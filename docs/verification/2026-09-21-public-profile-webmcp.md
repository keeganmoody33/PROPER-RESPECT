# Public-profile WebMCP verification

Verified September 21, 2026. Application head `deb579869a5d76754ad832b08f0d2e53169e2a88`.
Base `6036f513b1071efda4c3878897889ea67c9fc474`, the open dark-mode PR #41.
The following commit adds this receipt and the native result only.

Ref: https://plan.ref.tools/BNsnxxstTHWMyQKn

## Delivered behavior

`get_current_public_profile` accepts `{}` on the current published profile.
Its response explicitly selects the visitor-visible identity, product cards,
detail content, evidence caveats and cost disclosures. It preserves displayed
numeric precision and supplied daily counts. It omits branding acquisition
metadata, unused profile fields and hidden metric precision. Empty published
profiles return an explanation with `cards: []`.

Registration belongs to the profile component. It uses `document.modelContext`
and an abort signal. Leaving or replacing the profile revokes the registration
and retained callbacks. Missing profiles and unrelated routes have no tool.
Unsupported browsers keep the ordinary page. The adapter makes no data requests.
The configuration-derived `/llms.txt` route describes this contextual tool and
replaces the static old-host document.

## Verification results

| Check | Result |
| --- | --- |
| `npm test` on final source | 749 Vitest tests passed, 2 existing skipped; 7 script checks passed |
| `npm run lint` | Passed |
| `npm run test:e2e` | 91 passed before the final bridge compatibility fix |
| Contract browser retest after that fix | 3 passed |
| `npx playwright test --config tests/native-webmcp/config.ts` after that fix | 8 passed in native Chrome |
| Fixture production build, then `npm run typecheck` | Passed on final source |
| Ora native verifier on the final production build | One tool; valid response; no security-lint findings |
| Codex browser integration on the final production build | Discovery, invocation, navigation cleanup and stale-handle rejection verified |
| `git diff --check` | Passed |

Chrome was `153.0.8010.52`. Native tests launch with
`--enable-features=WebMCPTesting,DevToolsWebMCPSupport` and never replace the API.
They assert `document.modelContext` exists, invoke through `getTools` and
`executeTool`, and verify a same-document Next Link navigation removes the tool.
The retained old native handle fails; re-entry yields exactly one registration.
They also check a published empty profile, invalid arguments and absence at
`/`, `/about/origins`, `/app/collection` and the missing-profile route.

The separate contract doubles cover StrictMode replay, pending registration,
profile replacement, rejected registration, unsupported API and cancelled
invocations. These tests are not native compatibility evidence. Projection
tests compare all six activity variants with rendered card content, including
sparse contribution ranges and missing-count caveats.

Production-build command:

```sh
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY='' CLERK_SECRET_KEY='' NEXT_PUBLIC_CONVEX_URL='' PUBLIC_SITE_ORIGIN=https://public.example PROPER_RESPECT_E2E_REFERENCE=1 npm run build
```

The local production fixture runs on `http://127.0.0.1:8826`. Native CLI command:

```sh
npm exec --yes --package @ora-ai/webmcp-verify@0.1.0 -- webmcp-verify http://127.0.0.1:8826/keegan --headless --json --exec get_current_public_profile --input '{}'
```

[The raw native result](2026-09-21-public-profile-webmcp/native-profile.json)
contains synthetic repository fixture data, not a fresh provider capture.
The verifier's successful transport flag alone was not accepted as proof:
the parsed result was checked for the expected handle, two cards and no error.

## Review corrections

Independent review found that empty time series exposed labels and units absent
from the rendered card. The projection now omits them, with a sentinel regression.
The first Codex browser invocation then reproduced a missing execution-signal
failure despite native Chrome passing. The adapter now accepts an omitted
execution signal while always enforcing registration-lifetime cancellation.
The regression failed before the fix and passed afterward. Both browser paths
were rerun successfully. Final independent review found no remaining issues.

Two design candidates and an independent judge selected explicit projection
over a shared renderer refactor that would touch private inventory and examples.
A third candidate could not start because of the runtime thread limit. All
agents inherited the parent model; this was not cross-model validation.
One writer owned coupled application changes; another owned only native tests.
The coordinator ran the full checks and real browser invocations. Comment review
removed one redundant test comment and found no new suppressions or open flags.

Pstack Boundary Discipline kept input validation in the browser adapter and
projection in a pure typed function. Prove It Works required actual Chrome and
Codex browser calls in addition to unit tests. The current
[WebMCP specification](https://webmachinelearning.github.io/webmcp/) and
[Chrome imperative API guide](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
were checked against the installed plugin instructions.

## Release boundaries

No merge, deployment, authentication configuration change, backend synchronization,
provider read, private-data exposure or publication occurred. No app dependency
was added. The existing user checkout remains clean at
`4df11b5fd3ff4e4747f61fa2d72998842970fd7b`; the dark-mode checkout remains clean at
the base SHA above. GitHub CLI was used because Origin was unavailable.

PR #41 remains open. Its checked head had green checks, no review threads and a
Copilot review with no findings. Configured Clerk appearance remains unverified.
This local fixture proof does not establish production deployment, fresh-user
signup, two-user isolation or real connector lifecycle acceptance. Those gates
remain separate from this public read-only tool.
