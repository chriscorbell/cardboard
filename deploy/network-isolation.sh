#!/bin/sh
# Keep kardboard Session and Preview containers off the LAN.
#
# Docker gives every container NAT to everything the host can route, which on minicore includes
# 10.0.0.0/24 and every other stack's bridge. ADR 0003 accepts that a Session reaches the public
# internet; it does not accept that a Session reaches the rest of the house. Docker has no per-
# network egress filter, so the rule lives in the host firewall.
#
# Session bridges are named cbn<hash> by the runner and the preview bridge is cbnprev in
# deploy/compose.yaml, so a single `cbn+` interface match covers both kinds and needs no update
# when a Session starts. Traffic between a container and the services on its own bridge leaves on
# a `cbn*` interface too and is exempt; Docker's own DOCKER-ISOLATION chains already keep one
# bridge away from another.
#
#   ./network-isolation.sh apply    insert the rules (idempotent)
#   ./network-isolation.sh check    list what is currently installed
#   ./network-isolation.sh remove   take them out again
#
# iptables does not survive a host reboot or a `systemctl restart docker` that rebuilds the
# chains. Re-run `apply` after either, or persist it; see docs/runbooks/network-isolation.md.

set -eu

PREFIX="${KARDBOARD_BRIDGE_PREFIX:-cbn}"
TAG="kardboard-lan-isolation"

# RFC 1918 plus link-local (which carries cloud metadata services) and the carrier-grade range.
PRIVATE="10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 169.254.0.0/16 100.64.0.0/10"

ipt() { iptables "$@"; }

host_lan_ip() {
  ip -4 route get 1.1.1.1 2>/dev/null | sed -n 's/.* src \([0-9.]*\).*/\1/p' | head -n 1
}

# The host's own address is reached over INPUT, not FORWARD, so DOCKER-USER never sees it.
input_rule() {
  lan=$(host_lan_ip)
  [ -n "$lan" ] || { echo "could not determine the host LAN address; skipping the INPUT rule" >&2; return 1; }
  echo "INPUT -i ${PREFIX}+ -d ${lan} -m comment --comment ${TAG} -j DROP"
}

forward_rules() {
  for cidr in $PRIVATE; do
    echo "DOCKER-USER -i ${PREFIX}+ ! -o ${PREFIX}+ -d ${cidr} -m comment --comment ${TAG} -j DROP"
  done
}

all_rules() {
  forward_rules
  input_rule || true
}

apply() {
  ipt -L DOCKER-USER -n >/dev/null 2>&1 || { echo "DOCKER-USER is missing: is Docker running?" >&2; exit 1; }
  all_rules | while read -r chain rest; do
    # shellcheck disable=SC2086
    if ipt -C "$chain" $rest 2>/dev/null; then
      echo "already present: $chain $rest"
    else
      # shellcheck disable=SC2086
      ipt -I "$chain" 1 $rest
      echo "inserted: $chain $rest"
    fi
  done
  echo "kardboard containers on ${PREFIX}* bridges can no longer reach the LAN."
}

remove() {
  all_rules | while read -r chain rest; do
    # shellcheck disable=SC2086
    while ipt -C "$chain" $rest 2>/dev/null; do
      # shellcheck disable=SC2086
      ipt -D "$chain" $rest
      echo "removed: $chain $rest"
    done
  done
}

check() {
  installed=$(for chain in DOCKER-USER INPUT; do iptables -S "$chain" 2>/dev/null | sed -n "/$TAG/s|^|$chain |p"; done)
  if [ -n "$installed" ]; then echo "$installed"; else echo "no ${TAG} rules are installed."; fi
  echo
  echo "bridges these rules cover:"
  ip -o link show 2>/dev/null | sed -n "s/^[0-9]*: \(${PREFIX}[^:@]*\).*/  \1/p" || true
}

case "${1:-}" in
  apply) apply ;;
  remove) remove ;;
  check) check ;;
  *) echo "usage: $0 apply|check|remove" >&2; exit 2 ;;
esac
