# Workspace memory

Read this index and [the protocol](protocol.md) when starting or resuming a session. Load topic notes only when their retrieval cue matches the task.

| When needed | Read |
| --- | --- |
| Workspace constraints, non-obvious structure, or recurring procedures | [Context](context/README.md) |
| A failure, gotcha, or previously corrected assumption | [Lessons](lessons/README.md) |
| Continuing unfinished work | [Work](work/README.md) |
| Writing or updating a memory note | [Note format](note-format.md) |
| Deciding which document owns a fact, whether a change owes a documentation edit, or repairing `AGENTS.md` | [Document maintenance](documents.md) |
| Finish step 4, a category over its threshold, or a requested memory review | [Bounded review](maintenance.md) |
| Several agents writing memory at once | [Concurrency](concurrency.md) |

## Canonical project documents

- [CONTEXT.md](../../CONTEXT.md): the glossary. Terms are used with these meanings everywhere.
- [Design](../design.md): the agreed v1 design, dated 2026-09-13, with links to the decision records.
- [Decision records](../adr/): eight ADRs covering identity, credentials, egress, storage, the runner, Approval, GitHub tokens, and the two-app merge authority.
- [Design review](../design-review.md): eight findings against the design, dated 2026-09-13, with a status header saying which are resolved. Read before implementing Previews or child-Card dispatch; it does not supersede accepted decisions.
- [GitHub Apps guide](../../deploy/github-apps.md) and the [cardboard-onboard skill](../../skills/cardboard-onboard/SKILL.md): how a repository is prepared for a board.
- [README](../../README.md): how to run, build, and deploy; the Status section says what is not built.

## Review record

2026-09-14 (fifth): ordinary review at the end of the "Enter key in comment box" card. It supersedes the fourth record of the same day and carries its open items forward. `context/cardboard-production-operations.md`: checked and retained — `.github/workflows/ci.yml` still publishes the five images the note names, on pushes to `main` only; verification date unchanged, since only that one claim was re-read. `lessons/pnpm-11-build-approvals.md`: checked and retained — `pnpm install --frozen-lockfile` in this Session container ran the esbuild postinstalls and the whole acceptance command passed, so the `allowBuilds` correction still holds; date unchanged. `lessons/docker-image-and-compose-gotchas.md`: deferred again, as in the third and fourth records, and unverified since — no task yet has touched an image or compose file. The task itself reconciled `work/2026-09-14-v1-gaps.md`: corrected, CI now runs `pnpm -r test` and `AGENTS.md` line 16 already carries it, so that gap is closed. That also settles the fourth record's open item about `work/agents-md-proposal-acceptance-command-tests.md`: no such file exists on `main`, the proposal's substance is in place, and it is not carried forward. Two notes were added, `context/client-side-tests.md` and `context/this-board-has-no-pull-request-preview.md`. Next cursor: `lessons/` entry 3. Earlier records are below.

2026-09-14 (fourth): ordinary review at the end of the "GitHub Actions stopped creating runs" card, which turned out to be a conflicting pull request rather than a settings problem. It supersedes the third record of the same day and carries its open items forward. `lessons/check-the-pull-request-merges-before-reporting.md`: corrected — the same cause produces a second symptom, no `pull_request` run on any head, and the note and its index cue now say so; verification date unchanged, since the conflict claim it already made was re-checked with `git merge-tree` rather than replaced. `work/2026-09-14-v1-gaps.md`: corrected, the backups pull request is merged as `9d22c83` and the Actions card is no longer an open pointer. `work/agents-md-proposal-acceptance-command-tests.md`: checked, `AGENTS.md` line 16 still omits `pnpm -r test` and the Admin has not answered; retained as blocked. `context/minicore-deployment-constraints.md`: deferred again, as in the three earlier records, because its live fleet survey exceeds the incidental bound. `lessons/pnpm-11-build-approvals.md`: not sampled this pass, retained from the third record's check against a clean `pnpm install --frozen-lockfile`; date unchanged. `lessons/docker-image-and-compose-gotchas.md`: still deferred, as in the third record, and unverified since — no task since has touched an image or compose file. Earlier the same day the three preceding records added `lessons/session-token-cannot-push-workflow-files.md`, `lessons/check-the-pull-request-merges-before-reporting.md`, and `work/agents-md-proposal-acceptance-command-tests.md`, and retired `work/2026-09-14-first-implementation.md` to `archive/`; the backup mechanism itself is documented in [the backups runbook](../runbooks/backups.md) rather than memory. Next cursor: `context/` entry 2.
