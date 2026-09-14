# First implementation pass

Status: active
Objective: bring Cardboard from design to a deployable v1. Overnight on 2026-09-13/14 the scaffold, server, client, MCP endpoint, runner, egress, preview-router, images, compose file, and CI were written; see [README.md](../../../README.md) for what runs and the "Status" section for what is missing.
Branch: `main`, pushed to `github.com/chriscorbell/cardboard` (public since 2026-09-14). CI publishes five images to GHCR on every push to main; the first green run was 2026-09-14.

## Verified on 2026-09-14

- `pnpm -r typecheck` and `pnpm --filter @cardboard/app build` pass. The built server starts under `node dist/server/index.js` with Node 26 type-stripping resolving `@cardboard/shared` from TypeScript source.
- Dev server seeds an Admin plus two demo Boards. Posting a comment enqueues a Trigger, which becomes a Session after the 60 s window (noop runner mode).
- MCP over HTTP answered `tools/list`, `announce_intent`, `get_card`, and `post_comment` with a token hashed into the sessions table.
- All five Docker images build in CI (app, runner, egress, preview-router, agent). None has been run yet.

## Decisions taken without the user (reversible)

- Dev auth mode (`CARDBOARD_AUTH=dev`) exists so the UI works without Clerk keys.
- The runner delivers the workflow prompt on container stdin, not in env, so it stays out of `docker inspect`.
- Boot recovery marks active Sessions failed only when a real runner is configured; in noop mode it leaves them so demo data survives restarts.
- Schema already carries what the design review asked for: `approvals.head_sha`, `cards.parent_card_id`, `cards.revision` for optimistic concurrency, `cards.pending_rerun`, and session token hashes.

## Needs the user

- Decisions on the eight findings in [docs/design-review.md](../../design-review.md), especially GitHub merge authority (two GitHub Apps with a ruleset bypass was the candidate) and Approval binding to a head SHA.
- Cloudflare hostnames, Clerk app, Resend domain, GitHub App, `claude setup-token`.
- Whether the local Qwen model should take "workhorse" tasks; the user wants to set that up together.

## Review findings already absorbed in code

- Finding 7 (human move to Done races with work): a human move to Done now cancels the active Session, consumes pending Triggers, and clears the re-run flag (`closeCardWork` in `server/src/services/orchestrator.ts`). Verified 2026-09-14 by moving a card with a running Session.
- Finding 2 (Approval not bound to reviewed code): leaving Review invalidates standing Approvals; `approvals.head_sha` exists but nothing writes it until GitHub integration lands.
- Finding 4 (restarts): boot recovery fails stale Sessions and re-schedules pending Triggers; runner container creation is idempotent by container name. Runner inventory reconciliation is still missing.

## Known gaps in the code

- Egress proxy header rewrite for subscription tokens (`Authorization: Bearer` plus `anthropic-beta: oauth-2025-04-20`) is unverified against a live Claude Code session.
- Codex MCP config syntax in `images/agent/entrypoint.sh` is unverified.
- `/api/internal/previews` and `/preview-auth` are referenced by the preview router but not implemented in the app.
- Nightly sweep scheduler exists (`server/src/services/sweep.ts`, 03:00 local, skipped in noop mode) but has never started a real container. No GitHub App token minting. `read_attachment` inlines text only up to 200 KB.
- Browser-automation note: the in-app browser's `key` action does not reach React keydown handlers; dispatching a KeyboardEvent does. Not an app bug.

Next action: review with the user, decide the P1 items, then deploy the stack to minicore from `deploy/compose.yaml` with a Clerk app configured.
Close when: the stack runs on minicore behind `cardboard.xode.cc` and one real Session completes against a test repository.
