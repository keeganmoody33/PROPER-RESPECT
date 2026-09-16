# Connect the onboarding prototypes to implementation

Created 2026-09-16. This is an integration handoff and evidence map, not authorization to deploy or a report of completed integration.

## Shared authority and ownership

The master work contract is [Multiple mailboxes and native product cards](https://plan.ref.tools/oUl8LCIQb32SAicK). Keep its existing Task 1–4 identifiers. The [prototype Ref](https://plan.ref.tools/1PshU8pgYXXOXwK9) holds the runnable design evidence; it does not duplicate the connector backlog.

- Implementation owner: [Check Ref planning guidance](thread://01a0aae5-1314-7f81-b794-99e92dcfa219?hostId=local), working in `/Users/keeganmoody/Downloads/PROPER-RESPECT-self-test-20260916`.
- Prototype owner: this task, `01a0abc7-e2d2-7873-a17c-6c0d6d74bc55`, working only in `/Users/keeganmoody/.codex/worktrees/4b19/PROPER-RESPECT`.
- Protected checkout: `/Users/keeganmoody/Downloads/PROPER-RESPECT`; no commit, stash, reset, switch, or discard there.

When either task changes behavior, update the relevant Task 1–4 item in the master contract with the artifact/commit or local hash snapshot and the exact verification record. Send the other task the changed contract item and evidence path. A chat completion message alone does not advance another lane's status. No recurring monitor or automatic deploy is created by this handoff.

## Exact implementation statements read on 2026-09-16

The referenced task's latest final message says:

> I fixed the underlying source-account separation locally: **76 tests pass**, plus typecheck and lint. Mailbox OAuth remains unimplemented; the two Taste/DesignSystem prototypes are queued for task setup.

The test count is that task's report, not a rerun in this task. Its prototype queue statement is superseded by the local artifacts below.

The implementation contract says:

> Repair evidence ingestion so two mailboxes remain separate sources while contributing to one private product draft. **Status: local implementation; not deployed.**

> Implement account-specific authorization, bounded discovery, refresh, and disconnect. **Status: not implemented; depends on Task 1.**

> Integrate the working mailbox connector with the selected prototype direction and persistent introducer credit. **Status: not implemented; follows Tasks 2 and 3.**

Source: `/Users/keeganmoody/Downloads/PROPER-RESPECT-self-test-20260916/docs/plans/2026-09-16-multiple-mailboxes-and-native-cards.md`, inspected before the coordination correction. The master Ref is the shared status owner; the implementation task owns its local mirror.

## Prototype evidence delivered to Task 3

- A: http://127.0.0.1:4320/?view=studio
- B: http://127.0.0.1:4320/?view=collection
- Both endpoints returned HTTP 200 during this handoff. Use served URLs; `file://.../index.html` is the Vite source entry and is not a runnable standalone browser artifact.
- `README.md`, `DESIGN.md`, `src/main.jsx`, `src/styles.css`, and `src/data.js` provide two working synthetic alternatives.
- `src/introducer.js` and `src/introducer-field.jsx` implement the subsequent optional name/handle/domain/URL feedback, preserving raw text and optional platform override.
- `checks/verification-2026-09-16.json`: broad flow evidence for the original revision, including keyboard correction; `checks/independent-review-2026-09-16.md`: exact independent verdict.
- `checks/introducer-verification-2026-09-16.json`: latest refinement evidence, 14 parser cases and both variants at desktop/mobile, four clean axe scans, no observed external requests or overflow.
- `checks/integration-snapshot-2026-09-16.json`: current working-file SHA-256 values and each checkout's HEAD. The implementation and prototypes contain uncommitted work; HEAD alone is not an exact description of either delivered slice.

Neither A nor B has been selected as the final shell. Choosing a shell need not block the connector work. The prototype's private collection preview does not implement production publication. Consent failure is simulated; account-specific concurrent scan failure and in-flight revocation are not implemented by the prototype.

## Task 4 integration mapping

| Contract area | Read implementation bytes | Prototype behavior | Integration requirement |
| --- | --- | --- | --- |
| Account identity | `evidenceSources.sourceKey` and `rawEvidence.sourceRecordId`; owner/type/source index | Synthetic account IDs, mutable labels | Use verified provider identity and owner-scoped source keys. Preserve two account records even when one product is shared. Never use email labels as identity. |
| Connection lifecycle | `connectorAccounts` currently permits GITHUB and DEVIN | Local connected boolean and consent dialog | Build Gmail/Microsoft OAuth and account-specific credentials/cursors; bind real states and partial failures. A simulation toggle cannot represent successful authorization. |
| Private review | `claimReviews`, private/public visibility and draft imports | `pending`, `kept`, `dismissed` in React state | Map actions explicitly to persisted owner decisions; preserve observation-level verdicts. Save, reload, reopen, and verify. Do not replace the richer evidence model with a boolean. |
| Relationships | Validator literals ACTIVE / TESTING / ARCHIVED | Active / Tried / Archived | Resolve whether Tried means currently testing or tried in the past. Do not silently map both meanings to TESTING. |
| Introducer | No introducer fields in the inspected props schema or default review return | Original text, locally derived URL/platform, explicit optional platform override | Add owner-scoped persistence and projection for raw credit, optional source link, platform suggestion/override, and self-attestation. Preserve the distinction between automatic suggestion, explicit selection, and explicit omission. No inferred identity verification. |
| Destinations | `links` supports CANONICAL / AFFILIATE / REFERRAL / INVITE | Product URL, affiliate text, and separate introducer link | Keep each destination's role separate through save/read/publication. Do not put an introducer URL into the product affiliate slot. |
| GitHub activity | Collector returns contributionCalendar: total, days, period, capturedAt, memberSince | Synthetic calendar plus invented commit/PR/repository examples | Adapt actual calendar fields into the Primer card. Omit commit/PR/repository rows unless independently sourced; contribution total is not a commit or push count. |
| Freshness | Collector distinguishes capturedAt and period | Fixed fixture observed/captured dates | Use real observation/period/capture values; refresh must not invent recent use or a first-use date. |
| Disconnection | Production mailbox lifecycle still pending | Local removal with retained sample cards | Stop reads, invalidate in-flight writes, preserve reviewed history under the disclosed retention policy, and test deletion separately. |
| Publication/cadence | Explicit approval and auto-refresh decisions in current review | Private preview; Manual / Daily API / Weekly snapshot choices | Retain explicit owner publication and refresh approval. Prototype cadence labels are proposals, not jobs to enable. |

## Proposed next implementation sequence

1. The implementation owner checkpoints its own Task 1 repair in its isolated checkout, with tests and exact revision recorded. This prototype task will not package another task's dirty code.
2. Continue Task 2's actual mailbox lifecycle and bounded discovery, using its existing consent, ownership, revocation, and privacy checks. Shell selection can remain open while this work proceeds.
3. At Task 4, extract the chosen shell and native card components into the Next app. Keep fixtures behind a demo-only boundary. Create a typed adapter to the existing Convex/domain model rather than replacing that model with the prototype's React state.
4. Persist introducer credit and its distinct destinations; verify reload, edit, omission, and owner access boundaries.
5. Verify the end-to-end integration before enabling live copy or deployment. Design selection and deployment are separate decisions; neither is supplied by this handoff.

## Evidence required to advance Task 4

- Two same-provider accounts and one other-provider account retain separate identity, tokens, and cursors while producing a shared product candidate with attributable sources.
- One account may fail or be revoked without losing other results; no persistence occurs after its revocation.
- The owner reaches a useful private preview before writing a bio or dates. New discoveries remain private.
- Save/edit/reload preserves raw introducer input, optional platform choice, distinct affiliate/product/introducer destinations, relationship status, and observation review.
- Real card fields match the collector's supplied metrics and dates; unsupported sections are unavailable rather than populated from fixtures.
- Publication includes only the owner-selected cards and evidence; disconnected history follows the explicit retention/deletion contract.
- Keyboard/mobile/overflow checks pass on the integrated route, and production connector tests are recorded separately from these prototype checks.
