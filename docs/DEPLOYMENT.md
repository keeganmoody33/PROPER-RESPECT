# Deployment runbook

Updated: 2026-09-23. Production uses separate accepted backend and frontend
sources. Main contains changes still held from production. Use the
[release reconciliation](verification/2026-09-23-release-documentation-reconciliation.md)
for exact identities and the selective-release evidence before preparing a release.

## Current public origin

The native `https://proper-respect.com` cutover is complete. Production public
pages and existing-owner access have been verified there. Fresh hosted signup,
email-code delivery, and second-user isolation remain separate acceptance work.
The September 21 Clerk Hobby primary-domain migration invalidated existing
sessions. The old host redirects public links; retained callbacks and DNS support
an explicit rollback plan, not simultaneous old-host authentication. Public
redirect continuity does not prove authenticated rollback. The former
apex-to-`props.lecturesfrom.com` sequence is historical, not a current setup task. Its source preparation remains in the
[September 20 receipt](verification/2026-09-20-canonical-public-origin.md).

`PUBLIC_SITE_ORIGIN` controls canonical URLs, OpenGraph/Twitter URLs, the generic
share image, and sitemap. Production uses `https://proper-respect.com`. The value
is server-side, must be an HTTPS origin in production, and does not infer authority
from Host or forwarded headers. Production rendering and deployment preflight
reject missing or invalid values. Preview pages are noindex.

The sitemap includes the homepage and Origins, Contact, and Privacy pages with
last-modified dates. It does not enumerate owners or private profiles. Profile
metadata uses the published-only read model; the generic share image contains
no owner data. This origin variable does not configure Clerk, Google redirect
URIs, Convex auth issuers, or `MAILBOX_APPLICATION_ORIGIN`.

## Deployment controls

`vercel.json` sets `git.deploymentEnabled` to `false`. Git pushes do not create
preview or production deployments. Its build command still runs
`npm run deploy:check && npx convex deploy --cmd 'npm run build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL`.
A manual Vercel deployment with that command also synchronizes Convex. Do not
use it for a frontend-only release or remove the Git guard to obtain a PR check.

PROPER-RESPECT has three configuration boundaries:

1. Clerk owns identity and the GitHub OAuth connection.
2. Convex owns application data, scheduled refreshes, and encrypted connector
   credentials.
3. Vercel runs the Next.js application and server routes.

Keep variables in the boundary listed below. A value marked secret must never
use a `NEXT_PUBLIC_` prefix.

## Configuration inventory

