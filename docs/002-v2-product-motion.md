# 002 — V2 product motion: multi-user on proper-respect.com

Updated: 2026-09-23. Supersedes [V1 motion](002-v1-product-motion.md) as the active
scope. Reuses the existing evidence and publication decisions; this is not a
new architecture program.

## Product outcome

A person can show what they use, test, choose as go-to, stop using and return to,
with the history and context explaining why those products matter. Measurements
support that story; missing telemetry does not prevent an honest owner statement.
Go-to is explicit, not earned by activity. Evidence, derived findings and owner
statements remain distinct; no universal score or cross-product ranking.

## Existing implementation and source

Main includes PRs #25–64. Accepted production has separate backend and frontend
sources, with #52, #58, #60, and #64 still held. The native `proper-respect.com`
cutover and September 23 onboarding release are complete. See the
[release reconciliation](verification/2026-09-23-release-documentation-reconciliation.md)
for exact identities and the evidence limits.

[Release gaps #24](https://github.com/keeganmoody33/PROPER-RESPECT/issues/24)
remains the acceptance and bug queue. Completed Tasks 1–4, private evidence, and
source checkpoints remain intact; no seed reruns or automatic owner transfer.

## Launch sequence and acceptance

1. Preserve the accepted ownership, replay-safety, and public-projection fixes.
   Release held changes only after their separate review and authorization.
2. Native path-based profiles run on `proper-respect.com`. The published owner
   example remains `/keegan`; the desired `/lecturesfrom` canonical migration
   is pending. The empty-collection first-tool flow is released, while a fresh
   hosted account's complete journey remains to be verified.
3. A second test user signs in to an isolated private owner record, independently
   authorizes each source, sees source-specific progress/coverage/errors and
   reviews deduplicated candidates. Google sign-in is not Gmail consent.
4. Private save, relationship editing/history, archive/resume and supporting
   context survive reload and a fresh session. Publishing requires exact owner
   selection/preview; verify only approved content as a signed-out visitor.
5. Expose bounded/resumable read budgets and revocation. Prove an explicitly
   authorized unattended refresh and recoverable failures; the requested 30-day
   GitHub receipt must accrue real observations, not fixture time or claims.

## Boundaries and deferred work

Use [source roles](003-evidence-surfaces.md), [the existing mailbox plan](plans/2026-09-16-multiple-mailboxes-and-native-cards.md)
and [deployment rules](DEPLOYMENT.md). Email finds candidates; Context.dev supplies
presentation; neither proves usage. Exclude private GitHub details/transcripts,
keep work context private by default, and preserve historical claims when source
access stops. New source reads, recurrence, transfer, deployment and publication
retain separate authorization gates.

Owner-specific custom-domain routing remains the separate [custom-domain milestone #13](https://github.com/keeganmoody33/PROPER-RESPECT/issues/13),
not a prerequisite for path-based profiles. All historical products, every
connector, production Composio replacement, prototype A/B selection and perfect
styling are not launch prerequisites. No new ADRs or parallel planning program;
correct existing documents to match reality. New scope must displace existing
scope. Devin reports; Codex triages and writes one concern per reviewed PR.
