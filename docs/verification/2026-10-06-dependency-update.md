# Dependency update verification — 2026-10-06

The dependency patch from [PR #147](https://github.com/keeganmoody33/PROPER-RESPECT/pull/147) is integrated with main `06e4215003e6df9f92aa79c4ca7b314761814bf3`. Original Dependabot commit `36d9a287a4da1ef208da078611a78d9c1def1fea` remains an ancestor; integration commit `bba40f4ac3930d088c7da55f60ffcd212f08455d` preserves main's new cursor-environment tests and browser job. Final independent review and current-head hosted CI remain pending. No deployment is asserted.

Before push, Dependabot rebased its branch to signed commit `23c0692ae4f5b7e16365dacc3c33ea9fc3b33b78` on the same main. That refreshed proposal retained Next/source-map changes but omitted the original incidental Undici update. Merge `0f6f0c7fd01b5be9b5318fb04b4e3de95e102f75` preserves both bot ancestors and the already verified Undici 7.30.0; its complete tree is identical to validated commit `d37f978ea81fe2285472efd7f411fa764e14e85b`. No runtime source changed during this ancestry repair.

## Exact changes

| Dependency | Previous | Retained |
| --- | --- | --- |
| next, @next/env and eight @next/swc variants | 16.3.5 | 16.3.8 |
| source-map-js | 1.2.1 | 1.2.2 |
| Undici, through Cheerio | 7.29.1 | 7.30.0 |

Only the Next manifest range changes, from `^16.3.5` to `^16.3.8`. All twelve changed version/tarball/integrity triples match the public npm registry. Four Linux SWC entries gain the published glibc/musl selectors. The optional Darwin fsevents 2.3.2 entry loses its dev flag; its version, integrity and pre-existing install script stay identical. Existing Playwright optional-peer paths already classify their consumer as production-reachable. No packages are added or removed, and root engines remain 24.x. React 19.2.3 satisfies Next's peer range; lint config stays 16.3.5.

## Upstream fixes and source limits

[Next 16.3.6](https://github.com/vercel/next.js/releases/tag/v16.3.6) patches [CVE-2026-94545](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j), the critical Node ImageResponse SVG RCE. The old 16.3.5 falls in the published affected range. The two inspected ImageResponse paths build constant JSX and trusted local assets, with no attacker-controlled SVG/content/style input observed. That is a static source observation, not an exploit or deployed-exposure proof. [Next 16.3.7](https://github.com/vercel/next.js/releases/tag/v16.3.7) also fixes a Turbopack read hang after cancellation.

[Next 16.3.8](https://github.com/vercel/next.js/releases/tag/v16.3.8) patches seven further advisory classes: image-optimizer SSRF, dynamic metadata-image bypass, two SSG/ISR cache-poisoning paths, two use-cache content leaks and development MCP disclosure. Main has no remote image patterns, Pages Router, root catch-all pages, dynamicParams/generateStaticParams, Cache Components or use-cache/Draft Mode adoption. The development MCP fix remains relevant to local next dev. Several advisory pages retain version placeholders; the official 16.3.8 release supplies the patch attribution. No missing CVE or precise cutoff is inferred.

[source-map-js 1.2.2](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2) fixes strict-CSP browser execution and indexed-map CPU/memory denial of service, CVE-2026-93749. It is a PostCSS dependency here. [Undici 7.30.0](https://github.com/nodejs/undici/releases/tag/v7.30.0) adds SIMD, diagnostic lifecycle, decompression backpressure and rejected WebSocket cleanup fixes; no new security advisory is claimed for that incidental minor update.

## Local proof

Node `v24.19.0` from the bundled runtime was used. Installed Next 16.3.8 installation/upgrade guides were read; AGENTS.md still points to the bundled docs. No ignored environment file is present in this worktree; the build uses exactly the four synthetic values from verify.yml.

| Check | Observed result |
| --- | --- |
| npm ci | PASS; lock unchanged |
| npm test | PASS; 1724 Vitest tests, two existing skips, 122 Node script tests |
| npm run lint | PASS |
| npm run typecheck | PASS |
| npm run build | PASS; Next 16.3.8 Turbopack with synthetic Convex/Clerk/origin, telemetry disabled |
| installed dependency tree | PASS; expected Next/env/Darwin SWC, source-map-js and Undici versions |
| component browser suite | PASS; 61 desktop/mobile synthetic cases |
| actual Next fixture routes | PASS; 35 homepage/profile/metadata/icons/inventory/security-header cases |
| npm audit | Seven flagged packages on baseline → five on integrated lock |
| npm audit --omit=dev | PASS; zero currently reported flags |

The five remaining full-audit flags are the unchanged development ESLint chain, ending at braces. They are deferred from this two-dependency source proposal: audit suggests a major eslint-config-next downgrade, which needs its own compatibility decision and regression scope. No audit fix/force was run. Zero currently reported production flags does not prove absence of undisclosed vulnerabilities.

## Review and bindings

The original PR had zero review comments, inline comments or issue comments to dispose. Its three green CI jobs bind original `36d9a287a4da1ef208da078611a78d9c1def1fea` against older main `1dd933182193f4b38c16762b8890885adcf7aa49` only. Outside review and strict CI must bind the final integrated head before merge. No application code, provider operation, counter read, hosted configuration, backend sync or publication was changed during this concern.

- package.json SHA256: `e4bc06a9bd3e2c4f4ebcd64d306788878ab74695028bb8bedf8e353905fbad87`.
- package-lock.json SHA256: `b844cf18c73dbf5b1b769b769c5b835897b697ace65b1c322f3e7879438596bc`, byte-identical to original #147's lock.
- Complete source audit: `/tmp/proper-respect-pickup-20261006/dependency147-review.md`.
- Raw public metadata/patch/registry/advisory evidence: `dependency147-*` files in that directory.
- Raw local commands: dependency147-npm-ci.txt, dependency147-test.txt, dependency147-lint.txt, dependency147-typecheck.txt, dependency147-build.txt, dependency147-installed-versions.txt, dependency147-components-browser.txt and dependency147-runtime-browser.txt. Next dev rewrote next-env.d.ts to dev-generated imports; that local runner artifact was restored to its pre-run tracked bytes and is excluded from delivery.
- Baseline/full/production audit JSON is retained separately; full audit exited 1 for the disclosed residual flags.
