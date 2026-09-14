import { sqliteTable, text, integer, real, primaryKey, index } from "drizzle-orm/sqlite-core";

const now = () => new Date().toISOString();

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  handle: text("handle").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  status: text("status", { enum: ["invited", "active", "revoked"] }).notNull().default("invited"),
  clerkUserId: text("clerk_user_id").unique(),
  createdAt: text("created_at").notNull().$defaultFn(now),
});

export const boards = sqliteTable("boards", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  repoUrl: text("repo_url"),
  provider: text("provider", { enum: ["claude", "codex"] }).notNull().default("claude"),
  previewMode: text("preview_mode", { enum: ["external", "runner"] }).notNull().default("external"),
  agentImage: text("agent_image"),
  maxConcurrentSessions: integer("max_concurrent_sessions").notNull().default(3),
  promptAppend: text("prompt_append").notNull().default(""),
  createdAt: text("created_at").notNull().$defaultFn(now),
});

export const boardMembers = sqliteTable(
  "board_members",
  {
    boardId: text("board_id").notNull().references(() => boards.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().$defaultFn(now),
  },
  (t) => [primaryKey({ columns: [t.boardId, t.userId] })],
);

export const cards = sqliteTable(
  "cards",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id").notNull().references(() => boards.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    priority: text("priority", { enum: ["none", "low", "medium", "high"] }).notNull().default("none"),
    column: text("column", { enum: ["inbox", "blocked", "ready", "in_progress", "review", "done"] })
      .notNull()
      .default("inbox"),
    position: real("position").notNull().default(0),
    creatorKind: text("creator_kind", { enum: ["user", "agent", "system"] }).notNull().default("user"),
    creatorId: text("creator_id"),
    parentCardId: text("parent_card_id"),
    revision: integer("revision").notNull().default(0),
    branch: text("branch"),
    prUrl: text("pr_url"),
    prNumber: integer("pr_number"),
    previewUrl: text("preview_url"),
    pendingRerun: integer("pending_rerun", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().$defaultFn(now),
    updatedAt: text("updated_at").notNull().$defaultFn(now),
  },
  (t) => [index("cards_board_column_idx").on(t.boardId, t.column)],
);

export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    cardId: text("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
    authorKind: text("author_kind", { enum: ["user", "agent", "system"] }).notNull(),
    authorId: text("author_id"),
    sessionId: text("session_id"),
    body: text("body").notNull(),
    editedAt: text("edited_at"),
    createdAt: text("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("comments_card_idx").on(t.cardId)],
);

export const commentRevisions = sqliteTable("comment_revisions", {
  id: text("id").primaryKey(),
  commentId: text("comment_id").notNull().references(() => comments.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  replacedAt: text("replaced_at").notNull().$defaultFn(now),
});

export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  commentId: text("comment_id").notNull().references(() => comments.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  sha256: text("sha256").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(now),
});

export const mentions = sqliteTable(
  "mentions",
  {
    commentId: text("comment_id").notNull().references(() => comments.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    notifiedAt: text("notified_at"),
  },
  (t) => [primaryKey({ columns: [t.commentId, t.userId] })],
);

export const approvals = sqliteTable("approvals", {
  id: text("id").primaryKey(),
  cardId: text("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  prNumber: integer("pr_number"),
  headSha: text("head_sha"),
  createdAt: text("created_at").notNull().$defaultFn(now),
  invalidatedAt: text("invalidated_at"),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id").notNull().references(() => boards.id, { onDelete: "cascade" }),
    cardId: text("card_id"),
    kind: text("kind", { enum: ["card", "sweep"] }).notNull().default("card"),
    provider: text("provider", { enum: ["claude", "codex"] }).notNull(),
    status: text("status", {
      enum: ["queued", "starting", "running", "succeeded", "failed", "cancelled", "timed_out"],
    })
      .notNull()
      .default("queued"),
    intent: text("intent"),
    branch: text("branch"),
    containerId: text("container_id"),
    tokenHash: text("token_hash"),
    startedAt: text("started_at"),
    endedAt: text("ended_at"),
    outcomeSummary: text("outcome_summary"),
    createdAt: text("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("sessions_board_status_idx").on(t.boardId, t.status)],
);

export const triggers = sqliteTable(
  "triggers",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id").notNull(),
    cardId: text("card_id").notNull(),
    kind: text("kind").notNull(),
    actorUserId: text("actor_user_id"),
    payload: text("payload", { mode: "json" }).notNull().$type<Record<string, unknown>>(),
    status: text("status", { enum: ["pending", "consumed"] }).notNull().default("pending"),
    sessionId: text("session_id"),
    createdAt: text("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("triggers_card_status_idx").on(t.cardId, t.status)],
);

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id").notNull(),
    cardId: text("card_id"),
    actorKind: text("actor_kind", { enum: ["user", "agent", "system"] }).notNull(),
    actorId: text("actor_id"),
    type: text("type").notNull(),
    payload: text("payload", { mode: "json" }).notNull().$type<Record<string, unknown>>(),
    createdAt: text("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("events_card_idx").on(t.cardId), index("events_board_idx").on(t.boardId)],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const outboundEmails = sqliteTable("outbound_emails", {
  id: text("id").primaryKey(),
  toUserId: text("to_user_id").notNull(),
  subject: text("subject").notNull(),
  html: text("html").notNull(),
  status: text("status", { enum: ["pending", "sent", "failed", "logged"] }).notNull().default("pending"),
  error: text("error"),
  createdAt: text("created_at").notNull().$defaultFn(now),
  sentAt: text("sent_at"),
});
