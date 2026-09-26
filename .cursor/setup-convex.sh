#!/usr/bin/env bash
# Idempotent local Convex bootstrap for Cursor Cloud Agents.
#
# The app talks to a local, anonymous Convex deployment (CONVEX_AGENT_MODE=anonymous).
# The backend process only lives while `npx convex dev` runs, so this script prepares
# everything a persistent `convex dev` watcher needs so its first push succeeds:
#   1. Configures the local deployment and writes NEXT_PUBLIC_CONVEX_URL to .env.local.
#   2. Sets the CLERK_FRONTEND_API_URL deployment env var that convex/auth.config.ts
#      requires (a placeholder is fine for the public/unauthenticated demo; replace it
#      with a real Clerk issuer URL to exercise sign-in).
# Seeding of the demo profile is done by the persistent watcher via `--run` (see
# .cursor/environment.json), after functions are deployed.
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
export CONVEX_AGENT_MODE=anonymous

log() { printf '[setup-convex] %s\n' "$*"; }

# Bring up the local backend in its own process group so we can signal the whole tree
# (the `convex dev` parent AND the `convex-local-backend` child) on shutdown. The first
# push may fail because the auth config env var is not set yet; that is expected here.
log "Starting temporary Convex backend to configure the local deployment..."
setsid npx convex dev --typecheck disable --tail-logs disable </dev/null >/tmp/convex-bootstrap.log 2>&1 &
BOOT_PID=$!

stop_backend() {
  # SIGINT the whole process group so convex dev tears down its backend child cleanly.
  kill -INT -- "-${BOOT_PID}" 2>/dev/null || kill -INT "$BOOT_PID" 2>/dev/null || true
  wait "$BOOT_PID" 2>/dev/null || true
  # Wait until port 3210 is actually released so the persistent watcher can bind it.
  for _ in $(seq 1 30); do
    if ! curl -sf http://127.0.0.1:3210/version >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
}
trap 'stop_backend' EXIT

# Wait for the local backend to accept connections.
ready=""
for _ in $(seq 1 90); do
  if curl -sf http://127.0.0.1:3210/version >/dev/null 2>&1; then ready=1; break; fi
  if ! kill -0 "$BOOT_PID" 2>/dev/null; then break; fi
  sleep 2
done

if [ -z "$ready" ]; then
  log "Convex backend did not become ready. Bootstrap log:"
  tail -n 40 /tmp/convex-bootstrap.log || true
  exit 1
fi
log "Convex backend is up on http://127.0.0.1:3210"

# Ensure the deployment env var required by convex/auth.config.ts exists (idempotent).
log "Ensuring CLERK_FRONTEND_API_URL deployment env var is set..."
npx convex env set CLERK_FRONTEND_API_URL "${CLERK_FRONTEND_API_URL:-https://example.clerk.accounts.dev}" </dev/null || true

# Ensure PUBLIC_SITE_ORIGIN is present for `npm run build` (production build requires an
# HTTPS origin; the dev server does not need it). convex only manages its own keys in
# .env.local, so appending here is safe and idempotent.
if [ -f .env.local ] && ! grep -q '^PUBLIC_SITE_ORIGIN=' .env.local; then
  printf '\nPUBLIC_SITE_ORIGIN=%s\n' "${PUBLIC_SITE_ORIGIN:-https://proper-respect.com}" >> .env.local
  log "Added PUBLIC_SITE_ORIGIN to .env.local"
fi

# Stop the temporary backend (handled by the EXIT trap, which SIGINTs the process group
# and waits for port 3210 to be released). The persistent `convex dev` terminal defined
# in environment.json then restarts it, pushes functions, and seeds the demo profile.
log "Stopping temporary Convex backend; the persistent watcher will take over."
stop_backend
trap - EXIT

log "Convex bootstrap complete."
