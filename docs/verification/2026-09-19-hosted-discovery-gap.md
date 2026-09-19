# Hosted discovery gap and card presentation

Verified 2026-09-19, America/New_York.

## Hosted collection is not a completed discovery run

The signed-in hosted collection shows GitHub, Wispr Flow, NotebookLM and Devin
Desktop, plus Copilot awaiting review. Four retained GitHub relationships are
shown within one product selector. There are eight relationship rows, not eight
distinct products. The preserved public page contains four cards.

The hosted Sources UI has no Gmail accounts. The latest release snapshot has
zero mailbox accounts, scan contexts and unknown-header rows. A read-only check
of production `striped-chicken-693` confirms all five required mailbox settings
are absent: OAuth client ID/secret, application origin, encryption key version
and encryption keys. Deployment alone did not deliver hosted Gmail discovery.

Read-only development inspection of `utmost-mongoose-374` found two connected
accounts. Their retained search-context counters are below. All searches are
PARTIAL; recurrence is disabled. These are cumulative processed-header counters,
not unique messages or products. Older unfiltered proof reads are separate.

| Account | Catalog headers | Incremental headers | History headers |
| --- | --- | --- | --- |
| Personal Gmail | 10 | 5 | No context |
| Workspace Gmail | 5 | 10 | 10 |

No Gmail provider call was made during this inspection. Existing captures do not
establish current usage or complete historical coverage.

## Next delivery work

Configure a distinct hosted OAuth client and production mailbox encryption.
The exact callback is
`https://props.lecturesfrom.com/api/connect/mailboxes/google/callback`.
The existing Google project is `proper-respect-dev-20260917`; its prior scope was
development-only. A separate hosted client/configuration requires the requested
owner approval, then Google consent for each account. Do not transfer development
OAuth tokens or silently copy private evidence.

Complete resumable bounded multi-page discovery using existing query-specific
cursors, generation checks and atomic retention. The current catalog has only 16 products. Catalog search only finds its known
sender domains; historical discovery must also retain unknown senders for review.
Show actual coverage, processed headers, unique retained evidence, candidate
products and remaining pages separately. Email identifies possible relationships;
owner decisions and stronger evidence establish the product story. A full run
cannot promise products that never left evidence in either mailbox.

The next local implementation should add a persistent run above `startLease`,
`readLeasedPage` and `persistBatch`. Schedule one page at a time and commit run
progress with evidence/cursor persistence. Bind it to owner/account/generation,
reserve an explicit attempt budget before I/O, and stop on cancellation, expired
credentials, cursor cycles or exhausted coverage. Keep catalog and history
budgets separate. Resume must not reset a completed query into a new window.
Test duplicate scheduling, interrupted runs, generation changes and replay counts.
This orchestration is not implemented yet; no broad run has started.

## Card presentation correction

Normal private and public cards now use retained logos, colors and typography
without showing Context.dev retrieval receipts or official-asset diagnostics.
Dedicated brand previews retain those diagnostics. Activity/evidence details stay
on cards; brand metadata never creates usage claims.

Local verification passed 58 focused unit tests, 11 browser component tests,
scoped ESLint and nonincremental TypeScript. This UI correction is not deployed.
No configuration write, source read, data transfer, relationship edit or
publication accompanied this work.
