import { eq } from "drizzle-orm";
import type { Approval } from "@cardboard/shared";
import { db, schema } from "../db/index.js";
import { newId } from "../ids.js";
import { recordEvent, type Actor } from "./events.js";
import { getCard } from "./cards.js";
import { enqueueTrigger } from "./orchestrator.js";
import { publish } from "./realtime.js";

function toApproval(row: typeof schema.approvals.$inferSelect): Approval {
  return {
    id: row.id,
    cardId: row.cardId,
    userId: row.userId,
    prNumber: row.prNumber,
    headSha: row.headSha,
    createdAt: row.createdAt,
    invalidatedAt: row.invalidatedAt,
  };
}

export async function listApprovals(cardId: string): Promise<Approval[]> {
  const rows = await db.select().from(schema.approvals).where(eq(schema.approvals.cardId, cardId));
  return rows.map(toApproval);
}

export class ApprovalError extends Error {
  status = 400;
}

export async function approveCard(cardId: string, actor: Actor): Promise<Approval> {
  const card = await getCard(cardId);
  if (!card) throw new Error("card not found");
  if (card.column !== "review") throw new ApprovalError("Only cards in Review can be approved.");
  if (!actor.id) throw new ApprovalError("Approval needs a signed-in user.");
  const id = newId();
  // headSha is recorded by the Session that opened the PR; until GitHub integration lands it may be null.
  await db.insert(schema.approvals).values({ id, cardId, userId: actor.id, prNumber: card.prNumber, headSha: null });
  await recordEvent({ boardId: card.boardId, cardId, actor, type: "card.approved", payload: { approvalId: id, prNumber: card.prNumber } });
  publish(card.boardId, { type: "card.upserted", card: (await getCard(cardId))! });
  await enqueueTrigger({ card, kind: "approval", actorUserId: actor.id, payload: { approvalId: id } });
  const row = (await db.select().from(schema.approvals).where(eq(schema.approvals.id, id)).get())!;
  return toApproval(row);
}
