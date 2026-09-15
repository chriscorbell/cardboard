# Rebrand and domain migration

Status: active
Branch: `kardboard/rebrand`, based on `cardboard/mq729nev-preview-setup` at `2f6fc77`.
Source: Chris's 2026-09-14 request to use lowercase `kardboard`, replace the wordmark, move the app to `app.kardboard.cc`, and previews to `{card}.kardboard.cc`.
Close when: branding, production app, authentication, email, and previews use the new domain and are verified.

## Current state

- PR [11](https://github.com/chriscorbell/cardboard/pull/11) remains open. Its root Dockerfile and preview healthcheck fixes are ancestors of this branch. Main is `71e0a7b`.
- Production on minicore still uses `cardboard.xode.cc`; the live preview is `mq729nev-preview.xode.cc`.
- Cloudflare has the new `kardboard.cc` zone with no DNS records. Both requested host patterns fit a first-level wildcard certificate.
- Clerk's production primary domain is `cardboard.xode.cc`. Its documented `POST /v1/instance/change_domain` migrates the existing instance and generates a new Publishable Key. Preserve existing users and secrets; coordinate DNS and deployment. Node fetch works with the existing backend key; Python urllib was rejected by the vendor edge.
- The Resend key in `deploy/.env` permits sending only, so domain administration needs its dashboard.
- Keep internal package names, environment variables, storage paths, and container names compatible. Replace public branding and URLs.

## Next actions

Implement and verify branding, prepare Cloudflare and Clerk DNS, inspect email configuration, then coordinate the authentication and deployment cutover. No new-domain infrastructure changes have been applied yet. Secrets remain in the existing local and remote `.env` files; never copy them into this note.

## Authentication boundary

Use `is_secondary: true` for Clerk with `home_url: https://app.kardboard.cc`. Clerk infrastructure and cookies must stay scoped to `app.kardboard.cc`, because sibling card hosts run branch-controlled JavaScript. Root-scoped Clerk cookies would weaken that boundary. Clerk supplies its own certificates on DNS-only CNAMEs. Root Clerk CNAMEs were initially imported during preparation and need removal after replacing them with `clerk.app`, `accounts.app`, `clkmail.app`, `clk._domainkey.app`, and `clk2._domainkey.app`. App and wildcard proxied DNS records are already present. No Clerk domain change has been applied yet.

## Verified preparation

Lowercase app branding, vector wordmarks, first-level preview defaults, and deployment examples are implemented. The repository acceptance command passed. A temporary dev app is running on localhost:3170 with isolated data under `/tmp/kardboard-rebrand-qa`.

Cloudflare has 12 DNS records: the two app/preview aliases, five correct Clerk records scoped beneath `app`, and five initial root-level Clerk records. Adding the app tunnel route failed because the DNS alias already exists. A user confirmation is pending to delete the seven setup records (app, wildcard, and five root-level Clerk records); then create the two tunnel routes, which also create their DNS aliases. No new tunnel route or Clerk primary-domain change is live yet. Existing xode.cc app remains working.

## Corrected destination

Chris corrected the main app hostname to **kardboard.cc**, with previews still at `{card}.kardboard.cc`. This supersedes the earlier app subdomain and secondary Clerk plan. Use primary Clerk infrastructure at `clerk.kardboard.cc` and `accounts.kardboard.cc`. Clerk documents the session cookie as host-only. Enable the instance subdomain allowlist, permit the accounts portal only, and keep backend `authorizedParties` pinned to `https://kardboard.cc` so preview hosts cannot use Clerk as an alternate app origin. Verify those restrictions before cutover.

Chris approved deleting/recreating the seven temporary setup records; deletion succeeded. App tunnel route `app.kardboard.cc` to port 3070 and wildcard route `*.kardboard.cc` to port 3073 were then saved. App DNS was recreated automatically. Wildcard tunnel routes do not create DNS automatically, so its DNS still needs recreation. Keep app.kardboard.cc as a redirect alias after adding the apex route. Rename the five scoped Clerk DNS records back to their root-level names for the corrected destination.

Resend domain `kardboard.cc` was created (id `0b01ca95-7252-4f8b-a33c-8a6feaa51988`). Its four DNS records are prepared in `/tmp/kardboard-email.zone`, but not imported or verified yet.