| Variable | Location | Secret | Purpose |
| --- | --- | --- | --- |
| `PUBLIC_SITE_ORIGIN` | Vercel | No | Verified public origin for canonical metadata; separate from OAuth callback origin |
| `NEXT_PUBLIC_CONVEX_URL` | Vercel | No | Production Convex client URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Vercel | No | Clerk browser key |
| `CLERK_SECRET_KEY` | Vercel | Yes | Clerk server API and GitHub OAuth token retrieval |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Vercel | No | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Vercel | No | `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | Vercel | No | `/onboarding` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | Vercel | No | `/onboarding` |
| `CLERK_FRONTEND_API_URL` | Convex production | No | Clerk issuer used by `convex/auth.config.ts` |
| `CONNECTOR_ENCRYPTION_KEY` | Convex production | Yes | Encrypts stored connector credentials |
| `CONVEX_DEPLOY_KEY` | Vercel build or CI only | Yes | Authorizes non-interactive Convex deploys |
| `CONTEXT_DEV_API_KEY` | Convex runtime; ignored local env for operator verification | Yes | Fetches product brand presentation; supplies no owner evidence |

`CLERK_JWT_ISSUER_DOMAIN` remains a compatibility alias for
`CLERK_FRONTEND_API_URL`. New deployments should use the official
`CLERK_FRONTEND_API_URL` name.

There is intentionally no shared `GITHUB_TOKEN` or `DEVIN_API_KEY`:

- GitHub uses the OAuth token from each user's linked Clerk account.
- Devin uses a per-user organization token submitted during onboarding and
  encrypted before it is stored in Convex.

### Historical Context.dev verification, September 17–18, 2026

The following records describe those dated development operations only. They
do not inventory current production configuration or authorize another run.

The brand adapter and queued Convex persistence are separate from mailbox and
usage evidence. A canonical catalog slug and exact catalog domain are required.
No credential is sent to a product website or included in a card response.

The owner-supplied Context.dev key is retained in ignored `.env.local` for
operator retrieval and, since September 18, configured on development
`utmost-mongoose-374` with the owner’s authorization. No production key was changed. The retained Wispr Flow and GitHub records are
verified at `/evidence-fixture/brands` when `NODE_ENV=development` and
`PROPER_RESPECT_BRAND_RECEIPTS_DIR` names their private receipt directory. The
route reads files, does not retrieve brands on render, and returns 404 outside
development. It includes no personal usage or relationship data.

On September 18 the owner approved development-only synchronization of
`158dc504895c1a46f4b9f8793d4e321c95e6faeb`. The new brand schema/functions,
retained intake and private inventory are installed on `utmost-mongoose-374`;
real authenticated collection queries work and existing data is unchanged.
See the [synchronization receipt](verification/2026-09-18-development-sync.md).
Private controls activate through `onboarding:getState` capability flags.
No environment values changed during that earlier synchronization. During the
subsequent owner-authorized product-delivery work, the existing presentation key
was configured privately on development only. Actual authenticated retained
intake now triggers successful Context.dev retrieval: both Wispr Flow and GitHub
have READY jobs and retained v2 snapshots consumed by their actual private cards.
Production and preview remain untouched.
The [September 17 brand record](verification/2026-09-17-context-brand-enrichment.md)
continues to describe the real local provider receipts.

The authorized development verification passed for private intake, owner review and persistence. Detailed account results, personal relationship choices and mailbox classifications are retained in private operator receipts; public source verification is recorded in [the main-consolidation receipt](verification/2026-09-18-main-consolidation.md). No new source operation or publication follows from code integration.

On September 18 an initial `CONNECTOR_ENCRYPTION_KEY` was provisioned on that
same development backend after confirming no existing key or connector accounts/
secrets. Private readback matched the ignored local copy. This was initial
configuration, not rotation; no GitHub/Devin connection or provider read followed.
The [current delivery receipt](verification/2026-09-18-personal-product-delivery.md)
distinguishes these runtime changes from the earlier schema-only synchronization.

## Configuration reference for a separately authorized setup

The existing production environment is configured. These setup instructions
are not steps to repeat for an application release.

### 1. Configure Clerk

Use a production Clerk instance for the production domain.

1. In the Clerk Dashboard, open the Convex integration and select
   **Activate Convex integration**.
2. Copy the displayed Frontend API URL. Production normally uses
   `https://clerk.<your-domain>.com`; development normally uses
   `https://<instance>.clerk.accounts.dev`.
3. With the native Convex integration, Clerk session claims contain
   `aud: "convex"`; use the session token directly. A legacy setup instead needs
   a JWT template named `convex`. Do not create a legacy template just to work
   around a route that ignores native sessions. The accepted source handles
   native sessions; a new sign-in and provider lifecycle proof remain separate
   from that implementation.
4. Enable GitHub under Clerk social connections and configure its production
   OAuth callback/domain settings.
5. Copy the matching production publishable and secret keys. Both keys must be
   from the same Clerk environment (`pk_live_` with `sk_live_`).

### 2. Configure Convex production

Generate the connector encryption key once:

```bash
openssl rand -base64 32
```

Set both variables interactively so secrets do not enter shell history:

```bash
npx convex env set --prod CLERK_FRONTEND_API_URL
npx convex env set --prod CONNECTOR_ENCRYPTION_KEY
```

Verify names without printing values:

```bash
npx convex env list --prod --names-only
```

