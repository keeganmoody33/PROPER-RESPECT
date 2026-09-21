# Agent discovery verification

Date: September 21, 2026.
Implementation commit: `92d5e5bdd477dca8c93cc4f1250207a37e7ecdb4`.
Base main: `6dc63391c789ffe2eb7f8e19174c89ebbaf3b032`.
Ref: https://plan.ref.tools/d6fedvHQMy4bpEJW

## Scope and baseline

The owner pasted an orank remediation request. Its 45 findings were checked against actual product capabilities. The cached live scan is 50/100, grade C, scanned 2026-09-21T19:10:42.081+00:00. Live requests confirmed missing index.md, auth.md, robots.txt, ARD catalog, homepage JSON-LD and discovery Link headers. The exact baseline is in 2026-09-21-agent-discovery-baseline.json. No improved score is claimed for unmerged local source.

The existing WebMCP tool belongs to published profiles, not the homepage. It accepts an empty object and returns only the visible publication. It remains unchanged. The agent guide now links a published example. This is discovery documentation, not a remote transport or permission to inspect private records.

## Design and boundaries

The data consists of public product identity, homepage Markdown, agent instructions, human authentication guidance and one ARD entry referencing that guide. All site URLs use publicSiteOrigin. The repository URL was verified PUBLIC using gh repo view. Existing llms.txt prose moved into a shared document function so Markdown and llms.txt cannot disagree.

The read-only grounding reviewer compared explicit route handlers with broad proxy negotiation. Explicit dotted routes reuse the existing llms.txt pattern and cannot collide with valid profile handles. Clerk proxy, Convex, account writes, WebMCP registration, profile publication and redirects are unchanged. Full architecture exploration was skipped for this mechanical route adaptation. Public robots allows crawlers to read existing noindex directives; robots is not an authorization boundary. Origins remains excluded from the sitemap. The fixed homepage revision date must change only when that content changes.

Model the Domain kept discovery metadata separate from private data. Prove It Works required actual response bodies and headers, not file presence or a score estimate.

## Verification

PASS on the implementation tree:

- npm test: 752 Vitest tests and 7 Node script tests. Two existing tests skipped.
- npm run lint, npm run build and npm run typecheck: pass. Build uses synthetic public origin, Convex URL and Clerk publishable key; no owner credentials.
- npx playwright test: 93 passed. This includes 11 discovery checks, existing profile-handle, private noindex, theme and WebMCP contract checks.
- npx playwright test --config tests/native-webmcp/config.ts: 8 passed with real Chrome registration, invocation and navigation lifecycle.
- CUA inspected the actual local homepage, JSON-LD DOM and Markdown alternate. The visual layout remains intact. Screenshot kept with private evidence.
- Independent inherited-model review found no blocking implementation finding. It confirmed ARD v0.91 format and no auth/private-route changes. No-comments review found 0 added comments or suppressions requiring deletion. Its finalization notes requested restoration of generated next-env.d.ts and completion of this receipt and trail, now addressed.

Logs and screenshots are retained in the owner’s private evidence archive under the September 21 agent-discovery receipt. Private archive paths are not published. The HTTP regression is committed in tests/e2e/discovery.spec.ts and is already included by the existing CI workflow. Native Chrome emitted React's development warning about non-executable script tags during client navigation; JSON-LD remains parseable on initial HTML and no runtime test failed.

 Initial local test launch failed because Turbopack rejected an external node_modules symlink. A local APFS clone fixed the environment. The preserved live HTTP baseline supplies the RED observations; the failed local launch is not counted as a failing product test. The initial full checks also caught the sitemap test expectation needing the new lastmod and a test regex flag incompatible with the ES2017 target. Both are corrected without relaxing the production contract.

## Finding dispositions

Each row refers to the exact finding title supplied by the owner. Implemented means local source until this PR is separately merged and released. The owner has since set a target of at least 90/100 on Ora and requested all 45 findings remain tracked. Missing capabilities require discussion before implementation; they are not closed as inapplicable. The linked Ref contains the current full checklist and decision sequence. This table records what this PR does and what it leaves open.

