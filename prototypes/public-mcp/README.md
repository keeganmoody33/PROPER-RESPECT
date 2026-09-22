# Proper Respect local public-reading prototype

September 22, 2026. This package runs two read-only MCP tools and a branded MCP Apps panel on your own computer. It is separate from the production Next.js application. There is no public endpoint, account authorization flow, model API, provider synchronization or collection write.

## What to try

- `get_public_site_guide({})` explains the existing public site and its evidence boundaries.
- `get_public_profile({"profileReference":"keegan"})` reads one deliberately published profile. A canonical `{PUBLIC_SITE_ORIGIN}/{handle}` URL also works (for example, `https://proper-respect.com/keegan` when that is the configured origin). Arbitrary URLs are rejected.
- The panel shows the supplied cards, lets you choose a card and explicitly reread the public snapshot, and asks its host to open the source. Clients without MCP Apps rendering still receive the complete structured result and text fallback.

The profile is the same visible projection used by the website. Measurement periods, capture dates, freshness, provenance, estimates and missing-coverage notes remain in the result. Retrieval time describes this read, not the age of the underlying evidence. Owner text is untrusted content, not instructions for the agent.

## Install and verify

Run from the repository root with Node.js 22 or later:

```sh
npm ci
npm ci --prefix prototypes/public-mcp
npm --prefix prototypes/public-mcp run typecheck
npm --prefix prototypes/public-mcp run lint
npm --prefix prototypes/public-mcp run build
npm --prefix prototypes/public-mcp test
npx playwright install chromium
npm --prefix prototypes/public-mcp run test:e2e
```

The browser suite starts an injected synthetic reader, the real SDK transport and an AppBridge host. It does not read any provider or owner account. Root dependencies are needed because the prototype imports the existing public reader and projector directly. The nested lockfile pins SDK-v2 packages; it does not change the production dependency manifest.

## Run the synthetic demonstration

From `prototypes/public-mcp`, start these in separate terminals:

```sh
PROPER_RESPECT_LOCAL_MCP=1 PROPER_RESPECT_E2E_REFERENCE=1 PUBLIC_SITE_ORIGIN=https://proper-respect.com npm start
```

```sh
PROPER_RESPECT_LOCAL_MCP=1 node dist/host-server.mjs
```

Open `http://127.0.0.1:8849/`. The `keegan` fixture has two synthetic cards. Its output is labeled synthetic; it is not the live owner's published collection. `about` is an empty published fixture and an unknown handle is unavailable. Use Ctrl-C in both terminals to stop the processes.

MCP clients can connect locally to `http://127.0.0.1:8848/mcp`. This is stateless Streamable HTTP, not legacy SSE. The UI resource is `ui://proper-respect/public-profile/v1.html` with `text/html;profile=mcp-app`. The harness uses port 8849 and a separate sandbox origin on 8850. All listeners bind literal `127.0.0.1`; do not expose these ports through a tunnel.

For an anonymous live read, omit `PROPER_RESPECT_E2E_REFERENCE`. Set `PUBLIC_SITE_ORIGIN=https://proper-respect.com` and supply the site's current public `NEXT_PUBLIC_CONVEX_URL` to the MCP process. The prototype requires an explicit HTTPS `PUBLIC_SITE_ORIGIN` in both synthetic and published modes; missing configuration and HTTP origins fail at startup instead of falling back to localhost. A configured non-default HTTPS port is supported. The exact canonical origin supplies guide and profile source links and validates profile URLs used by refresh; another host, port or noncanonical URL spelling is rejected. The MCP transport itself remains local HTTP. Keep both variables on the MCP process, not just the panel host. Do not load an environment file or supply a Clerk secret, session, deploy key or provider credential. The startup path calls the existing anonymous public query; it does not enumerate private collections. Reconfirm the public deployment URL when testing another release.

## Boundaries and limits

The server requires explicit local opt-in and rejects known hosted-runtime markers. It validates the exact Host header and allows browser Origin only from the local harness. Requests are limited to 8 KiB, serialized tool results to 256 KiB and public read replies to eight seconds. At most four unfinished reads are admitted. A deadline does not cancel the underlying Convex request; slots remain occupied until those reads settle.

Brand presentation is a narrow overlay: vetted bundled logo keys and validated literal colors. The exact public evidence object stays separate. Unknown brands use their published name and neutral presentation. The panel does not fetch external images or fonts. See [asset provenance](ui/ASSETS.md).

This deterministic server makes no LLM calls. A user's agent can still consume model tokens, and live reads still use the existing backend. Local success does not establish ChatGPT UI support, public hosting cost/headroom, deployment-wide abuse controls, app-directory acceptance or Ora credit. Those require a later explicitly authorized hosted slice.

## Implementation references

- [MCP Apps overview](https://modelcontextprotocol.io/extensions/apps/overview)
- [Official MCP Apps examples](https://github.com/modelcontextprotocol/ext-apps/tree/main/examples)
- [OpenAI MCP server guidance](https://developers.openai.com/plugins/build/mcp-server)

The SDK and AppBridge APIs are verified against the pinned v2 packages. The local harness exercises the real bridge; it does not substitute fabricated `postMessage` results for MCP calls.