Do not casually rotate `CONNECTOR_ENCRYPTION_KEY`. Existing connector
credentials require the original key; rotation needs a deliberate
decrypt-and-re-encrypt migration.

### 3. Configure Vercel

Copy the Vercel variables from `.env.example`, replacing placeholders with the
production Convex URL and matching Clerk live keys. Apply them to Production
and to any Preview environment that is intended to exercise authentication.

If Vercel deploys Convex during the build, add a production or preview
`CONVEX_DEPLOY_KEY` with the appropriate scope. Never prefix it with
`NEXT_PUBLIC_`.

Run the local check before deploying:

```bash
npm run deploy:check
```

This reads `.env.local`, validates the Next.js/Clerk configuration, and warns
when Convex-only values cannot be inspected locally. When a production or
development `CONVEX_DEPLOY_KEY` is present, it also verifies that the key and
`NEXT_PUBLIC_CONVEX_URL` target the same deployment without printing either
value. In a protected CI environment that injects all variables, use:

```bash
npm run deploy:check:strict
```

The check reports variable names and validation errors only; it never prints
credential values.

## Prepare a selective release

1. Record the accepted backend and frontend from the release reconciliation.
   Compare the proposed source with each baseline. Exclude the held runtime
   changes in PRs #52, #58, #60, and #64 unless their release is separately approved.
2. Prepare an isolated candidate with only the approved changes. Keep the
   accepted Convex source in a frontend-only candidate. Do not upload main or
   assume that backend and frontend must share one Git commit.
3. If the frontend needs a backend change, review and obtain approval for the
   exact backend source and target first. Verify the complete deployed bundle
   after synchronization before proceeding with the dependent frontend.
