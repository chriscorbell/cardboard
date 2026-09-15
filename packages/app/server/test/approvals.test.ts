import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import { approvalAwaitingRetry, type Approval } from "@cardboard/shared";

// The database module opens its file at import time, so point it at a scratch directory first.
const root = fs.mkdtempSync(path.join(os.tmpdir(), "cardboard-approvals-"));
process.env.CARDBOARD_DATA_DIR = root;
process.env.CARDBOARD_PUBLIC_URL = "https://kardboard.test";

const { db, schema, runMigrations } = await import("../src/db/index.js");
const { ApprovalError, followUpFor, listApprovals, retryMerge } = await import("../src/services/approvals.js");

await runMigrations();
after(() => fs.rmSync(root, { recursive: true, force: true }));

const BOARD = "board-1";
const USER = "user-1";
const MENTION = "@chris";

let n = 0;
async function makeCard(column: "review" | "done" = "review"): Promise<string> {
  const id = `card-${n++}`;
  await db.insert(schema.cards).values({ id, boardId: BOARD, title: "A card", column, branch: `cardboard/${id}`, prNumber: 42, prUrl: "https://github.com/chriscorbell/kardboard/pull/42" });
  return id;
}

async function makeApproval(cardId: string, fields: Partial<typeof schema.approvals.$inferInsert> = {}): Promise<string> {
  const id = `approval-${n++}`;
  await db.insert(schema.approvals).values({ id, cardId, userId: USER, prNumber: 42, headSha: "a".repeat(40), ...fields });
  return id;
}

beforeEach(async () => {
  for (const t of [schema.approvals, schema.events, schema.comments, schema.cards, schema.boards, schema.users]) await db.delete(t);
  await db.insert(schema.boards).values({ id: BOARD, slug: "board-1", name: "Board one", repoUrl: "https://github.com/chriscorbell/kardboard" });
  await db.insert(schema.users).values({ id: USER, email: "chris@example.com", handle: "chris", name: "Chris", role: "admin", status: "active" });
});

describe("what a merge outcome means for the approval it was made on", () => {
  it("merges", () => {
    assert.deepEqual(followUpFor({ ok: true, sha: "abc" }, 42, MENTION), { kind: "merged", sha: "abc" });
  });

  it("voids the approval when the head moved, and asks for a fresh look rather than a retry", () => {
    const followUp = followUpFor({ ok: false, reason: "head_changed", message: "head changed" }, 42, MENTION);
    assert.equal(followUp.kind, "invalidated");
    assert.equal(followUp.kind === "invalidated" && followUp.rerun, false);
    assert.match(followUp.kind === "invalidated" ? followUp.comment : "", /approve once more/);
  });

  it("voids the approval and sends a session to update a branch that cannot merge", () => {
    const followUp = followUpFor({ ok: false, reason: "not_mergeable", message: "not mergeable" }, 42, MENTION);
    assert.equal(followUp.kind, "invalidated");
    assert.equal(followUp.kind === "invalidated" && followUp.rerun, true);
    assert.equal(followUp.kind === "invalidated" && followUp.rerun === true ? followUp.reason : "", "not mergeable");
  });

  it("keeps the approval standing for a refusal of GitHub's own, and offers a retry", () => {
    const followUp = followUpFor({ ok: false, reason: "error", message: "403 Required status check is failing" }, 42, MENTION);
    assert.equal(followUp.kind, "refused");
    assert.equal(followUp.kind === "refused" ? followUp.error : "", "403 Required status check is failing");
    assert.match(followUp.kind === "refused" ? followUp.comment : "", /Retry merge/);
  });
});

describe("the approval a card offers a retry on", () => {
  const approval = (fields: Partial<Approval>): Approval => ({
    id: `a-${n++}`,
    cardId: "card",
    userId: USER,
    prNumber: 42,
    headSha: "a".repeat(40),
    createdAt: "2026-09-15T04:00:00.000Z",
    invalidatedAt: null,
    mergeError: null,
    ...fields,
  });

  it("is the standing one whose merge GitHub refused", () => {
    const refused = approval({ mergeError: "403 Resource not accessible" });
    assert.equal(approvalAwaitingRetry([approval({}), refused])?.id, refused.id);
  });

  it("is nothing when the approval merged cleanly or was never tried", () => {
    assert.equal(approvalAwaitingRetry([approval({})]), null);
    assert.equal(approvalAwaitingRetry([]), null);
  });

  it("is nothing when the refusal voided the approval, since that needs a fresh sign-off", () => {
    assert.equal(approvalAwaitingRetry([approval({ mergeError: "403", invalidatedAt: "2026-09-15T04:05:00.000Z" })]), null);
  });

  it("is the newest one, as the server lists them", async () => {
    const cardId = await makeCard();
    await makeApproval(cardId, { createdAt: "2026-09-15T04:00:00.000Z", invalidatedAt: "2026-09-15T04:01:00.000Z" });
    const second = await makeApproval(cardId, { createdAt: "2026-09-15T04:02:00.000Z", mergeError: "403 Resource not accessible" });
    assert.equal(approvalAwaitingRetry(await listApprovals(cardId))?.id, second);
  });
});

describe("retrying a refused merge", () => {
  const actor = { kind: "user", id: USER } as const;

  it("refuses when no approval is waiting on a refused merge", async () => {
    const cardId = await makeCard();
    await makeApproval(cardId);
    await assert.rejects(retryMerge(cardId, actor), (err: Error) => err instanceof ApprovalError && /waiting on a refused merge/.test(err.message));
  });

  it("refuses when the refusal already voided the approval", async () => {
    const cardId = await makeCard();
    await makeApproval(cardId, { mergeError: "403", invalidatedAt: "2026-09-15T04:05:00.000Z" });
    await assert.rejects(retryMerge(cardId, actor), (err: Error) => err instanceof ApprovalError && /waiting on a refused merge/.test(err.message));
  });

  it("refuses once the card has left Review", async () => {
    const cardId = await makeCard("done");
    await makeApproval(cardId, { mergeError: "403 Resource not accessible" });
    await assert.rejects(retryMerge(cardId, actor), (err: Error) => err instanceof ApprovalError && /in Review/.test(err.message));
  });

  it("refuses when the board has no merge app to merge with", async () => {
    const cardId = await makeCard();
    await makeApproval(cardId, { mergeError: "403 Resource not accessible" });
    await assert.rejects(retryMerge(cardId, actor), (err: Error) => err instanceof ApprovalError && /merge app/.test(err.message));
  });

  it("needs a signed-in user, since the retry is a member's act", async () => {
    const cardId = await makeCard();
    await makeApproval(cardId, { mergeError: "403 Resource not accessible" });
    await assert.rejects(retryMerge(cardId, { kind: "agent", id: null }), (err: Error) => err instanceof ApprovalError && /signed-in user/.test(err.message));
  });
});
