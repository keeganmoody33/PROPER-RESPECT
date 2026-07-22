# PROPER-RESPECT reconnaissance

> Prepared 2026-07-22. This is an evidence-based audit of the repository, not an implementation proposal disguised as existing functionality.

## Executive finding

This repository is a product-definition repository, not an application. It contains no source code, package manifest, lockfile, database schema, migrations, environment files, deployment configuration, tests, or CI workflows. The present product is therefore **specified, not implemented**.

The documented MVP is a manual-first, public product-stack profile: a linker records products, a relationship/status, links, proof, and lineage. The requested proof-of-use network and portable-site model are compatible with that direction, but are not represented in the present architecture. The first implementation should establish a small canonical network before custom domains or a repository template are introduced.

## 1. Repository map

### Contents and technology

| Area | Current evidence |
| --- | --- |
| Repository shape | Documentation only: root product docs, active ADRs in `docs/adr/`, and parked decisions in `docs/future/`. A stray `.DS_Store` is the only non-document artifact. |
| Application/package entry points | Missing. No `src/`, `app/`, `pages/`, `package.json`, lockfile, runtime configuration, or executable code exists. |
| Package manager/workspaces | Missing; no package manager or workspace has been selected. |
| Stack/versioning | No implemented versions. `README.md` proposes Next.js + TypeScript, Postgres (Neon acceptable), Prisma or Drizzle, Clerk or another simple auth provider, Vercel Blob/S3, and Vercel. |
| More specific planned stack | `docs/adr/058-performance.md` names Next.js App Router, server components, Vercel edge/serverless, Prisma + Neon, Vercel Analytics, Sentry, LogRocket, and Lighthouse CI. These are decisions/proposals, not installed dependencies. |
| UI/styling | No components, tokens, fonts, icons, or styles exist. `README.md` leaves Tailwind versus CSS modules open; ADR-057 proposes shadcn/ui and WCAG 2.1 AA. |
| Rendering/routing | Missing. App Router/server components are proposed only. |
| Database/ORM/migrations/seeds | Missing. `PRD.md` includes a conceptual Prisma-shaped model, but no schema, migrations, seed data, or database connection is present. |
| Authentication/authorization | Missing. Auth is required but unselected. Clerk JWTs appear only in the parked API proposal. No role or permission implementation exists. |
| APIs/actions/webhooks/jobs/queues/cron | Missing. The `/api/v1` routes, API keys, rate limits, and webhooks in `docs/future/031-api.md` are explicitly parked. |
| Tests/lint/typecheck/build | Missing; consequently no commands can be run. |
| CI/CD/deployment | Missing. Vercel is proposed, but there is no Vercel, GitHub Actions, container, infrastructure, or preview configuration. |
| Environment variables | No variable names are documented or validated. Expected categories would be database, auth, storage, host/domain, and observability configuration, but introducing names now would be speculative. |

### Documentation and decision map

- `README.md`, `CONTEXT.md`, `PRD.md`, and `GRILL-SESSION.md` define current scope.
- `INDEX.md` identifies active ADRs and parked work.
- Active ADRs establish product behavior around proof, privacy, lineage, imports, moderation, accessibility, SEO, performance, deletion, and export.
- `docs/future/` explicitly parks company tooling, pricing, analytics, screen time, mobile, embeds, API monetization, notifications, support, and churn work.

### Inconsistencies and decision debt

1. The stack is open in `README.md` but partially prescriptive in ADR-057/058.
2. Current MVP rejects opaque credibility scores, yet older active examples retain `credibilityWeight` or `Cred:` (`docs/adr/023-put-on-by-ui.md`, `docs/adr/057-accessibility.md`, `docs/adr/060-data-export.md`). Replace those references with `publicProofLevel` + `proofMethodLabel`, evidence links selected by the author, relationship status/duration, and adjacent referral-disclosure fields before they influence an implementation.
3. ADR-006 retention language conflicts with ADR-012's later, more specific anonymized-lineage deletion policy.
4. Active docs use PROPER-RESPECT and `proper-respect.example`; parked documents use `props.to`. These must not become accidental URL contracts.
5. The conceptual PRD model does not cover many accepted decisions: work/private context, lineage hardening, moderation reports, deletion lifecycle, product lifecycle, exports, or site/domain configuration.
6. The active unresolved product questions are in `GRILL-SESSION.md`: minimum credible proof, best first import, card layout, proof presentation, and day-one status scope.

