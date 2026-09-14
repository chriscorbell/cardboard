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

2026-09-14 (third): ordinary review at the end of the "Backups" card, after the CI test step turned out to be unpushable from a Session. It supersedes the two records of the same day and carries their open items forward. `lessons/pnpm-11-build-approvals.md`: checked against a clean `pnpm install --frozen-lockfile` in this Session container, which ran the esbuild and `@clerk/shared` postinstalls; retained, date unchanged. `lessons/docker-image-and-compose-gotchas.md`: read, not verified — this task touched no image or compose file; deferred, date unchanged. `work/2026-09-14-v1-gaps.md`: corrected, the snapshot-procedure item is answered by the backups change and its production observations are now listed as unverified. `context/minicore-deployment-constraints.md`: still deferred, as in both earlier records, because its live fleet survey exceeds the incidental bound. Added `lessons/session-token-cannot-push-workflow-files.md` and `work/agents-md-proposal-acceptance-command-tests.md`; retired `work/2026-09-14-first-implementation.md` to `archive/` earlier the same day. The backup mechanism itself is documented in [the backups runbook](../runbooks/backups.md) rather than memory. Also added `lessons/check-the-pull-request-merges-before-reporting.md` after this pull request was found conflicting with `main`. Next cursor: `work/` entry 1.
