# Cloud-agent fixture reconciliation — 2026-10-06

Source proposal: [PR #82](https://github.com/keeganmoody33/PROPER-RESPECT/pull/82), original head `a2c17716486b100eff0d93b53c5984c4b8d04d22`.
Starting base: `94c65df28ff6caf0367728c40c855e8e6303d493`.
Ref: https://plan.ref.tools/oLGxQYBMTcFHrrvg.

## Disposition before editing

The old proposal has no substantive outside review: its Devin check explicitly skipped review, and its stored reviews/inline comments are empty. No Devin-authored commit was found in the inspected commit set.

Independent read-only investigation recorded the old anonymous Convex bootstrap as fix now before this port. Existing deployment selectors precede the CLI anonymous fallback. The old startup seeded owner-named records and could replace them, disabled typechecking, accepted a fixed healthy port without proving child ownership, and wrote configuration. Its intent is retained as a cloud-agent preview; the backend bootstrap and automatic seed are replaced by the existing synthetic public fixture.

## Result

The environment installs the locked graph with engine-strict and starts one Node24 fixture terminal. The wrapper reads only environment-file key names to blank their values in its child's environment; existing files are not changed. The child receives explicitly empty Clerk/Convex/PostHog configuration, synthetic public origin, development mode and fixture mode. It launches the installed Next CLI on an explicit loopback port and propagates startup failures. It never invokes Convex or writes backend/deployment configuration. This preview exercises public projection and a signed-out collection shell; it does not establish signed-in CRUD or a real backend connection.

## Verification

- Actual entry-point unit: one pass with fake poisoned inherited deployment/auth/analytics values and a synthetic `.env.local`. The captured child is isolated, configuration bytes remain unchanged, and no `.convex` path appears. Raw output `/tmp/proper-respect-pickup-20261006/cloud-fixture-unit-final.txt`.
- Legacy RED reproduction: executed the exact original shell script in a disposable synthetic project with stand-ins for npx, curl, setsid and sleep. Its inherited deployment key reached both Convex command kinds and it changed the synthetic configuration file. The isolation assertion fails for the intended reason. No real CLI or provider ran. Output `/tmp/proper-respect-pickup-20261006/cloud-fixture-legacy-red.txt`. This reproduction was performed after the new wrapper implementation; it is not a claim that this test ran first.
- Real Next fixture startup and seven existing public-profile browser checks pass, including canonical redirect, projected card/evidence, axe, unknown handle, legacy roots, and signed-out noindex collection. It starts through the new wrapper despite fake poisoned auth/backend values. Output `/tmp/proper-respect-pickup-20261006/cloud-fixture-browser-verified.txt`.
- Real wrapper rejects a separately held synthetic port with EADDRINUSE and exit1; it does not accept or reuse that server. Output `/tmp/proper-respect-pickup-20261006/cloud-fixture-port-collision.txt`.
- Lint/typecheck/diff check: pass. Next dev's generated import-path changes in `next-env.d.ts` were restored to their starting content.
- Initial browser configuration attempts exposed Playwright's multiple-config webServer concatenation, relative command cwd, and CJS config import-meta incompatibility. The final config follows the existing single-object base spread and explicit root cwd. Raw attempts remain in `/tmp/proper-respect-pickup-20261006/cloud-fixture-browser{,-final,-complete}.txt`; no server was reused or gate skipped.
- The required Ubuntu verify job runs the same wrapper browser scenario after installing Chromium. Its fresh hosted result must pass before merge; local Darwin source checks are separate from Linux execution.

This is developer-startup reconciliation; no application provider logic changed. Synthetic data proves the bounded preview only. No provider/account request, seed, production environment change, deploy or publication occurred.

## Source hashes

- `.cursor/environment.json`: `7c349175d7d01594fef1e345b5570c5b5a8ab51d15577ff7739149845d48343a`
- `.cursor/start-fixture.mjs`: `8b6f167a1ed325f77a90800753c524e6009c56abc99ab72202c1429661b01fd3`
- `.github/workflows/verify.yml`: `8ac6b9a75cf5f82b3dfb766696eca084ec2697fafe599890d3ac902d9cec74cc`
- `package.json`: `cd2b7e7d3a2f0ac79c63b5bfefd0a6d72d81f3c0c6403e32e75698718808f568`
- `scripts/cursor-environment.test.mjs`: `d23f5d59a08042e7d89268288d629e5ad95ef56f9ae92b7e4d28fd88b3c9418d`
- `tests/e2e/cursor-environment.config.ts`: `57596da83890f8a0420e1c76879efe8d8be53dec9198714380e7b1c980e18a44`

Later integration: main `1dd933182193f4b38c16762b8890885adcf7aa49` adds the independently verified release CLI smoke. The fixture source is unchanged; the workflow source hash above includes both checks.