## 2. Current product map

### Implemented routes and behavior

None. There are no implemented user-facing routes or executable behavior.

The following are **specified surfaces**, not routes:

| Intended surface | Intended purpose | Evidence |
| --- | --- | --- |
| `/{username}` (example only) | Public profile with product cards | `PRD.md`, ADR-012, ADR-056 |
| `/{username}/{product}` (implied) | Product/prop detail or maintenance link | ADR-033 |
| `/api/og/{username}.png` (example only) | Dynamic profile share image | ADR-056 |
| Dashboard | Edit profile, stack, proof, lineage, and imports | `PRD.md` |
| Import review | Confirm, edit, merge, skip, or create imported draft props | `PRD.md` |
| Search | Find people/products from database data | ADR-019 |

The future `/api/v1/*`, company, analytics, notification, and embed routes must not be treated as currently supported.

### Conceptual entities and relationships

`PRD.md` establishes the current conceptual core:

```text
User 1 ── * Prop * ── 1 Product
                 ├── * Proof
                 └── * Lineage
```

| Entity | Current documented fields/relationship |
| --- | --- |
| User | Identity/profile: email, username, display name, avatar, bio; owns props. |
| Product | Shared product record: name, slug, domains/aliases, logo, description; has props. |
| Prop | The documented name for a person's product relationship; joins user/product; has Active/Testing/Archived status, Draft/Public/Private visibility, dates, headline/note, outbound-link slots, proof, and lineage. |
| Proof | Type, URL/file/text, label; includes self-attested, content, receipt, claim-on-visit, OAuth/API, and future company confirmation concepts. |
| Lineage | Person/content/community/event source plus name, URL, and context. |

The problem statement's `Respect` maps most directly to `Prop`. This report uses **Prop** only when describing current documentation and **Respect** only for the recommended evolved model; the final product term remains a founder decision.

Important missing concepts are:

- Site/Installation and Domain
- Collection and Field Note
- Disclosure as a first-class record
- Proof-level vocabulary, proof method, and private-evidence references
- Link-health checks and trust challenges/reviews
- Theme configuration and relationship duration/type

### Current journey

Specified linker journey:

```text
Sign up → create profile → start blank or import public links
→ create/review draft props → add status, links, proof, and lineage
→ preview → explicitly publish
```

Specified visitor journey:

```text
Open profile → filter Active / Testing / Archived
→ inspect note, proof, and lineage → select an outbound link
```

No part works today because no application exists. Import parsing, uploads, public pages, account management, publishing, and outbound actions are all planned.

### Trust, disclosure, privacy, and authorization decisions

| Decision | Present documented policy | Implementation status |
| --- | --- | --- |
| Usage claims | Self-attestation is allowed; visible proof lets visitors judge. | Specified only |
| “Verified” | No universal oracle; proof source must communicate what it shows. Do not imply verification from a referral link. | Specified only |
| Referrals | Affiliate, referral, invite, and canonical links may coexist; a product need not monetize to belong. | Specified only; immediate action-adjacent disclosure is not yet defined |
| Publication | Everything starts draft/private; user explicitly publishes props and proof. | Specified only |
| Evidence | Receipts, captures, screenshots, OAuth/API data, and work artifacts are private until explicitly selected for publication. | Specified only |
| Imports | Create reviewable drafts; never auto-publish. | Specified only |
| Lineage | Self-attested and floating lineage are valid, with later hardening; attribution is not proof of usage. | Specified only |
| Retired products | Archived history is valuable; product shutdown/rebrand handling is documented. | Specified only |
| Moderation | Report public profiles/props/proof; basic URL/upload safety checks; do not claim universal fact checking. | Specified only |
| Account deletion | Hide immediately, then hard-delete personal data after a 30-day grace period; anonymize received lineage under ADR-012. | Specified only |
| Authorization | Linker ownership and implied admin moderation exist conceptually, but roles/policies are absent. | Missing |

### Tenant/domain status

