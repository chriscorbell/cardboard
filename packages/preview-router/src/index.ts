import http from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";

// Routes *.preview.<domain> to Preview containers by hostname and gates access with a signed,
// host-only cookie. The cookie is issued by the app after a membership check and carries the
// preview host it is valid for, so a cookie for one preview does not open another.
//
// Not wired yet: the app does not issue preview cookies or register previews, and the runner
// does not build them. The verification and routing logic lives here so those pieces plug in.

const port = Number(process.env.PORT ?? "3072");
const secret = process.env.CARDBOARD_PREVIEW_SECRET ?? "";
const appUrl = (process.env.CARDBOARD_APP_URL ?? "http://app:3070").replace(/\/$/, "");
const publicAppUrl = (process.env.CARDBOARD_PUBLIC_URL ?? "https://cardboard.xode.cc").replace(/\/$/, "");
const runnerToken = process.env.CARDBOARD_RUNNER_TOKEN ?? "";
const cookieName = "cardboard_preview";

type Route = { host: string; target: string; expiresAt: number };
const routes = new Map<string, Route>();

async function refreshRoutes() {
  try {
    const res = await fetch(`${appUrl}/api/internal/previews`, { headers: { Authorization: `Bearer ${runnerToken}` } });
    if (!res.ok) return;
    const list = (await res.json()) as Route[];
    routes.clear();
    for (const r of list) routes.set(r.host, r);
  } catch {
    // keep the last known table
  }
}

function verifyCookie(value: string | undefined, host: string): boolean {
  if (!value || !secret) return false;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { host: string; exp: number };
    return data.host === host && data.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

const server = http.createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200);
    res.end("ok");
    return;
  }
  const host = (req.headers.host ?? "").split(":")[0]!;
  const route = routes.get(host);
  if (!route) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("No preview at this address.");
    return;
  }
  const cookie = (req.headers.cookie ?? "").split(";").map((s) => s.trim()).find((s) => s.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (!verifyCookie(cookie, host)) {
    res.writeHead(302, { location: `${publicAppUrl}/preview-auth?host=${encodeURIComponent(host)}&next=${encodeURIComponent(req.url ?? "/")}` });
    res.end();
    return;
  }
  const target = new URL(route.target);
  const headers = { ...req.headers, host: target.host };
  delete headers.cookie; // Cardboard credentials never reach branch-controlled code.
  const upstream = http.request({ hostname: target.hostname, port: target.port, path: req.url, method: req.method, headers }, (up) => {
    res.writeHead(up.statusCode ?? 502, up.headers);
    up.pipe(res);
  });
  upstream.on("error", () => {
    res.writeHead(502);
    res.end("Preview is not responding.");
  });
  req.pipe(upstream);
});

void refreshRoutes();
setInterval(() => void refreshRoutes(), 15_000);
server.listen(port, () => console.log(`cardboard preview-router listening on :${port}`));
