import { desc, eq } from "drizzle-orm";
import type { Approval } from "@cardboard/shared";
import { db, schema } from "../db/index.js";
import { newId } from "../ids.js";
import { recordEvent, type Actor } from "./events.js";
import { getCard } from "./cards.js";
import { closeCardWork, enqueueTrigger } from "./orchestrator.js";
import { publish } from "./realtime.js";
import { getBoardById } from "./boards.js";
import { createComment } from "./comments.js";
import { moveCard, setCardWorkState } from "./cards.js";
import { getUser } from "./users.js";
import { deleteBranch, findPullRequestByBranch, getPullRequest, githubConfigured, mergePullRequest, parseRepoUrl, type MergeOutcome, type PullRequest } from "./github.js";

function toApproval(row: typeof schema.approvals.$inferSelect): Approval {
  return {
    id: row.id,
    cardId: row.cardId,
    userId: row.userId,
    prNumber: row.prNumber,
    headSha: row.headSha,
    createdAt: row.createdAt,
    invalidatedAt: row.invalidatedAt,
    mergeError: row.mergeError,
  };
}

export async function listApprovals(cardId: string): Promise<Approval[]> {
  const rows = await db.select().from(schema.approvals).where(eq(schema.approvals.cardId, cardId)).orderBy(desc(schema.approvals.createdAt));
  return rows.map(toApproval);
}

export class ApprovalError extends Error {
  status = 400;
}

const AGENT: Actor = { kind: "agent", id: null };

type CardRow = NonNullable<Awaited<ReturnType<typeof getCard>>>;

async function resolvePullRequest(card: { prNumber: number | null; branch: string | null }, owner: string, repo: string): Promise<PullRequest | null> {
  if (card.prNumber) return getPullRequest(owner, repo, card.prNumber);
  if (card.branch) return findPullRequestByBranch(owner, repo, card.branch);
  return null;
}

/**
 * What a merge attempt means for the Approval it was made on: whether the Approval survives, what
 * the Card is told, and whether a Session is asked to bring the branch up to date. A refusal
 * GitHub gave for some other reason — a required check, a protected path, a rate limit — leaves
 * the Approval standing, because the Member's sign-off is still good for that head.
 */
export type MergeFollowUp =
  | { kind: "merged"; sha: string }
  | { kind: "invalidated"; comment: string; rerun: false }
  | { kind: "invalidated"; comment: string; rerun: true; reason: string }
  | { kind: "refused"; comment: string; error: string };

export function followUpFor(outcome: MergeOutcome, prNumber: number, mention: string): MergeFollowUp {
  if (outcome.ok) return { kind: "merged", sha: outcome.sha };
  if (outcome.reason === "head_changed") {
    return { kind: "invalidated", rerun: false, comment: `${mention} The branch changed after you approved, so nothing was merged. Please look at the preview again and approve once more if it still looks right.`.trim() };
  }
  if (outcome.reason === "not_mergeable") {
    // A Session gets the approval trigger so it can rebase. Its push changes the head, which needs a fresh Approval.
    return {
      kind: "invalidated",
      rerun: true,
      reason: outcome.message,
      comment: `${mention} Pull request #${prNumber} can't be merged as it stands (${outcome.message}). I'll bring the branch up to date and ask you to approve again.`.trim(),
    };
  }
  return { kind: "refused", error: outcome.message, comment: `${mention} GitHub refused the merge: ${outcome.message}. Your approval still stands — press Retry merge on this card once the cause is fixed.`.trim() };
}

// Merge on a recorded Approval, sending the head the Member reviewed as GitHub's precondition, and
// carry out whatever the outcome means for the Card. Shared by the Approve control and Retry merge.
async function mergeOnApproval(input: { card: CardRow; approvalId: string; pr: PullRequest; headSha: string; repo: { owner: string; repo: string }; mention: string; actorUserId: string }): Promise<void> {
  const { card, approvalId, pr, repo, mention } = input;
  const outcome = await mergePullRequest(repo.owner, repo.repo, pr.number, input.headSha, `${pr.title} (#${pr.number})`, pr.body);
  const followUp = followUpFor(outcome, pr.number, mention);

  if (followUp.kind === "merged") {
    await db.update(schema.approvals).set({ mergeError: null }).where(eq(schema.approvals.id, approvalId));
    await recordEvent({ boardId: card.boardId, cardId: card.id, actor: AGENT, type: "card.merged", payload: { prNumber: pr.number, mergeSha: followUp.sha } });
    await deleteBranch(repo.owner, repo.repo, pr.headRef).catch(() => {});
    // The merge is the end of this card's work: a Session still running on it must not reopen it.
    await closeCardWork(card.id, AGENT);
    const fresh = (await getCard(card.id))!;
    await moveCard(card.id, { column: "done", position: fresh.position, revision: fresh.revision, actor: AGENT });
    await createComment({ cardId: card.id, body: `${mention} Merged pull request #${pr.number} and moved this card to Done.`.trim(), actor: AGENT });
    return;
  }

  if (followUp.kind === "invalidated") {
    await db.update(schema.approvals).set({ invalidatedAt: new Date().toISOString(), mergeError: null }).where(eq(schema.approvals.id, approvalId));
    await createComment({ cardId: card.id, body: followUp.comment, actor: AGENT });
    if (followUp.rerun) await enqueueTrigger({ card, kind: "approval", actorUserId: input.actorUserId, payload: { approvalId, reason: followUp.reason } });
    return;
  }

  await db.update(schema.approvals).set({ mergeError: followUp.error }).where(eq(schema.approvals.id, approvalId));
  await recordEvent({ boardId: card.boardId, cardId: card.id, actor: AGENT, type: "card.merge_refused", payload: { prNumber: pr.number, error: followUp.error } });
  await createComment({ cardId: card.id, body: followUp.comment, actor: AGENT });
}

