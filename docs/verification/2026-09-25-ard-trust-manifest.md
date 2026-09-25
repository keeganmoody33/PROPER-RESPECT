# ARD trust metadata

Prepared September 25, 2026. Implementation authorized by the owner; merge and
selective frontend release remain separate exact-head gates.

## Inspected source and finding

- Branch: `codex/ard-trust-20260925`.
- Base main: `43e2eef20a2edd8991d569b7e8dd4dbc03ced313`.
- Live `/.well-known/ard.json` contains one public-profile reading guide entry
  and no `trustManifest`.
- Ora contract 1.25.0 marks `ard-trust-manifest` as a two-point **bonus** check.
  No overall score increase is inferred from an implementation or a merge.
- Scope is tracked in [Task 12](https://plan.ref.tools/d6fedvHQMy4bpEJW) alongside
  the discovery work associated with issue #24.

## Inspection decisions recorded before implementation

- Missing trust metadata: fix now using the existing configured HTTPS guide URL
  and confirmed public source repository.
- Identity alone is insufficient under the current AI Catalog Manifest Validity
  requirement. Include a non-empty provenance link naming the actual repository.
- A repository link is publisher-supplied lineage, not a verified build digest.
  Emit no signature, attestation, digest, audit or certification claims.
- The identity must share the configured publisher domain. Vercel-generated host
  names do not establish canonical authority. Local HTTP must omit this HTTPS
  declaration.
- Stronger signed artifact binding is deferred: it introduces key custody and
  signature verification beyond this bounded identity/provenance change.

## Trust boundary

The manifest identifies the existing `/agents.md` resource through its canonical
HTTPS URL and declares `publishedFrom` provenance to the existing public source
repository. Consumers can check the expected domain's HTTPS endpoint and inspect
the linked source. These are unsigned, publisher-supplied statements; they do not
establish independent publisher authentication, tamper-evident artifact binding,
or protection against compromise of the publisher's hosting. No new account,
credential, key pair, third-party service or private read is required.

Normative references inspected September 25, 2026:

- [AI Catalog identity, manifest validity and provenance](https://ai-catalog.io/spec/).
- [ARD identity and publisher authority binding](https://agenticresourcediscovery.org/spec/#45-identity-and-trust).

## Verification

- RED: both HTTPS origin cases failed because the unchanged catalog had no
  `trustManifest`; six existing/local-HTTP cases passed.
- GREEN: 38 focused tests pass across agent discovery, Markdown metadata,
  configured public origin and the public-site guide WebMCP helper. The new cases
  cover the real domain, a different configured HTTPS origin with a port, ignored
  Vercel host names and local HTTP omission.
- Focused ESLint and `git diff --check` pass.
- The production webpack build, including TypeScript, passes using the existing
  anonymous reference fixture with blank Clerk/Convex variables. This is not a
  production-auth or live-owner test.
- The served build returns 200 JSON with CORS at `/.well-known/ard.json`; the
  identity matches the resource URL and URN publisher domain. Removing only the
  new trust member makes the result exactly equal to the current live catalog.
- The served guide remains 200 Markdown with its existing public-only capability
  limits. Both the live HTTPS identity URL and source repository return 200 without
  redirects under standard certificate validation.
- The source change is confined to `agentCatalog()`. Public guide text, auth,
  collection data, profile publication and backend code are unchanged.

Production remains unchanged. No Ora rescan has been requested. The original
accepted checkout is preserved at `20b91787feca9f99ef81a8be7c9a6fd06147c99e`.
