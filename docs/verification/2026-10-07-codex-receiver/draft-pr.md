# Complete the development Codex receiver and durable Mac sync

The PR #157 fixture and `1fff45e` live connection work overlapped in acquisition
and accounting contracts. This integrates #157, reuses its strict Codex numeric
row validation, and preserves its Cursor report adapter unchanged. The live
receiver remains a bounded Codex packet endpoint rather than a complete-report
replacement endpoint.

Clerk owners approve device/source/context grants; device signatures bind each
status request and exact packet. Same-device pairing can recover a lost response
within its original deadline. Receiver transactions save private evidence,
receipts and checkpoints together. The companion saves pending packets before
send, skips acknowledged unchanged scans after restart, and pauses during outages.
Explicit revocation and expiry stop recurrence. Latest source consent governs
retention, and source identity cannot change its prepared device or context.

Validation and screenshots are in the dated receipt. Linux fixtures cover
multi-page/multi-window backfill, lost acknowledgment, disk restart and revocation.
The macOS workflow and `npm run codex:mac:check` now include the authenticated
receiver and companion. Darwin/live Clerk/Convex and approved real Mac history
remain unverified. No push, GitHub merge or deployment is included.
