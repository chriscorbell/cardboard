# Cardboard design

Cardboard is a self-hosted kanban platform where every human change to a Board summons a disposable coding agent that either does the work or asks for what it needs. This document records the agreed design as of 2026-09-13, revised 2026-09-14 after the first production deployment. Vocabulary is defined in [CONTEXT.md](../CONTEXT.md) and is used here with its glossary meaning. Decisions with real trade-offs have their own record under [docs/adr](adr/).

## Actors

The Admin is the single operator: Chris. Members are invited humans, mostly clients, each granted access to specific Boards. The Agent is one global non-human identity, named "Milo" by default and configurable by the Admin, under which every Session acts on every Board. Members see the Agent as a colleague on the Board: it comments, moves Cards, asks questions, and reports when work is ready.

Access is invite-only. The Admin adds an email address as an Invitation; Clerk authenticates the identity; Cardboard's own User table decides whether that identity is a User and which Boards it may open. An authenticated identity with no Invitation sees a "not invited" page. See [ADR 0001](adr/0001-clerk-for-identity-with-local-allowlist.md).

## Boards and Cards

One Board per project and repository. Six fixed Columns:

| Column | Meaning |
| --- | --- |
| Inbox | Human-created Cards awaiting intake by a Session. Reserved for human creation. |
| Blocked | Waiting on a human answer. |
| Ready | Triaged and actionable, not being worked on. |
| In Progress | A Session is implementing. |
| Review | A pull request and Preview exist; awaiting Approval or feedback. |
| Done | Merged, closed by a human, or a duplicate. |

A Card has a title, Markdown description, Priority (none, low, medium, high), Column, position within the Column, creator, and Comments. Attachments belong to Comments only; an image pasted into a description becomes an Attachment on a system Comment. Authors may edit their own Comments, which shows an "edited" marker; earlier bodies stay in the event log with no history UI. A Mention in a Comment notifies the mentioned User by email. Each Card shows an activity trail of moves, Approvals, and Session starts and ends alongside its Comments. There is no Board-wide feed.

Members may drag Cards anywhere. Inbox to Ready means "do this next". A human move into In Progress or Review is corrected by the next Session or Hygiene sweep, with a one-line Comment explaining the move back.

A human move to Done is an immediate server-side closure: the Card's Done reason is recorded as `closed`, any active Session on the Card is cancelled, its pending re-run is cleared, and any Approval on the Card is invalidated. A merge GitHub has already accepted is completed work and is recorded as Done with reason `merged` instead. Every Card carries a revision number; every mutation from a Session or a sweep names the revision it was based on and is rejected when the Card has moved on, so a stale report cannot reopen a closed Card. Done reasons are `merged`, `closed`, and `duplicate`.

## Sessions

A Trigger is any human change to a Board: Card created, description edited, Comment posted or edited, Card moved. Triggers by the Admin count too, with a per-action silent option. Agent actions are never Triggers.

Triggers coalesce per Card over roughly 60 seconds. When the window closes, Cardboard takes a Claim on the Card and asks the runner to start a card Session. If a Claim already exists, the Card becomes Pending re-run and a new Session starts with the full unhandled batch as soon as the current one ends. Cancelling a Session from the Card clears its pending re-run unless the Admin chooses "cancel and re-run".

Limits: one active Session per Card, three per Board, four globally, and a 45-minute wall clock per Session. All are Admin-configurable. There are no daily count caps in v1.

The app owns a persistent Session lifecycle so that restarts, which Watchtower makes routine, never strand a Claim or duplicate a container. States: `queued`, `starting`, `running`, `finishing`, and the terminal `succeeded`, `failed`, `cancelled`, `timed_out`. Taking the Claim, recording which Triggers the Session consumes, and creating the `queued` row happen in one database transaction. The runner creates containers idempotently by Session ID, so a lost response and a retry produce one container. On startup the app reconciles every non-terminal Session against the runner's inventory: a `starting` Session with no container is retried up to twice and then failed; a `running` Session whose container has exited is finished from its recorded outcome; a Session whose wall clock has passed is timed out. The app, not the container, owns the timeout. Reaching a terminal state releases the Claim, revokes the Session's MCP token, and starts the pending re-run if one exists.

