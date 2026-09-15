---
status: accepted
date: 2026-09-13
---
# Provider credentials live only in the egress proxy

Sessions run on the Admin's personal Claude Code and Codex subscriptions rather than API keys, so the credential is one long-lived, high-value token rather than a revocable per-project key. Sessions also execute text written by clients, which makes prompt injection inside a container a realistic path to exfiltration. We therefore never place the Claude Code token in a Session container: containers talk to the provider through an egress proxy in the Cardboard stack that injects the credential on requests bound for the provider's endpoints. Codex uses its sign-in file injected into the container until the same proxy path is verified for it; the proxy route exists and is off by default.

## Status of verification

Claude, verified 2026-09-14 on minicore: a container on the workload network with no credential called `/v1/messages` through the proxy and received a model reply.

Codex, partly verified 2026-09-15 against codex-cli 0.154.0. A Session container holding no Codex credential at all completed a turn against a stand-in provider through the proxy route, which settles the container half: naming a model provider is what does it, because Codex's default provider prefers a WebSocket to `chatgpt.com` that ignores any base URL. What is not verified is the proxy's own half — that `https://chatgpt.com/backend-api/codex` accepts the injected access token, and that the refresh against `https://auth.openai.com/oauth/token` works — because that needs the Admin's real Codex sign-in file. Until someone runs a Codex Session with `CARDBOARD_CODEX_VIA_EGRESS=1` and sees a model reply, the mounted sign-in file stays the default.

## Consequences

- For a proxied Provider, a compromised Session can burn subscription usage during its 45-minute life but cannot carry the token out. The guarantee does not hold for Codex while its sign-in file is inside the container, so automatic fallback into Codex stays off by default until Codex traffic goes through the proxy.
- A Session never writes to the Admin's Codex sign-in file: it is bound read-only at a staging path and copied into the container, because Codex rewrites the file whenever it refreshes its access token. A Session that refreshes therefore diverges from the host copy for its own lifetime and no longer.
- Subscription usage windows are shared by every concurrent Session and the Admin's interactive use, which is why the global concurrency cap exists and why Providers fall back to each other on usage-limit errors.
