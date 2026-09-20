import { defineTable } from "convex/server";
import { v } from "convex/values";

export const mailboxProviderValidator = v.union(v.literal("GOOGLE"), v.literal("MICROSOFT"));
export const mailboxCursorValidator = v.union(v.string(), v.null());
export const mailboxScanModeValidator = v.union(v.literal("KNOWN_PRODUCTS"), v.literal("HISTORY"), v.literal("INCREMENTAL"));
export const mailboxFailureValidator = v.union(v.literal("TEMPORARY"), v.literal("REAUTHORIZE"), v.literal("CURSOR_EXPIRED"));
export const mailboxCredentialValidator = v.object({
  algorithm: v.literal("AES-256-GCM"), keyVersion: v.string(),
  ciphertext: v.string(), iv: v.string(),
});
export const mailboxBatchResultValidator = v.object({
  ingestedSignals: v.number(), proposals: v.number(), createdDrafts: v.array(v.string()),
  ambiguousProducts: v.optional(v.array(v.object({
    productSlug: v.string(), reason: v.literal("MULTIPLE_OWNER_RELATIONSHIPS"),
  }))),
});

export const mailboxTables = {
  mailboxOAuthStates: defineTable({
    ownerId: v.id("users"), provider: mailboxProviderValidator,
    stateHash: v.string(), verifier: v.optional(v.string()),
    accountId: v.optional(v.id("mailboxAccounts")), providerAccountId: v.optional(v.string()),
    expectedGeneration: v.number(), expiresAt: v.number(),
    status: v.union(v.literal("PENDING"), v.literal("EXCHANGING"), v.literal("COMPLETE")),
  }).index("by_owner", ["ownerId"]).index("by_hash", ["stateHash"]),
  mailboxAccounts: defineTable({
    ownerId: v.id("users"),
    provider: mailboxProviderValidator,
    providerAccountId: v.string(),
    evidenceSourceId: v.id("evidenceSources"),
    accountLabel: v.string(), scopes: v.array(v.string()),
    status: v.union(v.literal("CONNECTED"), v.literal("NEEDS_REAUTH"), v.literal("DISCONNECTED")),
    generation: v.number(),
    cursor: mailboxCursorValidator,
    lastReadStatus: v.optional(v.union(v.literal("READING"), v.literal("COMPLETE"), v.literal("FAILED"))),
    activeJobId: v.optional(v.id("mailboxScanJobs")),
    discoveryRunId: v.optional(v.id("mailboxDiscoveryRuns")),
    lastFailure: v.optional(mailboxFailureValidator),
    maintenanceEnabled: v.optional(v.boolean()),
    maintenanceApprovedAt: v.optional(v.string()),
    nextMaintenanceAt: v.optional(v.number()),
    connectedAt: v.string(), updatedAt: v.string(), lastSyncedAt: v.optional(v.string()),
  }).index("by_owner", ["ownerId"])
    .index("by_maintenance_due", ["maintenanceEnabled", "nextMaintenanceAt"])
    .index("by_owner_provider_account", ["ownerId", "provider", "providerAccountId"]),

  mailboxDiscoveryRuns: defineTable({
    ownerId: v.id("users"), accountId: v.id("mailboxAccounts"), generation: v.number(), requestId: v.string(),
    status: v.union(v.literal("RUNNING"), v.literal("PAUSED"), v.literal("FAILED"), v.literal("COMPLETE"), v.literal("LIMIT_REACHED"), v.literal("CANCELLED")),
    phase: v.union(v.literal("KNOWN_PRODUCTS"), v.literal("HISTORY")),
    phaseAttempts: v.number(), totalAttempts: v.number(), pagesRead: v.number(), messagesRead: v.number(), retainedRecords: v.number(),
    limited: v.boolean(), step: v.number(), cursorHashes: v.array(v.string()),
    activeJobId: v.optional(v.id("mailboxScanJobs")), leaseExpiresAt: v.optional(v.number()),
    failure: v.optional(v.union(mailboxFailureValidator, v.literal("LEASE_EXPIRED"), v.literal("CURSOR_CYCLE"))),
    startedAt: v.string(), updatedAt: v.string(),
  }).index("by_account_request", ["accountId", "requestId"]),

  mailboxSecrets: defineTable({
    accountId: v.id("mailboxAccounts"), generation: v.number(),
    credential: mailboxCredentialValidator, createdAt: v.string(),
    revision: v.optional(v.number()), rotatedAt: v.optional(v.string()),
  }).index("by_account", ["accountId"]),

  mailboxScanJobs: defineTable({
    accountId: v.id("mailboxAccounts"), ownerId: v.id("users"), generation: v.number(),
    status: v.union(v.literal("ACTIVE"), v.literal("COMPLETE"), v.literal("CANCELLED"), v.literal("EXPIRED")),
    cursor: mailboxCursorValidator, leaseExpiresAt: v.number(),
    contextId: v.optional(v.id("mailboxScanContexts")), queryKey: v.optional(v.string()),
    credentialRevision: v.optional(v.number()), scheduled: v.optional(v.boolean()),
    discoveryRunId: v.optional(v.id("mailboxDiscoveryRuns")),
    startedAt: v.string(), updatedAt: v.string(),
  }).index("by_account", ["accountId"]),

  // Search progress is separate from the original unfiltered account cursor.
  // Each job retains its exact query while this row tracks the current window.
  mailboxScanContexts: defineTable({
    ownerId: v.id("users"), accountId: v.id("mailboxAccounts"), mode: mailboxScanModeValidator,
    query: v.string(), queryKey: v.string(), before: v.number(), after: v.optional(v.number()),
    cursor: mailboxCursorValidator, status: v.union(v.literal("READY"), v.literal("PARTIAL"), v.literal("COMPLETE"), v.literal("FAILED")),
    completedThrough: v.optional(v.number()),
    pagesRead: v.number(), messagesRead: v.number(), retainedRecords: v.number(),
    observedEarliest: v.optional(v.string()), observedLatest: v.optional(v.string()),
    startedAt: v.string(), updatedAt: v.string(), lastFailure: v.optional(mailboxFailureValidator),
    restartCount: v.number(),
  }).index("by_account_mode", ["accountId", "mode"]),

  mailboxUnknownRecords: defineTable({
    ownerId: v.id("users"), accountId: v.id("mailboxAccounts"), rawEvidenceId: v.id("rawEvidence"),
    sourceRecordId: v.string(), senderDomain: v.optional(v.string()),
    status: v.union(v.literal("PENDING"), v.literal("DISMISSED"), v.literal("LINKED")),
    linkedPropId: v.optional(v.id("props")), reviewedAt: v.optional(v.string()), createdAt: v.string(),
  }).index("by_account_record", ["accountId", "sourceRecordId"])
    .index("by_owner_status", ["ownerId", "status"]),

  // Receipts contain hashes and counts, never another copy of the mailbox body.
  mailboxBatches: defineTable({
    jobId: v.id("mailboxScanJobs"), batchId: v.string(), digest: v.string(),
    result: mailboxBatchResultValidator, persistedAt: v.string(),
  }).index("by_job_batch", ["jobId", "batchId"]),
};
