# Runner previews on the kardboard Board

Read when: requesting a preview on the kardboard Board, or working from a branch created before runner previews were enabled.
Status: verified
Scope: environment, the kardboard Board
Verified: 2026-09-15 UTC
Source: production Board configuration and access checks for Card mq729n; [PR 11](https://github.com/chriscorbell/kardboard/pull/11); [preview runbook](../../runbooks/previews.md)
Recheck when: the Board preview mode, root Dockerfile, or Cloudflare routing changes

The Board now uses `runner` preview mode. Card mq729n has a working preview built by the deployed runner from PR 11, opened through the Admin's existing browser sign-in. DNS, the tunnel, the shared secret, and the preview network are configured on minicore. URLs use `{card}.kardboard.cc`; the certificate and setup details belong in the runbook.

PR 11 adds the root Dockerfile required by the runner and a health check that follows `$PORT`. Until that PR is merged, other branches need those files before they can build a preview. A preview request builds the branch, so an old branch without the Dockerfile remains broken even after main has it.

A Session container still has no installed browser, as checked on 2026-09-14. It can request a preview URL for the Admin to inspect, but should not claim a visual check it did not perform.