There is no multi-tenancy, hostname, or custom-domain implementation. ADR-021 deliberately avoids binding core architecture to a final brand domain; it does not decide portable installations.

## 3. Custom-domain feasibility

All items below are missing because there is no application or deployment substrate. “Not decided” is distinct from a technical blocker.

| Concern | Status | Findings and required decision |
| --- | --- | --- |
| Hostname-based tenant resolution | Missing | No request middleware, host lookup, Site/Domain model, or routing convention. |
| Custom-domain verification | Missing | Need DNS challenge state, records, verification polling, and a verified-at audit trail. |
| CNAME onboarding | Missing | Need explicit onboarding copy and provider-neutral CNAME target. |
| SSL/certificate ownership | Missing | Choose a hosting provider with managed custom-domain certificates; record provisioning state and failure recovery. |
| Redirect/canonical policy | Missing | Define one canonical URL per public page. Recommended: custom hostname canonical when verified and chosen by the site owner; hosted `properrespect.com/@handle` redirects or emits canonical only by explicit policy. |
| Cookies/sessions | Missing | Third-party host cookies cannot be shared safely with the central domain. Keep authenticated editing on canonical app origin or use host-specific sessions with a centralized identity flow; never depend on cross-domain cookies. |
| SEO | Partially specified | ADR-056 specifies profile metadata and OG images, but no canonical tags, sitemap, robots, hostname-aware metadata, or duplicate policy exists. |
| Webhooks/custom-host auth | Missing | Webhooks should terminate on canonical platform endpoints, signed and tenant-scoped; they should not rely on arbitrary customer hostnames. |
| Analytics attribution | Missing | Need site ID and host dimension, consent policy, and an owner-accessible summary. |
| Rate limiting/abuse | Missing | Parked API rate limits are not an app-wide abuse plan. Apply limits by IP + tenant + account and protect outbound redirect/link-health endpoints. |
| Domain removal/transfer/recovery | Missing | Need ownership re-verification, cooling-off, audit events, domain detachment behavior, and account recovery outside DNS possession. |
| Local/preview workflow | Missing | Need localhost host overrides and a preview-domain policy that prevents customer hosts being claimed by preview deployments. |

No item is blocked by an existing deliberate implementation decision. The sole relevant deliberate decision is domain-name flexibility (ADR-021), which supports a hostname abstraction rather than blocking it.

## 4. GitHub template feasibility

### Recommended boundary

A generated `proper-respect-site` repository is viable as an **advanced publishing surface**, never onboarding's prerequisite. A template-generated repository satisfies the desired clean history; a required fork would not.

| Portable to a template site | Must remain centrally hosted |
| --- | --- |
| Theme, layout, navigation, editorial pages, collections, static assets, local MD/MDX content, deployment choice, and site configuration | Identity/account recovery, authorization, moderation, private evidence, product normalization, proof method definitions, referral disclosure policy, public-data publishing controls, link-health operations, domain ownership, API access policy, abuse prevention, and audit data |

### Required public contract

The canonical platform needs a stable, public-read network API or signed build export before a template can be real. It should return only published, explicitly public data and include:

- stable person/site/product/respect identifiers and revision/update timestamps;
- public relationship/status/reason/caveat/context;
- structured outbound links with immediate disclosure fields, recipient benefit, author benefit, offer checked time, and link status;
- public proof level **and exact method label**, never a generic `verified` boolean;
- public evidence only, with no private evidence URLs or identifiers;
- canonical network URL and permitted site hosts;
- cache validators and a versioned schema.

Use a per-site, scoped read token only for previews or non-public build feeds. A browser/static site must never contain a privileged API key, account JWT, database URL, moderation credential, or private-evidence token.

### Template configuration and disclosure

`site.config` should identify the canonical site/installation ID, selected hostname, API base URL, public theme tokens, navigation, and optional editorial content. Disclosure fields must come from the network payload and be rendered by a required component/semantic block adjacent to every outbound action. Themes may style that block but cannot suppress, relocate, or replace it.

### Static versus dynamic

- A static deployment can render public profile, collection, product, and local editorial pages from a signed build export or public API at build time.
- Dynamic rendering/revalidation is required for short link-health freshness, changed offers, moderated/taken-down content, account/domain state, and preview drafts.
- Central pages should remain the authoritative fallback if an independent site has a failed build or stale deployment.

