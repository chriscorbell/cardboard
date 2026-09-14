# pnpm 11 refuses postinstall builds until each package is listed

Read when: `pnpm install` or `pnpm exec` fails with `ERR_PNPM_IGNORED_BUILDS`, or a dependency with a native or postinstall step (esbuild, @clerk/shared, ssh2, protobufjs) appears to be missing.
Status: verified
Scope: workspace
Verified: 2026-09-14
Source: observed in this workspace on 2026-09-13 with pnpm 11.25.0; re-checked 2026-09-14 in a Session container, where `pnpm install --frozen-lockfile` ran the esbuild and `@clerk/shared` postinstalls with the correction below in place; check `pnpm-workspace.yaml`
Recheck when: pnpm major version changes

Symptom: every `pnpm exec` and `pnpm --filter` command re-ran the dependency check, which re-ran `pnpm install`, which exited 1 with `Ignored build scripts`. `onlyBuiltDependencies` in `pnpm-workspace.yaml` did not clear it. Correction: list each package under `allowBuilds` in `pnpm-workspace.yaml` with `true` or `false` (both count as decided), and set `verify-deps-before-run=false` in `.npmrc` so `pnpm exec` stops re-running install. Verified by `pnpm install` finishing and `pnpm -r typecheck` running.
