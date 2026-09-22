# Ora discovery corrections

Recorded 2026-09-22 UTC. Source base: `04ab7a5a335b7e1bc1638b75a2ee68bb72cfabbe`.
Verified application head: `c97c92b596bd6a9f11664bfa9c7c67dda07c5eb4`.
Ref: https://plan.ref.tools/d6fedvHQMy4bpEJW

## Findings and dispositions

| Finding | Disposition | Evidence |
| --- | --- | --- |
| Ora rejects the ARD catalog for missing specVersion | Fixed in this branch | AI Catalog transport requires a Major.Minor version. Add `1.0`; preserve the existing ARD documentation entry. |
| Sign-in and sign-up lack robots metadata | Fixed in this branch | Production returned HTTP 200 without a robots meta element or X-Robots-Tag on both routes. Both catch-all pages now export noindex/nofollow metadata. |
| Ora reports no WebMCP | Detection mismatch; decision pending | The live homepage has 17 script elements and no registration. The published profile has 18; registration occurs in script 12. Ora reports scanning only 8 of 16 homepage bundles. Existing native profile invocation works. A proposed public homepage guide tool awaits the owner's choice. |

The [AI Catalog specification](https://ai-catalog.io/spec/) uses `specVersion: "1.0"` for its transport envelope. [ARD section 5.1](https://agenticresourcediscovery.org/spec/#51-discovery-mechanisms) ignores other transport-defined top-level members. This value does not claim ARD version 1.0. [Ora's own catalog](https://ora.ai/.well-known/ard.json) uses the same transport version.

## Regression sequence

Authentication RED commit: `69713ec`. Fix: `2cd1e681ad9b633f003ea15fae5358d37fc591ca`.
Catalog RED commit: `639e241`. Fix: `c97c92b596bd6a9f11664bfa9c7c67dda07c5eb4`.

Auth focused test, before:

```text
Tests  2 failed (2)
```

After:

```text
Tests  2 passed (2)
```

Catalog focused test, before:

```text
AssertionError: expected { entries: [ { …(7) } ] } to have property "specVersion" with value '1.0'
Expected: "1.0"
Received: undefined
Tests  1 failed | 1 passed (2)
```

After:

```text
Tests  2 passed (2)
```

## Verification

- `npm test`: 756 tests passed, 2 optional tests skipped; 7 script tests passed.
- `npm run lint`, `npm run typecheck`, and `npm run build`: passed.
- `npx playwright test tests/e2e/public-metadata.spec.ts tests/e2e/discovery.spec.ts tests/e2e/webmcp-contract.spec.ts`: 18 passed.
- `npx playwright test --config tests/native-webmcp/config.ts`: 8 passed using native Chrome WebMCP. Profile invocation, rejected input, absent tools outside published profiles, and navigation cleanup remain covered.
- Independent review at the application head: no blocking defects. No added comments or suppressions required action.
- Local production HTTP responses: `/sign-in`, `/sign-in/sso-callback`, `/sign-up`, and `/sign-up/verify-email-address` each returned 200 and `<meta name="robots" content="noindex, nofollow"/>`. `/.well-known/ard.json` returned 200 with specVersion 1.0 and its unchanged documentation entry.

The production build and local HTTP run used synthetic configuration: the existing CI dummy Clerk publishable key, `https://example.convex.cloud`, `https://public.example`, and a dummy Clerk secret string with no account. Requests carried no session cookies. This verifies server-rendered metadata, not real authentication or private access.

The default credential-free browser fixture returns HTTP 500 on Clerk pages. Its framework-generated noindex was rejected as evidence. An initial full-suite run overlapped the auth RED checkpoint and failed only those two new regressions; the stable corrected tree passed the full suite. Neither initial failure was relabeled as a passing runtime check.

## Release limits

No merge, deployment, Convex synchronization, Clerk/OAuth/DNS change, provider read, owner-data write, or publication occurred in this task. Current production source remains `04ab7a5a335b7e1bc1638b75a2ee68bb72cfabbe`, with the previously measured Ora score 64/C. Production acceptance and a new Ora score require an authorized release and completed scan. New-user signup, two-user isolation, reconnect/revocation and the broader user-readiness goal remain separate gates.

The original checkout remains clean at `4df11b5fd3ff4e4747f61fa2d72998842970fd7b`. Raw output and local HTTP results are retained in the owner's private verification archive. No private filesystem paths or credentials are included here.
