# Runner-hosted previews

## minicore configuration

The setup for Card mq729n was verified on 2026-09-15 UTC:

- Preview URLs use `{card}-preview.xode.cc`, where `{card}` is the first eight characters of the Card ID. `CARDBOARD_PREVIEW_HOST_PATTERN={card}-preview.{domain}` selects this shape; the app derives `xode.cc` from its public URL.
- The `homelab` Cloudflare Tunnel routes `cardboard.xode.cc` to `http://10.0.0.20:3070`. A later `*.xode.cc` rule routes previews to `http://10.0.0.20:3073`.
- A proxied wildcard CNAME named `*` points to the same tunnel as the `cardboard` DNS record. Existing explicit records retain precedence.
- Cloudflare's active certificate covers `xode.cc` and `*.xode.cc`. No paid certificate add-on is enabled.
- The app and preview router share `CARDBOARD_PREVIEW_SECRET`. The runner uses `CARDBOARD_PREVIEW_NETWORK=cardboard_preview`; only preview containers and the preview router join that network.

`*-preview.xode.cc` is not a working wildcard. Cloudflared's hostname matcher requires a `*.` prefix. For this URL shape, use `*.xode.cc` for both DNS and tunnel routing, and keep exact tunnel routes before it. Unknown hosts return 404 from the preview router. See [Cloudflare's wildcard DNS rules](https://developers.cloudflare.com/dns/manage-dns-records/reference/wildcard-dns-records/) and [its hostname matcher](https://github.com/cloudflare/cloudflared/blob/master/ingress/ingress.go).

`{card}.cardboard.xode.cc` would require a certificate covering `*.cardboard.xode.cc`. On the current full DNS setup, Universal SSL does not cover that depth. Chris chose the free pattern after reviewing Cloudflare's $10/month Advanced Certificate Manager option. See [Universal SSL limitations](https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/limitations/).

## Host changes

Compose reads values from `.env`; it does not execute shell commands in that file. Run `openssl rand -base64 32` in a terminal, then save its output as `CARDBOARD_PREVIEW_SECRET`. Saving `$(openssl rand -base64 32)` literally creates a predictable value instead. Do not print or commit the secret. Changing an existing secret signs open previews out.

Keep `deploy/compose.yaml` and `chriscorbell/stacks/cardboard/compose.yaml` aligned. Publish the stacks change, pull it on minicore, copy `deploy/.env` to `/home/chris/docker/stacks/cardboard/.env`, and run `docker compose up -d`. Watchtower updates images but does not apply Compose changes.

Check both `http://127.0.0.1:3070/healthz` and `http://127.0.0.1:3073/healthz` on minicore. Request an unused `https://<id>-preview.xode.cc/` hostname: valid TLS followed by `No preview at this address.` confirms DNS and tunnel routing. It does not prove an image builds or a Member can sign in.

## Enable a Board

Set the Board's preview mode to `runner`. Its repository needs a root `Dockerfile` that starts a server on `$PORT`, currently 3000. This repository links that path to `packages/app/Dockerfile`; its health check uses the same port. The app starts with its own seeded database in dev authentication mode, behind the production preview router's membership gate. The preview container receives no production credentials or host mounts.

A Session pushes its branch and calls `request_preview`. The Card receives a URL while the image builds. A Member without a Preview cookie is redirected to Cardboard to sign in. The router exchanges a single-use code for a host-only cookie and strips cookies and authorization headers before forwarding the request.

## Verification and limits

A temporary Member and preview were checked through the deployed app, public HTTPS tunnel, and preview router. The check verified the sign-in redirect, code exchange, Secure/HttpOnly/SameSite=Lax cookie without a Domain attribute, code replay rejection, removal of cookie and authorization headers, and revocation after membership removal. Temporary records and the header-check container were removed afterwards. This exercised membership authorization with a synthetic Member; it did not exercise a real Member's Clerk sign-in.

The router polls routes every 15 seconds. Membership revocation therefore takes effect on the next successful refresh. A failed refresh keeps the last routing table. A separate preview Docker network is verified, but access through the Docker host's published ports and other LAN services has not been audited.
