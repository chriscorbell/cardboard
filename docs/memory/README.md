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

2026-09-14 (sixth): ordinary review at the end of the "Invitation emails" card, which made an Invitation send an email. It supersedes the fifth record of the same day and carries its open items forward. The task reconciled `work/2026-09-14-v1-gaps.md`: invitation emails moved off the open list and onto the unverified-in-production list, because no invitation has yet been delivered through Resend by the deployed app. It changed documented behavior, so [the design](../design.md) Notifications section and Status and [the README](../../README.md) feature list and Status were updated in the same change. Sampled from the fifth record's cursor, `lessons/` entry 2. `lessons/docker-image-and-compose-gotchas.md`: checked in part and retained — `deploy/compose.yaml` still carries `init: true` on four services and `packages/app/server/src/index.ts` still registers `/api/internal` before `/api`; the two image-build bullets exceeded the bound, so the verification date is unchanged. `lessons/session-token-cannot-push-workflow-files.md`: corrected against `services/github.ts` — the quoted `mintInstallationToken` body no longer matched the source, and the caveat it carried is answered there: only a `sessions` token narrows its permissions, so the merge token holds whatever the Merge App installation holds and a workflow-touching pull request is mergeable once that App has `workflows: write`. The Session-side conclusion is unchanged. `lessons/check-the-pull-request-merges-before-reporting.md`: checked and retained — followed in this Session, where `gh pr view 5 --json mergeable,mergeStateStatus` answered `MERGEABLE`/`BLOCKED`, the normal board state the note describes; date unchanged, same day. Correction to the two preceding records: `work/agents-md-proposal-acceptance-command-tests.md` does not exist, in `work/` or in its index, and `AGENTS.md` already runs `pnpm -r test` in the acceptance command, so the proposal it carried is satisfied and is no longer carried forward. Still carried forward unchanged: `context/minicore-deployment-constraints.md` is deferred for exceeding the incidental bound, and `context/cardboard-production-operations.md` stands as checked in the fifth record. Next cursor: `work/` entry 1.

