# Public reading plugin verification

Date: 2026-09-22. Application commit: `57c32239920ee051440078c31a936f30054f7afe`.
Base/main: `04ab7a5a335b7e1bc1638b75a2ee68bb72cfabbe`.
Ref: https://plan.ref.tools/d6fedvHQMy4bpEJW, Task 4.

## Delivered behavior

The official LecturesFrom package supplies one skill, `read-public-profile`, for a user-specified, owner-published Proper Respect profile. It preserves evidence scope, dates and cost caveats, uses the existing contextual WebMCP tool when available, and falls back to visible public cards. It adds no private access, credentials, account connection, editing or publication capability.

One package under `public/agent-plugins/proper-respect` contains the portable Agent Plugins manifest, native Codex manifest, installation instructions and self-contained skill. The repository marketplace selects that package. The public discovery index points to the exact skill bytes with SHA-256. Agent entry documents link the package and index using the configured public origin. Public contact is the owner-confirmed `33@lecturesfrom.com`.

## PStack decisions and review

Three independent inherited-model designs compared a static public package, a separate plugin directory with runtime filesystem serving, and a generated distribution. Independent comparison selected the static public package; marketplace discovery and manifest/frontmatter checks were retained from the alternatives. This keeps one skill source without runtime filesystem reads or a generation step. These were separate agents using the inherited model, not cross-provider validation.

Independent final code review found no blockers and separately passed the three package tests. Comment review found no comments or suppressions in the scoped implementation, no required refactors and no unenforced constraints. One explanatory test comment was removed before review. No application-code workaround was added.

## Checks

| Check | Result |
| --- | --- |
| `npm test` | 755 Vitest tests passed; 2 optional tests skipped; 7 script tests passed |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed, including after restoring generated production type references |
| `npm run build` | Passed with synthetic public configuration |
| `npx playwright test tests/e2e/public-metadata.spec.ts tests/e2e/discovery.spec.ts tests/e2e/webmcp-contract.spec.ts` | 23 passed |
| `npx playwright test --config tests/native-webmcp/config.ts` | 8 passed; actual native Chrome tool registration, invocation and navigation cleanup |
| Production-build HTTP checks | 12 passed: GET/HEAD for five artifacts, exact source bytes and media types, CORS, nosniff, empty HEAD bodies, two missing-artifact 404s |
| Portable manifest | Validated against the official Agent Plugins 1.0.0 JSON schema |
| Native plugin and skill validators | Passed |
| `git diff --check` | Passed |

The production-build HTTP checks used a local `npm start` server with Clerk middleware enabled and synthetic configuration. They did not authenticate a real user. Fixture browser checks remain distinct from this server and the live reading check below. The generated `next-env.d.ts` development-path change was restored and is not part of the delivery.

The discovery index follows the [draft 0.2.0 RFC](https://github.com/cloudflare/agent-skills-discovery-rfc/blob/main/README.md). Its referenced schema host did not resolve during validation. RFC shape, reference resolution and exact digest are tested locally; remote JSON-schema validation and Ora acceptance of this draft are not claimed.

## Actual Codex installation

Codex 0.153.4 read the repository marketplace through its native plugin resolver and discovered the one intended skill. An exact package copy was then registered in a uniquely named temporary test marketplace and installed with `codex plugin marketplace add` and `codex plugin add`. A fresh Codex app-server process reported the enabled skill `proper-respect:read-public-profile`. Installed skill bytes matched the source and index digest:

`sha256:61ff667f9a8e3bb4620e537cdafc39f9097d797740ae7da8f3d0721fe0bd7c56`

After the independent consumer test, the temporary plugin and marketplace were removed. A fresh discovery call no longer found the test skill. All 11 pre-existing marketplace registrations and all 70 installed-plugin registrations, policies and enabled states were preserved. The unrelated Compound Engineering version field changed from 3.27.0 to 3.28.0 during the observation window; no command in this test requested that update. Do not describe the complete plugin inventory as byte-identical.

No replacement Codex home, global configuration restore, or persistent test registration was used. Remote marketplace installation and skills.sh directory presence remain unverified.

## Independent live reading test

Observed 2026-09-22 at 12:50:33 UTC on [Keegan's published profile](https://proper-respect.com/keegan). A fresh agent received only the installed skill and a request to identify published tools, usage evidence and total spend. It did not inspect the implementation or tests.

The browser exposed `get_current_public_profile`; invocation with `{}` succeeded. The agent also expanded the four visible cards: GitHub, Wispr Flow, NotebookLM and Devin Desktop. It correctly distinguished the owner's relationship statements and dates from quantitative activity. No usage counts or costs were published, so the answer left total spend unknown instead of treating missing costs as zero or estimating from product prices. It retained the public source and observation time.

The agent's attempts to retrieve `/agents.md` and `/auth.md` encountered browser-client/tool restrictions. It followed the installed skill's public-only fallback and reported that limitation. These client errors do not establish an HTTP failure on the production website. The successful tool invocation and card reading are actual live evidence; no internal endpoint, private collection, account credential or external action link was used.

## Delivery boundaries

No merge, deployment, backend synchronization, Clerk/OAuth/DNS change, provider read, private write or publication was performed for this package. Existing production remains at source `04ab7a5a335b7e1bc1638b75a2ee68bb72cfabbe`. The last complete Ora score remains 64/C, scanned at 2026-09-22T02:42:50.212Z; no new score is inferred from local checks.

Website downloads, scanner detection and directory listing require their own post-release observations. Fresh-user onboarding, two-user isolation, connector lifecycle and private agent writes remain separate acceptance work. No new paid service was introduced; existing hosting and user-agent costs still apply.

The original checkout remains clean at `4df11b5fd3ff4e4747f61fa2d72998842970fd7b`. Detailed installation, HTTP, test and independent-consumer records are retained in the owner's private verification archive. This public receipt omits private filesystem locations.
