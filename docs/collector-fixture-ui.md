# Durable collector fixture UI

This page uses the local SQLite receiver and companion through the fixture HTTP
server. Its Codex rollout records and Cursor report are synthetic. It cannot
authenticate a provider account, access real usage files or publish measurements.

The browser owns source selection, the approval dialog and a temporary sharing
preview. The receiver owns approved access and accepted private results. The
companion owns pending deliveries and acknowledged checkpoints. Reloading the
page reads the receiver again; measurement state is never stored in browser
storage.

## Run locally

Use Node 24. Create a private directory outside the repository, then run:

```sh
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
  --disable-warning=ExperimentalWarning \
  scripts/collector-fixture-server.mjs \
  --directory /absolute/private/fixture-directory --port 4188
```

Open `http://127.0.0.1:4188`. The server binds only to loopback. The directory
holds synthetic source files and private SQLite stores. Do not point it at real
Codex data.

Choose Codex or Cursor and personal or work context. Review the request, approve
it and inspect the backfilled results. Repeat sync to check stable totals, add a
synthetic update, then reopen the fixture stores. Disconnecting stops collection
and preserves accepted history. A browser reload proves that the UI reads the
retained record from the receiver.

Codex response tokens and legacy cumulative increases have separate cards.
Cursor native quantities, unknown requests and source usage-cost estimates have
separate labels. Subscription payments, actual charges and API-equivalent
estimates remain unsupplied.

The sharing controls let a user select individual measurement fields. The page
shows only a local preview, labelled with synthetic data, partial history and
unverified provider identity. Reloading clears every selection. Nothing is
published.

## Browser verification

```sh
TMPDIR=/var/tmp PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium \
  npx playwright test --config tests/collector-browser/playwright.config.ts
```

The launcher creates and removes a private temporary fixture directory. Tests
exercise approval without a read, backfill, replay, updates, store reopening,
revocation and retained results, Cursor metric interpretation, deliberate preview
selection, keyboard cancellation and desktop/mobile accessibility. Screenshots
in `tests/collector-browser/screenshots/` contain synthetic data only.

Closing and reopening SQLite handles proves store persistence in this fixture.
It does not prove macOS installation, daemon restart behavior, live authentication
or a real Mac connection. Those remain separate acceptance gates.
