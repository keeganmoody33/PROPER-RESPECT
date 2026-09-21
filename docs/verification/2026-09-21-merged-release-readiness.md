# Merged-source release verification — 2026-09-21 UTC

Verified main: `6a36295c78d70b0b3e98f7ce13408a57081dddd7`.
PRs #28 and #32–35 are merged. No agent merge or deployment occurred.

Clean dependency installation, 671 Vitest passes (two optional skips), seven
Node script checks, ESLint, typecheck, production build and all 50 Playwright
checks pass on the combined source. GitHub main CI35558262084 also passed on
the exact SHA. Build used the existing synthetic Clerk/Convex configuration
and `PUBLIC_SITE_ORIGIN=https://public.example`. Browser verification used an
isolated fixture-only server on port8840, not the authenticated owner session.
Temporary logs: `/tmp/proper-respect-merged-{install,test,lint,types,build,browser}.log`.

Independent read-only backend comparison with recorded deployed source
`32aa043c48ee32686b3c656127f2d58ed7d1388b` confirms backend-first release is
required for optional query arguments, accountEvidencePage and secured uploads.
Existing upload clients deliberately fail closed after the security update.
No actual backend synchronization or production schema validation was run.

The old generic rollback instructions were unsafe after new uploads: old code
lacks uploadTickets and rawEvidence.uploadAttribution and restores the unbound
upload path. The corrected deployment runbook requires frontend-first fallback
while retaining secured additive backend/schema; any backend rollback needs a
separately reviewed compatible patch. This follow-up changes documentation only.

Read-only production inspection still records deployment
`dpl_8zGq3Exu68QgVvCKmdy4Hm9SoRTh`; source parity with merged main is unproven.
Apex redirects307 to props.lecturesfrom.com. Vercel's production Convex target,
Clerk issuer and frontend/backend mailbox origins align with the old host;
fresh signed-in token acceptance and registered provider callbacks are not
proven by that configuration check. Production lacks PUBLIC_SITE_ORIGIN.

An authorized pre-cutover release should keep the old host and use
`PUBLIC_SITE_ORIGIN=https://props.lecturesfrom.com`, targeting existing Vercel
groundskeep/proper-respect and Convex striped-chicken-693. Vercel's build command
synchronizes Convex; this is not frontend-only authorization. No Clerk/OAuth,
DNS/redirect, encryption-key, account-ownership or publication change is implied.

Hosted acceptance remains required: two designated users, fresh login, private
manual entry/card save/reload, exact sharing preview, isolation, explicitly scoped
test-connector reconnect/revocation, and preserved existing profile/data. No
provider read, recurrence, migration or publication follows from source checks.