| Finding | Disposition | Evidence or reason |
| --- | --- | --- |
| Wikipedia / Wikidata entity presence | External prerequisite | Independent notability evidence is absent. Do not self-publish promotional encyclopedia claims or invent citations. |
| Brand name discoverability | Partial | Consistent SoftwareApplication identity and verified repository linking added. Search ranking and indexing are external outcomes, not guaranteed. |
| ChatGPT app listed | Deferred product integration | No ChatGPT app exists to submit. A supported app and directory review are separate product work. |
| ARD discovery | Implemented | Catalog advertises one existing public-profile reading guide as text/markdown, not a remote MCP server. |
| Agent platform configs | Implemented | Existing public AGENTS.md and repository linked from llms.txt and agents.md. No replacement repo rules invented. |
| Agent Plugins manifest | Open; capability discussion required | No product plugin or bundled remote MCP server exists. A discovery document is not a plugin manifest. |
| Listed on skills.sh | Deferred packaging | No installable product skill is shipped here. npx skills add installs a skill; it does not establish an official directory listing. |
| JSON-LD structured data | Implemented | Homepage SoftwareApplication JSON-LD uses known product facts and configured canonical origin. |
| Agent instruction / when-to-use | Implemented | Explicit best-fit jobs, profile entry URL, invocation and interpretation limits added. |
| Agent discovery file | Deferred packaging | No installable skill is advertised. ARD and agents.md discover the actual browser workflow without a made-up skill index. |
| A2A / agent-card | Open; capability discussion required | No A2A agent or contact endpoint exists. |
| MCP well-known discovery | Open; capability discussion required | Browser WebMCP is not a remote MCP transport. No fake server URL published. |
| Agent mode view | Deferred representation | Explicit index.md and agents.md provide the documented machine-readable entry. Query-based replacement remains absent. |
| Markdown URL fallback | Partial | index.md is implemented. Arbitrary profile .md twins are deferred to preserve exact publication and missing-profile semantics. |
| Skills.sh skill quality | Deferred packaging | No official skills.sh skill was published; duplicating repositories for a score is not a capability improvement. |
| JSON-LD entity linking (sameAs) | Implemented | sameAs points only to the verified public product repository. No invented social or encyclopedia identity. |
| Organization schema completeness | Unsupported entity fields | The known entity is a web application. No business address, phone or organizational contact was supplied; none is fabricated. |
| Schema type breadth | Partial | SoftwareApplication describes the actual product. No unsubstantiated ratings, reviews, offers or FAQ schema added. |
| Trust anchor pages | Owner content prerequisite | Origins remains a labeled placeholder. Legal/contact copy needs real operating details. Root words may already be profile handles; no route takeover. |
| API catalog (RFC 9727) | Open; capability discussion required | No supported external HTTP API or OpenAPI document exists to catalog. |
| Content without JavaScript | Already present | Scan reports 2,147 characters and H1. The page is server-rendered; a markup ratio alone does not establish missing content. |
| NLWeb Schema Feeds | Open; capability discussion required | robots.txt added, but no JSONL/RSS Schema Feeds exist. Agentmap points to the real ARD catalog; no fake schemamap feed. |
| HTTP Link headers (RFC 8288) | Implemented | Homepage Link header advertises existing sitemap, Markdown alternate, ARD catalog and agent documentation. |
| Modular llms.txt per product area | Deferred duplication | The small documentation set has explicit agents.md and auth.md. There are no separate product/API documentation sections requiring duplicate llms.txt indexes. |
| Sitemap freshness (lastmod) | Implemented | Homepage lastmod is the actual content revision date, fixed in source. It is not reset by request/build time. |
| Markdown alternate link | Implemented | Homepage HTML metadata and HTTP Link header both advertise the working index.md route. |
| Markdown agent docs | Implemented | Root agents.md and auth.md return real heading-led Markdown with text/markdown content type. |
| Markdown content negotiation (acceptmarkdown.com) | Deferred representation | Root Accept negotiation is not added. Explicit Markdown routes meet cold-discovery needs without changing Clerk or Next request routing. |
| Bot-UA markdown serving | Open; optional behavior discussion required | No User-Agent cloaking. All clients can request the same explicit Markdown resources. |
| WebMCP support | Existing capability; scan missed profile scope | Tool registers only on published profile pages. Added explicit profile entry/invocation guidance; native regression remains the runtime gate. |
| MCP Apps support | Open; capability discussion required | No remote MCP server or ui:// resource exists. |
| Agent auth discovery metadata | Open; capability discussion required | No supported agent credential exchange exists. Clerk human sessions are not a public OAuth agent authorization server. |
| Web Bot Auth directory | Open; capability discussion required | The product is not operating an agent signing-key service. No fabricated keys or unverified signing claims. |
| OAuth Protected Resource metadata (RFC 9728) | Open; capability discussion required | No OAuth-protected external agent API exists. Do not advertise internal Clerk/Convex credentials. |
| auth.md exists | Implemented | auth.md documents anonymous public reading, human Clerk sign-in, access limits and actual error/lifecycle behavior. |
| auth.md structure | Open; auth discussion required | No register/claim/exchange/ID-JAG flow is offered. auth.md explicitly states the unsupported methods instead of adding misleading spec keywords. |
| agent_auth endpoints reachable | Open; auth discussion required | No agent_auth endpoints are advertised; no placeholder endpoints created to evade 404 probes. |
| MCP server-card.json | Open; capability discussion required | No remote MCP server exists to describe. |
| Product + docs MCP coverage | Deferred product integration | Separate product and documentation MCP servers would create new services, not repair current WebMCP discovery. |
| Sandbox / test environment | Deferred hosted environment | Local synthetic fixtures exist. No public sandbox or production-data access is implied by them. |
| A2UI / generative UI support | Deferred product integration | No in-conversation application UI is implemented or claimed. |
| Agent auth WWW-Authenticate hint | Open; auth discussion required | No supported bearer-token API exists. Do not manufacture 401 discovery headers on valid human profile routes. |
| NLWeb /ask endpoint | Open; capability discussion required | No NLWeb query service exists. Adding one would require a separate data/access and cost design. |
| NLWeb streaming support | Open; capability discussion required | No NLWeb endpoint exists to stream. |
| Agent-friendly 404s | Partial existing behavior | Correct HTTP 404 remains. Markdown errors are deferred with representation negotiation; missing profiles and APIs keep truthful status codes. |