### Portability requirements

Export must cover public site configuration and published records in versioned JSON, plus the existing promised CSV/Markdown/HTML formats. Export private evidence only via authenticated, expiring downloads and never in a public repository export.

### Template contents

The future template should include a documented static-capable application, a schema-validated site config, required disclosure/proof components, theme token extension points, local pages/content, GitHub Actions or provider-neutral deployment examples, custom-domain instructions, accessibility/SEO defaults, and a data refresh/revalidation strategy. It should not contain central-service internals or operational secrets.

## 5. Prioritized gap analysis

| Priority | Gap | Why it matters | Affected area | Recommended approach | Dependencies | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| P0: invite-only POC | No application substrate | Nothing described can be used or tested | Entire product | Build the smallest canonical hosted profile app first | Product decisions, chosen stack | High |
| P0: invite-only POC | Respect/Prop does not express substantive relationship, caveat, or disclosure | Core sincerity claim is not legible | Data/UI | Extend the conceptual Prop carefully with relationship type, reason, caveat, use context, public proof method, and structured disclosure | P0 substrate | High |
| P0: invite-only POC | No private evidence boundary in data/access controls | Private receipts and work artifacts could leak | Storage/auth | Model evidence visibility separately; enforce owner/admin access server-side | Auth/storage | Critical |
| P0: invite-only POC | Referral action lacks required adjacent disclosure | Referral link could be mistaken for sincerity | Public card/outbound UI | Require a disclosure block at every outbound action, including no-referral state | Respect model/UI | High |
| P0: invite-only POC | No publishing/moderation/link safety path | Public network needs accountable content | Authorization/operations | Explicit draft/published/archived/retired states, report intake, URL validation | Auth, storage | High |
| P1: custom-domain beta | No Site/Domain/hostname model | Cannot connect a real owner domain | Routing/data/deployment | Add installation and domain records plus host resolution | Canonical app | High |
| P1: custom-domain beta | No DNS verification/SSL lifecycle | Domain takeover and broken onboarding risks | Operations | DNS challenge and managed-certificate lifecycle with audit/recovery flows | Hosting provider | High |
| P1: custom-domain beta | No canonical/SEO host policy | Duplicate content dilutes trust and search | SEO/routing | Adopt one canonical public URL per page, host-aware metadata/sitemaps/robots | Host resolution | Medium |
| P1: custom-domain beta | No link-health/change detection | Stale/broken offers undermine credibility | Jobs/data/UI | Schedule safe checks and expose checked/result state; never follow unsafe URLs blindly | Queue/cron | Medium |
| P2: valuable later | No public read contract/export feed | Template site cannot consume trustworthy data | API/versioning | Publish a narrow versioned read API or signed export | Public data model | High |
| P2: valuable later | No template repository | Advanced users lack repository ownership | Distribution | Create a template after API and disclosure contract stabilize | API, component package | Medium |
| P3: explicitly out of scope | Paid API, company dashboards, reward configuration, analytics, mobile, screen-time, embeds, pricing | These distort the core profile MVP | Product scope | Keep parked per `INDEX.md` | Successful core usage | Medium |

## 6. Proposed architecture

This extends the documented Next.js/Postgres direction rather than inventing a separate platform.

```text
                    ┌─────────────────────────────────────┐
                    │ Canonical PROPER-RESPECT application │
                    │ app, identity, policy, moderation    │
                    └───────┬──────────────┬────────────────┘
                            │              │
                  authenticated writes      │ public, versioned reads
                            │              │
                    ┌───────▼───────┐  ┌───▼─────────────────┐
                    │ Postgres      │  │ Public delivery/API  │
                    │ identities    │  │ host resolution      │
                    │ sites/domains │  │ cache/SEO/OG         │
                    │ respects      │  └───┬─────────┬────────┘
                    │ evidence      │      │         │
                    └───┬─────┬─────┘      │         │
                        │     │            │         │
              private object  │        hosted URL   custom CNAME
                 storage      │            │         │
                        │     │     properrespect  owner domain
                        │     │       .com/@h      surface
                        │     │                      │
                        │     └───────────────┐      │
                        │                     ▼      ▼
                        │                template repository site
                        │                public feed/build export
                        └──────────────────────────────────────
```

