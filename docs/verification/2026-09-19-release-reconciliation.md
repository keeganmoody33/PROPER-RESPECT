# Release reconciliation

Date: 2026-09-19.

The public-safe four-commit baseline through b028d904381c540245beea8d7516bb3460ce2434
is available on origin/codex/cursor-handoff-20260919. The outgoing range contains
source, synthetic tests and documentation, with no private originals or credentials
identified during review and secret-pattern checks. Private history was not pushed.

Local merge 74f6c1c integrates PR #22 at bc2900073bf524df850a07707f700e5d298e0d40.
Only docs/CURSOR_HANDOFF.md conflicted; both implementation streams were preserved.

An added regression demonstrated that unrelated source identity could become a
GitHub account URL. Expected https://github.com, received
https://github.com/mailbox-account. Require GITHUB source type and GITHUB origin
issuer before deriving a profile from retained evidence. Existing connector and
owner-selected destinations remain supported.

The combined suite passes 458 Vitest tests and six Node tests; one optional test
is skipped. Typecheck passes after correcting the regression fixture ID type.
Lint passes. These are local checks, not authenticated hosted verification.

The combined release adds upload classification, FILE_UPLOAD schema support,
rawEvidence.by_storage, replay-safe retention and private file metadata to the
previously approved PR #22 scope. Production release of this additional scope
requires owner approval. No backend synchronization, provider read, data transfer,
publication or production deployment occurred in this reconciliation.