## Ora recheck

The requested POST https://ora.ai/api/scan with only the public domain was attempted after local verification. The connection failed with curl35, receive timeout; no response or new score was produced. The earlier cached GET remains50/C. No post-release result is claimed. No local fixture or private data was sent.

## References

- [ARD v0.91 specification](https://agenticresourcediscovery.org/spec/) and [publishing guide](https://agenticresourcediscovery.org/how_to_publish/). ARD describes a resource before invocation; this catalog honestly labels its document text/markdown.
- [Ora API](https://ora.ai/api/openapi.json). A production rescan cannot measure code that has not been released. Repeat POST /api/scan after a separately authorized release and inspect analysisStatus before making score claims.
- Installed Next16.3.5 guides for route handlers, JSON-LD, robots and sitemap were read before implementation. JSON-LD serialization escapes the less-than character.

No deployment, account read, publication, external directory submission, business address publication, or new paid service was performed. The next real-user acceptance run remains separate.

## PR review dispositions — September 21, 2026

Inspected head: `000c886e052aa87c98b0b5d8ac7917cd7253e05c`.

- [Copilot receipt path finding](https://github.com/keeganmoody33/PROPER-RESPECT/pull/44#discussion_r4065655420): fix now. Replace the private machine path with a generic private-evidence reference; preserve the originals outside Git.
- [Copilot decision-record path finding](https://github.com/keeganmoody33/PROPER-RESPECT/pull/44#discussion_r4065655357): fix now. Replace absolute paths with public repository-relative evidence or generic private artifact names.

Validation: the pre-fix receipt and decision records contain absolute private filesystem paths. After remediation, both files pass the absolute-private-path scan and `git diff --check`. These are documentation-only changes; application behavior is unchanged. Earlier commit history still contains the original paths; this correction does not rewrite history.
