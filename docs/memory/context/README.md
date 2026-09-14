# Context

Durable workspace knowledge that is expensive to rediscover: hidden constraints, explanations of structure, and recurring procedures whose owner is not another document. Check [document maintenance](../documents.md) before adding a fact another document owns; link to that document instead.

One bullet per topic note, with a relative link and a concrete "read when" cue. Create a note only for a supported finding; keep the facts in the note.

Threshold: 12 entries. Past it, the bounded review in [maintenance](../maintenance.md) samples this category first.

- [minicore deployment constraints](minicore-deployment-constraints.md): read when deploying or exposing a stack on minicore, or picking a host port.
- [Operating Cardboard on minicore](cardboard-production-operations.md): read when deploying a change, rotating a secret, reading a Session log, or querying the production database.
- [Testing client code](client-side-tests.md): read when a change in `packages/app/client` needs a test; there is no DOM harness.
- [The Cardboard board has no per-pull-request preview](this-board-has-no-pull-request-preview.md): read when a card asks for a preview URL or a UI change needs to be seen.
