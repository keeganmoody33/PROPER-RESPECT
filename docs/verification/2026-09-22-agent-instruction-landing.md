# Agent instruction directory correction

Verified September 22, 2026. Base/main: `32a851f18632af984e56ab2d761ebc47be870340`. Failing regression commit: `157c9b3c5f2cb782ec678e81e9289e0bbf42ae23`. Route implementation commit: `f06989dbb28d12dd7520ad233b0cd01e3a9e4b62`.

## Observed defect and design

The live Ora 66/C audit selected `/.well-known/agent-skills/` as an instruction document. Vercel returned the same JSON bytes as the explicit index, while `/agents.md` contained the complete when-to-use guidance. Ora's instruction check fell from 3/3 to 2/3.

Three PStack candidates compared an explicit route and an exact beforeFiles rewrite, with static generation considered as an alternative. The lead and independent cross-judge selected the explicit route using existing `agentInstructions()` and `markdownResponse()`. The data shape remains a public Markdown string adapted to an HTTP response. No request identity, private records or new tool enters this path. Candidates and judge inherited the same model; no cross-provider validation is claimed.

The exact route is preferable to a global rewrite because it keeps document behavior beside existing discovery routes. The rewrite remains a fallback if a deployed candidate demonstrates a routing-precedence issue. No speculative fallback was added.

## Failing then passing HTTP proof

Before the fix, both new local HTTP tests failed:

```text
Expected: 200
Received: 404
2 failed
```

Local Next returned 404 where deployed Vercel supplied its directory-index JSON fallback. Both responses lacked the required Markdown instructions. After the fix, the full discovery suite passed against development and the production build:

```text
18 passed
```

Both directory spellings now return the existing guide, with heading-led Markdown, explicit when-to-use guidance, matching `/agents.md` text, CORS and nosniff. HEAD returns matching headers and no body. Explicit index and skill downloads remain byte-identical to their source files; missing nested resources remain HTTP 404.

- Index SHA-256: `12d5277d18e070dd47a8f0f066591fbb404ab72670decc08dec05ad65434d35c`.
- Skill SHA-256: `61ff667f9a8e3bb4620e537cdafc39f9097d797740ae7da8f3d0721fe0bd7c56`.
- Full unit suite: 759 passed, two optional tests skipped.
- Script suite: seven passed.
- Lint, typecheck and production build passed.

Independent review of `f9e38dd14b81882032d27e7a0814d4ea6b5d4ad1` found no blocking code defects and independently repeated the 18 production HTTP checks successfully. Its receipt-wording correction is reflected above.

The same instruction source now links directly to the real portable manifest and GitHub package root. Package documentation uses the remote Codex and skills CLI installation paths actually verified in the [release receipt](2026-09-22-ora-release-and-rescan.md).

## Remaining deployed verification

This correction has not been released. A real Vercel candidate must prove directory-route precedence before promotion. Only a later complete Ora scan can establish recovered instruction credit or acceptance of the newly explicit manifest links. No score gain, private-user acceptance, remote MCP support or homepage WebMCP detection is claimed from these local checks.
