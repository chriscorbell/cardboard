# Rebrand and domain migration

Status: active
Branch: `kardboard/rebrand`, including the preview setup commits from PR 11.
Source: Chris's 2026-09-14 request for lowercase `kardboard`, with the corrected canonical app URL `https://kardboard.cc` and previews at `{card}.kardboard.cc`.
Close when: branding is deployed, the app and previews work on the new domain, and legacy app links redirect.

## Verified state, 2026-09-15 UTC

- GitHub repository renamed to [chriscorbell/kardboard](https://github.com/chriscorbell/kardboard), with the same repository ID and ruleset. Local origin updated. Public branding is committed in [PR 12](https://github.com/chriscorbell/kardboard/pull/12), but production still runs main `71e0a7b`.
- The full acceptance command passed after the runtime Clerk config fix. Local browser verification showed the lowercase wordmark and working dev authentication. QA used localhost:3170 and isolated `/tmp/kardboard-rebrand-qa` data.
- Cloudflare routes the apex and `app` alias to port 3070, the proxied wildcard to port 3073, and unknown previews to 404. The seven transient setup records were deleted with Chris's approval. Five Clerk records now use the correct root-level names. No paid certificate add-on is required.
- Clerk's existing production instance moved to the root domain. Users and Secret Key were preserved; the new Publishable Key is in local and remote deploy configuration. All five DNS records verified. Domain change regenerated the three mail CNAME targets. HTTPS frontend API works; the dashboard confirms both certificates are issued.
- Clerk allows the root and accounts portal origins. `/v1/client` returns 403 `subdomain_not_allowed` for a preview origin. Backend code also pins token `authorizedParties` to the root. Real Google sign-in at the new root succeeded; that account has no Board memberships, which were left unchanged. Admin email-code sign-in also succeeded, followed by browser access to the rebuilt preview, which showed the lowercase wordmark and separate demo data.
- Google OAuth client and consent branding updated with the new root, callback, and lowercase name. Old URLs remain registered during transition. Google says consent branding requires verification; no verification request was submitted.
- Resend verified the new domain. The existing sending key was renamed and restricted to it without changing its value. Production sender is `Milo <milo@kardboard.cc>`. No test email was sent.
- Stacks commit `ee0d81a` applied on minicore. App and preview router were recreated with the new public URL, key, sender, and `{card}.{domain}` pattern. Existing data, image names, packages, environment names, and network names remain stable.
- Board `6w2vc9ztmx4yrh` is named `kardboard`; its slug remains `cardboard`. Its repository URL is updated, and both GitHub Apps remain installed under the new repository name. Card `mq729nev6f9jy5` and its live preview registry now use `https://mq729nev.kardboard.cc`. Anonymous preview access redirects to the new app. Board preview epoch incremented to revoke old cookies.
- Pre-cutover database snapshot `cardboard-20260915T032551Z.db` verified. Private environment backups are under `~/.local/state/cardboard/` on mbp and minicore. Never copy their contents into documentation.

## Release gate

[PR 12](https://github.com/chriscorbell/kardboard/pull/12) combines the rebrand and PR 11 preview setup fixes. PR 11 is closed. Card mq729n points to PR 12 and branch `kardboard/rebrand`; its Preview was rebuilt successfully from `4fcc860` and verified in the browser. GitHub validation passed. The remaining gate is GitHub's required approving review. The interactive owner has an Admin bypass, but no merge has been performed.

After release authorization, merge the reviewed head, wait for all five CI image publications and Watchtower deployment, and verify the live lowercase wordmark, redirects, and authorized preview access with the new backend origin restriction. Record the release revision and close this note when the live code matches the new configuration. The preview reflects the implementation; later commits only record verification.
