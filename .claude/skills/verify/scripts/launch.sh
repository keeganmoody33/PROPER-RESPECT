#!/bin/sh
# Starts this checkout's app in reference test mode (no sign-in, no backend) on PORT
# and returns once the homepage renders its product examples.
# Usage: .claude/skills/verify/scripts/launch.sh PORT
set -eu
PORT="${1:?usage: launch.sh PORT}"
ROOT="$(git rev-parse --show-toplevel)"
STATE="$ROOT/.artifacts/verify"
mkdir -p "$STATE"

case "$PORT" in
  3000|3211) echo "Port $PORT is the Playwright suite's or the card-fixture preview's. Pick another." >&2; exit 2 ;;
esac
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "Port $PORT is in use. Run doctor.sh $PORT to see whose." >&2; exit 2
fi
# Two dev servers in one checkout share .next and corrupt each other's builds.
for pid in $(lsof -nP -iTCP -sTCP:LISTEN -t 2>/dev/null | sort -u); do
  cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')"
  if [ "$cwd" = "$ROOT" ]; then
    echo "pid $pid already serves this checkout. Use it (doctor.sh on its port) or stop it first." >&2; exit 2
  fi
done

cd "$ROOT"
PROPER_RESPECT_E2E_REFERENCE=1 NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= CLERK_SECRET_KEY= NEXT_PUBLIC_CONVEX_URL= \
PUBLIC_SITE_ORIGIN=https://public.example NEXT_TELEMETRY_DISABLED=1 \
  nohup npx next dev --hostname 127.0.0.1 --port "$PORT" >"$STATE/server-$PORT.log" 2>&1 &
echo $! >"$STATE/server-$PORT.pid"

tries=0
until curl -fsS "http://127.0.0.1:$PORT/" 2>/dev/null | grep -q 'Product usage examples'; do
  tries=$((tries + 1))
  if [ "$tries" -gt 90 ]; then echo "Not ready after 180 s. Read $STATE/server-$PORT.log" >&2; exit 1; fi
  sleep 2
done
echo "ready: http://127.0.0.1:$PORT  pid $(cat "$STATE/server-$PORT.pid")  log $STATE/server-$PORT.log"