### Publishing a Respect

```text
Owner authenticates on canonical app
→ creates/edits a draft Respect and private evidence
→ server validates ownership, URLs, proof method, visibility, and disclosure
→ owner selects public evidence and explicitly publishes
→ transaction stores publication revision/audit event
→ public read model is invalidated/rebuilt
→ hosted and connected sites render the same public policy fields
```

### Connecting the task's hypothetical reference-customer hostname, `proper-respect.lecturesfrom.com`

```text
Owner creates Site and requested Domain on canonical app
→ platform supplies unique DNS challenge + CNAME target
→ owner configures DNS
→ verifier confirms challenge and domain is bound atomically to Site
→ hosting provider provisions certificate
→ host resolver maps request hostname to Site
→ page renders site theme/editorial content plus canonical network records
→ platform publishes host-aware canonical, sitemap, robots, and OG metadata
```

The platform must retain a verified-domain audit log and safely fall back to the canonical hosted profile when verification/certification is incomplete or a domain is removed.

### Template-site data flow

```text
Owner generates template repository and configures public Site ID
→ deployment obtains public feed or narrowly scoped build token
→ build validates schema and renders required proof/disclosure components
→ owner deploys to a host they control
→ scheduled build/revalidation receives only published network data
→ visitors use the owner site; outbound actions show network disclosure data
```

### Trust boundaries

- A referral URL proves only that an incentive exists. Store/display disclosure independently from proof.
- `proofLevel` must be an enumerated public summary coupled to `proofMethodLabel`; never expose a universal “verified” claim. Examples of method labels are “self-attested relationship,” “published workflow demonstration,” “selected receipt evidence,” and “user-triggered on-site capture.”
- Private evidence object IDs and URLs stay behind canonical authorization checks. A public Respect contains selected public evidence snapshots/references only.
- Site themes control presentation, not disclosure semantics, publication state, proof method wording, or link-health warnings.
- Link checks must be operational observations (status, target/offer change, checked time), not claims that a recommendation is sincere.

### Proposed data additions

Keep `User`, `Product`, `Prop`, `Proof`, and `Lineage` as the migration path, while adding:

```text
Site(id, ownerUserId, slug, displayName, themeConfig, policyVersion, status)
Domain(id, siteId, hostname, verificationTokenHash, verificationState,
       certificateState, canonicalMode, verifiedAt, removedAt)
Respect (evolved Prop: authorId, productId, relationshipType, startedAt,
         durationDisplay, lifecycleStatus, reason, caveat, useContext,
         publicationState, publicProofLevel, lastCheckedAt, revision)
ReferralDisclosure(id, respectId, linkId, incentiveExists, authorBenefit,
                   recipientBenefit, offerTerms, disclosedAt)
OutboundLink(id, respectId, kind, url, label, active, checkedAt)
PrivateEvidence(id, respectId, ownerId, storageKey, kind, accessPolicy,
                selectedForPublicProofAt)
PublicProof(id, respectId, method, methodLabel, evidenceSnapshot, visibility)
LinkHealthCheck(id, outboundLinkId, observedAt, result, finalHost, offerChanged)
TrustEvent(id, respectId, type, reporterId, resolution, resolvedAt)
Collection(id, siteId, title, visibility) / CollectionRespect
FieldNote(id, siteId, authorId, body, visibility)
```

Use explicit enums and foreign keys rather than free-form status strings. Preserve an append-only publication/audit event record for moderation, domain changes, and disclosure revisions.

The proposed logical/API field names use lower camel case consistently with the Prisma-shaped conceptual model in `PRD.md`; the selected ORM may map them to a database-specific convention without changing the public contract.

### API and hostname contract

- Resolve requests by normalized host: platform host maps `/@{handle}`; verified custom host maps directly to one active `Site`.
- Reject unknown/removed hosts without tenant fallback.
- Public API/read export: `GET /api/public/v1/sites/{siteId}` and profile/collection resources, with cache validators, schema version, `canonicalUrl`, and only public fields.
- Canonical write APIs and evidence URLs require canonical identity session + ownership authorization.
- Domain verification and lifecycle APIs require site owner authorization and rate limits.
- Outbound redirect tracking, if used, must preserve disclosure before the click and provide abuse controls; direct links remain acceptable for POC.

