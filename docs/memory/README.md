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

2026-09-15 (seventh): ordinary review at the end of the second pass on the "Enter key in comment box" card, where an Approval was refused because the branch conflicted with `main`. It supersedes the sixth record and carries its open items forward. The task reconciled this index itself: the branch's fifth review record and the fourth below it were dropped in favour of `main`'s sixth, which supersedes the fifth and keeps a single current record; both are in Git history at `33cdd97`, so the recovery rule needed no `history/` copy. The card itself merged as `f69cbbd`; this record and the note corrections below follow it. `lessons/check-the-pull-request-merges-before-reporting.md`: corrected and re-verified to 2026-09-15 — a second occurrence, pull request #3, and two facts it lacked. A refused Approval returns as an `approval` Trigger carrying `"reason":"Pull Request has merge conflicts"`, so the board recovers the case at the cost of a user's press; and a Session resumed on an open card gets a clone whose branch name matches the card but whose `HEAD` is `main`, which reads as a plausible history until the card's branch is fetched by name. Sampled from the sixth record's cursor: `work/2026-09-14-v1-gaps.md`, checked in part and retained — the runner still answers `/previews` with 501 at `packages/runner/src/index.ts:189`, so that gap stands; the note merged cleanly with `main`'s edit to it. `context/minicore-deployment-constraints.md`: deferred again, as in the five earlier records, its live fleet survey still exceeding the incidental bound. `context/cardboard-production-operations.md`: corrected — `images/agent/entrypoint.sh` still passes `--output-format text`, so the log bullet holds today, but the "Live session transcripts" card in flight means to change exactly that, and the note's `Recheck when` now names the flag; verification date unchanged, one claim re-read. Still carried forward from the sixth record: the two image-build bullets in `lessons/docker-image-and-compose-gotchas.md` remain unverified, having exceeded the bound there, and `AGENTS.md` needs no proposal — its acceptance command already runs `pnpm -r test`. Next cursor: `context/` entry 3.


