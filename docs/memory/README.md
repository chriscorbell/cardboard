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

2026-09-14 (fifth): ordinary review at the end of the "Notifications indicator/panel" card, which added in-app notifications beside the existing emails. It supersedes the fourth record of the same day and carries its open items forward. The task itself reconciled no memory note: it changed documented behavior, so [the design](../design.md) Notifications section and [the README](../../README.md) feature list were updated instead, and nothing it found was expensive to rediscover. Sampled from the fourth record's cursor: `context/cardboard-production-operations.md`: checked and retained — `.github/workflows/ci.yml` still builds five images and `deploy/compose.yaml` still declares the four Watchtower-updated services, so the deploy bullet holds; verification date unchanged. `lessons/pnpm-11-build-approvals.md`: checked and retained — `pnpm install --frozen-lockfile` ran the esbuild postinstalls cleanly in this Session with `allowBuilds` in place; date unchanged, same day. `work/2026-09-14-v1-gaps.md`: checked and retained — no item on it was closed or invalidated by this card; notifications were never one of the listed gaps. Carried forward unchanged from the fourth record: `work/agents-md-proposal-acceptance-command-tests.md` is still blocked on the Admin, `context/minicore-deployment-constraints.md` is still deferred for exceeding the incidental bound, `lessons/docker-image-and-compose-gotchas.md` is still deferred and unverified, and `lessons/check-the-pull-request-merges-before-reporting.md` stands as corrected there against `git merge-tree`. The four preceding records of 2026-09-14 added `lessons/session-token-cannot-push-workflow-files.md`, `lessons/check-the-pull-request-merges-before-reporting.md`, and `work/agents-md-proposal-acceptance-command-tests.md`, and retired `work/2026-09-14-first-implementation.md` to `archive/`; the backup mechanism itself lives in [the backups runbook](../runbooks/backups.md) rather than memory. Next cursor: `lessons/` entry 2.
