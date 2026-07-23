# 004 - V1 Technical Contract

> The engineering contract for V1: core entities, shared types, the transformation pipeline, and the tests we will owe later.
> Updated: 2026-06-08. This doc is descriptive of intent, not a migration. No app code is implied yet.

## Design Principles

1. **Prefer clear domain types** over stringly-typed fields. Every closed set is an enum.
2. **Keep raw imported data separate from curated product data.** Raw evidence and curated cards live in different layers and never share a table.
3. **Design around transformations**, not CRUD-on-one-blob:
   `RawEvidence -> DraftProp -> CuratedProp -> PublishedProfile`.
4. **The user is the only actor that advances data across a layer boundary.** Automation may write to the raw/staged layers; only an explicit user action promotes to curated/published.

## Four Layers

| Layer | Entities | Public? | Mutable by automation? |
| --- | --- | --- | --- |
| Raw | `EvidenceSource`, `RawEvidence` | No | Yes (append-only) |
| Staged | `DraftImport` | No | Proposed by automation, owned by user |
| Curated | `User`, `Product`, `Prop`, `Link`, `Proof`, `Lineage` | Per-card visibility | No (user only) |
| Published | `PublishedProfile` (projection of public `Prop`s) | Yes | No |

## Core Entities

These are intent-level interfaces. ORM choice (Prisma/Drizzle) and exact column types are deferred; see `../PRD.md` for the conceptual Prisma sketch.

```typescript
// ---- Curated layer (user-owned source of truth) ----

interface User {
  id: string;
  email: string;
  username: string;          // public profile handle
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Product {
  id: string;
  name: string;
  slug: string;              // unique, used in URLs
  domains: string[];         // canonical + alternate domains, for dedup
  aliases: string[];         // alternate names, for dedup
  logoUrl: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// A Prop is one person's relationship to one product: the "product card".
interface Prop {
  id: string;
  userId: string;
  productId: string;
  status: PropStatus;
  visibility: PropVisibility;
  headline: string | null;
  note: string | null;
  startedAt: Date | null;
  archivedAt: Date | null;
  // origin: how this card came to exist; null/MANUAL for hand-created.
  sourceImportId: string | null; // -> DraftImport.id when promoted from an import
  createdAt: Date;
  updatedAt: Date;
  // (userId, productId) is unique: one card per product per user.
}

// Links are first-class so a card can carry several, with the preferred one flagged.
interface Link {
  id: string;
  propId: string;
  type: LinkType;
  url: string;
  label: string | null;
  isPrimary: boolean;        // the link the Linker most wants clicked
  createdAt: Date;
  updatedAt: Date;
}

interface Proof {
  id: string;
  propId: string;
  type: ProofType;
  url: string | null;        // for embeds / external artifacts
  fileUrl: string | null;    // for uploads (screenshots, receipts)
  text: string | null;       // for NOTE
  label: string | null;
  // optional pointer back to the raw signal this proof was derived from
  rawEvidenceId: string | null;
  createdAt: Date;
}

interface Lineage {
  id: string;
  propId: string;
  sourceType: LineageSourceType;   // person | content | community | event
  name: string;                    // "Jordan Crawford", "a YouTube workflow video"
  url: string | null;              // floating lineage: may point off-platform
  referredUserId: string | null;   // set only if the source is a PROPER-RESPECT user
  context: string | null;
  confidence: LineageConfidence;
  createdAt: Date;
}

// ---- Raw layer (private, append-only, never published) ----

// A source the user authorized or supplied. NOT an automated tracker.
interface EvidenceSource {
  id: string;
  userId: string;
  type: EvidenceSourceType;
  label: string | null;            // e.g. "personal gmail", "lecturesfrom gmail"
  connectedAt: Date;
  lastSyncedAt: Date | null;
}

// Immutable raw signal pulled/uploaded from an EvidenceSource. Curation never mutates this.
interface RawEvidence {
  id: string;
  evidenceSourceId: string;
  userId: string;
  // unparsed payload as received (email headers, receipt JSON, history row, etc.)
  payload: unknown;
  // light extraction only; resolution happens when building a DraftImport.
  detectedVendor: string | null;
  detectedUrl: string | null;
  capturedAt: Date;
  createdAt: Date;
}

// ---- Staged layer (the Import Review queue) ----

// A candidate Prop awaiting user approval. This is "git add", not "git commit".
interface DraftImport {
  id: string;
  userId: string;
  status: ImportStatus;
  // candidate fields, all user-editable before approval:
  suggestedProductId: string | null;   // matched existing Product, if any
  suggestedProductName: string | null;  // when no match found
  suggestedStatus: PropStatus | null;
  suggestedLinks: { type: LinkType; url: string }[];
  suggestedProofType: ProofType | null;
  rawEvidenceIds: string[];              // which raw signals back this draft
  // set when approved/merged:
  resultPropId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

## Shared Types / Enums

```typescript
export enum PropStatus {
  Active = "ACTIVE",
  Testing = "TESTING",
  Archived = "ARCHIVED",
}

export enum PropVisibility {
  Draft = "DRAFT",       // never been published
  Private = "PRIVATE",   // intentionally hidden
  Public = "PUBLIC",     // on the published profile
}

export enum LinkType {
  Affiliate = "AFFILIATE",
  Referral = "REFERRAL",
  Invite = "INVITE",
  Canonical = "CANONICAL",
}

