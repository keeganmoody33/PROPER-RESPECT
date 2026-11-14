#!/bin/sh
# Stops only the server launch.sh started on PORT, and its child processes. Evidence under .artifacts/ stays.
# Usage: .claude/skills/verify/scripts/teardown.sh PORT
set -u
PORT="${1:?usage: teardown.sh PORT}"
ROOT="$(git rev-parse --show-toplevel)"
PIDFILE="$ROOT/.artifacts/verify/server-$PORT.pid"
if [ ! -f "$PIDFILE" ]; then echo "No server of ours is recorded on $PORT. Nothing stopped."; exit 0; fi

descendants() { for child in $(pgrep -P "$1" 2>/dev/null); do descendants "$child"; done; echo "$1"; }
pids="$(descendants "$(cat "$PIDFILE")")"
# shellcheck disable=SC2086
kill $pids 2>/dev/null || true

tries=0
while lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; do
  tries=$((tries + 1))
  if [ "$tries" -gt 10 ]; then echo "Port $PORT still has a listener. Run doctor.sh $PORT; it may not be ours." >&2; exit 1; fi
  sleep 1
done
rm -f "$PIDFILE"
if ! git -C "$ROOT" diff --quiet -- next-env.d.ts; then
  git -C "$ROOT" checkout -q -- next-env.d.ts && echo "restored next-env.d.ts (next dev rewrites it on start)"
fi
echo "stopped $PORT. Evidence kept under $ROOT/.artifacts/"
