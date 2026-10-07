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
No upload or push occurs. A fully passing full suite still needs an authorized
writable temporary directory outside Git ancestry; existing sandbox guards and
the environment's read-only Git markers are preserved.

No account or credential access, private upload, permission change, backend
configuration, publication, push, merge or deployment is authorized or performed.
The previous full-suite filesystem blocker remains documented in the
[adapter receipt](2026-10-06-cursor-report-adapter.md). Sandbox guards are unchanged.
