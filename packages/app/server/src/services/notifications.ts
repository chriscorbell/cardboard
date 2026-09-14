import { COLUMN_LABELS, type Card } from "@cardboard/shared";
import { env } from "../env.js";
import type { Actor } from "./events.js";
import { getBoardById } from "./boards.js";
import { getUser } from "./users.js";
import { getAgentProfile } from "./settings.js";
import { queueEmail } from "./email.js";

// The Card's creator hears about column moves they did not make themselves.
export async function notifyCardMoved(card: Card, from: Card["column"], actor: Actor): Promise<void> {
  if (card.creatorKind !== "user" || !card.creatorId) return;
  if (actor.kind === "user" && actor.id === card.creatorId) return;
  const creator = await getUser(card.creatorId);
  if (!creator || creator.status === "revoked") return;
  const board = await getBoardById(card.boardId);
  if (!board) return;
  const who = actor.kind === "agent" ? (await getAgentProfile()).name : actor.kind === "user" && actor.id ? ((await getUser(actor.id))?.name ?? "Someone") : "Cardboard";
  await queueEmail({
    toUserId: creator.id,
    subject: `"${card.title}" moved to ${COLUMN_LABELS[card.column]}`,
    heading: `${who} moved your card to ${COLUMN_LABELS[card.column]}`,
    body: `${card.title}\n\n${COLUMN_LABELS[from]} → ${COLUMN_LABELS[card.column]}`,
    linkUrl: `${env.publicUrl}/b/${board.slug}/c/${card.id}`,
    linkLabel: "Open the card",
  });
}
