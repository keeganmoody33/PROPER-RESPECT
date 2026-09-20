# Deployment runbook

## Code synchronization and the owner's domain — September 18, 2026

The owner reports owning **proper-respect.com**, registered through Cloudflare.
DNS and HTTPS redirect to `props.lecturesfrom.com` are verified. The September 19
release of `7fa18a7` is live; hosted Gmail client configuration is complete.
Manual account consent remains pending. See
[the current receipt](verification/2026-09-19-hosted-gmail-release.md).
Clerk domain/OAuth callback migration remains separate from this working redirect.

GitHub consolidation is separate from a hosted release. `vercel.json` sets
`git.deploymentEnabled` to `false`, disabling automatic preview and production
deployments from Git pushes. The existing build command is retained for a later
explicitly approved release and still invokes **Convex deployment**. Manual
Vercel deployments remain consequential and require exact-target approval.
Do not remove the Git deployment guard merely to make a PR status appear.
See [Vercel's Git configuration](https://vercel.com/docs/project-configuration/git-configuration#turning-off-all-automatic-deployments).

During hosted release acceptance, finish canonical/OpenGraph origin metadata
against the selected, verified public domain. That useful remainder from PR #17
does not justify restoring its old seeded profile or superseded card layout.

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

### Context.dev local verification — September 17, 2026

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

## 1. Configure Clerk

Use a production Clerk instance for the production domain.

1. In the Clerk Dashboard, open the Convex integration and select
   **Activate Convex integration**.
2. Copy the displayed Frontend API URL. Production normally uses
   `https://clerk.<your-domain>.com`; development normally uses
   `https://<instance>.clerk.accounts.dev`.
3. With the native Convex integration, Clerk session claims contain
   `aud: "convex"`; use the session token directly. A legacy setup instead needs
   a JWT template named `convex`. Do not create a legacy template just to work
   around a route that ignores native sessions. Hosted Gmail already handles
   both modes. The GitHub route correction remains a separate local follow-up
   until explicitly released and verified.
4. Enable GitHub under Clerk social connections and configure its production
   OAuth callback/domain settings.
5. Copy the matching production publishable and secret keys. Both keys must be
   from the same Clerk environment (`pk_live_` with `sk_live_`).

## 2. Configure Convex production

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

## 3. Configure Vercel

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

## 4. Deploy in order

Deploy the Convex schema and functions before the Next.js application:

```bash
npx convex deploy
```

Then deploy the same Git commit to Vercel. Confirm that
`NEXT_PUBLIC_CONVEX_URL` points to the Convex deployment that received the
backend deploy. A dev URL paired with a production deploy key is an invalid
configuration even if both values work independently.

The existing `props.lecturesfrom.com/keegan` already has curated production data.
Do not rerun the seed for this release or replace production with development
data. The seed command below is only for a separately authorized initial setup:

```bash
npm run convex:seed:prod
```

`seedKeegan` is an internal Convex mutation: browser clients cannot invoke it,
but an authenticated deployment operator can run it through the Convex CLI.

## 5. Production smoke test

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

- Roll back the Vercel deployment to the last known-good commit.
- Redeploy the matching Convex code from that commit.
- Do not delete tables or rotate `CONNECTOR_ENCRYPTION_KEY` as part of an
  application rollback.
- The current schema evolution is additive; handle any future destructive data
  migration with a separate, reversible migration plan.

## Gmail configuration and operation — September 18, 2026

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

## Authenticated file uploads — September 19 PR #23, not yet deployed

The first-upload ownership fix replaces exposed storage upload URLs with an
owner-bound ticket and authenticated Convex HTTP action. Deploy its additive
schema/functions/HTTP action before the matching frontend, only with release
authorization. Convex supplies `CONVEX_SITE_URL`; no additional secret is needed.
Old clients receive a reload instruction. New uploads accept the same formats
up to **19 MiB**, below the HTTP action's 20 MB request limit. Existing retained
files are unchanged. The private UI explicitly marks legacy uploader attribution
unverified; do not backfill it from the old account association. See the
[first-upload verification receipt](verification/2026-09-19-first-upload-ownership.md).
