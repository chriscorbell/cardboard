# Image and compose mistakes that broke the first deployment

Read when: a service image fails at startup with a missing module, a container takes 30 seconds to stop, or a `/api/internal` call returns 401.
Status: verified
Scope: workspace
Verified: 2026-09-14
Source: production log excerpts of 2026-09-14 recorded in `work/` history; fixes in `packages/app/Dockerfile`, `deploy/compose.yaml`, `packages/app/server/src/index.ts`
Recheck when: the workspace layout or the Node base image changes

- The app image must copy `packages/shared` source and `packages/shared/node_modules` into the runtime stage: Node resolves `@cardboard/shared` through a workspace symlink to TypeScript source, and that package's own `zod` link lives beside it. Copying only `package.json` fails at boot with `ERR_MODULE_NOT_FOUND`.
- A package with no runtime dependencies gets no `node_modules` directory from pnpm, and a `COPY --from` of that path fails the build. The service Dockerfiles `mkdir -p` it.
- `node` as PID 1 ignores SIGTERM, so Watchtower waited the full 30 s per container. `init: true` on each compose service fixed it; restarts now take under a second.
- Hono matches routers in registration order. A router registered under `/api` with a user-auth middleware also guards `/api/internal/*` unless the internal router is registered first. Symptom: the runner's exit report answered 401 and Sessions stayed "running".
