import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { zValidator } from "@hono/zod-validator";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  boardMembersSchema,
  createCardSchema,
  createCommentSchema,
  inviteUserSchema,
  markNotificationsReadSchema,
  moveCardSchema,
  settingsSchema,
  updateCardSchema,
  updateCommentSchema,
  upsertBoardSchema,
  type BoardView,
  type CardDetail,
  type Me,
} from "@cardboard/shared";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { env } from "../env.js";
import { refreshFromClerk, requireAdmin, requireUser, type AuthVariables } from "../auth.js";
import { canAccessBoard, createBoard, getBoardById, getBoardBySlug, listAllBoards, listBoardsForUser, listMembers, setMembers, updateBoard } from "../services/boards.js";
import { ConflictError, createCard, getCard, listCards, listChildren, moveCard, updateCard } from "../services/cards.js";
import { addAttachment, createComment, getAttachment, getComment, listComments, updateComment } from "../services/comments.js";
import { getAgentProfile, getSettings, updateSettings } from "../services/settings.js";
import { inviteUser, listUsers, setUserStatus } from "../services/users.js";
import { subscribe } from "../services/realtime.js";
import { cancelSession, listAllSessions, listBoardSessions } from "../services/orchestrator.js";
import { ApprovalError, approveCard, listApprovals } from "../services/approvals.js";
import { listNotifications, markNotificationsRead } from "../services/notifications.js";
import { backupsView, takeSnapshot } from "../services/backup.js";
import { installationStatus, parseRepoUrl } from "../services/github.js";

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export const api = new Hono<{ Variables: AuthVariables }>();

api.use("*", requireUser);

function actorOf(c: { get: (k: "user") => { id: string } }) {
  return { kind: "user" as const, id: c.get("user").id };
}

async function boardForUser(c: Parameters<typeof actorOf>[0] & { json: (b: unknown, s: 403 | 404) => Response }, boardId: string) {
  const board = await getBoardById(boardId);
  if (!board) return { error: c.json({ error: "not_found" }, 404) };
  if (!(await canAccessBoard(c.get("user") as never, board.id))) return { error: c.json({ error: "forbidden" }, 403) };
  return { board };
}

api.get("/me", async (c) => {
  const me: Me = { user: c.get("user"), agent: await getAgentProfile(), authMode: env.authMode };
  return c.json(me);
});

api.post("/me/refresh", async (c) => {
  const user = await refreshFromClerk(c.get("user"));
  const me: Me = { user, agent: await getAgentProfile(), authMode: env.authMode };
  return c.json(me);
});

api.get("/boards", async (c) => c.json(await listBoardsForUser(c.get("user"))));

api.get("/notifications", async (c) => c.json(await listNotifications(c.get("user"))));

// An empty body means "mark everything read"; a list of ids marks just those.
api.post("/notifications/read", async (c) => {
  const parsed = markNotificationsReadSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid" }, 400);
  return c.json(await markNotificationsRead(c.get("user"), parsed.data.ids));
});

api.get("/boards/:slug", async (c) => {
  const board = await getBoardBySlug(c.req.param("slug"));
  if (!board) return c.json({ error: "not_found" }, 404);
  if (!(await canAccessBoard(c.get("user"), board.id))) return c.json({ error: "forbidden" }, 403);
  const view: BoardView = {
    board,
    cards: await listCards(board.id),
    members: await listMembers(board.id),
    sessions: await listBoardSessions(board.id, 20),
    agent: await getAgentProfile(),
  };
  return c.json(view);
});

api.get("/boards/:slug/events", async (c) => {
  const board = await getBoardBySlug(c.req.param("slug"));
  if (!board) return c.json({ error: "not_found" }, 404);
  if (!(await canAccessBoard(c.get("user"), board.id))) return c.json({ error: "forbidden" }, 403);
  return streamSSE(c, async (stream) => {
    let id = 0;
    const unsubscribe = subscribe(board.id, (event) => {
      void stream.writeSSE({ id: String(id++), event: event.type, data: JSON.stringify(event) });
    });
    stream.onAbort(unsubscribe);
    await stream.writeSSE({ event: "ready", data: "{}" });
    while (!stream.aborted) {
      await stream.sleep(25_000);
      await stream.writeSSE({ event: "ping", data: "{}" });
    }
  });
});

