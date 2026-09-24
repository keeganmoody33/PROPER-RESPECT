# Exact private usage cards — 2026-09-24

Branch: `codex/exact-private-usage-cards-20260924`.
Base: `bf1c2db019c7ca2a46495f256d3937331ca1e42b` (PR #68).
Feature Ref: https://plan.ref.tools/YWNjvdWM6alR07GP
Integration Ref: https://plan.ref.tools/T5OY9rT2rmtqxuxw
External receipt: `/tmp/proper-respect-private-usage-cards-20260924/receipt.md` records final reviewed/merged SHAs and hosted checks after this source receipt.

## Run a local private preview

Node.js 22+ and installed development dependencies are required. This command reads only the two explicitly named repository fixtures. The output directory must be new; existing artifacts are never overwritten.

```sh
node --no-warnings --experimental-strip-types scripts/private-usage-card-preview.mjs \
  --out /tmp/proper-respect-usage-card-example-20260924 \
  tests/fixtures/usage-cost/priced-synthetic.json \
  tests/fixtures/usage-cost/codex-account-synthetic.json
python3 -m http.server 8877 --bind 127.0.0.1 \
  --directory /tmp/proper-respect-usage-card-example-20260924
```

Open `http://127.0.0.1:8877`. The generated application uses the actual ProductCard and global stylesheet; Details reveals full exact values and separately expandable source observations. Appearance switches the outer light/dark theme. API-equivalent pricing is off by default. To exercise the existing explicitly synthetic example, put `--synthetic-haiku-20260924` before `--out` and choose a different new directory. Explicit sanitized files can replace fixture arguments; no discovery or account invocation occurs. Do not serve the directory publicly. The script does not host or upload it.

## Contract and boundaries

`projectPrivateUsage(buildUsageCostReport(texts))` creates `private-usage-preview-v1` with `private-usage-card-v1` attachments. The existing report owns parsing, reconciliation and pricing. The projection allows selected presentation fields only, preserving count/decimal strings, nulls, capture timestamps, observation periods, source client version, sample designation and coverage. Original source observations retain delta/cumulative meaning and remain separate from reconciled coverage. No global token/spend total is computed. Unknown reasons use fixed copy rather than echoing arbitrary diagnostic strings.

ProductCard renders an attachment only for the owner audience, outside brand-preview mode, after strict validation and exact product slug/domain matching. Shared activity, subscription/payment cost, saved/public card schemas, inventory, publication, refresh, public-profile reader and WebMCP implementations are unchanged. The owner audience is a display guard, not authentication. There is no new persistence or second-user read path.

Claude Code retains the existing example identity (`claude-code`, `claude.com`) and existing example typography/initials. Codex uses `codex`, `openai.com` with initials because no exact retained product logo is configured. No parent-company logo is substituted. The unchanged non-metered Copilot card retains its official local logo/font assets. Branding is not usage evidence.

Codex account lifetime snapshots remain origin-unverified and unpriced with period/model/categories unknown; the source parser still accepts only safe integers. Claude can preserve 30-digit counts and up to 12 decimal USD places. Owner-supplied designation stays unverified; no fixture is claimed as genuine metering. Source estimate, conditional synthetic API equivalent and billed unknown are distinct. Baselines/conflicts are not measured increments. No automatic connection, collector, update, publication or deployment exists in this slice.

## Observed verification

- PStack U51–U53: three independent architecture candidates and same-model cross-judge selected the standalone owner-only attachment. Design is in `work/pstack/private-usage-cards-20260924/design.md`.
- Domain and component RED logs preceded implementation. Valid private-projection publication rejection was already GREEN, establishing an existing boundary.
- Focused projection, actual component, CLI and Convex boundary tests: 31 passed.
- Full Vitest rerun: 1,200 passed, two optional private-input tests skipped. Seven Node script checks passed. First run had one 5-second timeout in the unrelated 200-page mailbox test; its isolated 15-test suite and full rerun passed without changing that test.
- TypeScript and ESLint passed before final exact-head review.
- Generated artifact browser tests: 390px and 1280px in light/dark. Verified full exact text, zero/unknown, separate prices, baseline/reset/conflict cases, duplicate replay, source observation disclosure, keyboard focus/escape, no horizontal overflow, retained Copilot asset loading, no external requests and no page errors.
- Browser server required host approval because sandbox loopback listen returned EPERM. No alternate control path was used.

Screenshots and detailed logs live under `/tmp/proper-respect-private-usage-cards-20260924/browser/`. The final receipt lists actual screenshot paths and final reviewer/CI results. Chromium evidence is local synthetic proof; Safari and actual owner evidence are untested.

Committed browser evidence: [desktop light](assets/2026-09-24-private-usage-cards/desktop-light.png), [mobile dark](assets/2026-09-24-private-usage-cards/mobile-dark.png), [exact row mobile](assets/2026-09-24-private-usage-cards/exact-row-mobile.png), [exact row desktop](assets/2026-09-24-private-usage-cards/exact-row-desktop.png). These are actual generated-artifact screenshots with synthetic inputs.

## Review dispositions

- D1 — fixed before implementation: keep private usage outside ActivityModule/public schema; reject forced visitor and wrong-product rendering.
- D2 — fixed: retain observation temporality to distinguish cumulative readings from delta observations.
- D3 — fixed: test schema-valid projected data against actual save/publication APIs, not a malformed stand-in.
- V1 — test correction: duplicate fixture produces one replay; browser assertion corrected from plural to exact single replay.
- V2 — fixed: replace internal pricing reason codes with readable, fixed explanations.

No application route, production record, backend synchronization, device collector, telemetry hook, provider invocation, personal config/auth/session read, scheduled work or deployment occurred. The next dependency is separately validated real source evidence and a reviewed collector/transfer contract; future native single-metric rows and owner-selected public fields need their own projection review. Whole-product and live-metering acceptance remain open.
