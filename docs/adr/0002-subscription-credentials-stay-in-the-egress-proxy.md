---
status: accepted
date: 2026-09-13
---
# Provider credentials live only in the egress proxy

Sessions run on the Admin's personal Claude Code and Codex subscriptions rather than API keys, so the credential is one long-lived, high-value token rather than a revocable per-project key. Sessions also execute text written by clients, which makes prompt injection inside a container a realistic path to exfiltration. We therefore never place the Claude Code token in a Session container: containers talk to the provider through an egress proxy in the Cardboard stack that injects the credential on requests bound for the provider's endpoints. Codex uses its sign-in file injected into the container until the same proxy path is verified for it.

## Consequences

- For a proxied Provider, a compromised Session can burn subscription usage during its 45-minute life but cannot carry the token out. The guarantee does not hold for Codex while its sign-in file is inside the container, so automatic fallback into Codex stays off by default until Codex traffic goes through the proxy.
- Subscription usage windows are shared by every concurrent Session and the Admin's interactive use, which is why the global concurrency cap exists and why Providers fall back to each other on usage-limit errors.