A Session runs in a fresh container from the default agent image published by this repository, or a per-Board override image, as a non-root user with CPU, memory, and pids limits and no Docker socket. It follows one global workflow template, which the Admin may extend per Board with an appended text field:

1. Orient: read the Ledger, the Board, the Card, its Comments and Attachments, and the repository's `AGENTS.md`. Announce intent and expected areas of the codebase to the Ledger. Images are passed to the model as vision input.
2. Classify the Trigger batch: new request, clarification reply, review feedback, Approval, human move, or noise such as a typo fix. Noise ends the Session silently.
3. Plan. Nothing is posted yet.
4. Implement on a branch named after the Card, with tests.
5. Open or update the pull request and make a Preview available.
6. Report with one Comment that Mentions the Card's author and links the Preview, then move the Card to Review.
7. Light Hygiene sweep over the Cards the Session touched.

There is no "started" Comment; the Card shows a status indicator while a Session holds its Claim.

When the request is unclear the Session moves the Card to Blocked and Mentions the author with its question. The reply is a Trigger; the resulting Session moves the Card onward. The Agent never declines work on its own: out-of-scope or risky requests go to Blocked with a Mention of the Admin, not the client. Duplicates are linked in a Comment and moved to Done. Cards left in Blocked for 14 days with no human reply receive one reminder Mention from the nightly sweep.

Sessions may create Cards in any appropriate Column except Inbox, which is reserved for human intake. A large request is split into child Cards linked from a Comment on the parent, and the parent sits in Blocked until the children reach Done. A Comment on a Done Card reopens it: the Session answers, or moves the Card to In Progress, cuts a fresh branch with a `-2` suffix, and opens a new pull request.

Overlapping intents on the Ledger do not block each other. A Session that sees an overlap proceeds and notes it in its report Comment; conflicts are resolved at merge time.

A sweep Session holds no Claim, may move Cards and Comment, and never opens pull requests. It runs nightly at 03:00 minicore local time, waits up to one hour for card Sessions on the Board to finish, and counts against the global cap only.

Members see the status indicator and Comments. The Admin can also cancel a Session from the Card. Cardboard stores per Session its status, timings, Provider, outcome summary, and the Comments it posted. Raw logs are written as files on the runner's bind mount and kept 14 days; the database never holds a transcript.

The Admin, and only the Admin, can read a Session's transcript: expanding a run in the admin panel tails that log file through the runner and renders it as the agent's messages, tool calls, and results. A running Session is followed live. The provider CLI is therefore run in a streaming output mode, so the log fills as the work happens rather than at exit. Nothing is shown to Members, and nothing is redacted: a transcript carries whatever the agent printed, so it is admin-only for the same reason the log file is.

## Review, Approval, and merge

Preview mode is a Board setting. In `external` mode the Session discovers the preview URL from the project's own CI, such as a Cloudflare Pages deployment on the pull request. In `runner` mode Cardboard builds the branch's Dockerfile and runs it as a Preview container at `<card>.preview.xode.cc`; only projects with a Dockerfile may use it. Runner Previews are removed when the Card reaches Done or after seven idle days.

Preview access never relies on a domain-wide cookie. The app's own session cookie is host-only on `cardboard.xode.cc`. Opening a Preview host without a Preview cookie redirects to the app, which checks current Board membership and redirects back with a short-lived, single-use authorization code bound to that Board and that Preview. The preview router exchanges the code for a host-only Preview cookie scoped to that one Preview host, valid for a few hours, and strips every cookie and authorization header before proxying to branch-controlled code. Revoking membership invalidates outstanding Preview cookies for that Board. App mutations require an origin check and a CSRF token, since Preview pages share the parent domain with the app.

