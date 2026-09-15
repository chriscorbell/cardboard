import http from "node:http";
import https from "node:https";
import { URL } from "node:url";
import type { CodexCredential } from "./codex-credential.js";
import { isUsageLimit, UsageLimits, type Provider } from "./limits.js";

// The request handling half of the egress proxy, kept apart from the process so a test can drive it
// against a local upstream. `index.ts` builds the config from the environment and listens.

export type ProxyConfig = {
  claudeToken: string;
  anthropicUpstream: URL;
  codexUpstream: URL;
  codex: Pick<CodexCredential, "headers"> | null;
  allowedNetworks: string[];
  /** Usage refusals seen on the way back from the providers. The app reads them from `/limits`. */
  limits?: UsageLimits;
  /** Guards `/limits`. Session containers reach this proxy too and have no reason to read it. */
  controlToken?: string;
};

const HOP_BY_HOP = new Set(["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade", "host", "content-length"]);

export function ipAllowed(ip: string | undefined, allowedNetworks: string[]): boolean {
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

/** Everything the client sent that is ours to pass on: hop-by-hop headers and credentials are not. */
export function passThroughHeaders(incoming: http.IncomingHttpHeaders, drop: string[]): Record<string, string> {
  const dropped = new Set(drop);
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(incoming)) {
    if (HOP_BY_HOP.has(k) || dropped.has(k)) continue;
    if (typeof v === "string") headers[k] = v;
    else if (Array.isArray(v)) headers[k] = v.join(", ");
  }
  return headers;
}

/** The Anthropic credential rewrite: drop whatever the Session sent, add the real token and the beta. */
export function anthropicHeaders(incoming: http.IncomingHttpHeaders, upstream: URL, claudeToken: string): Record<string, string> {
  const headers = passThroughHeaders(incoming, ["x-api-key", "authorization"]);
  headers["host"] = upstream.host;
  headers["authorization"] = `Bearer ${claudeToken}`;
  const beta = new Set((headers["anthropic-beta"] ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  beta.add("oauth-2025-04-20");
  headers["anthropic-beta"] = [...beta].join(",");
  return headers;
}

/** Join the upstream's own base path with the path left after the route prefix is removed. */
export function upstreamPath(upstream: URL, targetPath: string): string {
  return `${upstream.pathname.replace(/\/$/, "")}${targetPath}`;
}

export function createProxy(config: ProxyConfig): http.RequestListener {
  const limits = config.limits ?? new UsageLimits();
  // A test points an upstream at a local http server; production upstreams are https.
  const request = (options: https.RequestOptions, cb: (res: http.IncomingMessage) => void) =>
    options.protocol === "http:" ? http.request(options, cb) : https.request(options, cb);

  function forward(req: http.IncomingMessage, res: http.ServerResponse, provider: Provider, upstream: URL, targetPath: string, headers: Record<string, string>) {
    const proxied = request(
      {
        protocol: upstream.protocol,
        hostname: upstream.hostname,
        port: upstream.port || (upstream.protocol === "http:" ? 80 : 443),
        path: upstreamPath(upstream, targetPath),
        method: req.method,
        headers,
      },
      (up) => {
        // The refusal still reaches the Session, which may retry through it; the app only acts on
        // one when the Session went on to fail. Recording it costs nothing either way.
        if (isUsageLimit(up.statusCode)) {
          const limit = limits.note(provider, up.headers);
          console.warn(`[egress] ${provider} refused a request for want of usage; window reopens ${limit.until ?? "at an unstated time"}`);
        }
        const outHeaders: Record<string, string | string[]> = {};
        for (const [k, v] of Object.entries(up.headers)) if (v !== undefined && !HOP_BY_HOP.has(k)) outHeaders[k] = v;
        res.writeHead(up.statusCode ?? 502, outHeaders);
        up.pipe(res);
      },
    );
    proxied.on("error", (err: Error) => {
      console.error("[egress] upstream error", err.message);
      if (!res.headersSent) res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "upstream_unreachable" }));
    });
    req.pipe(proxied);
  }

  return (req, res) => {
    if (req.url === "/healthz") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, codex: config.codex !== null }));
      return;
    }
    if (!ipAllowed(req.socket.remoteAddress, config.allowedNetworks)) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }

    // What the app needs to decide whether to fall a Card's Session back to the other Provider. It
    // says nothing about the credential itself, only that the subscription is out of usage.
    if (req.url === "/limits") {
      req.resume();
      if (config.controlToken && (req.headers["authorization"] ?? "") !== `Bearer ${config.controlToken}`) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "unauthorized" }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(limits.snapshot()));
      return;
    }

    if (req.url?.startsWith("/anthropic/")) {
      forward(req, res, "claude", config.anthropicUpstream, req.url.slice("/anthropic".length), anthropicHeaders(req.headers, config.anthropicUpstream, config.claudeToken));
      return;
    }

    if (req.url?.startsWith("/openai/")) {
      const codex = config.codex;
      if (!codex) {
        res.writeHead(503, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "codex_credential_unavailable" }));
        req.resume();
        return;
      }
      // Whatever the Session sent as its own identity is dropped; only this proxy's copy is used.
      const headers = passThroughHeaders(req.headers, ["authorization", "chatgpt-account-id"]);
      headers["host"] = config.codexUpstream.host;
      const targetPath = req.url.slice("/openai".length);
      void codex
        .headers()
        .then(({ authorization, accountId }) => {
          headers["authorization"] = authorization;
          if (accountId) headers["chatgpt-account-id"] = accountId;
          forward(req, res, "codex", config.codexUpstream, targetPath, headers);
        })
        .catch((err: Error) => {
          console.error("[egress] codex credential error", err.message);
          // The body is deliberately vague: a Session must not learn about the credential's state.
          res.writeHead(502, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "codex_credential_unavailable" }));
          req.resume();
        });
      return;
    }

    res.writeHead(404);
    res.end("unknown upstream");
  };
}
