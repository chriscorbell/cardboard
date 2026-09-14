import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { env } from "../env.js";
import { endSession } from "../services/orchestrator.js";

// Called by the runner when a container exits. Authenticated with the shared runner token.
export const internal = new Hono();

internal.use("*", async (c, next) => {
  const header = c.req.header("authorization") ?? "";
  if (!env.runnerToken || header !== `Bearer ${env.runnerToken}`) return c.json({ error: "unauthorized" }, 401);
  await next();
});

// Runner-hosted previews are not built yet; the router polls this and gets an empty table.
internal.get("/previews", (c) => c.json([]));

internal.post("/sessions/:id/exit", zValidator("json", z.object({ exitCode: z.number().int(), reason: z.string().optional() })), async (c) => {
  const { exitCode, reason } = c.req.valid("json");
  await endSession(c.req.param("id"), exitCode === 0 ? "succeeded" : "failed", reason ?? (exitCode === 0 ? "Container exited cleanly." : `Container exited with code ${exitCode}.`));
  return c.json({ ok: true });
});
