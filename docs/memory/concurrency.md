# Concurrent writers

Read when more than one agent may write memory at the same time.

Use a separate work note per task, named with a date, descriptive slug, and collision-resistant suffix. For shared topic notes and indexes, coordinate one writer per file. Before writing, compare the file's current content or SHA-256 hash with the version used to draft the change, then apply a narrow edit. If the file changed, reread, merge the latest content, and retry. Recheck the resulting diff.

A hash check followed by a write is not an atomic lock. When exclusive ownership cannot be established, save the proposed change in a unique work note for the next bounded review instead of racing to replace the shared file. Use existing locking or transactional storage if the workspace provides it; these Markdown instructions alone enforce nothing.

Before resuming another writer's work note, verify that the branch, files, and issue state still match it. Search `work/` for notes that a concurrent writer has not yet indexed.