4. For a frontend-only upload, follow the verified procedure in the
   [September 22 release receipt](verification/2026-09-22-ora-release-and-rescan.md#source-and-release).
   In an isolated deployment package, override `vercel.json` to use
   `npm run deploy:check && npm run build`. Verify that both the uploaded project
   settings and the actual remote build log use that command. Keep the shared
   project settings unchanged.
5. Verify the candidate before promotion. After the approved promotion, verify
   the production alias, public behavior, existing-owner continuity, and unchanged
   backend. Record the candidate, source SHAs, and deployment identity together.

The September 23 release used this separation and retained distinct backend and
frontend commits. Its exact results and remaining acceptance work are in the
release reconciliation. The prior operation's approval does not authorize a new
release, configuration change, provider read, migration, or publication.

The existing `/keegan` profile contains four curated public cards. Do not seed,
replace production with development data, or migrate it as part of a release.
`npm run convex:seed:prod` is an initial-setup operation requiring separate
explicit authorization. It is not a smoke test.

## Production smoke test

After an explicitly approved application/backend release:

1. Open `/` and `/keegan` while signed out; public cards should render without
   private evidence.
2. Sign in as the actual production owner and verify its association with the
   existing curated profile. Do not infer ownership from an email or handle, or
   copy a development Clerk subject into production. If an unowned seeded
   profile needs recovery, verify the internal recovery preconditions and get
   explicit authorization before linking it.
3. Verify retained private evidence, discovery review, manual product entry,
   optional context, owner-selected go-to and relationship/history controls.
   Save the owner's choices and verify reload plus a fresh signed-in session.
4. For an explicitly authorized source, verify a bounded discovery and refresh
   reaching private review. Static captures must not imply live tracking. Check
   coverage, failure/recovery and disconnection without changing relationships.
5. Preview the exact selected public projection. Publish only after the owner
   approves that content, then verify the result signed out and confirm omitted
   curated cards remain unchanged. Release approval does not approve publication.
6. Verify source revocation stops future collection and preserves evidence,
   relationship history and the last explicitly approved public snapshot. Do not
   revoke the owner's working source solely as a test without approval.

## Rollback

Updated: 2026-09-21 UTC.

- Roll back the frontend first to an approved, known-good Vercel deployment,
  retaining the secured Convex backend and additive schema. Restoring a frontend
  artifact must not rerun an older build command that redeploys Convex.
- Keep `uploadTickets`, `rawEvidence.uploadAttribution`, the authenticated upload
  handlers, and the compatible query functions/arguments. New uploads write fields
  absent from the old schema; additive forward changes do not make an old backend
  schema safe to restore. Do not redeploy backend `32aa043` as a blanket rollback.
- Older frontends can still use the compatible collection queries, but their old
  `generateUploadUrl` flow deliberately fails closed with a reload instruction.
  Verify this limitation and existing collection/profile access after rollback;
  do not reopen unbound uploads to make the old UI work.
- If a backend correction is required, prepare and separately authorize a reviewed
  compatible patch that preserves stored records, upload ownership enforcement,
  and the query contracts needed by the selected frontend. Record its exact SHA
  and target before synchronization.
- Do not delete tables or attribution fields, restore a database, seed owner data,
  or rotate `CONNECTOR_ENCRYPTION_KEY` as part of application rollback. Any data
  migration requires its own reversible plan and authorization.

## Historical Gmail configuration and operation, September 18, 2026

These dated development results and original read limits are retained for
reference. They are not current configuration instructions or fresh authorization.

The authorized development verification passed for private intake, owner review and persistence. Detailed account results, personal relationship choices and mailbox classifications are retained in private operator receipts; public source verification is recorded in [the main-consolidation receipt](verification/2026-09-18-main-consolidation.md). No new source operation or publication follows from code integration.

Onboarding waits for `useConvexAuth().isAuthenticated` before mounting owner
queries; Clerk's signed-in state alone does not establish Convex token
acceptance. Keep `/__clerk/:path*` in the middleware matcher for the local
Clerk proxy. Run Next on `localhost:3000` so that proxy can reach its own
configured origin. See the [auth diagnosis and regression record](./verification/2026-09-17-task2-owner-auth.md).

Google project `proper-respect-dev-20260917` is dedicated to this development
proof, with Gmail API enabled and billing disabled. The owner completed Auth
Platform registration and accepted the User Data Policy. The External app
remains in Testing, with the owner's two selected test accounts listed. The Web client
"Proper Respect Local Gmail — 2026-09-17" has exactly the localhost callback
below. Its declared scopes are `openid`, `userinfo.email`, and `gmail.readonly`.

`MAILBOX_GOOGLE_CLIENT_ID` and `MAILBOX_GOOGLE_CLIENT_SECRET` are provisioned
only on development `utmost-mongoose-374`; private readback matched both new
values. Existing encryption keys were reused. No secrets were committed or
printed. **Add Gmail account** reaches Google's real consent flow. Consent is
per mailbox: both owner-selected accounts are connected with separate
generation-bound credentials, sources and cursors. Both have completed real
bounded reads. No further consent is required while those grants remain valid.

Prerequisites for an operator-authorized development run:

- Matching Clerk browser/server keys, the Clerk `convex` JWT template and
  `CLERK_FRONTEND_API_URL` in Convex; `NEXT_PUBLIC_CONVEX_URL` points at that
  same development backend. Run the new Convex schema/functions in that
  authorized development environment and regenerate bindings before testing.
  No admin/deploy key participates in user OAuth requests.
- A Google **Web application** OAuth client with the exact redirect URI
  `MAILBOX_APPLICATION_ORIGIN/api/connect/mailboxes/google/callback` registered.
  For a local origin `http://localhost:3000`, register
  `http://localhost:3000/api/connect/mailboxes/google/callback`.
- Configure `MAILBOX_APPLICATION_ORIGIN` and, for explicit local HTTP only,
  `MAILBOX_ALLOW_LOOPBACK_HTTP=true` in both Next.js and Convex. HTTPS is
  required otherwise. Redirects never use request-controlled host headers.
- Configure `MAILBOX_GOOGLE_CLIENT_ID`, `MAILBOX_GOOGLE_CLIENT_SECRET`,
  `MAILBOX_ENCRYPTION_ACTIVE_VERSION`, and `MAILBOX_ENCRYPTION_KEYS` only in
  Convex. The last variable is a JSON object mapping retained key versions to
  base64-encoded 32-byte keys. Generate a key with `openssl rand -base64 32`;
  provision privately, never commit its output. Keep old versions available
  while their envelopes exist. Gmail keys are separate from the legacy
  `CONNECTOR_ENCRYPTION_KEY`.
- Enable the Gmail API and configure consent/test-user access for the
  requested `openid`, `email`, and `gmail.readonly` scopes. Public release
  depends on Google's applicable restricted-scope verification requirements.

Manual consent boundary: once that environment is configured and running,
open `http://localhost:3000/onboarding`, sign in, and choose **Add Gmail
account**. That form makes an authenticated, same-origin POST to
`/api/connect/mailboxes/google/start`. Complete Google consent manually.
The callback returns to onboarding with only a fixed success/failure status.
Do not put tokens or authorization codes into diagnostic screenshots/logs.

With an explicitly approved read scope, choose **Find known products** for
catalog sender-domain discovery, **Check recent updates** for the incremental
window, or **Explore earlier mail** for historical discovery. Each click reads
one page of at most five From/Subject/Date metadata records, without bodies or
attachments. **Continue known products** and **Continue recent updates** use
their own atomically retained query/cursor contexts. Never resume one mode
using another mode's token. Each page completes its scan lease; failed work
preserves committed progress. A crashed lease expires after two minutes.
Expired-query recovery offers an explicit restart of that search while
retaining prior evidence and owner choices. A completed incremental window
advances its high-water mark; partial coverage remains labeled partial.

Known sender-domain matches create private candidates with no signup, payment,
or usage observations. Sender headers are unverified. Unknown senders are
retained privately for review without assigning a guessed product. Empty
pages create no candidates. Originals, private review, and public
publication stay separate. Confirm or correct candidates before any explicit
publication. New reads never publish or update existing public activity.

Reconnect uses the selected immutable account and its pre-consent generation;
choosing another Google account fails. **Add Gmail account** cannot overwrite
an existing account. Disconnect deletes that account's encrypted credentials,
invalidates in-flight work, and preserves historical evidence/reviews. Tokens
are encrypted for the new generation before storage. One pending Google
consent per owner is supported; starting another supersedes the first.

Normal access-token refresh is now wired through generation-, lease- and
credential-revision checks; both real accounts refreshed successfully during
the September 18 pass. Revoked grants need the owner's reconnect/consent.
Automatic discovery is implemented but **disabled for both real accounts**.
An explicit per-account opt-in makes the first bounded read due within the
15-minute scheduler interval and subsequent reads at most daily. Development
sync and manual reads do not authorize this opt-in. Hosted unattended refresh
still needs its own authorization and acceptance proof.

The four-page/twenty-header authorization is exhausted; further mailbox reads
remain paused. Historical mode was not started. All four live query contexts
have partial coverage and continuation cursors. Live revoked-grant and expired-
cursor recovery remain to be exercised; regressions cover these failures with
stubbed provider HTTP. Microsoft, full-body/attachment extraction, generic
re-extraction versions and complete historical coverage remain outside this
slice. The real known-product capture/candidate gate is closed, without
converting mailbox evidence into signup, payment or human-usage claims.

## Authenticated file uploads

The accepted backend includes first-upload ownership and issuer-bound replay.
It replaces exposed storage upload URLs with an owner-bound ticket and an
authenticated Convex HTTP action. Future changes must preserve that boundary. Convex supplies `CONVEX_SITE_URL`; no additional secret is needed.
Old clients receive a reload instruction. New uploads accept the same formats
up to **19 MiB**, below the HTTP action's 20 MB request limit. Existing retained
files are unchanged. The private UI explicitly marks legacy uploader attribution
unverified; do not backfill it from the old account association. See the
[first-upload verification receipt](verification/2026-09-19-first-upload-ownership.md).
