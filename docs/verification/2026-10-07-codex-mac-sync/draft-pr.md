# Draft PR

Title: feat: connect Codex Mac history with signed private sync

The merged Codex connection is an in-memory fixture, and the unpublished genuine
collector's directory reader only works on Linux. This change integrates that
collector and adds a descriptor-relative Darwin reader, owner-approved device
pairing, numeric-only private ingestion and a durable local queue. A lost ACK or
helper restart replays the same pending packet without inflating totals. Disconnect
revokes all source access, including queued retries; declined retention triggers
server deletion even after the browser closes.

The development-only connection keeps work/personal sources separate and preserves
unknown historical identity. Device private keys remain local. Signed proofs bind
the grant, operation and exact packet. Conflicting evidence stays unknown. Native
response totals and legacy increases remain distinct, as do quota, estimates and
actual charges. Private ingestion does not publish a profile fact.

Validation: 128 focused tests, 124 Node tests and 8 existing prototype browser tests passed; desktop/mobile shared-panel
browser checks and axe passed. Full Vitest passed 2,034, skipped 2, and failed the
same 50 cases reproduced on unchanged main. Lint, typecheck and build passed.
See the receipt and synthetic screenshots in this directory.

Real-Mac acceptance remains gated on exact source/access approval, matching Clerk
development setup, permitted network destinations and approved development backend
deployment. Darwin host tests and approved real-history restart/revocation proof
are required before release. Source limits and partial scan coverage are documented
in `docs/codex-mac-connection.md`.

Cursor report accounting is owned by the separate thread. This change defines
reviewable shared consent/device/receipt contracts and does not add its adapter.
No push, merge, deployment, real acquisition or persistent installation is included
in this local PR package.
