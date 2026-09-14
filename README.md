# Cardboard

A self-hosted, agent-native kanban platform. Every human change to a Board starts a disposable coding-agent Session that implements the request or asks for what it needs. The design is in [docs/design.md](docs/design.md), the vocabulary in [CONTEXT.md](CONTEXT.md), and the decisions with trade-offs in [docs/adr](docs/adr/).

## Layout

| Path | What it is |
| --- | --- |
| `packages/app` | Hono server (REST API, MCP endpoint, orchestrator, SQLite via Drizzle) and the Vite + React client |
| `packages/shared` | Types and zod schemas shared by server and client |
| `packages/runner` | Owns the Docker socket. Starts and stops Session containers, streams their logs to disk |
| `packages/egress` | Credential-injecting proxy so Session containers never hold the provider token |
| `packages/preview-router` | Hostname routing and signed-cookie gate for runner-hosted Previews |
| `images/agent` | The default Session image: Node, Bun, Python, Go, git, gh, Claude Code, Codex |
| `deploy/` | Compose file, env template, and the GitHub Apps guide for minicore |
| `skills/cardboard-onboard` | Agent skill that prepares a repository for Cardboard; symlink it into `~/.claude/skills` |

## Run it locally

Requires Node 24+ and pnpm 11.

```bash
pnpm install
pnpm dev
```

The server listens on 3070 and Vite on 5173 with `/api` and `/mcp` proxied. With no `.env`, auth runs in dev mode: every request is the seeded Admin, and a demo Board with cards and comments is created on first start. Data lives in `packages/app/data`. Delete that directory to reseed.

Copy `packages/app/.env.example` to `packages/app/.env` to change the port, data directory, auth mode, or email delivery. Without `RESEND_API_KEY` outgoing emails are logged to stdout. Without `CARDBOARD_RUNNER_URL` Sessions are recorded but nothing runs; the board still shows the working indicator so the flow can be exercised.

Other commands:

```bash
pnpm typecheck        # every package
pnpm build            # client bundle plus server to packages/app/dist
pnpm db:generate      # new Drizzle migration after editing server/src/db/schema.ts
```

## How a Session reaches Cardboard

Session containers get a bearer token in `CARDBOARD_TOKEN` and talk to `POST /mcp` on the app. The MCP tools are `get_ledger`, `announce_intent`, `get_board`, `get_card`, `read_attachment`, `post_comment`, `move_card`, `create_card`, `set_work_state`, and `finish`. Every call is authorised by the Session's Board, and pull-request state only for its own Card. The runner reports container exit to `POST /api/internal/sessions/:id/exit` with the shared runner token.

## Deploy to minicore

CI publishes `ghcr.io/chriscorbell/cardboard-{app,runner,egress,preview-router,agent}` on every push to `main`. On minicore:

1. Copy `deploy/compose.yaml` to `~/docker/stacks/cardboard/compose.yaml` and `deploy/.env.example` to `.env` beside it, then fill the secrets.
2. `docker compose up -d`. Watchtower keeps the four services current; Session containers carry the opt-out label.
3. Add `cardboard.xode.cc` to the Cloudflare Tunnel pointing at `http://10.0.0.20:3070`, and `*.preview.xode.cc` at port 3073.

The `.env` beside the compose file is never committed: keep the master copy in `deploy/.env` locally and `scp` it to `~/docker/stacks/cardboard/.env` on minicore when it changes. The stack has been live at `https://cardboard.xode.cc` since 2026-09-14.

Steps that need the Admin's hands: creating the Clerk application, verifying `cardboard.xode.cc` in Resend, creating and installing the GitHub App, and running `claude setup-token` for the egress proxy. The design document lists them.

## Status

Live at `https://cardboard.xode.cc` since 2026-09-14. Verified end to end on two repositories, this one included: sign-in through Clerk, card to Session, per-Session GitHub tokens, pull request with the acceptance command passing, Approval bound to the reviewed commit, merge by Cardboard through the Merge app, and email at each step. Not yet built: runner-hosted Previews and their cookie flow, Provider fallback on usage limits, invitation emails, child-card dispatch, and Codex through the egress proxy. Open review findings are listed at the top of the [design review](docs/design-review.md).

To prepare a repository for a board, run the `cardboard-onboard` skill in that repository, or follow [deploy/github-apps.md](deploy/github-apps.md) by hand.