api.post("/boards/:slug/cards", zValidator("json", createCardSchema), async (c) => {
  const board = await getBoardBySlug(c.req.param("slug"));
  if (!board) return c.json({ error: "not_found" }, 404);
  if (!(await canAccessBoard(c.get("user"), board.id))) return c.json({ error: "forbidden" }, 403);
  const input = c.req.valid("json");
  const column = c.get("user").role === "admin" ? input.column : "inbox";
  const card = await createCard({ boardId: board.id, ...input, column, actor: actorOf(c) });
  return c.json(card, 201);
});

api.get("/cards/:id", async (c) => {
  const card = await getCard(c.req.param("id"));
  if (!card) return c.json({ error: "not_found" }, 404);
  const access = await boardForUser(c as never, card.boardId);
  if ("error" in access) return access.error;
  const detail: CardDetail = {
    card,
    comments: await listComments(card.id),
    activity: (
      await db.select().from(schema.events).where(eq(schema.events.cardId, card.id)).orderBy(desc(schema.events.createdAt)).limit(100)
    ).map((e) => ({ id: e.id, type: e.type, actorKind: e.actorKind, actorId: e.actorId, payload: e.payload, createdAt: e.createdAt })),
    approvals: await listApprovals(card.id),
    children: await listChildren(card.id),
  };
  return c.json(detail);
});

api.patch("/cards/:id", zValidator("json", updateCardSchema), async (c) => {
  const card = await getCard(c.req.param("id"));
  if (!card) return c.json({ error: "not_found" }, 404);
  const access = await boardForUser(c as never, card.boardId);
  if ("error" in access) return access.error;
  try {
    return c.json(await updateCard(card.id, { ...c.req.valid("json"), actor: actorOf(c) }));
  } catch (err) {
    if (err instanceof ConflictError) return c.json({ error: "conflict", card: await getCard(card.id) }, 409);
    throw err;
  }
});

api.post("/cards/:id/move", zValidator("json", moveCardSchema), async (c) => {
  const card = await getCard(c.req.param("id"));
  if (!card) return c.json({ error: "not_found" }, 404);
  const access = await boardForUser(c as never, card.boardId);
  if ("error" in access) return access.error;
  try {
    return c.json(await moveCard(card.id, { ...c.req.valid("json"), actor: actorOf(c) }));
  } catch (err) {
    if (err instanceof ConflictError) return c.json({ error: "conflict", card: await getCard(card.id) }, 409);
    throw err;
  }
});

api.post("/cards/:id/approve", async (c) => {
  const card = await getCard(c.req.param("id"));
  if (!card) return c.json({ error: "not_found" }, 404);
  const access = await boardForUser(c as never, card.boardId);
  if ("error" in access) return access.error;
  try {
    return c.json(await approveCard(card.id, actorOf(c)), 201);
  } catch (err) {
    if (err instanceof ApprovalError) return c.json({ error: err.message }, 400);
    throw err;
  }
});

api.post("/cards/:id/comments", zValidator("json", createCommentSchema), async (c) => {
  const card = await getCard(c.req.param("id"));
  if (!card) return c.json({ error: "not_found" }, 404);
  const access = await boardForUser(c as never, card.boardId);
  if ("error" in access) return access.error;
  const comment = await createComment({ cardId: card.id, ...c.req.valid("json"), actor: actorOf(c) });
  return c.json(comment, 201);
});

api.patch("/comments/:id", zValidator("json", updateCommentSchema), async (c) => {
  const comment = await getComment(c.req.param("id"));
  if (!comment) return c.json({ error: "not_found" }, 404);
  const user = c.get("user");
  if (!(comment.authorKind === "user" && comment.authorId === user.id)) return c.json({ error: "forbidden" }, 403);
  return c.json(await updateComment(comment.id, { body: c.req.valid("json").body, actor: actorOf(c) }));
});

api.post("/comments/:id/attachments", async (c) => {
  const comment = await getComment(c.req.param("id"));
  if (!comment) return c.json({ error: "not_found" }, 404);
  const card = (await getCard(comment.cardId))!;
  const access = await boardForUser(c as never, card.boardId);
  if ("error" in access) return access.error;
  const user = c.get("user");
  if (!(comment.authorKind === "user" && comment.authorId === user.id)) return c.json({ error: "forbidden" }, 403);
  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return c.json({ error: "file required" }, 400);
  if (file.size > MAX_ATTACHMENT_BYTES) return c.json({ error: "file exceeds 25 MB" }, 413);
  const bytes = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const dir = path.join(env.dataDir, "uploads", sha256.slice(0, 2));
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, sha256);
  if (!fs.existsSync(target)) fs.writeFileSync(target, bytes);
  const att = await addAttachment({
    commentId: comment.id,
    filename: file.name || "attachment",
    mime: file.type || "application/octet-stream",
    size: file.size,
    sha256,
  });
  return c.json(att, 201);
});

