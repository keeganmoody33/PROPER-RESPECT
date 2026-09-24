# Explicit Claude selected-file source mode

Dated 2026-09-24 UTC. Source-only change; every verification input is generated
synthetic test data. Testing `--owner-supplied` is software proof, not evidence of
genuine Claude usage. Ref: https://plan.ref.tools/KetN0yyIT4buIGrz.

## Invocation contract

`scripts/claude-native-report.mjs` requires exactly one first-position source
selector: `--synthetic` or `--owner-supplied`. Existing synthetic invocations are
unchanged. Missing, unknown, repeated, conflicting or misplaced selectors reject
before file reads. Both selector tokens are reserved throughout argv; a literal
flag-named file must be addressed with a path such as `./--synthetic`.

The selected origin applies to all files in one invocation and enters the strict
sanitizer before capture validation. Paths and metric contents never infer origin;
outputs are never relabelled after sanitation. `owner-supplied` is a declaration,
not producer authentication, account ownership or proof of human activity.

Exact interface (placeholders are not selected files or authorization):

```text
node --no-warnings --experimental-strip-types scripts/claude-native-report.mjs MODE --key-file KEY --source-scope SCOPE --captured-at ISO_CAPTURE_TIME --content-type application/json [--format report|sanitized] INPUT [INPUT...]
```

All named options precede positional input files. Mode must be one of the two
literal selectors. There is no default mode, acquisition, discovery or receiver.
Report is the default; sanitized format requires exactly one input and emits one
JSON capture plus a newline. Pass those emitted bytes unchanged to
`scripts/usage-cost-report.mjs` and then, only after evaluating report status, to
`scripts/private-usage-card-preview.mjs --out NEW_DIRECTORY`.

## Enforced checks and operator preflights

| Boundary | CLI enforcement | Additional operator requirement |
| --- | --- | --- |
| Input files | Explicit paths; final-component no-follow and nonblocking open; descriptor regular-file check; bounded read | Select and authorize exact files; trusted nonsymlink ancestors; private local directories; matching owner and mode 0600 or stricter |
| Identity key | Explicit file; same type/no-follow protections; exactly 32 bytes; rejects group/other permissions; buffer cleared afterward | Private random key outside exports/Git; matching owner; secure ancestors; stable key and source scope for intended comparisons |
| Raw format | Existing strict sanitizer and byte/point/count limits; entire mixed/unsupported input rejects | Confirm authorized source/format/version/window; allow transient attribute processing; do not silently filter or rewrite rejected exports |
| Native/report output | stdout only; validation completes before emission; fixed redacted rejection text on stderr | Exclusive output creation, mode 0600, new private 0700 directory, explicit approved paths; ordinary shell `>` can overwrite existing files |
| Preview output | Requires a new directory; exclusive generated files | Inspect report status first; preserve any partial failed preview as failed evidence; do not reuse an old directory |

These operator requirements are not new CLI enforcement. Final-component
`O_NOFOLLOW` does not secure symlinked or attacker-writable ancestors. The native
CLI does not check raw input ownership/mode, verify an owner-selected original
hash or provide transactional/exclusive stdout persistence. The selected-file
pilot still requires those separately authorized preflights; do not infer their
completion from CLI success.

## Exit and fidelity contract

Exit 0 means accepted bounded input, possibly only cumulative baselines. Exit 1
means validation/read rejection with empty stdout and redacted stderr. Exit 2
emits quarantined conflict output: stop validated-measurement acceptance and
retain it only as diagnostic evidence. This applies to sanitized format too if
its one capture contains conflicts. Output stream/filesystem failures are not
a promise of transactional stdout rollback.

The downstream report also exits 2 for conflicts. The preview may exit 0 while
showing conflicts; preview generation is not a conflict acceptance gate. Replays
deduplicate by facts, not arrival time. Changed origin on the same stream is a
metadata conflict, not an additional measurement.

Exact generated-fixture assertions retain input `9007199254740993`, source cost
`0.00000000000000000001234567890123456789`, and independent Unix-nanosecond
intervals `1790244000000000001`–`1790244000000000100` and
`1790244000000000004`–`1790244000000000108`. Unknown models/categories stay
unknown; native API-equivalent remains unpriced and actual billed remains unknown.
The branded private card retains origin as `owner-supplied-unverified`, converts
identity digests to local labels, and excludes private usage from public cards.
The original exported representation cannot recover precision already lost by
an exporter.

## Reproducible software checks

```sh
npx vitest run src/server/claude-native/selected-file-cli.test.ts
```

Tests generate input files and test keys in private temporary directories, invoke
real Node CLIs, consume sanitized stdout unchanged, and verify both success and
rejection/status paths. They compare preview branding bytes and public/owner card
rendering, source-origin conflicts, unchanged output on rejected preview reuse,
redaction and exact quantities/timestamps. Full and independent exact-head check
results are retained in the task receipt under
`/tmp/proper-respect-claude-selected-file-cli-20260924/`.

No genuine file, home/configuration/account search, provider binary, telemetry,
receiver/filter/listener, backend sync, authenticated ingestion, recurrence,
publication or deployment is part of this change. Codex HOLD remains unchanged.
Real-file selection and execution require separate exact-scope authorization.
The source pipeline has no explicit network operation; this is source and scoped
invocation evidence, not an OS-wide egress-denial claim.
