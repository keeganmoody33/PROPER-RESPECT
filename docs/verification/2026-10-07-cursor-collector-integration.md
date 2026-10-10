# Cursor collector integration verification

Implementation branch: `feat/cursor-report-adapter`, initial head
`e168e8d5a91ad31cf55374ce7ccbb483c1aeff32`, isolated worktree
`/workspace/PROPER-RESPECT-cursor`. Published integration reference: PR #157
`a6c670b6fc71b418d608c75d612c06112195a701`, unchanged detached validation
worktree `/workspace/PROPER-RESPECT-cursor-contract`. No shared modules are edited.
Reported canonical local `17f8a52` is unavailable here and is not claimed tested.

## Comparison dispositions

Recorded before bridge implementation. Independent research inspected the exact
published parser, domain contract and receiver replacement slot.

| Finding | Disposition |
| --- | --- |
| Published fixture CSV cannot parse observed real-format exports or official JSON | Keep the real-format parser and use one direct bridge into the shared schema. |
| Published fixture parser emits unapproved null metric families | Avoid in the new bridge: emit only selected approved metrics; leave shared code to its owner. |
| Report IDs cannot separate the receiver's connection/window slot | Pin source/schema/filter/billing scope in the approved descriptor; reject a changed pin. |
| Source request billing units are not native request counts | Preserve privately; project requests as null. |
| Source money is not the contract's cost-estimate meaning | Preserve all exact costs privately; project usage_cost_usd as null. |
| Shared schema lacks rich source, coverage, cache-write and literal CSV input fields | Retain the private report unchanged and return explicit projection omissions. |
| Shared and provider-private checkpoints have different responsibilities | Keep only shared delivery durability; provider preflight owns no transport or persistence. |

Independent implementation review found no correctness or security issue in the
trusted-normalizer-result scope. The reviewer flagged an unused `id` destructure
in a new test as a possible lint warning: fix now by filtering that key, matching
the existing test cleanup. Source-pin binding and the actual schema callback are
caller responsibilities, explicitly documented and tested; they are not claimed
to authenticate an account or authorize a connection.

Copilot review 5450117027 of [PR #158](https://github.com/keeganmoody33/PROPER-RESPECT/pull/158)
at `b273257fb7860763b28385e740d99b0b68f78c2c` found that the adapter handoff still
reported 47 tests for the current `src/server/cursor-report/*.test.mjs` glob.
Disposition: fix now. Re-ran that Node 24 command: **57 passed, 0 failed, 0
skipped** standalone; **63 passed, 0 failed, 0 skipped** with
`CURSOR_COLLECTOR_CONTRACT_ROOT` at this receipt's pinned PR #157 head. Updated
the handoff, collector integration instructions, and this receipt so all three
use those counts. No test files changed.

## Validation

The final Cursor directory was overlaid onto the unchanged pinned PR worktree.
This also checks normalization against PR #157's updated `exact-json.ts`, rather
than validating transport while leaving the parser on the older base.

| Check | Result |
| --- | --- |
| Cursor Node tests on the combined PR worktree | 63 passed, 0 failed, 0 skipped, including 16 bridge tests |
| Published `src/local/cursor-report-adapter.test.ts` and `src/domain/collector-contract.test.ts` | 54 passed, 0 failed |
| Combined PR code `npm run typecheck` | Passed |
| Isolated adapter `npm run lint` | Passed, 0 errors, 0 warnings |
| Independent read-only bridge review | No correctness or security findings; unused test binding corrected after lint confirmed it |
| Whitespace validation | `git diff --check` passed |

The Node command is:

```sh
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types \
  --test src/server/cursor-report/*.test.mjs
```

The focused published tests are:

```sh
./node_modules/.bin/vitest run src/local/cursor-report-adapter.test.ts \
  src/domain/collector-contract.test.ts
```

Tests cover actual shared schema validation, exact large native quantities,
zero versus unknown, duplicate ordinals, private-field removal, source pins,
approved metric subsets, inclusive-to-half-open millisecond boundaries,
deterministic delivery replay and genuine multi-chunk assembly. Missing and
tampered chunks reject. The tests use the existing receiver contract; no second
receiver, persistence implementation or live connection is added.

The isolated branch can run ten projection unit tests without the shared contract;
the integration group then explicitly skips. An explicit invalid contract root
fails module loading. Reported integration results above used the actual contract
and had no skips. These `.test.mjs` files are invoked explicitly with Node, since
the unchanged repository Vitest configuration selects `.test.ts` files.

The final local commit and portable patch are reported in the task outcome.
No upload or push occurred during local validation. A fully passing full suite still needs an authorized
writable temporary directory outside Git ancestry; existing sandbox guards and
the environment's read-only Git markers are preserved.

## Approved draft publication

Publication review disposition: fix the earlier "No upload or push occurs"
sentence to describe local validation historically. The new approval and draft
publication supersede that boundary for code only.
The delivery command also needs a commit range: selecting only the branch tip
would omit the bridge when a later CI commit becomes the tip. Disposition: fix
now by selecting all Cursor commits since the named base, or since the already
integrated cleanup commit.

The owner explicitly approved pushing the tested code and opening a draft PR on
October 7 at 09:36 UTC. [PR #158](https://github.com/keeganmoody33/PROPER-RESPECT/pull/158)
opened at `e79164f09fe39e504b9e0a9079628b2e4806dd7a`, based directly on current
main `6cf026b11499854b53f8aaae01f9a133df7578dd`. PR #157 remains a separate draft
at `a6c670b6fc71b418d608c75d612c06112195a701`; none of its 55 changed files or
shared modules is included here. Dependency injection keeps this PR compilable
on main while the actual contract round-trip remains independently verified
against the pinned PR head.

Publication review identified that the default Vitest configuration does not
run the adapter's Node `.test.mjs` files. Disposition: fix now with one
Cursor-specific read-only workflow. It must not fetch unmerged PR code, change
the shared verification workflow, use secrets, upload fixtures or deploy. When
the shared contract becomes available on main it will also exercise the actual
integration tests. Exact-head CI monitoring and implementation review continue.

The new workflow uses Node 24 and the repository's pinned checkout/setup-node
action revisions, with `contents: read` and checkout credential persistence
disabled. Standalone fixture validation passed 57 tests; the actual shared
collector suite explicitly skips while its contract is absent. A conditional
locked install with scripts disabled enables those tests when the contract is
present in the checked-out code. YAML structure and action/permission invariants
were checked locally. No unmerged branch is fetched to supply that dependency.

Direct `gh` GraphQL and REST reads returned `Forbidden`; the already connected
GitHub app successfully read PR metadata and opened the draft. Git push used
the existing repository authentication without reading or changing credentials.

Exact-head application CI at `ab7de74` passed all 1,988 Vitest tests (two
existing skips), then failed the existing R13 Node-runtime consistency test:
the new Cursor workflow used `node-version: "24"` instead of `.nvmrc`.
Disposition: fix now in the Cursor workflow with `node-version-file: .nvmrc`
and include `.nvmrc` in its path triggers. The existing deployment-preflight
regression reproduces the failure before the fix. No shared test or workflow
is changed. The Cursor fixture CI itself passed all 57 standalone tests.
After the fix, all six Node-script test files from the repository's `npm test`
command pass locally: 122 passed, zero failed, including the R13 regression.

No account or credential access, private upload, permission change, backend
configuration, merge, deployment or publication of measurements is authorized
or performed. The previous full-suite filesystem blocker remains documented in
the [adapter receipt](2026-10-06-cursor-report-adapter.md). Sandbox guards are unchanged.
