#!/usr/bin/env bash
# Session entrypoint. The runner passes configuration in the environment and the workflow prompt
# on stdin. The agent reaches Cardboard through MCP with the session token and the provider
# through the egress proxy. Exit code 0 means the agent finished on its own terms.
set -euo pipefail

: "${CARDBOARD_SESSION_ID:?}" "${CARDBOARD_TOKEN:?}" "${CARDBOARD_MCP_URL:?}" "${CARDBOARD_PROVIDER:?}"
PROMPT="$(cat)"
WALL_CLOCK_MINUTES="${CARDBOARD_WALL_CLOCK_MINUTES:-45}"

log() { printf '[session %s] %s\n' "$CARDBOARD_SESSION_ID" "$*" >&2; }

if [ -n "${CARDBOARD_REPO_URL:-}" ]; then
  log "cloning $CARDBOARD_REPO_URL"
  # GITHUB_TOKEN is a one-hour installation token minted by the app (not wired yet; falls back to anonymous clone).
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    git -c credential.helper='!f() { echo "username=x-access-token"; echo "password=$GITHUB_TOKEN"; }; f' clone --depth=50 "$CARDBOARD_REPO_URL" repo
    git -C repo config credential.helper '!f() { echo "username=x-access-token"; echo "password=$GITHUB_TOKEN"; }; f'
  else
    git clone --depth=50 "$CARDBOARD_REPO_URL" repo
  fi
  cd repo
  git config user.name "${CARDBOARD_GIT_NAME:-Milo}"
  git config user.email "${CARDBOARD_GIT_EMAIL:-cardboard@xode.cc}"
  if [ -n "${CARDBOARD_BRANCH:-}" ]; then
    git checkout -B "$CARDBOARD_BRANCH" "origin/$CARDBOARD_BRANCH" 2>/dev/null || git checkout -b "$CARDBOARD_BRANCH"
  fi
fi

# MCP config for both providers.
mkdir -p "$HOME/.codex"
cat > /tmp/mcp.json <<JSON
{ "mcpServers": { "cardboard": { "type": "http", "url": "$CARDBOARD_MCP_URL", "headers": { "Authorization": "Bearer $CARDBOARD_TOKEN" } } } }
JSON

case "$CARDBOARD_PROVIDER" in
  claude)
    log "starting claude code"
    MODEL_ARGS=(); [ -n "${CARDBOARD_MODEL:-}" ] && MODEL_ARGS=(--model "$CARDBOARD_MODEL")
    # Effort level: Claude Code reads CLAUDE_CODE_EFFORT_LEVEL (low, medium, high, max).
    [ -n "${CARDBOARD_REASONING:-}" ] && export CLAUDE_CODE_EFFORT_LEVEL="$CARDBOARD_REASONING"
    # stream-json, not text: text prints nothing until the run ends, so the container log — which is
    # what the admin panel shows as the Session's transcript — would stay empty for the whole run.
    exec timeout --signal=TERM "${WALL_CLOCK_MINUTES}m" \
      claude -p "$PROMPT" "${MODEL_ARGS[@]}" \
        --mcp-config /tmp/mcp.json \
        --permission-mode acceptEdits \
        --allowedTools "mcp__cardboard__*,Bash,Read,Edit,Write,Glob,Grep,WebFetch" \
        --output-format stream-json --verbose
    ;;
  codex)
    log "starting codex"
    cat > "$HOME/.codex/config.toml" <<TOML
[mcp_servers.cardboard]
url = "$CARDBOARD_MCP_URL"
http_headers = { "Authorization" = "Bearer $CARDBOARD_TOKEN" }
TOML
    MODEL_ARGS=(); [ -n "${CARDBOARD_MODEL:-}" ] && MODEL_ARGS=(-m "$CARDBOARD_MODEL")
    # Codex calls the top level "xhigh"; Cardboard's "max" maps to it.
    if [ -n "${CARDBOARD_REASONING:-}" ]; then
      EFFORT="$CARDBOARD_REASONING"; [ "$EFFORT" = "max" ] && EFFORT="xhigh"
      MODEL_ARGS+=(-c "model_reasoning_effort=\"$EFFORT\"")
    fi
    exec timeout --signal=TERM "${WALL_CLOCK_MINUTES}m" \
      codex exec --full-auto "${MODEL_ARGS[@]}" "$PROMPT"
    ;;
  *)
    log "unknown provider $CARDBOARD_PROVIDER"; exit 64 ;;
esac
