# GitHub Apps for Cardboard

Cardboard uses two GitHub Apps with identical repository permissions and different trust. Sessions
receive one-hour tokens from the first and can push branches and open pull requests. Only the app
itself, on a recorded Approval, uses the second to merge. A branch ruleset on the default branch
requires a pull request with one approval and lists the merge app as its only bypass actor, so a
Session cannot merge its own work no matter what its prompt says. See ADR 0008.

## 1. Create the apps

Twice, at https://github.com/settings/apps/new (once per app):

| Field | cardboard-sessions | cardboard-merge |
| --- | --- | --- |
| GitHub App name | Cardboard Sessions | Cardboard Merge |
| Homepage URL | https://cardboard.xode.cc | https://cardboard.xode.cc |
| Webhook | Uncheck **Active** | Uncheck **Active** |
| Repository permissions | Contents: Read and write. Pull requests: Read and write. Metadata: Read. | Same |
| Where can this app be installed | Only on this account | Only on this account |

After creating each app: note the **App ID** on its settings page, then **Generate a private key**
and keep the downloaded `.pem`. Store both with:

```bash
deploy/add-github-key.sh sessions <app id> ~/Downloads/cardboard-sessions.<date>.private-key.pem
deploy/add-github-key.sh merge <app id> ~/Downloads/cardboard-merge.<date>.private-key.pem
```

If you named the apps differently, set `GITHUB_SESSIONS_APP_SLUG` and `GITHUB_MERGE_APP_SLUG` in
`deploy/.env` to the app slugs (the URL name). Commits from Sessions appear as `<slug>[bot]`.

## 2. Install both apps on each project repository

From each app's settings page, **Install App**, pick the account, choose **Only select
repositories**, and select the repository. A client-owned repository works the same way once the
client installs both apps on it. The board settings dialog in the admin panel shows whether each
app is installed on the board's repository.

## 3. Protect the default branch

In the repository: Settings, Rules, Rulesets, **New branch ruleset**.

- Name: `cardboard`, enforcement **Active**, target **Default branch**.
- Bypass list: add the **Cardboard Merge** app, mode **Always**.
- Rules: **Require a pull request before merging** with **Required approvals: 1**. Leave
  "Dismiss stale approvals" on. Optionally **Block force pushes** and **Restrict deletions**.

With that ruleset, `cardboard-sessions[bot]` can push branches and open pull requests but every
merge attempt from it fails, while the app's own merge on Approval succeeds through the bypass.

## 4. Deploy

Copy `deploy/.env` to minicore and recreate the app service:

```bash
scp deploy/.env minicore:/home/chris/docker/stacks/cardboard/.env
ssh minicore 'cd ~/docker/stacks/cardboard && docker compose up -d app'
```
