#!/usr/bin/env bash
# Store a GitHub App's numeric id and downloaded private key (PEM) in deploy/.env, base64-encoded.
# Usage: deploy/add-github-key.sh sessions|merge <app id> <path to .pem>
set -euo pipefail
kind="${1:?sessions|merge}"; app_id="${2:?app id}"; pem="${3:?pem path}"
case "$kind" in sessions) prefix=GITHUB_SESSIONS_APP ;; merge) prefix=GITHUB_MERGE_APP ;; *) echo "kind must be sessions or merge" >&2; exit 64 ;; esac
env_file="$(dirname "$0")/.env"
b64="$(base64 < "$pem" | tr -d '\n')"
tmp="$(mktemp)"
grep -vE "^${prefix}_(ID|PRIVATE_KEY_B64)=" "$env_file" > "$tmp" || true
printf '%s_ID=%s\n%s_PRIVATE_KEY_B64=%s\n' "$prefix" "$app_id" "$prefix" "$b64" >> "$tmp"
mv "$tmp" "$env_file"; chmod 600 "$env_file"
echo "stored ${prefix}_ID and ${prefix}_PRIVATE_KEY_B64 in $env_file"
