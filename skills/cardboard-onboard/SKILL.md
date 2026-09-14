---
name: cardboard-onboard
description: Prepare a GitHub repository for Cardboard, the agent-native kanban at cardboard.xode.cc, so its Sessions can clone, change, and open pull requests against it. Use when the user wants to connect, onboard, or set up a repo or project for Cardboard, or asks why Sessions on a board cannot push or merge.
---

# Onboard a repository for Cardboard

A Cardboard **Session** is a disposable container that clones this repository on a branch named `cardboard/<card id>-<slug>`, reads `AGENTS.md`, makes the change a card asks for, runs the repository's acceptance command, pushes, and opens a pull request with `gh`. Cardboard itself merges on Approval through a second GitHub App that bypasses a branch ruleset. Onboarding is done when every item in the final checklist is verified, not merely written.

Work from the repository root. Find the repository with `gh repo view --json nameWithOwner,defaultBranchRef -q '.nameWithOwner + " " + .defaultBranchRef.name'`.

## 1. Write `AGENTS.md` for a Session

A Session reads `AGENTS.md` once and follows it. Reuse an existing `AGENTS.md` or `CLAUDE.md`; create one only if none exists, and keep `CLAUDE.md` a relative symlink to `AGENTS.md`.

The file must give a Session what it cannot discover by looking:

- The **acceptance command** to run before opening a pull request, and what passing looks like. Verify the command yourself by running it; a command you have not run does not go in the file.
- Setup that is not obvious from the manifest: env files to copy, services to start, generated code to build.
- Conventions the code does not enforce: where new pages or modules go, naming, what never to touch.

Leave out anything the environment already states (scripts in `package.json`, the directory tree). A Session's container has Node with pnpm and Bun, Python with uv, Go, git, and `gh`, no Docker, no browser, and a 45-minute wall clock; an acceptance command that needs more than that must be replaced or scoped down here.

Done when: `AGENTS.md` names one acceptance command you ran successfully in this checkout.

## 2. Make pull requests from Session branches usable

- CI must run on pull requests from branches in this repository, since Session branches are same-repo branches. Check the workflow triggers include `pull_request`.
- If the project deploys pull-request previews on its own (Cloudflare Pages, Vercel), note the preview URL pattern in `AGENTS.md` so the Session can link it on the card. Without one, the board runs in external preview mode with no preview link.

Done when: a pull request from a `cardboard/*` branch would get the same checks as any other.

## 3. Install both GitHub Apps on the repository

Only the repository owner can do this; open the two links for the user and wait:

- https://github.com/apps/cardboard-sessions/installations/new
- https://github.com/apps/cardboard-merge/installations/new

Choose "Only select repositories" and pick this repository. On a client-owned repository the client installs them from the same links.

Done when: the board's settings dialog in Cardboard admin shows both apps as installed (step 5 creates the board).

## 4. Protect the default branch with the `cardboard` ruleset

The ruleset requires a pull request with one approval. Its bypass actors are the merge app and repository admins, so a Session's token cannot merge while the owner keeps pushing directly. Create it with the API from [ruleset.json](ruleset.json), which already carries the merge app's actor id:

```bash
gh api -X POST "/repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/rulesets" --input ~/.claude/skills/cardboard-onboard/ruleset.json
```

If the repository already has a ruleset named `cardboard`, leave it. Requires admin on the repository; on a client-owned repository, hand the JSON and the command to the client.

Done when: `gh api /repos/OWNER/REPO/rulesets -q '.[].name'` lists `cardboard` and the ruleset page shows enforcement Active.

## 5. Create the board

The user does this at https://cardboard.xode.cc/admin/boards: name, slug, this repository's URL, provider and model, preview mode (`external` unless the repository has a Dockerfile and runner previews are enabled), and the members who may open it. Members must sign up at cardboard.xode.cc with the invited email before they can sign in.

Done when: the board exists and its settings dialog shows both apps installed.

## 6. Prove the loop

Have the user create one small, concrete card on the board, for example a one-line copy change. Within about a minute a Session starts. Done when the card reaches Review with a pull request link and a passing acceptance command in the pull request, and pressing Approve merges it and moves the card to Done.

## Final checklist

- `AGENTS.md` names a verified acceptance command.
- CI runs on pull requests from same-repo branches.
- Both apps show as installed on the board.
- The `cardboard` ruleset is active on the default branch.
- One card has gone Inbox to Review to Done through a merged pull request.
