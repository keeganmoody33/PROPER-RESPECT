# Release CLI reconciliation — 2026-10-06

Source: [PR #134](https://github.com/keeganmoody33/PROPER-RESPECT/pull/134), head `6560f383b5a33fd28e4a09fe30215a030ced2a2f`.
Current base: `258660ce212ed50623ff2b93765f7cf8d327dff6`.
Ref: https://plan.ref.tools/oLGxQYBMTcFHrrvg.

## Dispositions before editing

Independent tooling investigation `/tmp/proper-respect-pickup-20261006/tooling-reconciliation-evidence.md` identifies the actual Vercel 60.1.3 → 61.0.0 major update. Tar 7.5.11 is already main: that part of the historical dependency rationale is superseded. The remaining CLI and builder graph are retained and reviewed. The stored proposal has no substantive reviews or inline findings. Node minimum rises from 18 to 20; the repository uses Node 24.

## Verification

- `npm ci --ignore-scripts --prefix release-tools`: passed, with exact lock/package pin61.0.0. The dependency install has no provider credentials and disables install hooks.
- Under bundled Node24.19.0 on Darwin, the real CLI shim starts with a disposable working/config directory and a whitelist environment containing no tokens/project selectors. Telemetry is disabled. Default selection and explicit JavaScript selection both pass version and deploy-help checks. Every release-used flag is present: `--prod`, `--yes`, `--build-env`, `--env`, `--meta`.
- Vercel61's native deploy-help branch intentionally returns2 after printing help; installed `dist/commands/deploy/index.js` confirms this exact return. The first smoke assumed0 and failed; the corrected check requires2 plus the complete flag contract. Version requires0 and exactversion. Raw attempts: `/tmp/proper-respect-pickup-20261006/release-cli-smoke{,-final}.txt`.
- Existing deployment-preflight tests:24pass, preserving production target, install-before-secrets, pinned CLI, URL validation and owner protection. Output `/tmp/proper-respect-pickup-20261006/release-cli-preflight-tests.txt`.
- Changed-script lint and `git diff --check`: pass. Configuration/dependency-only reconciliation is exempt from RED regression requirements.
- Required verify job now installs this graph without hooks and runs the same smoke on Ubuntu. Its hosted result must bind the final head before merge; Mac checks do not assert Linux proof.

The protected production workflow is unchanged. No `deploy`, `pull`, `link`, `inspect`, login, provider account request, release tag or production command ran; only version/help commands did. Actual production release remains a separate gate.

## Source hashes

- `release-tools/package.json`: `c2a5331dd98625d11f8dc239a19bde96329e6e2505dabd1b333d092d72135097`
- `release-tools/package-lock.json`: `0317c1996a078670efe263fd9a2f5cca9355c5f8fb59e256e101e864d3eda80d`
- `scripts/check-release-cli.mjs`: `57a91d8a3dd90e667a38f3332cef6e3f6405d0128ce95224f726cee65e57096d`
- `.github/workflows/verify.yml`: `793127899699c6ae318c8bd468bd96f5c1c3af92e461d6d45b302761f0187abc`
