# PROPER-RESPECT

Proper Respect lets someone keep a private collection of the tools they use,
with notes and supporting evidence, and choose which cards to publish on a
public profile. Evidence proposes; the person confirms. It runs on Next.js,
Convex and Clerk.

Two ways to run it locally:

1. **Fixture mode** (no accounts, about 5 minutes): the public pages with
   synthetic data. Good for UI work and reading the code.
2. **Full mode** (your own Convex and Clerk, about 30 minutes): sign-in,
   onboarding, a private collection and publishing, against a development
   backend of your own.

## Requirements

- **Node 24** (`.nvmrc`). With nvm: `nvm use`. Vercel, CI and the Convex Node
  actions all run 24.
- **npm**, which comes with Node.
- **Git.**

## 1. Fixture mode: no accounts

```bash
git clone https://github.com/keeganmoody33/PROPER-RESPECT.git
cd PROPER-RESPECT
npm ci
PROPER_RESPECT_E2E_REFERENCE=1 npm run dev
```

Don't create `.env.local` for this mode. With no Clerk or Convex keys, the app
serves synthetic data instead of calling a backend:

- `http://localhost:3000/`: the homepage.
- `http://localhost:3000/lecturesfrom`: a public profile built from
  synthetic reference data (`src/data/e2e-reference-profile.ts`).
- `http://localhost:3000/evidence-fixture` and
  `http://localhost:3000/evidence-fixture/inventory`: fixture views of the
  evidence cards and the private collection.
- `http://localhost:3000/about/methodology`: how evidence works.

Sign-in, onboarding and anything that saves data need full mode.

The browser tests use this same mode (`playwright.config.ts`).

## 2. Full mode: your own Convex and Clerk

This uses a Convex **development** deployment and a Clerk **development**
instance, both yours. It never touches production.

1. **Install and copy the environment file.**

   ```bash
   npm ci
   cp .env.example .env.local
   ```

   `.env.local` is ignored by Git. Keep `PUBLIC_SITE_ORIGIN=http://localhost:3000`.

2. **Create a Convex dev deployment.**

   ```bash
   npx convex dev
   ```

   Log in and create a new project when asked. The command writes
   `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` to `.env.local` and keeps
   running, pushing the functions in `convex/` as you edit. Leave it running in
   its own terminal.

3. **Create a Clerk development instance** at
   [dashboard.clerk.com](https://dashboard.clerk.com).
   - Copy its publishable and secret keys (`pk_test_…` and `sk_test_…`, both
     from the same instance) into `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and
     `CLERK_SECRET_KEY` in `.env.local`.
   - Open the Convex integration in the Clerk dashboard, select **Activate
     Convex integration**, and copy the Frontend API URL it shows
     (`https://<instance>.clerk.accounts.dev`).
   - Optional: enable GitHub under social connections, to try the GitHub
     connector.

4. **Give your Convex deployment its two server settings.** Enter each value
   when prompted, so it stays out of your shell history:

   ```bash
   npx convex env set CLERK_FRONTEND_API_URL
   npx convex env set CONNECTOR_ENCRYPTION_KEY
   ```

   Use the Frontend API URL from step 3, and a key from
   `openssl rand -base64 32`. Keep the key: connector credentials saved with
   it can't be read with a different one.

5. **Start the app** in a second terminal:

   ```bash
   npm run dev -- --hostname localhost
   ```

   Open `http://localhost:3000/onboarding`, sign in, and build a collection.
   Use `localhost`, not `127.0.0.1`, so Clerk accepts the session.

6. **Optional: seed the reference profile** into your dev deployment:

   ```bash
   npm run convex:seed
   ```

   It creates the synthetic `keegan` profile. Run it only against your own dev
   deployment.

Gmail discovery and Context.dev brand data need more server settings; see
`.env.example` and [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). Neither is needed
to try the app.

## Verify

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm test` runs the Vitest suite (including the Convex backend tests) and the
Node script tests. `npm run test:e2e` starts the app in fixture mode itself.

## Where to go next

- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md): the working guide and current
  delivery state.
- [`AGENTS.md`](AGENTS.md): repository rules for anyone, human or agent,
  making changes.
- [`docs/000-current-product-thesis.md`](docs/000-current-product-thesis.md):
  what the product is for and its permission boundaries.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md): configuration, releases and
  rollback. Production changes are the owner's to make; don't deploy from a
  development checkout.
- [`docs/remediation/CODEX-BRIEF.md`](docs/remediation/CODEX-BRIEF.md): the
  current task list.
- `CONTEXT.md`, `PRD.md` and `INDEX.md`: domain language, requirements and a
  map of the docs.
- [`docs/history/README-2026-06.md`](docs/history/README-2026-06.md): the
  earlier product framing that used to live in this README.