api.get("/attachments/:id", async (c) => {
  const att = await getAttachment(c.req.param("id"));
  if (!att) return c.json({ error: "not_found" }, 404);
  const card = (await getCard(att.cardId))!;
  const access = await boardForUser(c as never, card.boardId);
  if ("error" in access) return access.error;
  const file = path.join(env.dataDir, "uploads", att.sha256.slice(0, 2), att.sha256);
  if (!fs.existsSync(file)) return c.json({ error: "missing" }, 404);
  const inline = att.mime.startsWith("image/") ? "inline" : "attachment";
  return new Response(fs.createReadStream(file) as unknown as ReadableStream, {
    headers: {
      "Content-Type": att.mime,
      "Content-Length": String(att.size),
      "Content-Disposition": `${inline}; filename*=UTF-8''${encodeURIComponent(att.filename)}`,
      "Cache-Control": "private, max-age=3600",
    },
  });
});

// ---- admin ----
const admin = new Hono<{ Variables: AuthVariables }>();
admin.use("*", requireAdmin);

admin.get("/users", async (c) => c.json(await listUsers()));
admin.post("/users", zValidator("json", inviteUserSchema), async (c) => c.json(await inviteUser(c.req.valid("json")), 201));
admin.post("/users/:id/revoke", async (c) => {
  if (c.req.param("id") === c.get("user").id) return c.json({ error: "cannot revoke yourself" }, 400);
  await setUserStatus(c.req.param("id"), "revoked");
  return c.json({ ok: true });
});
admin.post("/users/:id/reinstate", async (c) => {
  await setUserStatus(c.req.param("id"), "invited");
  return c.json({ ok: true });
});

admin.get("/boards", async (c) => {
  const boards = await listAllBoards();
  const withMembers = await Promise.all(boards.map(async (b) => ({ ...b, memberIds: (await listMembers(b.id)).filter((m) => m.role !== "admin").map((m) => m.id) })));
  return c.json(withMembers);
});
admin.post("/boards", zValidator("json", upsertBoardSchema), async (c) => {
  if (await getBoardBySlug(c.req.valid("json").slug)) return c.json({ error: "slug already in use" }, 409);
  return c.json(await createBoard(c.req.valid("json")), 201);
});
admin.patch("/boards/:id", zValidator("json", upsertBoardSchema), async (c) => {
  const existing = await getBoardBySlug(c.req.valid("json").slug);
  if (existing && existing.id !== c.req.param("id")) return c.json({ error: "slug already in use" }, 409);
  return c.json(await updateBoard(c.req.param("id"), c.req.valid("json")));
});
admin.get("/boards/:id/github", async (c) => {
  const board = await getBoardById(c.req.param("id"));
  if (!board) return c.json({ error: "not_found" }, 404);
  const repo = parseRepoUrl(board.repoUrl);
  if (!repo) return c.json({ repo: null, sessions: "unconfigured", merge: "unconfigured" });
  return c.json({ repo: `${repo.owner}/${repo.repo}`, ...(await installationStatus(repo.owner, repo.repo)) });
});
admin.put("/boards/:id/members", zValidator("json", boardMembersSchema), async (c) => {
  await setMembers(c.req.param("id"), c.req.valid("json").userIds);
  return c.json({ ok: true });
});

admin.get("/settings", async (c) => c.json(await getSettings()));
admin.patch("/settings", zValidator("json", settingsSchema), async (c) => c.json(await updateSettings(c.req.valid("json"))));

admin.get("/backups", (c) => c.json(backupsView()));
admin.post("/backups", async (c) => {
  const { snapshot } = await takeSnapshot();
  return c.json({ ...backupsView(), snapshot }, 201);
});

admin.get("/sessions", async (c) => c.json(await listAllSessions()));
admin.post("/sessions/:id/cancel", async (c) => {
  const rerun = c.req.query("rerun") === "1";
  await cancelSession(c.req.param("id"), actorOf(c), rerun);
  return c.json({ ok: true });
});

api.route("/admin", admin);