Approval is an explicit control on a Card in Review, available to any Member of the Board. It is never inferred from a Comment. See [ADR 0006](adr/0006-approval-is-a-control-not-a-comment.md). Approval records the pull request head SHA the Member reviewed. Cardboard itself then squash-merges with that SHA as GitHub's precondition, deletes the branch, moves the Card to Done, and posts a Comment. If the head changed after Approval, nothing merges and the Member is asked to look again. If the pull request is not mergeable, a Session receives the approval Trigger to update the branch, and the resulting push needs a fresh Approval. Sessions never merge: see [ADR 0008](adr/0008-two-github-apps-for-merge-authority.md). Production deployment is outside Cardboard: the project's own CI deploys on merge, or the Admin cuts a release tag.

## Providers and credentials

Provider is a per-Board default, Claude Code or Codex, with automatic fallback to the other on usage-limit errors (fallback is not yet implemented). A Board may also name the model and a reasoning level (low, medium, high, max), passed to the Provider CLI; empty means the Provider default. Both run on the Admin's personal subscriptions. The Claude Code token is held only by the egress proxy, which injects it on requests to the provider; Session containers never see it. Codex uses its sign-in file inside the container: the runner binds the Admin's file read-only at a staging path and the Session copies it, since Codex rewrites the file when it refreshes its token. Setting `CARDBOARD_CODEX_VIA_EGRESS=1` moves that credential into the egress proxy instead, so a Codex container holds nothing; that route is built but not yet verified against the real ChatGPT backend. A Codex Session with neither is refused by the runner rather than started. See [ADR 0002](adr/0002-subscription-credentials-stay-in-the-egress-proxy.md). Outbound network from Sessions is otherwise unrestricted in v1, a deliberate trade-off recorded in [ADR 0003](adr/0003-unrestricted-agent-egress-in-v1.md).

Repositories live on GitHub. Two GitHub Apps are installed on each repository: each Session receives a one-hour installation token from the Sessions app, scoped to that repository, and only Cardboard uses the Merge app, as the bypass actor of a branch ruleset that otherwise requires an approved pull request. Commits are attributed to the Sessions app's bot identity. See [ADR 0007](adr/0007-github-app-installation-tokens-per-session.md) and [ADR 0008](adr/0008-two-github-apps-for-merge-authority.md). Setup steps are in [deploy/github-apps.md](../deploy/github-apps.md).

Sessions reach Cardboard through an MCP server over HTTP with a session-scoped bearer token. A card Session's token can read its whole Board, Comment on and move any Card of that Board, create Cards, and open or merge pull requests only for its own Card. It cannot see other Boards. A sweep token has no pull-request rights. The web UI uses a REST API behind the same authorization layer, and every mutation from either path lands in the event log with its actor, human or Session.

## Notifications

Triggers: a Mention, and a Card move for the Card's creator. Each trigger both sends an email and records an in-app notification, so the two never disagree. A User is never notified of their own action, and a revoked User is not notified at all.

Resend sends email from `milo@cardboard.xode.cc` (the verified sending domain is `cardboard.xode.cc`) with the sender name set to the Agent's name. Each email carries the Comment body and a deep link to the Card. There is no inbound email; reply-to is a no-reply address. The Admin receives the same emails as any other User.

An Invitation sends its own email, outside the notification triggers: it names the inviting Admin, the Agent, and the address to sign in with, and links to the app rather than to a Card. It goes out when an address is first invited, when an already-invited address is invited again, and when a revoked User is reinstated — the three cases that leave someone waiting to sign in. An active User has already accepted, so re-inviting them sends nothing. The Admin panel can send the invitation again without re-entering the address.