### Likely implementation modules

When an application exists, likely boundaries are `app/` for hosted/public/dashboard routes; `middleware` or edge host resolver; `lib/auth`, `lib/authorization`, `lib/domains`, `lib/disclosure`, `lib/proof`, `lib/link-health`, and `lib/public-api`; database schema/migrations; object-storage adapter; background job worker; required public-card/disclosure components; and a separate generated `proper-respect-site` template repository.

## 7. Incremental issue plan

### 1. Establish the canonical hosted profile foundation

- **Problem:** The repository has no executable product.
- **Scope/non-goals:** Create only the canonical hosted profile and authenticated owner foundation; no custom domains, template site, imports, or billing.
- **Likely modules:** Application shell, routing, auth adapter, database schema/migrations, public-profile and owner-dashboard surfaces.
- **Data/API:** User/Profile, Product, and draft/published Prop baseline; internal owner operations only.
- **Acceptance criteria:** A nontechnical invitee can sign in, reserve a handle, create a draft, and publish a hosted profile without GitHub.
- **Tests:** Auth/ownership integration tests, public/draft access tests, route smoke tests.
- **Security/privacy/SEO:** Server-side ownership enforcement; draft not indexable or publicly fetchable; canonical hosted metadata.
- **Done:** Deployed preview and documented local setup with a tested end-to-end publish path.

### 2. Define Respect, proof, and disclosure semantics

- **Problem:** The current Prop model cannot make genuine use and incentives legible.
- **Scope/non-goals:** Add relationship type, status/retirement, reason, caveat, context, proof method, and structured outbound disclosure; update the legacy `credibilityWeight`/`Cred:` examples in ADR-023, ADR-057, and ADR-060 to the adopted proof/disclosure terminology; do not introduce numeric trust scores or company confirmation.
- **Likely modules:** Schema, owner editor, public card/detail, validation library.
- **Data/API:** Evolve Prop toward Respect with versioned public representation; separate link/disclosure records.
- **Acceptance criteria:** Every outbound action has an adjacent disclosure or explicit “no referral/incentive” state; proof labels state method; retired records remain public.
- **Tests:** Validation, rendering, and disclosure-adjacency/UI tests.
- **Security/privacy/SEO:** No private evidence leaks; do not render “verified” without exact method.
- **Done:** Product language and schema are documented and exercised end to end.

### 3. Implement private evidence and explicit publication controls

- **Problem:** Evidence is sensitive by default but lacks an enforceable boundary.
- **Scope/non-goals:** Private uploads/references, public selection, and draft/published access policy; no OAuth connectors.
- **Likely modules:** Storage adapter, evidence service, authorization policy, owner proof UI.
- **Data/API:** PrivateEvidence/PublicProof split and signed, expiring private retrieval.
- **Acceptance criteria:** Evidence is inaccessible until explicitly made public; removing public proof revokes public access.
- **Tests:** Authorization matrix, object access, publication/revocation tests.
- **Security/privacy/SEO:** Malware/content type checks, signed URLs, retention/deletion policy; private objects excluded from indexing.
- **Done:** Security review confirms an anonymous request cannot retrieve private evidence.

### 4. Add public trust operations and link health

- **Problem:** Public links and claims need a safe challenge/report path and stale-link visibility.
- **Scope/non-goals:** Report intake, moderation states, link-check observations, and retired/broken presentation; no automated truth scoring.
- **Likely modules:** Report UI/API, moderation queue, link-health worker, public status components.
- **Data/API:** TrustEvent and LinkHealthCheck; status fields on links/respects.
- **Acceptance criteria:** Users can report each public unit; broken/stale/changed-link state is visible with checked time; moderators can resolve without exposing reporters.
- **Tests:** Permission, worker, SSRF-safe URL validation, and public-state tests.
- **Security/privacy/SEO:** SSRF prevention, rate limits, audit logging, abuse controls, no defamatory “fraud” labels.
- **Done:** Operational runbook and test fixture cover link failure and moderation resolution.

