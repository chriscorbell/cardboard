import { serve } from "@hono/node-server";
import { Hono } from "hono";
import Docker from "dockerode";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { codexWiring } from "./codex.js";
import { readLogSlice } from "./logs.js";
import { buildAndRunPreview, PreviewError, removePreview, type PreviewRequest } from "./previews.js";

// The runner is the only process with the Docker socket. It knows how to do exactly two things:
// run a Session container from an approved image with fixed limits, and stop or remove one.
// It listens on the stack's internal network only and requires the shared token.

const env = {
  port: Number(process.env.PORT ?? "3071"),
  token: process.env.CARDBOARD_RUNNER_TOKEN ?? "",
  appUrl: (process.env.CARDBOARD_APP_URL ?? "http://app:3070").replace(/\/$/, ""),
  mcpUrl: (process.env.CARDBOARD_MCP_URL ?? "http://app:3070/mcp").replace(/\/$/, ""),
  egressUrl: (process.env.CARDBOARD_EGRESS_URL ?? "http://egress:8787").replace(/\/$/, ""),
  defaultImage: process.env.CARDBOARD_AGENT_IMAGE ?? "ghcr.io/chriscorbell/cardboard-agent:latest",
  workloadNetwork: process.env.CARDBOARD_WORKLOAD_NETWORK ?? "cardboard_workload",
  // Previews are branch-controlled code, so they get their own network: the router can reach them
  // and they can reach the internet, but not the app, the egress proxy, or the runner.
  previewNetwork: process.env.CARDBOARD_PREVIEW_NETWORK ?? "cardboard_preview",
  logDir: process.env.CARDBOARD_LOG_DIR ?? "/data/logs",
  logRetentionDays: Number(process.env.CARDBOARD_LOG_RETENTION_DAYS ?? "14"),
  memoryBytes: Number(process.env.CARDBOARD_SESSION_MEMORY_BYTES ?? String(4 * 1024 * 1024 * 1024)),
  nanoCpus: Number(process.env.CARDBOARD_SESSION_NANO_CPUS ?? String(2e9)),
  pidsLimit: Number(process.env.CARDBOARD_SESSION_PIDS_LIMIT ?? "1024"),
  previewMemoryBytes: Number(process.env.CARDBOARD_PREVIEW_MEMORY_BYTES ?? String(1024 * 1024 * 1024)),
  previewNanoCpus: Number(process.env.CARDBOARD_PREVIEW_NANO_CPUS ?? String(1e9)),
  previewPidsLimit: Number(process.env.CARDBOARD_PREVIEW_PIDS_LIMIT ?? "512"),
  // A path on the Docker host: the runner never opens it, it only names it in a bind.
  codexAuthFile: process.env.CODEX_AUTH_FILE ?? "",
  codexViaEgress: /^(1|true|yes)$/i.test(process.env.CARDBOARD_CODEX_VIA_EGRESS ?? ""),
};

if (!env.token) {
  console.error("CARDBOARD_RUNNER_TOKEN is required");
  process.exit(1);
}
fs.mkdirSync(env.logDir, { recursive: true });

const docker = new Docker({ socketPath: "/var/run/docker.sock" });
const app = new Hono();

app.use("*", async (c, next) => {
  if (c.req.path === "/healthz") return next();
  if ((c.req.header("authorization") ?? "") !== `Bearer ${env.token}`) return c.json({ error: "unauthorized" }, 401);
  await next();
});

app.get("/healthz", async (c) => {
  try {
    await docker.ping();
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ ok: false, error: (err as Error).message }, 503);
  }
});

const startSchema = z.object({
  sessionId: z.string(),
  boardSlug: z.string(),
  provider: z.enum(["claude", "codex"]),
  model: z.string().nullable().default(null),
  reasoning: z.string().nullable().default(null),
  image: z.string().nullable(),
  repoUrl: z.string().nullable(),
  branch: z.string().nullable(),
  token: z.string(),
  wallClockMinutes: z.number(),
  prompt: z.string(),
  githubToken: z.string().nullable().default(null),
  gitName: z.string().default("cardboard"),
  gitEmail: z.string().default("cardboard@users.noreply.github.com"),
});

const containerName = (sessionId: string) => `cardboard-session-${sessionId}`;

// Nothing long-lived runs the agent image, so no watcher refreshes it. Pull before every start:
// a no-op when the tag is current, and a fresh image the minute CI publishes one. If the registry
// is unreachable, an image already on the host still starts the Session.
async function ensureImage(image: string): Promise<void> {
  try {
    const stream = await docker.pull(image);
    await new Promise<void>((resolve, reject) => docker.modem.followProgress(stream, (err) => (err ? reject(err) : resolve())));
  } catch (err) {
    const present = await docker.getImage(image).inspect().catch(() => null);
    if (!present) throw err;
    console.warn(`[runner] could not refresh ${image}; using the local copy`, (err as Error).message);
  }
}