In the app a bell beside the avatar carries a badge with the unread count and opens a panel of the 50 most recent notifications, newest first, with unread ones marked. Opening one marks it read and goes to its Card; the panel can also mark everything read. The panel polls rather than riding a Board's event stream, because it is visible on every page including those outside a Board. A notification is only ever shown to its own User, and only while that User can still open the Board it came from.

## Admin panel, v1 scope

- Users: invite, revoke, grant and remove Board membership.
- Boards: create, repository URL, GitHub App installation status for both apps, preview mode, Provider, model, reasoning level, image override, concurrency caps, prompt append text.
- Agent: name, avatar, global caps.
- Sessions: active list, cancel, cancel and re-run.

## Infrastructure

Cardboard runs on minicore as one compose stack named `cardboard` in `chriscorbell/stacks`, with data under `/home/chris/docker/data/cardboard`:

| Service | Role | Network |
| --- | --- | --- |
| `app` | Web, REST API, MCP server, orchestrator, SQLite | Host port 3070 |
| `runner` | Owns the Docker socket; creates, logs, stops, and removes Session and Preview containers | Internal only |
| `egress` | Credential-injecting proxy for provider traffic | Internal only |
| `preview-router` | Routes `*.preview.xode.cc` by hostname and enforces the signed cookie | Host port, behind the tunnel |

The app keeps its state in SQLite in WAL mode, see [ADR 0004](adr/0004-sqlite-in-a-single-server-process.md). Once a day it writes a snapshot with `VACUUM INTO` to `backups/` on the same bind mount, verifies it, and keeps the newest fourteen; restoring one is an operator procedure with the app stopped, described in [the backups runbook](runbooks/backups.md). Attachments are stored on the data bind mount with content-addressed names and served through the app with membership checks; there are no public file URLs. Only the runner mounts the Docker socket, see [ADR 0005](adr/0005-runner-service-owns-the-docker-socket.md).

Public exposure uses the existing Cloudflare Tunnel with two hostnames added in the Cloudflare dashboard: `cardboard.xode.cc` and `*.preview.xode.cc`. Clerk is the only gate; there is no Cloudflare Access. TLS terminates at Cloudflare's edge.

This repository is a pnpm monorepo in TypeScript with packages for `app` (Vite + React front end, Node back end, Drizzle on SQLite), `runner`, `egress`, `preview-router`, and the agent image. The agent image carries Node with pnpm and Bun, Python with uv, Go, git, gh, and both Provider CLIs. One GitHub Actions workflow, copied from `chriscorbell/invox`, builds and publishes each image to GHCR on push to `main`. Watchtower on minicore updates the four services within a minute; Session and Preview containers carry the Watchtower opt-out label.

## Manual steps the Admin performs

These cannot be automated from inside Cardboard: adding the two tunnel hostnames in the Cloudflare dashboard, verifying `cardboard.xode.cc` in Resend, creating the two GitHub Apps and installing both on each repository ([deploy/github-apps.md](../deploy/github-apps.md)), creating the Clerk application (a secondary application on `cardboard.xode.cc` with Google sign-in), and generating the Claude Code long-lived token with `claude setup-token`. Preparing a repository, including its branch ruleset, is scripted for an agent in [skills/cardboard-onboard](../skills/cardboard-onboard/SKILL.md).

## Status

As of 2026-09-14 the stack runs on minicore at `https://cardboard.xode.cc` and the loop has completed on two repositories, including this one: card, Session, pull request, Approval, merge by Cardboard, deploy. Not yet built: runner-hosted Previews and their cookie flow, Provider fallback, and child-Card dispatch. Codex through the egress proxy is built but unproven against the real backend. [docs/design-review.md](design-review.md) records which review findings are resolved.

## Out of scope for v1

Board archival or deletion, backups beyond the data bind mount, daily Session count caps, transcript viewing, inbound email, Board-wide activity feeds, per-Board custom Columns, egress allowlists, and Git hosts other than GitHub.
