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

2026-09-13: ordinary review after the design review. Retained the design, glossary, and ADRs as accepted intent; unresolved discrepancies are recorded in [the review](../design-review.md). Deferred re-verification of `context/minicore-deployment-constraints.md`: its live fleet survey exceeds the incidental review bound, and this task changed no infrastructure. Its verification date is unchanged. `lessons/` and `work/` were empty. Next cursor: `context/` entry 1.
