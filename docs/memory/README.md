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
- [Decision records](../adr/): seven ADRs covering identity, credentials, egress, storage, the runner, Approval, and GitHub tokens.
- [Design review](../design-review.md): eight findings against the design, dated 2026-09-13, not yet decided. Read before implementing Sessions, GitHub writes, or Previews; it does not supersede accepted decisions.
- [README](../../README.md): how to run, build, and deploy; the Status section says what is not built.

## Review record

2026-09-14: ordinary review after deduplicating the Design review row in this index. `context/minicore-deployment-constraints.md` deferred again: its live fleet survey exceeds the incidental review bound and this task changed no infrastructure, so its verification date is unchanged. `lessons/pnpm-11-build-approvals.md` checked against `pnpm-workspace.yaml`, `.npmrc`, and a passing `pnpm install --frozen-lockfile`; retained with the date refreshed. `work/2026-09-14-first-implementation.md` checked and retained: its close condition is met, but its next action (design-review findings 3, 5, and 6) is still open. Next cursor: `context/` entry 1.
