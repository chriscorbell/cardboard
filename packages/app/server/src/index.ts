import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { logger } from "hono/logger";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./env.js";
import { runMigrations } from "./db/index.js";
import { api } from "./routes/api.js";
import { mcp } from "./routes/mcp.js";
import { internal } from "./routes/internal.js";
import { recoverOnBoot } from "./services/orchestrator.js";
import { startSweepScheduler } from "./services/sweep.js";
import { ensureSeed } from "./seed.js";

const app = new Hono();
app.use("*", logger((msg) => console.log(msg)));
app.get("/healthz", (c) => c.json({ ok: true }));
// Internal routes are registered before the user API so its auth middleware never sees them.
app.route("/api/internal", internal);
app.route("/api", api);
app.route("/mcp", mcp);

// Production: serve the built client. In dev, Vite serves it and proxies /api here.
const here = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(here, "../client");
if (fs.existsSync(path.join(clientDir, "index.html"))) {
  // Runtime config is injected into the page so one image serves every environment.
  const runtimeConfig = JSON.stringify({ clerkPublishableKey: env.authMode === "clerk" ? env.clerkPublishableKey : "" });
  const indexHtml = fs
    .readFileSync(path.join(clientDir, "index.html"), "utf8")
    .replace("<!--cardboard-config-->", `<script>window.__CARDBOARD_CONFIG__=${runtimeConfig}</script>`);
  app.use("/assets/*", serveStatic({ root: path.relative(process.cwd(), clientDir) }));
  app.use("/brand/*", serveStatic({ root: path.relative(process.cwd(), clientDir) }));
  app.get("*", async (c) => {
    if (c.req.path.startsWith("/api") || c.req.path.startsWith("/mcp")) return c.notFound();
    return c.html(indexHtml);
  });
}

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal", message: env.isProduction ? undefined : err.message }, 500);
});

await runMigrations();
await ensureSeed();
await recoverOnBoot();
startSweepScheduler();

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`cardboard app listening on http://localhost:${info.port} (auth=${env.authMode})`);
});
