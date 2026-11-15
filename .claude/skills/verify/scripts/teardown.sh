#!/bin/sh
# Stops only the server launch.sh started on PORT, and its child processes. Evidence under .artifacts/ stays.
# It signals a process only if that pid still has the start time launch.sh recorded; a reused pid is left alone.
# Usage: .claude/skills/verify/scripts/teardown.sh PORT
set -u
PORT="${1:?usage: teardown.sh PORT}"
ROOT="$(git rev-parse --show-toplevel)"
STATE="$ROOT/.artifacts/verify"
PIDFILE="$STATE/server-$PORT.pid"
if [ ! -f "$PIDFILE" ]; then echo "No server of ours is recorded on $PORT. Nothing stopped."; exit 0; fi

IFS='|' read -r PID STARTED <"$PIDFILE"
CURRENT="$(ps -o lstart= -p "$PID" 2>/dev/null | sed 's/^ *//')"
descendants() { for child in $(pgrep -P "$1" 2>/dev/null); do descendants "$child"; done; echo "$1"; }
if [ -z "$CURRENT" ]; then
  echo "The server launch.sh recorded (pid $PID) has already exited."
elif [ "$CURRENT" != "$STARTED" ]; then
  echo "pid $PID is now a different process (started $CURRENT, not $STARTED). Left it alone." >&2
else
  # shellcheck disable=SC2046
  kill $(descendants "$PID") 2>/dev/null || true
fi

tries=0
while lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; do
  tries=$((tries + 1))
  if [ "$tries" -gt 10 ]; then echo "Port $PORT still has a listener we did not stop. Run doctor.sh $PORT to see whose it is; leave it if it is not yours." >&2; exit 1; fi
  sleep 1
done
rm -f "$PIDFILE"

# Put next-env.d.ts back as launch.sh found it, never from git, so unrelated edits survive.
ORIG="$STATE/next-env.$PORT.orig"
if [ -f "$ORIG" ]; then
  if ! cmp -s "$ORIG" "$ROOT/next-env.d.ts"; then cp -p "$ORIG" "$ROOT/next-env.d.ts" && echo "restored next-env.d.ts to its pre-launch contents"; fi
  rm -f "$ORIG"
fi
echo "stopped $PORT. Evidence kept under $ROOT/.artifacts/"
