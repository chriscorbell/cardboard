# A Session's branch can conflict with `main` without the Session noticing

Read when: finishing a card, or resuming one whose pull request is already open.

Status: verified
Scope: every Cardboard board
Verified: 2026-09-14
Source: pull request #2 on this repository, observed `"mergeable": "CONFLICTING"` before the merge commit `d67f5c8`
Recheck when: Sessions stop cloning a fresh workspace per Session, or gain a fetch of the default branch at start

Symptom: a card is reported ready and moved to Review, and pressing Approve would fail. The Session sees nothing wrong: its workspace is a clone made when the Session started, its `origin/main` never moves during the Session, and `git status` is clean.

Cause: `main` advances between Sessions, and a card's branch is often several Sessions old. Pull request #2's branch was cut from the commit before a documentation reconcile on `main`, so it conflicted in three memory index files — exactly the files a documentation-maintaining Session is most likely to touch, which makes this common rather than rare for memory and index edits.

Correction, before reporting and before promising anything about a merge:

```bash
gh pr view <n> --json mergeable,mergeStateStatus --jq '{mergeable, mergeStateStatus}'
```

`CONFLICTING` means resolve it now: `git fetch origin main && git merge origin/main`, resolve, re-run the acceptance command, push. `MERGEABLE` with `mergeStateStatus: BLOCKED` is the normal state for a board repository — the ruleset is waiting for the Approval, not for the Session.

Note that a Session's clone fetches only `refs/heads/main` into `origin/main`. Fetching a card's own branch, or a fresh `main`, needs an explicit `git fetch origin <branch>`.
