# Proposal: the acceptance command should run the test suite

Status: blocked, awaiting the Admin's decision
Objective: keep `AGENTS.md`'s acceptance command aligned with what CI enforces, now that the repository has tests.
Branch: `cardboard/v5u4wwzp-backups` (the change that introduced the first tests); the proposal itself edits no file yet.

Target section: `AGENTS.md`, "Working in a Cardboard Session", the acceptance command block.

Exact replacement:

```bash
pnpm install --frozen-lockfile && pnpm -r typecheck && pnpm -r test && pnpm --filter @cardboard/app build
```

Evidence: the backups change added `packages/app/server/test/backup.test.ts` and a `test` script in `packages/app/package.json` and the root `package.json`. Nothing runs them automatically: the `validate` job in `.github/workflows/ci.yml` still stops at `typecheck` and `build`, and no Session can add the step — see [the lesson](../lessons/session-token-cannot-push-workflow-files.md). Until both the CI step and this command exist, a regression in the snapshot service reaches `main` unnoticed. `pnpm -r test` exits 0 while skipping the four packages that have no `test` script, verified in this workspace on 2026-09-14.

Authority needed: the Admin. This changes a workflow obligation every Session must meet, which [document maintenance](../documents.md) puts outside the delegated repairs.

Next action: asked @chris on card `v5u4wwzpucs73k` (Backups) on 2026-09-14, twice; the reply granted the Sessions App the `workflows` permission, which does not reach a Session token, and did not answer this. On a yes, edit the block in `AGENTS.md` and delete this note and its index entry. The command is worth adding whether or not CI gains the step, since it is the only thing that runs the tests today.
Close when: `AGENTS.md` states the agreed command, or the Admin declines and the tests stay a local step.
