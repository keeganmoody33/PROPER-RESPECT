# GitHub native-session compatibility

Verified September 19, 2026. Local correction only.

The GitHub connection route always requested a legacy Clerk JWT template named
`convex`. Production uses the native Convex integration. The installed Convex
adapter selects the session token for `sessionClaims.aud === "convex"`; the
deployed Gmail route already follows that selection.

## Reproduction and correction

Tests-only checkpoint `028886015d3b2369dde0722bf43ba3686b2fa0b9` reproduces the
failure through the exported GitHub POST handler. An option-sensitive Clerk
stub returns a native token but no template token. Before correction, the handler
returns 409 instead of 200. Sixteen other route cases passed at that checkpoint.

The route now uses `getToken()` for native Convex sessions and requests the
legacy template otherwise. No connector, evidence, credential storage, UI,
schema or account-selection behavior changed. The existing same-origin and
authenticated-owner checks remain. A missing Convex token or GitHub credential
still prevents invocation of the connector action.

An additional regression makes the template branch throw when the native
integration has no template. The corrected native route never invokes it.
Missing claims, another audience, an array audience, null tokens, missing
configuration and foreign origins have focused coverage.

## Verification

- GitHub and Gmail route tests: 35 passed.
- Full local suite: 601 Vitest tests passed; two optional private-input tests
  skipped. Six Node tests passed.
- ESLint, strict TypeScript, Next production build and diff checks passed.

Tests invoke the real route handler with stubbed Clerk and Convex clients.
They do not establish hosted authentication or a live GitHub import. No browser
connection was attempted. `connectGithub` immediately fetches the authenticated
account's last twelve months of contribution data, so a real connection needs
separate provider-read authorization. No provider calls, backend synchronization,
deployment, publication or saved relationship changes occurred.

This correction follows the pending retained-only release source `32aa043`.
Do not deploy branch HEAD as a substitute for that exact approved archive.