// Approval is recorded against the pull request head the Member reviewed, and the merge is
// attempted by the app itself with that SHA as a precondition. See ADR 0006 and ADR 0008.
export async function approveCard(cardId: string, actor: Actor): Promise<Approval> {
  const card = await getCard(cardId);
  if (!card) throw new Error("card not found");
  if (card.column !== "review") throw new ApprovalError("Only cards in Review can be approved.");
  if (!actor.id) throw new ApprovalError("Approval needs a signed-in user.");
  const board = (await getBoardById(card.boardId))!;
  const repo = parseRepoUrl(board.repoUrl);
  const mention = await mentionFor(actor.id);

  let pr: PullRequest | null = null;
  if (repo && githubConfigured("merge")) {
    pr = await resolvePullRequest(card, repo.owner, repo.repo);
    if (!pr || pr.state !== "open") throw new ApprovalError("No open pull request is linked to this card yet, so there is nothing to approve.");
    if (pr.number !== card.prNumber || pr.url !== card.prUrl) await setCardWorkState(card.id, { prNumber: pr.number, prUrl: pr.url });
  }

  const id = newId();
  await db.insert(schema.approvals).values({ id, cardId, userId: actor.id, prNumber: pr?.number ?? card.prNumber, headSha: pr?.headSha ?? null });
  await recordEvent({ boardId: card.boardId, cardId, actor, type: "card.approved", payload: { approvalId: id, prNumber: pr?.number ?? card.prNumber, headSha: pr?.headSha ?? null } });
  publish(card.boardId, { type: "card.upserted", card: (await getCard(cardId))! });

  if (!pr || !repo) {
    // No GitHub integration for this board: the Session handles the approval as before.
    await enqueueTrigger({ card, kind: "approval", actorUserId: actor.id, payload: { approvalId: id } });
  } else {
    await mergeOnApproval({ card, approvalId: id, pr, headSha: pr.headSha, repo, mention, actorUserId: actor.id });
  }
  return (await readApproval(id))!;
}

/**
 * Try the merge again on an Approval GitHub refused for a reason that left it standing. The head
 * the Member reviewed is still the precondition, so a push in the meantime fails the retry and
 * asks for a fresh Approval rather than merging something nobody saw.
 */
export async function retryMerge(cardId: string, actor: Actor): Promise<Approval> {
  const card = await getCard(cardId);
  if (!card) throw new Error("card not found");
  if (!actor.id) throw new ApprovalError("Retrying a merge needs a signed-in user.");
  if (card.column !== "review") throw new ApprovalError("Only cards in Review can be merged.");

  const approval = (await listApprovals(cardId)).find((a) => !a.invalidatedAt && a.mergeError);
  if (!approval) throw new ApprovalError("No approval on this card is waiting on a refused merge.");

  const board = (await getBoardById(card.boardId))!;
  const repo = parseRepoUrl(board.repoUrl);
  if (!repo || !githubConfigured("merge")) throw new ApprovalError("This board has no GitHub merge app configured, so kardboard cannot merge for you.");

  const pr = await resolvePullRequest(card, repo.owner, repo.repo);
  if (!pr || pr.state !== "open") throw new ApprovalError("No open pull request is linked to this card, so there is nothing to merge.");
  if (approval.prNumber && pr.number !== approval.prNumber) {
    await db.update(schema.approvals).set({ invalidatedAt: new Date().toISOString(), mergeError: null }).where(eq(schema.approvals.id, approval.id));
    throw new ApprovalError(`The approval was given for pull request #${approval.prNumber}, which is no longer the one on this card. Please review #${pr.number} and approve it.`);
  }

  const mention = await mentionFor(actor.id);
  await recordEvent({ boardId: card.boardId, cardId, actor, type: "card.merge_retried", payload: { approvalId: approval.id, prNumber: pr.number } });
  await mergeOnApproval({ card, approvalId: approval.id, pr, headSha: approval.headSha ?? pr.headSha, repo, mention, actorUserId: actor.id });
  return (await readApproval(approval.id))!;
}

async function mentionFor(userId: string): Promise<string> {
  const user = await getUser(userId);
  return user ? `@${user.handle}` : "";
}

async function readApproval(id: string): Promise<Approval | null> {
  const row = await db.select().from(schema.approvals).where(eq(schema.approvals.id, id)).get();
  return row ? toApproval(row) : null;
}
