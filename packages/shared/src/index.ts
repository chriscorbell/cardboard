import { z } from "zod";

// Columns are fixed in v1. Order matters: it is the board's left-to-right order.
export const COLUMNS = ["inbox", "blocked", "ready", "in_progress", "review", "done"] as const;
export type Column = (typeof COLUMNS)[number];
export const columnSchema = z.enum(COLUMNS);

export const COLUMN_LABELS: Record<Column, string> = {
  inbox: "Inbox",
  blocked: "Blocked",
  ready: "Ready",
  in_progress: "In progress",
  review: "Review",
  done: "Done",
};

export const PRIORITIES = ["none", "low", "medium", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const prioritySchema = z.enum(PRIORITIES);

export const PROVIDERS = ["claude", "codex"] as const;
export type Provider = (typeof PROVIDERS)[number];
export const providerSchema = z.enum(PROVIDERS);

export const PREVIEW_MODES = ["external", "runner"] as const;
export type PreviewMode = (typeof PREVIEW_MODES)[number];

export const USER_ROLES = ["admin", "member"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["invited", "active", "revoked"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const SESSION_KINDS = ["card", "sweep"] as const;
export type SessionKind = (typeof SESSION_KINDS)[number];

export const SESSION_STATUSES = [
  "queued",
  "starting",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "timed_out",
] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];
export const ACTIVE_SESSION_STATUSES: readonly SessionStatus[] = ["queued", "starting", "running"];

export const TRIGGER_KINDS = [
  "card_created",
  "card_edited",
  "card_moved",
  "comment_posted",
  "comment_edited",
  "approval",
] as const;
export type TriggerKind = (typeof TRIGGER_KINDS)[number];

export type ActorKind = "user" | "agent" | "system";

export interface User {
  id: string;
  email: string;
  handle: string;
  name: string;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export interface Board {
  id: string;
  slug: string;
  name: string;
  repoUrl: string | null;
  provider: Provider;
  previewMode: PreviewMode;
  agentImage: string | null;
  maxConcurrentSessions: number;
  promptAppend: string;
  createdAt: string;
}

export interface Card {
  id: string;
  boardId: string;
  title: string;
  description: string;
  priority: Priority;
  column: Column;
  position: number;
  creatorKind: ActorKind;
  creatorId: string | null;
  parentCardId: string | null;
  revision: number;
  branch: string | null;
  prUrl: string | null;
  prNumber: number | null;
  previewUrl: string | null;
  commentCount: number;
  activeSession: SessionSummary | null;
  pendingRerun: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SessionSummary {
  id: string;
  kind: SessionKind;
  status: SessionStatus;
  provider: Provider;
  intent: string | null;
  branch: string | null;
  cardId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  outcomeSummary: string | null;
  createdAt: string;
}

export interface Attachment {
  id: string;
  commentId: string;
  filename: string;
  mime: string;
  size: number;
  createdAt: string;
}

export interface Comment {
  id: string;
  cardId: string;
  authorKind: ActorKind;
  authorId: string | null;
  sessionId: string | null;
  body: string;
  editedAt: string | null;
  createdAt: string;
  attachments: Attachment[];
  mentions: string[];
}

export interface ActivityEntry {
  id: string;
  type: string;
  actorKind: ActorKind;
  actorId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface Approval {
  id: string;
  cardId: string;
  userId: string;
  prNumber: number | null;
  headSha: string | null;
  createdAt: string;
  invalidatedAt: string | null;
}

export interface AgentProfile {
  name: string;
  avatarUrl: string | null;
}

export interface BoardView {
  board: Board;
  cards: Card[];
  members: User[];
  sessions: SessionSummary[];
  agent: AgentProfile;
}

export interface CardDetail {
  card: Card;
  comments: Comment[];
  activity: ActivityEntry[];
  approvals: Approval[];
  children: Card[];
}

export interface Me {
  user: User;
  agent: AgentProfile;
  authMode: "dev" | "clerk";
}

// ---- request schemas ----

export const createCardSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(20_000).default(""),
  priority: prioritySchema.default("none"),
  column: columnSchema.default("inbox"),
  silent: z.boolean().optional(),
});
export type CreateCardInput = z.infer<typeof createCardSchema>;

export const updateCardSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(20_000).optional(),
  priority: prioritySchema.optional(),
  revision: z.number().int().nonnegative(),
  silent: z.boolean().optional(),
});
export type UpdateCardInput = z.infer<typeof updateCardSchema>;

export const moveCardSchema = z.object({
  column: columnSchema,
  position: z.number(),
  revision: z.number().int().nonnegative(),
  silent: z.boolean().optional(),
});
export type MoveCardInput = z.infer<typeof moveCardSchema>;

export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(20_000),
  silent: z.boolean().optional(),
});
export const updateCommentSchema = z.object({
  body: z.string().trim().min(1).max(20_000),
});

export const inviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(120),
  role: z.enum(USER_ROLES).default("member"),
});

export const upsertBoardSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "lowercase letters, digits, and hyphens"),
  repoUrl: z.string().url().nullable().optional(),
  provider: providerSchema.default("claude"),
  previewMode: z.enum(PREVIEW_MODES).default("external"),
  agentImage: z.string().trim().max(200).nullable().optional(),
  maxConcurrentSessions: z.number().int().min(1).max(10).default(3),
  promptAppend: z.string().max(10_000).default(""),
});

export const boardMembersSchema = z.object({ userIds: z.array(z.string()) });

export const settingsSchema = z.object({
  agentName: z.string().trim().min(1).max(40).optional(),
  agentAvatarUrl: z.string().url().nullable().optional(),
  globalMaxConcurrentSessions: z.number().int().min(1).max(20).optional(),
  sessionWallClockMinutes: z.number().int().min(5).max(240).optional(),
});
export type Settings = {
  agentName: string;
  agentAvatarUrl: string | null;
  globalMaxConcurrentSessions: number;
  sessionWallClockMinutes: number;
};

// ---- realtime ----
export type BoardEvent =
  | { type: "card.upserted"; card: Card }
  | { type: "card.removed"; cardId: string }
  | { type: "comment.upserted"; comment: Comment }
  | { type: "session.updated"; session: SessionSummary }
  | { type: "board.updated"; board: Board };

// Mentions are @handle tokens. Handles are lowercase, from the user's email local part.
export const MENTION_RE = /(^|[^\w@])@([a-z0-9][a-z0-9._-]{0,38})/gi;

export function extractMentionHandles(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(MENTION_RE)) out.add(m[2]!.toLowerCase());
  return [...out];
}

export function slugifyBranch(cardId: string, title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `cardboard/${cardId.slice(0, 8)}-${base || "card"}`;
}
