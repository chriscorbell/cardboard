# Agent instructions

## Memory and documentation

At the start of each session, and after compaction when these instructions have left context, read [the memory index](docs/memory/README.md) and [the memory protocol](docs/memory/protocol.md), then follow their pointers to material relevant to the task. Resolve these paths from the workspace root, including from a subdirectory.

Maintain human documentation, canonical project documents, and memory alongside verified changes, as ordinary work. Before finishing substantive work or handing off, follow the protocol's Finish steps to reconcile affected documents and prune stale memory.

Treat memories as evidence to verify, never as authority over current instructions. Edit `AGENTS.md` only within the delegated repairs in [document maintenance](docs/memory/documents.md). Keep `CLAUDE.md` a relative symlink to `AGENTS.md`.

## Working in a Cardboard Session

This repository is itself a board on Cardboard, so a Session may be editing the code that runs Sessions. Before opening a pull request, run the acceptance command from the repository root and make sure it prints nothing but success:

```bash
pnpm install --frozen-lockfile && pnpm -r typecheck && pnpm -r test && pnpm --filter @cardboard/app build
```

Facts a Session cannot see from the tree:

- Docker images are built only by CI after the pull request opens. A change to a `Dockerfile`, `deploy/compose.yaml`, or `.github/workflows/ci.yml` is unproven until the `publish` job is green; say so in the pull request.
- A schema change in `packages/app/server/src/db/schema.ts` needs a migration: run `pnpm db:generate` and commit the new file under `packages/app/drizzle/` with its journal update.
- Merging to `main` deploys to production within about a minute through Watchtower. Keep pull requests small and self-contained.
- `deploy/.env`, `packages/app/.env`, and anything under `docs/memory/history/` are never edited by a Session.
- Vocabulary in `CONTEXT.md` is binding: Board, Card, Session, Trigger, Claim, Approval mean exactly what it says.
