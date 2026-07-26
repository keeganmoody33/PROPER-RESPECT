# Deployment runbook

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

`CLERK_JWT_ISSUER_DOMAIN` remains a compatibility alias for
`CLERK_FRONTEND_API_URL`. New deployments should use the official
`CLERK_FRONTEND_API_URL` name.

There is intentionally no shared `GITHUB_TOKEN` or `DEVIN_API_KEY`:

- GitHub uses the OAuth token from each user's linked Clerk account.
- Devin uses a per-user organization token submitted during onboarding and
  encrypted before it is stored in Convex.

## 1. Configure Clerk

Use a production Clerk instance for the production domain.

1. In the Clerk Dashboard, open the Convex integration and select
   **Activate Convex integration**.
2. Copy the displayed Frontend API URL. Production normally uses
   `https://clerk.<your-domain>.com`; development normally uses
   `https://<instance>.clerk.accounts.dev`.
3. Confirm the integration exposes the `convex` session-token template. The
   GitHub connector's server route requests that template by name.
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

The Keegan reference profile is optional production data. Seed it only as an
intentional administrator operation:

```bash
npm run convex:seed:prod
```

`seedKeegan` is an internal Convex mutation: browser clients cannot invoke it,
but an authenticated deployment operator can run it through the Convex CLI.

## 5. Production smoke test

After both deployments complete:

1. Open `/` and `/keegan` while signed out; public cards should render without
   private evidence.
2. Sign up with a fresh account and claim a handle.
3. Skip every connector and confirm onboarding can still continue.
4. Link GitHub, import it, and confirm the result is a draft—not public.
5. Publish one selected card from bulk review and verify only that card appears
   on `/{handle}`.
6. Revoke the connector and confirm the last successful public snapshot
   remains while refresh stops.
7. Upload a test screenshot, delete it as the owner, and confirm it is never
   exposed by a public query.

## Rollback

- Roll back the Vercel deployment to the last known-good commit.
- Redeploy the matching Convex code from that commit.
- Do not delete tables or rotate `CONNECTOR_ENCRYPTION_KEY` as part of an
  application rollback.
- The current schema evolution is additive; handle any future destructive data
  migration with a separate, reversible migration plan.
