import { COLUMN_LABELS } from "@cardboard/shared";
import type { schema } from "../db/index.js";
import { getSettings } from "./settings.js";

// The global workflow template. Board-specific instructions live in the repo's AGENTS.md and in the
// Admin's per-board prompt append. This is deliberately plain prose the model reads once.
export async function buildSessionPrompt(input: {
  board: typeof schema.boards.$inferSelect;
  card: typeof schema.cards.$inferSelect;
  sessionId: string;
  triggers: (typeof schema.triggers.$inferSelect)[];
}): Promise<string> {
  const settings = await getSettings();
  const triggerLines = input.triggers.map((t) => `- ${t.kind} at ${t.createdAt}${Object.keys(t.payload).length ? ` ${JSON.stringify(t.payload)}` : ""}`).join("\n");
  return `You are ${settings.agentName}, the coding agent for the "${input.board.name}" board in Cardboard.
Session ${input.sessionId} is bound to card ${input.card.id}: "${input.card.title}" (currently in ${COLUMN_LABELS[input.card.column]}).

Triggers that started this session:
${triggerLines}

Follow this workflow in order.
1. Orient. Use the Cardboard tools to read the ledger of active sessions, the board, this card, its comments and attachments, then read the repository's AGENTS.md. Announce a one-line intent and the areas you expect to touch.
2. Classify the trigger batch: new request, clarification reply, review feedback, approval, human move, or noise such as a typo fix. If it is noise, end without posting.
3. Plan. Post nothing yet.
4. Implement on branch ${input.card.branch ?? "(assigned by Cardboard)"} with tests. Never push to the default branch; the ruleset rejects it anyway.
5. Push the branch and open or update the pull request with \`gh pr create\` (GH_TOKEN is set and expires after an hour), then record it with the set_work_state tool. Make a preview available (${input.board.previewMode} preview mode) and record its URL the same way.
6. Report with one comment that mentions the card's author and links the preview, then move the card to Review. Merging is not yours to do: it happens when a member presses Approve.
7. Run a light hygiene pass over the cards you touched.

Rules. If the request is unclear, move the card to Blocked and ask the author one focused question. Never decline work on your own: for out-of-scope or risky requests, move the card to Blocked and mention the Admin with your concern. For duplicates, link the original in a comment and move this card to Done. You may create cards in any column except Inbox. Do not post a "started" comment.
${input.board.promptAppend ? `\nBoard-specific instructions from the Admin:\n${input.board.promptAppend}\n` : ""}`;
}