### 5. Define public API/export and portability contract

- **Problem:** A portable site needs stable public data rather than database coupling.
- **Scope/non-goals:** Versioned public read API or signed build export; no paid API or webhooks.
- **Likely modules:** Public serializer, OpenAPI/schema document, cache layer, export service.
- **Data/API:** Versioned public Site/Profile/Respect/Collection payload and user data export.
- **Acceptance criteria:** A consumer can render public data, disclosures, and proof labels without access to private records.
- **Tests:** Contract/snapshot tests, cache tests, privacy field-deny tests.
- **Security/privacy/SEO:** Public allowlist serializer, rate limits, no secret in static consumers.
- **Done:** Contract version and deprecation policy published with sample sanitized payloads.

### 6. Add Site and verified custom-domain lifecycle

- **Problem:** Owner domains cannot map to a shared network identity.
- **Scope/non-goals:** Connected custom subdomains, DNS verification, managed certificates, and detach/transfer/recovery; no arbitrary customer code execution.
- **Likely modules:** Site/Domain schema, host resolver, verification worker, deployment-provider adapter, owner onboarding.
- **Data/API:** Site/Domain and verification/certificate state endpoints.
- **Acceptance criteria:** `proper-respect.lecturesfrom.com` can be verified by CNAME/challenge, serve its Site, and safely detach.
- **Tests:** Host normalization/resolution, takeover prevention, verification state, canonical redirect tests.
- **Security/privacy/SEO:** DNS ownership proof, certificate lifecycle, host-header protection, recovery/audit trail, sitemap/robots/canonical policy.
- **Done:** Staging domain passes setup, renewal, removal, and recovery drills.

### 7. Deliver host-aware SEO, sessions, and analytics policy

- **Problem:** Multiple public hosts create duplicate-content, attribution, and cookie risks.
- **Scope/non-goals:** Canonical URLs, host-aware metadata/sitemaps/robots/OG, canonical editing flow, and privacy-conscious host attribution; no behavioral advertising.
- **Likely modules:** Metadata utilities, sitemap/robots routes, auth callback flow, analytics adapter.
- **Data/API:** Site canonical mode and host attribution dimension.
- **Acceptance criteria:** Each page emits one chosen canonical URL; custom-host visitors can browse anonymously; editing does not rely on cross-domain cookies.
- **Tests:** Metadata snapshots across hosts, callback allowlist, cookie scope tests.
- **Security/privacy/SEO:** Explicit consent decision, callback allowlist, no tenant data in analytics identifiers.
- **Done:** Search-console and browser-session validation documented for both host types.

### 8. Create the `proper-respect-site` template repository

- **Problem:** Advanced owners need source-controlled presentation without losing network integrity.
- **Scope/non-goals:** GitHub template-generated site, theme/configuration/local pages, static deployment; not a mandatory fork or required onboarding path.
- **Likely modules:** New template repository, configuration schema, data client, required disclosure/proof component package.
- **Data/API:** Consume issue 5 public contract; optional scoped preview token flow.
- **Acceptance criteria:** A template-generated repo with independent history can deploy a branded site with local pages and cannot remove mandated disclosure semantics.
- **Tests:** Build against fixture API, config validation, disclosure component contract, static-host deploy smoke test.
- **Security/privacy/SEO:** No privileged secrets in repository/browser; canonical host configuration; dependency/update ownership documented.
- **Done:** A nontechnical hosted path remains primary and a technical owner can complete a documented template deployment.

## Founder confirmations needed before implementation

1. Is `Prop` retained as the public product term, or should it become `Respect` while maintaining migration/continuity?
2. What exact proof-level vocabulary and evidence methods may be displayed publicly?
3. What is the required wording/format for referral disclosure, recipient benefit, and author benefit?
4. Should a verified custom domain become canonical by default, or should hosted profiles remain canonical?
5. Which deployment provider owns custom-domain certificates and DNS verification?
6. Is static template-site freshness acceptable on a schedule, or must link-health/moderation changes propagate immediately?
7. What is the invite-only POC's moderation operator and incident-response commitment?
8. Are organizations first-class identities at POC, or are they Sites owned by individual accounts?