// Session containers that exited while the runner was down never got their post-exit cleanup.
async function pruneExitedSessions(): Promise<void> {
  const list = await docker.listContainers({ all: true, filters: { label: ["cardboard.session"], status: ["exited", "dead"] } });
  for (const c of list) {
    await docker.getContainer(c.Id).remove({ force: true }).catch(() => {});
    console.log(`[runner] removed exited ${c.Names[0] ?? c.Id}`);
  }
}

async function reportExit(sessionId: string, exitCode: number, reason?: string) {
  try {
    await fetch(`${env.appUrl}/api/internal/sessions/${sessionId}/exit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ exitCode, reason }),
    });
  } catch (err) {
    console.error(`[runner] could not report exit for ${sessionId}`, err);
  }
}

function watchContainer(sessionId: string, container: Docker.Container) {
  const logPath = path.join(env.logDir, `${sessionId}.log`);
  const out = fs.createWriteStream(logPath, { flags: "a" });
  void container.logs({ follow: true, stdout: true, stderr: true, timestamps: true }).then((stream) => {
    container.modem.demuxStream(stream, out, out);
    stream.on("end", () => out.end());
  });
  void container
    .wait()
    .then(async (res) => {
      await reportExit(sessionId, res.StatusCode);
      await container.remove({ force: true }).catch(() => {});
    })
    .catch((err) => console.error(`[runner] wait failed for ${sessionId}`, err));
}

app.post("/sessions", async (c) => {
  const parsed = startSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const req = parsed.data;
  const name = containerName(req.sessionId);

  // Idempotent: a retry after a lost response returns the existing container.
  const existing = docker.getContainer(name);
  const info = await existing.inspect().catch(() => null);
  if (info) return c.json({ containerId: info.Id });

  // Refuse a Codex Session with no way to reach the provider rather than starting a container that
  // can only fail: it would hold a concurrency slot and report an exit the Card cannot explain.
  const codex = req.provider === "codex" ? codexWiring({ viaEgress: env.codexViaEgress, egressUrl: env.egressUrl, authFile: env.codexAuthFile }) : { env: [], binds: [] };
  if ("error" in codex) {
    console.error(`[runner] refusing codex session ${req.sessionId}: ${codex.error}`);
    return c.json({ error: codex.error }, 400);
  }

  const image = req.image ?? env.defaultImage;
  await ensureImage(image);
  const envList = [
    `CARDBOARD_SESSION_ID=${req.sessionId}`,
    `CARDBOARD_TOKEN=${req.token}`,
    `CARDBOARD_MCP_URL=${env.mcpUrl}`,
    `CARDBOARD_PROVIDER=${req.provider}`,
    `CARDBOARD_MODEL=${req.model ?? ""}`,
    `CARDBOARD_REASONING=${req.reasoning ?? ""}`,
    `CARDBOARD_REPO_URL=${req.repoUrl ?? ""}`,
    `CARDBOARD_BRANCH=${req.branch ?? ""}`,
    `CARDBOARD_WALL_CLOCK_MINUTES=${req.wallClockMinutes}`,
    `CARDBOARD_GIT_NAME=${req.gitName}`,
    `CARDBOARD_GIT_EMAIL=${req.gitEmail}`,
    ...(req.githubToken ? [`GITHUB_TOKEN=${req.githubToken}`, `GH_TOKEN=${req.githubToken}`] : []),
    // Claude Code talks to the provider through the egress proxy, which holds the real credential.
    `ANTHROPIC_BASE_URL=${env.egressUrl}/anthropic`,
    `ANTHROPIC_API_KEY=cardboard-egress`,
    `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`,
    ...codex.env,
  ];
  const binds = [...codex.binds];

  const container = await docker.createContainer({
    Image: image,
    name,
    Env: envList,
    Labels: {
      "com.centurylinklabs.watchtower.enable": "false",
      "cardboard.session": req.sessionId,
      "cardboard.board": req.boardSlug,
    },
    // The prompt is delivered on stdin so it never appears in `docker inspect` or process lists.
    OpenStdin: true,
    StdinOnce: true,
    HostConfig: {
      Memory: env.memoryBytes,
      NanoCpus: env.nanoCpus,
      PidsLimit: env.pidsLimit,
      Binds: binds,
      NetworkMode: env.workloadNetwork,
      SecurityOpt: ["no-new-privileges:true"],
      CapDrop: ["ALL"],
      ReadonlyRootfs: false,
    },
  });
  const stdin = await container.attach({ stream: true, stdin: true, stdout: false, stderr: false, hijack: true });
  await container.start();
  stdin.write(req.prompt);
  stdin.end();
  watchContainer(req.sessionId, container);
  console.log(`[runner] started ${name} (${image})`);
  return c.json({ containerId: container.id });
});

app.delete("/sessions/:id", async (c) => {
  const id = c.req.param("id");
  const container = docker.getContainer(id);
  const info = await container.inspect().catch(() => null);
  if (!info) return c.json({ ok: true, missing: true }, 404);
  await container.stop({ t: 10 }).catch(() => {});
  await container.remove({ force: true }).catch(() => {});
  return c.json({ ok: true });
});

// The container log is the Session's transcript. The app polls this with the offset it last saw
// and renders what comes back; the runner does no parsing.
app.get("/sessions/:id/log", (c) => {
  const offset = Number(c.req.query("offset") ?? "0");
  return c.json(readLogSlice(env.logDir, c.req.param("id"), Number.isFinite(offset) ? offset : 0));
});

app.get("/sessions", async (c) => {
  const list = await docker.listContainers({ all: true, filters: { label: ["cardboard.session"] } });
  return c.json(list.map((x) => ({ containerId: x.Id, sessionId: x.Labels["cardboard.session"], state: x.State, status: x.Status })));
});

const previewSchema = z.object({
  previewId: z.string(),
  boardSlug: z.string(),
  cardId: z.string(),
  host: z.string(),
  repoUrl: z.string().url(),
  branch: z.string(),
  githubToken: z.string().nullable().default(null),
  dockerfile: z.string().default("Dockerfile"),
  port: z.number().int().positive().default(3000),
  env: z.record(z.string()).default({}),
});

const previewLimits = {
  network: env.previewNetwork,
  memoryBytes: env.previewMemoryBytes,
  nanoCpus: env.previewNanoCpus,
  pidsLimit: env.previewPidsLimit,
};

async function reportPreview(previewId: string, body: { status: "running" | "failed"; containerId?: string; target?: string; error?: string }) {
  try {
    await fetch(`${env.appUrl}/api/internal/previews/${previewId}/state`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(`[runner] could not report preview ${previewId}`, err);
  }
}

// A build takes minutes, so the request only accepts the work. The app already knows the hostname,
// and the router serves a holding page until the runner reports the container is up.
app.post("/previews", async (c) => {
  const parsed = previewSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const req: PreviewRequest = parsed.data;
  const logPath = path.join(env.logDir, `preview-${req.previewId}.log`);
  fs.writeFileSync(logPath, `[preview] accepted ${req.host} at ${new Date().toISOString()}\n`);
  const onLog = (line: string) => fs.appendFileSync(logPath, `${line}\n`);

  void buildAndRunPreview(docker, req, previewLimits, onLog)
    .then(async ({ containerId, target }) => {
      await reportPreview(req.previewId, { status: "running", containerId, target });
    })
    .catch(async (err: Error) => {
      const message = err instanceof PreviewError ? err.message : `preview failed: ${err.message}`;
      onLog(message);
      console.error(`[runner] preview ${req.previewId} failed`, message);
      await reportPreview(req.previewId, { status: "failed", error: message });
    });

  return c.json({ accepted: true }, 202);
});

app.delete("/previews/:id", async (c) => {
  const id = c.req.param("id");
  const removed = await removePreview(docker, id);
  fs.rmSync(path.join(env.logDir, `preview-${id}.log`), { force: true });
  return c.json({ ok: true, removed });
});

app.get("/previews", async (c) => {
  const list = await docker.listContainers({ all: true, filters: { label: ["cardboard.preview"] } });
  return c.json(list.map((x) => ({ containerId: x.Id, previewId: x.Labels["cardboard.preview"], host: x.Labels["cardboard.preview.host"], state: x.State, status: x.Status })));
});

app.get("/previews/:id/log", (c) => {
  const offset = Number(c.req.query("offset") ?? "0");
  return c.json(readLogSlice(env.logDir, `preview-${c.req.param("id")}`, Number.isFinite(offset) ? offset : 0));
});

function pruneLogs() {
  const cutoff = Date.now() - env.logRetentionDays * 86_400_000;
  for (const f of fs.readdirSync(env.logDir)) {
    const p = path.join(env.logDir, f);
    if (fs.statSync(p).mtimeMs < cutoff) fs.rmSync(p, { force: true });
  }
}
pruneLogs();
setInterval(pruneLogs, 6 * 3_600_000);
void pruneExitedSessions().catch((err) => console.error("[runner] prune failed", err));

serve({ fetch: app.fetch, port: env.port }, (info) => console.log(`cardboard runner listening on :${info.port}`));
