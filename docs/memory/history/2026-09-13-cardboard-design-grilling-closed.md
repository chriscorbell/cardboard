# Cardboard design interview

Status: active
Objective: reach a shared understanding of Cardboard's design through a grilling session before any code exists. Resolved vocabulary lives in [CONTEXT.md](../../../CONTEXT.md); this note holds only decisions the glossary cannot carry.

## Decisions accepted so far (dated user instructions, 2026-09-13)

- Auth: Clerk for identity, Cardboard's own User table is authoritative; unknown identities land on a "not invited" page.
- Agent credentials: the Admin's personal Claude Code and Codex subscriptions, not API keys.
- Git flow: branch per Card, PR, Preview for Members, Approval comment triggers auto-merge and move to Done. Production deploys are outside Cardboard.
- Triggers coalesce per Card (about 60 s); a Trigger during an active Session queues to it. Admin actions trigger too, with a per-action silent option.
- One active Session per Card, cap 3 per Board, single global Agent identity.
- Members see status indicator and Comments only; Admin can cancel a Session; no transcript UI.
- Notifications via Resend: Mentions plus card-moved to the Card's creator.
- Hygiene: light pass at Session end, nightly full sweep per Board.
- Per-Board config in Cardboard: repo, credentials, Provider, budget, plus an Admin prompt-append field. Engineering instructions live in the repo's AGENTS.md.
- Infra: SQLite WAL, single Node process; attachments on local bind mount; a separate runner service owns the Docker socket; host port 3070; hostname `cardboard.xode.cc` via the existing Cloudflare Tunnel; no Cloudflare Access; MCP over HTTP with session-scoped tokens plus REST for the UI.
- Security is a first-class requirement because the service is publicly exposed.

## Round 2 decisions (2026-09-13)

- Preview mode per Board: `external` or `runner`; runner Previews at `*.preview.xode.cc`, reaped at Done or 7 idle days, gated by a Cardboard-signed cookie on `.xode.cc`. `xode.cc` is in the same Cloudflare account.
- Approval is a button only; merge is squash with branch deletion; rebase and re-check if diverged.
- Git: GitHub only, one GitHub App per repo, one-hour installation token per Session.
- Subscription tokens never enter containers for Claude Code: a credential-injecting egress proxy adds them. Codex gets env injection until the proxy path is verified.
- Provider per Board with automatic fallback on usage-limit errors; global cap 4 Sessions, per-Board cap 3.
- Trigger during an active Session marks the Card pending re-run; no live injection.
- Agent never declines work alone: out-of-scope goes to Blocked with an Admin Mention; duplicates are linked and moved to Done; 14-day Blocked reminder from the nightly sweep.
- Card fields: title, description, Priority, Column, position, creator, Comments. Attachments only on Comments.
- Comment edits are Triggers; "edited" marker, no history UI.
- One default agent image from this repo on GHCR, per-Board override; non-root, CPU/mem/pids limits, 45-minute wall clock.
- Egress unrestricted in v1, recorded as a deliberate trade-off ADR.
- Session logs on disk 14 days, SSH only; DB keeps status, timings, outcome summary.
- Agent name is an Admin setting, default "Milo".

## Round 3 decisions (2026-09-13)

- Claim is taken by the orchestrator at Session creation; the Session announces intent to the Ledger during orientation and reads other Sessions' intents. No started Comment; one report Comment at the end; noise Triggers end silently.
- Overlapping intents proceed; conflicts resolve at Approval-time rebase.
- Sweep is a Session kind with no Claim: 03:00 local, waits up to one hour for card Sessions, counts against the global cap only.
- Members may move Cards anywhere; human move to Done closes silently; Session may move back with a one-line Comment.
- Comment on a Done Card reopens it: fresh branch with `-2` suffix, new PR.
- Sessions may create Cards in any appropriate Column; Inbox is reserved for human intake. Split requests: child Cards linked from the parent, parent Blocked until children Done.
- Limits: 45-minute wall clock, per-Board concurrency 3, global 4. No daily count caps.
- Email from `cardboard@xode.cc`, sender name is the Agent name, no inbound, no-reply reply-to.
- Clerk: email code plus Google, no passwords.
- Admin panel v1: Users, Boards, Agent, Sessions as listed in round 3 Q44.
- Compose stack `cardboard`: `app`, `runner`, `egress`, `preview-router`; pnpm monorepo; TypeScript, Vite + React, Node, Drizzle on SQLite; one GHCR workflow copied from invox; Watchtower opt-out label on Session and Preview containers.
- Per-Card activity trail, no Board-wide feed.

## Fleet facts used (verified 2026-09-13 by read-only SSH)

minicore: Ubuntu 26.04, x86_64, 28 GiB RAM, Docker 29 + Compose. Exposure only via token-based Cloudflare Tunnel with ingress in the dashboard targeting LAN host ports. No shared Postgres, Redis, object store, or reverse proxy. Deploy pattern: GitHub Actions to GHCR `:latest`, Watchtower polls every 60 s; copy `chriscorbell/invox` `.github/workflows/ci.yml`. Only Watchtower mounts the Docker socket. Used host ports: 3050, 3060, 3147, 3834, 4533, 5030, 8080, 8096, 8409, 8443, 8554, 8555, 8971, 25565, 50300.

## Next action

Await the user's confirmation of shared understanding on the closing assumptions list, then write ADRs under docs/adr/ and a design document under docs/, and close this note.

Close when: the interview frontier is empty and the user confirms shared understanding; then promote decisions to ADRs and a design doc.
