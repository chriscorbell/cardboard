# Proposal: `AGENTS.md` says Docker images are built when the pull request opens; they are built after merge

Status: blocked, awaiting the Admin
Objective: correct one factual claim in `AGENTS.md` that can send a Session waiting for a job that will never run.
Branch: found on `cardboard/tgf5su6p-codex-as-a-provider`; the correction itself is not made there.

## Target section

`AGENTS.md`, "Working in a Cardboard Session", first bullet of "Facts a Session cannot see from the tree".

Current text:

> - Docker images are built only by CI after the pull request opens. A change to a `Dockerfile`, `deploy/compose.yaml`, or `.github/workflows/ci.yml` is unproven until the `publish` job is green; say so in the pull request.

Exact replacement:

> - Docker images are built only after a merge to `main`, never on a pull request: the `publish` job is gated on `github.event_name == 'push' && github.ref == 'refs/heads/main'`, and reports "skipping" on a pull request. A change to a `Dockerfile`, `deploy/compose.yaml`, or `.github/workflows/ci.yml` therefore cannot be proven before Approval — say so in the pull request, and do not wait for `publish` to go green on it. `publish` sets `fail-fast: false`, so a broken image build leaves that one image unpublished while the others deploy.

## Evidence

Observed 2026-09-15 on pull request #8:

```
$ gh pr checks 8
publish   skipping  0   ...
validate  pass      42s ...
```

`.github/workflows/ci.yml` gates the job with `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`, under `strategy: fail-fast: false`.

## Authority needed

`AGENTS.md` is an instruction file, and this changes a workflow obligation rather than repairing a pointer, so [document maintenance](../documents.md) makes it a proposal rather than a delegated repair. It needs the Admin.

## Why it matters

A Session told that images build "after the pull request opens" can wait for evidence that never arrives, or report an image change as proven when nothing built it. The "Codex as a provider" card changed `images/agent/Dockerfile` and hit exactly this.

Two smaller inaccuracies sit nearby, both in files a Session cannot push. The header comment of `.github/workflows/ci.yml` says "every push to main publishes four images" while the matrix builds five. [The production operations note](../context/cardboard-production-operations.md) says five, which is correct.

Next action: ask the Admin to apply the replacement above, or to say the current wording is intended.
Close when: `AGENTS.md` states when images are actually built, or the Admin rejects the change.
