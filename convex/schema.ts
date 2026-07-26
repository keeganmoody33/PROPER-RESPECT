import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  activityModuleValidator,
  attributionScopeValidator,
  publicProfileValidator,
  statusValidator,
  visibilityValidator,
} from "./validators";

const evidenceSourceType = v.union(
  v.literal("MANUAL"),
  v.literal("PUBLIC_PROFILE"),
  v.literal("GITHUB"),
  v.literal("BILLING"),
  v.literal("BROWSER_HISTORY"),
  v.literal("SCREEN_TIME"),
  v.literal("SOCIAL_MESSAGES"),
  v.literal("GMAIL"),
  v.literal("SCREENSHOT"),
  v.literal("CSV"),
  v.literal("URL_IMPORT"),
  v.literal("DEVIN"),
  v.literal("DEVIN_DESKTOP"),
  v.literal("WINDSURF"),
  v.literal("WISPR_FLOW"),
  v.literal("NOTEBOOKLM"),
  v.literal("GREPTILE"),
);

export default defineSchema({
  users: defineTable({
    seedKey: v.optional(v.string()),
    authSubject: v.optional(v.string()),
    handle: v.string(),
    displayName: v.string(),
    bio: v.string(),
    avatarUrl: v.optional(v.string()),
    onboardingStatus: v.optional(
      v.union(
        v.literal("PROFILE"),
        v.literal("IMPORT"),
        v.literal("REVIEW"),
        v.literal("PUBLISHED"),
      ),
    ),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  })
    .index("by_seed_key", ["seedKey"])
    .index("by_auth_subject", ["authSubject"])
    .index("by_handle", ["handle"]),

  products: defineTable({
    seedKey: v.optional(v.string()),
    name: v.string(),
    slug: v.string(),
    domain: v.string(),
    description: v.string(),
    logoUrl: v.optional(v.string()),
  })
    .index("by_seed_key", ["seedKey"])
    .index("by_slug", ["slug"]),

  props: defineTable({
    seedKey: v.optional(v.string()),
    userId: v.id("users"),
    productId: v.id("products"),
    status: statusValidator,
    visibility: visibilityValidator,
    headline: v.string(),
    note: v.string(),
    startedAt: v.optional(v.string()),
    startedAtSource: v.optional(
      v.union(v.literal("AUTHORITATIVE"), v.literal("USER_CONFIRMED")),
    ),
    activity: v.optional(activityModuleValidator),
  })
    .index("by_seed_key", ["seedKey"])
    .index("by_user", ["userId"]),

  links: defineTable({
    seedKey: v.optional(v.string()),
    propId: v.id("props"),
    type: v.union(
      v.literal("CANONICAL"),
      v.literal("AFFILIATE"),
      v.literal("REFERRAL"),
      v.literal("INVITE"),
    ),
    url: v.string(),
    label: v.string(),
    isPrimary: v.boolean(),
  })
    .index("by_seed_key", ["seedKey"])
    .index("by_prop", ["propId"]),

  sites: defineTable({
    seedKey: v.optional(v.string()),
    ownerId: v.id("users"),
    handle: v.string(),
    status: v.union(v.literal("DRAFT"), v.literal("ACTIVE")),
  })
    .index("by_seed_key", ["seedKey"])
    .index("by_owner", ["ownerId"])
    .index("by_handle", ["handle"]),

  evidenceSources: defineTable({
    userId: v.id("users"),
    type: evidenceSourceType,
    label: v.optional(v.string()),
    provider: v.optional(v.string()),
    connectedAt: v.string(),
    lastSyncedAt: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_type", ["userId", "type"]),

  rawEvidence: defineTable({
    evidenceSourceId: v.id("evidenceSources"),
    userId: v.id("users"),
    payload: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    filename: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    byteSize: v.optional(v.number()),
    detectedVendor: v.optional(v.string()),
    detectedUrl: v.optional(v.string()),
    capturedAt: v.string(),
    dedupKey: v.string(),
    deletedAt: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_dedup_key", ["dedupKey"]),

  draftImports: defineTable({
    userId: v.id("users"),
    status: v.union(
      v.literal("PENDING"),
      v.literal("APPROVED"),
      v.literal("MERGED"),
      v.literal("REJECTED"),
      v.literal("SUPERSEDED"),
    ),
    suggestedProductSlug: v.string(),
    suggestedProductName: v.string(),
    suggestedDomain: v.string(),
    suggestedDescription: v.string(),
    suggestedUrl: v.string(),
    rawEvidenceIds: v.array(v.id("rawEvidence")),
    resultPropId: v.optional(v.id("props")),
  }).index("by_user_slug", ["userId", "suggestedProductSlug"]),

  proofs: defineTable({
    propId: v.id("props"),
    type: v.union(
      v.literal("NOTE"),
      v.literal("SCREENSHOT"),
      v.literal("RECEIPT"),
      v.literal("GITHUB_REPO"),
      v.literal("EMAIL_EVIDENCE"),
      v.literal("BROWSER_HISTORY_EXPORT"),
      v.literal("API_OAUTH"),
    ),
    url: v.optional(v.string()),
    text: v.optional(v.string()),
    label: v.optional(v.string()),
    rawEvidenceId: v.optional(v.id("rawEvidence")),
  }).index("by_prop", ["propId"]),

  connectorAccounts: defineTable({
    userId: v.id("users"),
    provider: v.union(v.literal("GITHUB"), v.literal("DEVIN")),
    status: v.union(
      v.literal("CONNECTED"),
      v.literal("NEEDS_REAUTH"),
      v.literal("REVOKED"),
      v.literal("ERROR"),
    ),
    accountLabel: v.string(),
    attributionScope: attributionScopeValidator,
    connectedAt: v.string(),
    lastSyncedAt: v.optional(v.string()),
    lastError: v.optional(v.string()),
    secretRef: v.optional(v.id("connectorSecrets")),
  })
    .index("by_user", ["userId"])
    .index("by_user_provider", ["userId", "provider"]),

  connectorSecrets: defineTable({
    userId: v.id("users"),
    provider: v.union(v.literal("GITHUB"), v.literal("DEVIN")),
    ciphertext: v.string(),
    iv: v.string(),
    createdAt: v.string(),
    rotatedAt: v.optional(v.string()),
  }).index("by_user_provider", ["userId", "provider"]),

  metricDefinitions: defineTable({
    productSlug: v.string(),
    key: v.string(),
    label: v.string(),
    unit: v.optional(v.string()),
    valueKind: v.union(
      v.literal("COUNTER"),
      v.literal("GAUGE"),
      v.literal("RATE"),
      v.literal("DURATION"),
    ),
    aggregation: v.union(
      v.literal("LATEST"),
      v.literal("SUM"),
      v.literal("MAX"),
      v.literal("AVERAGE"),
    ),
    visualization: v.union(
      v.literal("contributionCalendar"),
      v.literal("headlineMetrics"),
      v.literal("timeSeries"),
      v.literal("artifactCollection"),
      v.literal("reviewActivity"),
      v.literal("codingActivity"),
    ),
    sensitivity: v.union(
      v.literal("PUBLIC"),
      v.literal("PRIVATE"),
      v.literal("RESTRICTED"),
    ),
    eligibleScopes: v.array(attributionScopeValidator),
  })
    .index("by_key", ["key"])
    .index("by_product", ["productSlug"]),

  usageSignals: defineTable({
    userId: v.id("users"),
    propId: v.id("props"),
    metricKey: v.string(),
    value: v.number(),
    unit: v.optional(v.string()),
    periodStart: v.optional(v.string()),
    periodEnd: v.optional(v.string()),
    capturedAt: v.string(),
    sourceId: v.optional(v.id("evidenceSources")),
    attributionScope: attributionScopeValidator,
    evidenceRuleVersion: v.string(),
    visibility: visibilityValidator,
  })
    .index("by_prop_metric", ["propId", "metricKey"])
    .index("by_user", ["userId"]),

  metricSubscriptions: defineTable({
    userId: v.id("users"),
    propId: v.id("props"),
    connectorId: v.id("connectorAccounts"),
    metricKey: v.string(),
    attributionScope: attributionScopeValidator,
    refreshCadence: v.literal("DAILY"),
    approvedAt: v.string(),
    lastSuccessfulAt: v.optional(v.string()),
    lastAttemptedAt: v.optional(v.string()),
    lastError: v.optional(v.string()),
    revokedAt: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_connector", ["connectorId"])
    .index("by_prop_metric", ["propId", "metricKey"]),

  artifacts: defineTable({
    userId: v.id("users"),
    propId: v.id("props"),
    title: v.string(),
    url: v.string(),
    label: v.optional(v.string()),
    visibility: visibilityValidator,
    rawEvidenceId: v.optional(v.id("rawEvidence")),
  })
    .index("by_user", ["userId"])
    .index("by_prop", ["propId"]),

  publishedProfiles: defineTable({
    handle: v.string(),
    revision: v.number(),
    publishedAt: v.string(),
    profile: publicProfileValidator,
  }).index("by_handle", ["handle"]),
});
