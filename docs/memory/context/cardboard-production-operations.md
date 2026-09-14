# Operating Cardboard on minicore

Read when: deploying a change to production, rotating a secret, reading a Session's log, or inspecting the production database.
Status: verified
Scope: environment, minicore
Verified: 2026-09-14
Source: the deployment and Session runs of 2026-09-14; `deploy/compose.yaml`; `~/Code/stacks/cardboard/compose.yaml`
Recheck when: the compose file moves, the runner's log directory changes, or the app image stops bundling `@libsql/client`

- Code deploys itself: push to `main`, CI publishes five images, Watchtower restarts the four services within a minute. Every push rebuilds all five images, so every service restarts on every push.
- Secrets never leave `deploy/.env` on mbp except by `scp deploy/.env minicore:/home/chris/docker/stacks/cardboard/.env` followed by `docker compose up -d` in that directory. The compose file itself is committed in `chriscorbell/stacks` under `cardboard/`; `git pull` there before `up -d`.
- Session logs: `~/docker/data/cardboard/runner/logs/<session id>.log` on minicore, kept 14 days. Claude Code in print mode writes its whole output at exit, so a running Session's log shows only the clone and start lines.
- Production database: no `sqlite3` in the image. Query it with `docker compose exec app node -e` using `@libsql/client` against `file:/data/cardboard.db`.
- Service health: `curl http://127.0.0.1:3070/healthz` on minicore, `docker compose ps` in the stack directory. Public check: `https://cardboard.xode.cc/healthz`.
- Session containers carry the label `cardboard.session=<id>`; `docker ps -a --filter label=cardboard.session` lists them. The runner removes them after exit.
