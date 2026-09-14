# First implementation pass

Status: active
Objective: bring Cardboard from design to a deployable v1. Overnight on 2026-09-13/14 the scaffold, server, client, MCP endpoint, runner, egress, preview-router, images, compose file, and CI were written; see [README.md](../../../README.md) for what runs and the "Status" section for what is missing.
Branch: `main`, local commits only, nothing pushed. No GitHub repository exists yet.

## Verified on 2026-09-14

- `pnpm -r typecheck` and `pnpm --filter @cardboard/app build` pass. The built server starts under `node dist/server/index.js` with Node 26 type-stripping resolving `@cardboard/shared` from TypeScript source.
- Dev server seeds an Admin plus two demo Boards. Posting a comment enqueues a Trigger, which becomes a Session after the 60 s window (noop runner mode).
- MCP over HTTP answered `tools/list`, `announce_intent`, `get_card`, and `post_comment` with a token hashed into the sessions table.
- Docker images have not been built; the Dockerfiles are untested.

## Decisions taken without the user (reversible)

- Dev auth mode (`CARDBOARD_AUTH=dev`) exists so the UI works without Clerk keys.
- The runner delivers the workflow prompt on container stdin, not in env, so it stays out of `docker inspect`.
- Boot recovery marks active Sessions failed only when a real runner is configured; in noop mode it leaves them so demo data survives restarts.
- Schema already carries what the design review asked for: `approvals.head_sha`, `cards.parent_card_id`, `cards.revision` for optimistic concurrency, `cards.pending_rerun`, and session token hashes.

## Needs the user

- Decisions on the eight findings in [docs/design-review.md](../../design-review.md), especially GitHub merge authority (two GitHub Apps with a ruleset bypass was the candidate) and Approval binding to a head SHA.
- Create `chriscorbell/cardboard` on GitHub and push; the CI workflow publishes five images.
- Cloudflare hostnames, Clerk app, Resend domain, GitHub App, `claude setup-token`.
- Whether the local Qwen model should take "workhorse" tasks; the user wants to set that up together.

## Known gaps in the code

- Egress proxy header rewrite for subscription tokens (`Authorization: Bearer` plus `anthropic-beta: oauth-2025-04-20`) is unverified against a live Claude Code session.
- Codex MCP config syntax in `images/agent/entrypoint.sh` is unverified.
- `/api/internal/previews` and `/preview-auth` are referenced by the preview router but not implemented in the app.
- No nightly sweep scheduler, no GitHub App token minting, no `read_attachment` size guard beyond 200 KB text.
- Browser-automation note: the in-app browser's `key` action does not reach React keydown handlers; dispatching a KeyboardEvent does. Not an app bug.

Next action: review with the user, decide the P1 items, create the GitHub repo, push, and deploy the app container to minicore on port 3070 with a placeholder Clerk config.
Close when: the stack runs on minicore behind `cardboard.xode.cc` and one real Session completes against a test repository.
