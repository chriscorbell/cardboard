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

2026-09-14 (sixth): ordinary review at the end of the "Live session transcripts" card, which made a Session's container log readable in the admin panel and switched the agent entrypoint to streaming output. It supersedes the fifth record of the same day and carries its open items forward. The task itself corrected `context/cardboard-production-operations.md`: its claim that "Claude Code in print mode writes its whole output at exit, so a running Session's log shows only the clone and start lines" was true and is now false by this change, so the bullet was rewritten with the date the behavior changed and a pointer to the runner's new `GET /sessions/:id/log`, and `Recheck when` gained the entrypoint's output format; verification date unchanged, same day. Changed behavior went to the documents that own it — [the design](../design.md) Sessions section, which previously said no transcript appears in the UI, and [the README](../../README.md) feature list — rather than into memory. Sampled from the fifth record's cursor: `lessons/docker-image-and-compose-gotchas.md`: checked and retained, ending the deferral carried since the second record — `packages/app/Dockerfile` still copies both `packages/shared` and `packages/shared/node_modules` into the runtime stage and `deploy/compose.yaml` still sets `init: true` on all four services; date unchanged, same day. `lessons/session-token-cannot-push-workflow-files.md`: checked and retained — `mintInstallationToken` in `services/github.ts` still narrows a Session token to `contents`, `pull_requests`, `metadata`, so the limit holds; date unchanged. `lessons/check-the-pull-request-merges-before-reporting.md`: checked and retained, and replayed rather than merely read — the merge of `origin/main` before opening this card's pull request is the correction it prescribes. Carried forward unchanged from the fifth record: `work/agents-md-proposal-acceptance-command-tests.md` is still blocked on the Admin, `context/minicore-deployment-constraints.md` is still deferred for exceeding the incidental bound, and `work/2026-09-14-v1-gaps.md` is untouched — session transcripts were never one of its listed gaps, and `lessons/pnpm-11-build-approvals.md` held again here, `pnpm install --frozen-lockfile` running the esbuild postinstalls cleanly. The five preceding records of 2026-09-14 added `lessons/session-token-cannot-push-workflow-files.md`, `lessons/check-the-pull-request-merges-before-reporting.md`, and `work/agents-md-proposal-acceptance-command-tests.md`, and retired `work/2026-09-14-first-implementation.md` to `archive/`; the backup mechanism itself lives in [the backups runbook](../runbooks/backups.md) rather than memory. Next cursor: `work/` entry 1.
