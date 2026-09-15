# The Cardboard board has no per-pull-request preview

Read when: a card on the Cardboard board asks for a preview URL, or a UI change needs to be seen before Approval.

Status: verified
Scope: environment, the Cardboard board
Verified: 2026-09-15
Source: `.github/workflows/ci.yml` (publishes images, deploys nothing per pull request); the board record's `previewMode: external`; [the v1 gaps](../work/2026-09-14-v1-gaps.md)
Recheck when: this board's preview mode is changed to `runner`, or CI gains a per-pull-request deployment

The board is in external preview mode, which expects some outside service to publish a preview for the branch. Nothing does: this repository's CI builds and publishes Docker images, and the only deployment is Watchtower pulling `main` onto minicore about a minute after merge. Runner-hosted Previews were built on 2026-09-15 and would cover this board, but three things stand between the code and a URL: the board is still in external mode, the wildcard preview hostname is not on the tunnel with a certificate that covers it, and `CARDBOARD_PREVIEW_SECRET` is unset. Until the Admin does all three, this note still holds.

So a Session on this board cannot record a preview URL, and cannot produce a screenshot: the Session container has no browser (`chromium`, `playwright`, `puppeteer` are all absent, checked 2026-09-14). Do not spend a Session searching for one. Say plainly in the pull request and the report comment that a UI change is unseen in a browser, and describe what was verified instead — tests, typecheck, build. The pull request for the "Backups" card set the same precedent.
