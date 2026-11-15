#!/bin/sh
# Read-only. Is the server on PORT this checkout, at which commit, in reference test mode, and rendering?
# Usage: .claude/skills/verify/scripts/doctor.sh PORT   (exit 0 = worth driving)
set -u
PORT="${1:?usage: doctor.sh PORT}"
ROOT="$(git rev-parse --show-toplevel)"
failed=0

pid="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1)"
if [ -z "$pid" ]; then echo "FAIL nothing listens on $PORT"; exit 1; fi
cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')"
if [ "$cwd" = "$ROOT" ]; then echo "ok   listener pid $pid runs from this checkout ($ROOT)"
else echo "FAIL listener pid $pid runs from $cwd, not $ROOT"; failed=1; fi

echo "info launch.sh recorded pid $(cut -d"|" -f1 "$ROOT/.artifacts/verify/server-$PORT.pid" 2>/dev/null || echo none) (the listener may be its child)"
changed="$(git -C "$ROOT" status --porcelain --untracked-files=no | grep -cv ' next-env.d.ts$')"
echo "info commit $(git -C "$ROOT" rev-parse --short HEAD), $changed tracked files changed (next dev serves the working tree, not the commit)"

code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/evidence-fixture")"
if [ "$code" = 200 ]; then echo "ok   reference test mode (/evidence-fixture answers 200)"
else echo "FAIL /evidence-fixture answered $code: not a dev server in reference test mode"; failed=1; fi

if curl -fsS "http://127.0.0.1:$PORT/" 2>/dev/null | grep -q 'Product usage examples'; then echo "ok   homepage renders its product examples"
else echo "FAIL homepage has no product examples region"; failed=1; fi
exit "$failed"
