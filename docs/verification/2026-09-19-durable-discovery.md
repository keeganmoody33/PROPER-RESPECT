# Durable private Gmail discovery — local verification

Verified: 2026-09-19. Accepted checkout: `PROPER-RESPECT-self-test-20260916`,
branch `codex/personal-release-main`. Source follows `bd74356`.

## Delivered locally

An authenticated owner can start a finite background run per connected Gmail
account, inspect progress and partial coverage, pause, resume or cancel. Existing
Google sign-in is explicitly distinguished from mailbox authorization.

The existing provider adapter performs one scheduled page at a time: catalog then
history, at most 100 attempts per phase and five headers per attempt. The maximum
is 1,000 reserved header attempts per account/run. Failed allowances are not
refunded. No bodies or attachments are requested. This is separate from recurrence.

Run ownership is bound to owner/account/generation. Duplicate start requests and
scheduler deliveries cannot claim another page. Manual and daily page reads wait
while a run owns its contexts. Evidence, cursors, progress and continuation commit
atomically. Pause/cancel reject in-flight persistence. Reconnect invalidates the
old generation. Expired workers and invalid/cyclic cursors expose recovery controls.

Known products become unconfirmed private candidates; unknown senders remain in
private review. Replays do not inflate retained records. No relationship, go-to
choice or public snapshot is created or changed by a discovery run. Both frozen
queries must exhaust for COMPLETE; a cap produces LIMIT_REACHED. Neither status
proves that all products or periods of use have been found.

## Verification

- `npm test`: 55 Vitest files passed, 559 tests passed, one skipped; six Node tests passed.
- `npm run lint`: passed.
- `npm run build`: passed, including TypeScript and route generation.
- `PLAYWRIGHT_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npx playwright test --config tests/e2e/components.config.ts`: 13 passed.
- Final copy-only refinement: seven unit tests and both 390px/1280px browser cases passed again; Search limits disclosure verified.
- Backend subset: 92 tests across five files, including 15 new durable-run cases.
- `git diff --check`: passed.

Provider/scheduler fixtures exercised all 200 scheduled pages and 1,000 mocked
headers before stopping. Repeated headers retained five records. Other cases
cover recognized-product and unknown-sender intake, preserved owner/public data,
other-owner rejection, duplicate delivery, cancelled in-flight reads, expired
leases, generation changes, missing credentials, partial-page 401, unchanged and
cyclic cursors, and exact completed-receipt replay.

Independent review findings were fixed: completed receipt replay precedes the
active-run check; cyclic cursors expose search restart; missing credentials fail
visibly before claiming a page; an unchanged cursor has a typed recovery error.

## Runtime limits and next gate

These are automated fixtures and browser component checks, not a live Gmail run
or a hosted authenticated backend proof. Source has not been pushed, synchronized
or deployed. Production remains application `8b6aa9a` / Convex `striped-chicken-693`;
development remains `a2539b9` / `utmost-mongoose-374`.

Hosted OAuth configuration approval is pending. A separate hosted client,
production encryption configuration and each account's Google consent are needed.
A release of this new source and an explicitly bounded real-read scope also need
authorization. Do not copy development tokens or evidence. No recurrence, provider
read, relationship edit, data transfer or publication occurred in this work.

The catalog still has 16 known products. Unknown-sender review can broaden the
inventory without invented identities; efficient review of a large unknown inbox
and verified hosted execution remain unfinished product acceptance work.