export enum ProofType {
  Note = "NOTE",
  Screenshot = "SCREENSHOT",
  Loom = "LOOM",
  Youtube = "YOUTUBE",
  Article = "ARTICLE",
  Receipt = "RECEIPT",
  GithubRepo = "GITHUB_REPO",
  ScreenTimeScreenshot = "SCREEN_TIME_SCREENSHOT", // user-supplied image only
  BrowserHistoryExport = "BROWSER_HISTORY_EXPORT", // user-supplied export only
  EmailEvidence = "EMAIL_EVIDENCE",                // manual forward/upload only
  ApiOauth = "API_OAUTH",                          // later connector layer
}

export enum EvidenceSourceType {
  Manual = "MANUAL",
  PublicProfile = "PUBLIC_PROFILE", // linktree, bio, personal site
  Github = "GITHUB",
  Billing = "BILLING",              // Stripe / Apple / Google receipts
  BrowserHistory = "BROWSER_HISTORY",
  ScreenTime = "SCREEN_TIME",
  SocialMessages = "SOCIAL_MESSAGES",
  Gmail = "GMAIL",                  // optional, later, never the spine
}

export enum LineageSourceType {
  Person = "PERSON",
  Content = "CONTENT",
  Community = "COMMUNITY",
  Event = "EVENT",
}

export enum LineageConfidence {
  SelfAttested = "SELF_ATTESTED", // baseline; the Linker says so
  Corroborated = "CORROBORATED",  // backed by an artifact/link
  Confirmed = "CONFIRMED",        // confirmed by the other party / platform
}

export enum ImportStatus {
  Pending = "PENDING",       // in the review queue, awaiting the user
  Approved = "APPROVED",     // promoted to a new Prop
  Merged = "MERGED",         // folded into an existing Prop
  Rejected = "REJECTED",     // user dismissed; not re-proposed
  Superseded = "SUPERSEDED", // replaced by newer/better evidence
}
```

## The Transformation Pipeline

Model the product as four explicit, individually testable transformations. Each function is pure given its inputs and never skips the user-approval gate.

```text
EvidenceSource --pull/upload--> RawEvidence       (automation may write)
RawEvidence    --extract/match--> DraftImport      (automation proposes)
DraftImport    --USER approves--> Prop (CuratedProp) (user only)
public Props   --project-------> PublishedProfile  (read model)
```

```typescript
// Signatures sketch the boundaries; implementations come later.
function ingest(source: EvidenceSource, payloads: unknown[]): RawEvidence[];
function proposeDraft(raw: RawEvidence[]): DraftImport;            // vendor resolution + product match
function approveDraft(draft: DraftImport, edits: PropEdits): Prop; // requires explicit user action
function publishProfile(user: User, props: Prop[]): PublishedProfile; // only PUBLIC props
```

Validate at every boundary with a runtime schema (e.g. Zod) so untrusted imported `payload: unknown` is parsed into typed values before it can become a `DraftImport`. Raw `payload` is never trusted directly into the curated layer.

## Tests We Will Owe Later

Not for this docs PR, but the contract is designed so these are writable:

- **Vendor dedup.** `proposeDraft` must collapse `"Notion"`, `"notion.so"`, `"Notion Labs, Inc."`, and `notion.so/...` URLs onto one `Product` via `domains`/`aliases`. Tests cover casing, punctuation, and domain vs display-name mismatch.
- **Billing merchant resolution.** Stripe / Apple (`APPLE.COM/BILL`) / Google Play receipt descriptors are messy. Tests map real merchant strings (e.g. `"PADDLE.NET* SUPERHUMAN"`, `"APPLE.COM/BILL"`, `"GOOGLE *YouTubePremium"`) to the correct underlying `Product`, and assert ambiguous ones produce a `Pending` `DraftImport` rather than a wrong auto-match.
- **Merging personal + lecturesfrom email evidence.** A user with multiple `EvidenceSource`s of type `GMAIL` (personal + `lecturesfrom`) must not create duplicate cards for the same product. Tests assert cross-source `RawEvidence` for the same vendor merges into a single `DraftImport`, and that no card publishes without approval.
- **Approval gate invariants.** Tests assert no `RawEvidence` or `DraftImport` ever appears in a `PublishedProfile`, and that `Rejected` drafts are not re-proposed on the next sync.

## Engineering Style Notes (Matt Pocock / AI Hero alignment)

These are recommendations to stay "tapped in" as we build, not V1 requirements:

- **Parse, don't validate.** Use Zod schemas at each pipeline boundary; derive TS types from the schema so the runtime and compile-time contracts can't drift.
- **Branded IDs** (`type UserId = string & { __brand: "UserId" }`) to prevent passing a `productId` where a `propId` is expected.
- **Discriminated unions** for proof/evidence payloads keyed on `type`, so exhaustiveness checks force us to handle every `ProofType`/`EvidenceSourceType`.
- **Evals for the fuzzy steps.** Vendor dedup and merchant resolution are exactly the kind of "LLM-or-heuristic" steps worth covering with a small eval set of real-world inputs, run in CI.

## Related

- `000-current-product-thesis.md`, `001-git-for-product-attribution.md`, `002-v1-product-motion.md`, `003-evidence-surfaces.md`
- `../PRD.md` (conceptual data model), `../CONTEXT.md` (domain language)
