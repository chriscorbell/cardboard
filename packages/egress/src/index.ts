import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

// Credential-injecting egress proxy. Session containers never hold the provider token; they send
// requests here and the proxy adds the real credential before forwarding to the provider.
//
// Route: /anthropic/* -> https://api.anthropic.com/*  (Claude Code with ANTHROPIC_BASE_URL)
//
// Verification still owed (see docs/design.md): Claude Code launched with a placeholder
// ANTHROPIC_API_KEY sends x-api-key; a subscription token authenticates with a bearer header plus
// the oauth beta flag. Both header rewrites happen below and must be checked against a live session.

const port = Number(process.env.PORT ?? "8787");
const claudeToken = process.env.CLAUDE_CODE_OAUTH_TOKEN ?? "";
const anthropicUpstream = new URL(process.env.EGRESS_ANTHROPIC_UPSTREAM ?? "https://api.anthropic.com");
const allowedNetworks = (process.env.EGRESS_ALLOWED_CIDRS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

if (!claudeToken) console.warn("[egress] CLAUDE_CODE_OAUTH_TOKEN is empty; Claude Code requests will fail upstream");

const HOP_BY_HOP = new Set(["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade", "host", "content-length"]);

function ipAllowed(ip: string | undefined): boolean {
  if (allowedNetworks.length === 0) return true;
  if (!ip) return false;
  const plain = ip.replace(/^::ffff:/, "");
  return allowedNetworks.some((cidr) => {
    const [base, bitsStr] = cidr.split("/");
    const bits = Number(bitsStr ?? "32");
    const toInt = (a: string) => a.split(".").reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (toInt(plain) & mask) === (toInt(base!) & mask);
  });
}

const server = http.createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (!ipAllowed(req.socket.remoteAddress)) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }
  if (!req.url?.startsWith("/anthropic/")) {
    res.writeHead(404);
    res.end("unknown upstream");
    return;
  }
  const targetPath = req.url.slice("/anthropic".length);
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (HOP_BY_HOP.has(k) || k === "x-api-key" || k === "authorization") continue;
    if (typeof v === "string") headers[k] = v;
    else if (Array.isArray(v)) headers[k] = v.join(", ");
  }
  headers["host"] = anthropicUpstream.host;
  headers["authorization"] = `Bearer ${claudeToken}`;
  const beta = new Set((headers["anthropic-beta"] ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  beta.add("oauth-2025-04-20");
  headers["anthropic-beta"] = [...beta].join(",");

  const upstream = https.request(
    { protocol: anthropicUpstream.protocol, hostname: anthropicUpstream.hostname, port: anthropicUpstream.port || 443, path: targetPath, method: req.method, headers },
    (up) => {
      const outHeaders: Record<string, string | string[]> = {};
      for (const [k, v] of Object.entries(up.headers)) if (v !== undefined && !HOP_BY_HOP.has(k)) outHeaders[k] = v;
      res.writeHead(up.statusCode ?? 502, outHeaders);
      up.pipe(res);
    },
  );
  upstream.on("error", (err) => {
    console.error("[egress] upstream error", err.message);
    if (!res.headersSent) res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "upstream_unreachable" }));
  });
  req.pipe(upstream);
});

server.listen(port, () => console.log(`cardboard egress listening on :${port}`));
