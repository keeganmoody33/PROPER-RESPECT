import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireUser } from "./authHelpers";
import { rawSignalValidator } from "./validators";
import { mailboxCursorValidator } from "./mailboxTables";
import { ingestSignalsForOwner } from "./discovery";
import { MAILBOX_LEASE_MS, mailboxSourceKey, mailboxSourceType, requireMailboxGeneration } from "./mailboxes";
import { rawSignalSchema, resolveCatalogProduct } from "../src/domain/discovery";
import { canonicalJson } from "../src/domain/canonical-json";
import { sha256 } from "../src/domain/product-knowledge";
import { MAILBOX_PAGE_LIMIT } from "../src/server/mailbox-search";

// Worker seam only: no browser-provided payload or mutable handle determines
// ownership. All validation, originals, private drafts, receipt and cursor live
// in this single atomic mutation. Provider I/O happens outside this seam later.
export const persistBatch = internalMutation({
  args: {
    accountId: v.id("mailboxAccounts"), jobId: v.id("mailboxScanJobs"), expectedGeneration: v.number(),
    expectedCursor: mailboxCursorValidator, nextCursor: mailboxCursorValidator,
    batchId: v.string(), complete: v.boolean(), signals: v.array(rawSignalValidator),
    queryKey: v.optional(v.string()), readCount: v.optional(v.number()),
    unknown: v.optional(v.array(v.object({ sourceRecordId: v.string(), senderDomain: v.optional(v.string()) }))),
    observedEarliest: v.optional(v.string()), observedLatest: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) throw new Error("Mailbox unavailable.");
    requireMailboxGeneration(account, args.expectedGeneration);
    if (account.status !== "CONNECTED") throw new Error("Mailbox is not connected.");
    const job = await ctx.db.get(args.jobId);
    if (!job || job.accountId !== account._id || job.ownerId !== account.ownerId || job.generation !== account.generation) {
      throw new Error("Mailbox job ownership or generation mismatch.");
    }
    const now = Date.now();
    if (job.status === "CANCELLED" || job.status === "EXPIRED" ||
        (job.status === "ACTIVE" && (account.activeJobId !== job._id || job.leaseExpiresAt <= now || (job.scheduled && !account.maintenanceEnabled)))) {
      throw new Error("Mailbox job lease is no longer active.");
    }
    if (!args.batchId.trim() || args.batchId.length > 128 || args.signals.length > 50) {
      throw new Error("Mailbox batch exceeds its identity or record limit.");
    }
    if ((args.expectedCursor?.length ?? 0) > 8192 || (args.nextCursor?.length ?? 0) > 8192) {
      throw new Error("Mailbox cursor exceeds its size limit.");
    }
    if (args.readCount !== undefined && (!Number.isSafeInteger(args.readCount) || args.readCount < args.signals.length || args.readCount > MAILBOX_PAGE_LIMIT)) throw new Error("Invalid bounded mailbox read count.");
    for (const date of [args.observedEarliest, args.observedLatest]) {
      if (date !== undefined && (!Number.isFinite(Date.parse(date)) || new Date(date).toISOString() !== date)) throw new Error("Invalid mailbox observation range.");
    }
    if (args.observedEarliest && args.observedLatest && args.observedEarliest > args.observedLatest) throw new Error("Invalid mailbox observation range.");
    if ((args.unknown?.length ?? 0) > args.signals.length || new Set(args.unknown?.map(item => item.sourceRecordId)).size !== (args.unknown?.length ?? 0)) throw new Error("Invalid unmatched mailbox records.");
    for (const unknown of args.unknown ?? []) {
      const signal = args.signals.find(signal => signal.sourceRecordId === unknown.sourceRecordId);
      if (!signal || signal.vendor !== undefined || signal.url !== undefined || (signal.observations?.length ?? 0) !== 0 ||
          (unknown.senderDomain !== undefined && !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(unknown.senderDomain))) throw new Error("Unmatched mailbox records cannot assign a product or claim.");
    }
    const encoder = new TextEncoder();
    const sourceType = mailboxSourceType(account.provider);
    for (const signal of args.signals) {
      if (encoder.encode(signal.payload).byteLength > 65536) throw new Error("Mailbox capture exceeds its size limit.");
      rawSignalSchema.parse(signal);
      const origin = signal.captureProvenance?.origin;
      if (signal.sourceType !== sourceType || !signal.sourceRecordId || !origin ||
          origin.issuer !== account.provider || origin.accountId !== account.providerAccountId || origin.recordId !== signal.sourceRecordId) {
        throw new Error("Mailbox capture requires matching provider, account, record identity and provenance.");
      }
      if (!["DIRECT_API", "MCP", "WEBMCP", "BROWSER_AGENT"].includes(signal.captureProvenance!.route)) {
        throw new Error("Mailbox captures require a mailbox retrieval route.");
      }
    }
    const serialized = encoder.encode(canonicalJson(args));
    if (serialized.byteLength > 262144) throw new Error("Mailbox batch exceeds its size limit.");
    const digest = await sha256(serialized.buffer);
    const receipt = await ctx.db.query("mailboxBatches")
      .withIndex("by_job_batch", q => q.eq("jobId", job._id).eq("batchId", args.batchId)).unique();
    if (receipt) {
      if (receipt.digest !== digest) throw new Error("Mailbox batch identity collision; retry the exact original page.");
      // A completed page can be acknowledged again, including after later pages.
      // It cannot mutate evidence, extend a lease or advance a cursor a second time.
      return receipt.result;
    }
    if (job.status !== "ACTIVE" || account.activeJobId !== job._id) throw new Error("Mailbox job lease is no longer active.");
    const context = job.contextId ? await ctx.db.get(job.contextId) : null;
    if (job.contextId && (!context || context.accountId !== account._id || context.ownerId !== account.ownerId || context.queryKey !== job.queryKey || args.queryKey !== job.queryKey)) {
      throw new Error("Mailbox query changed; discard stale page work.");
    }
    if (!job.contextId && args.queryKey !== undefined) throw new Error("Mailbox query does not match its job.");
    if (job.cursor !== args.expectedCursor || (context ? context.cursor : account.cursor) !== args.expectedCursor) {
      throw new Error("Mailbox cursor changed; discard stale page work.");
    }
    if (!args.complete && args.nextCursor === args.expectedCursor) throw new Error("Mailbox cursor must advance or complete the scan.");
    const dedupKey = (recordId: string) => JSON.stringify(["source-v1", account.evidenceSourceId, ["record", recordId]]);
    let newlyRetained = 0;
    const countedRecords = new Set<string>();
    const retainedSignals = [...args.signals];
    const catalogClassifications = new Map<number, { vendor: string; url: string }>();
    for (const [index, signal] of args.signals.entries()) {
      const existing = await ctx.db.query("rawEvidence").withIndex("by_dedup_key", q => q.eq("dedupKey", dedupKey(signal.sourceRecordId!))).unique();
      if (!existing && !countedRecords.has(signal.sourceRecordId!)) newlyRetained++;
      countedRecords.add(signal.sourceRecordId!);
      if (!existing || existing.detectedVendor !== undefined || existing.detectedUrl !== undefined) continue;
      const classification = resolveCatalogProduct(signal);
      if (!classification) continue;
      const unknown = await ctx.db.query("mailboxUnknownRecords").withIndex("by_account_record", q => q.eq("accountId", account._id).eq("sourceRecordId", signal.sourceRecordId!)).unique();
      if (!unknown) continue;
      if (existing.userId !== account.ownerId || existing.evidenceSourceId !== account.evidenceSourceId || existing.deletedAt ||
          unknown.ownerId !== account.ownerId || unknown.rawEvidenceId !== existing._id) throw new Error("Mailbox original ownership mismatch.");
      // Keep the original extraction and owner review immutable. Only the
      // separate draft/proof may acquire a later catalog classification. The
      // ingestion helper still checks payload, observations, origin and actor.
      retainedSignals[index] = { ...signal, vendor: existing.detectedVendor, url: existing.detectedUrl };
      catalogClassifications.set(index, { vendor: classification.product.name, url: classification.canonicalUrl });
    }
    const result = await ingestSignalsForOwner(ctx, {
      ownerId: account.ownerId, sourceType, evidenceSourceId: account.evidenceSourceId,
      sourceKey: mailboxSourceKey(account.provider, account.providerAccountId),
      sourceLabel: account.accountLabel, signals: retainedSignals, catalogClassifications,
    });
    const timestamp = new Date(now).toISOString();
    for (const unknown of args.unknown ?? []) {
      const existing = await ctx.db.query("mailboxUnknownRecords").withIndex("by_account_record", q => q.eq("accountId", account._id).eq("sourceRecordId", unknown.sourceRecordId)).unique();
      if (existing) continue;
      const raw = await ctx.db.query("rawEvidence").withIndex("by_dedup_key", q => q.eq("dedupKey", dedupKey(unknown.sourceRecordId))).unique();
      if (!raw || raw.userId !== account.ownerId || raw.evidenceSourceId !== account.evidenceSourceId) throw new Error("Mailbox original ownership mismatch.");
      await ctx.db.insert("mailboxUnknownRecords", { ownerId: account.ownerId, accountId: account._id, rawEvidenceId: raw._id,
        ...unknown, status: "PENDING", createdAt: timestamp });
    }
    if (context) {
      const earliest = [context.observedEarliest, args.observedEarliest].filter((value): value is string => value !== undefined).sort()[0];
      const latest = [context.observedLatest, args.observedLatest].filter((value): value is string => value !== undefined).sort().at(-1);
      await ctx.db.patch(context._id, { cursor: args.nextCursor, status: args.nextCursor === null ? "COMPLETE" : "PARTIAL",
        ...(args.nextCursor === null ? { completedThrough: context.before } : {}),
        pagesRead: context.pagesRead + 1, messagesRead: context.messagesRead + (args.readCount ?? args.signals.length),
        retainedRecords: context.retainedRecords + newlyRetained, observedEarliest: earliest, observedLatest: latest,
        lastFailure: undefined, updatedAt: timestamp });
    }
    await ctx.db.patch(job._id, {
      cursor: args.nextCursor, status: args.complete ? "COMPLETE" : "ACTIVE",
      leaseExpiresAt: now + MAILBOX_LEASE_MS, updatedAt: timestamp,
    });
    await ctx.db.patch(account._id, {
      ...(!context ? { cursor: args.nextCursor } : {}), activeJobId: args.complete ? undefined : job._id,
      updatedAt: timestamp, lastSyncedAt: timestamp, lastReadStatus: args.complete ? "COMPLETE" : "READING",
    });
    await ctx.db.insert("mailboxBatches", { jobId: job._id, batchId: args.batchId, digest, result, persistedAt: timestamp });
    return result;
  },
});

export const listUnknown = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const owner = await requireUser(ctx);
    if (!Number.isSafeInteger(args.paginationOpts.numItems) || args.paginationOpts.numItems < 1) throw new Error("Invalid page size.");
    const result = await ctx.db.query("mailboxUnknownRecords").withIndex("by_owner_status", q => q.eq("ownerId", owner._id).eq("status", "PENDING"))
      .order("desc").paginate({ ...args.paginationOpts, numItems: Math.min(10, args.paginationOpts.numItems), maximumRowsRead: 10 });
    const page = await Promise.all(result.page.map(async record => {
      const raw = await ctx.db.get(record.rawEvidenceId);
      const account = await ctx.db.get(record.accountId);
      if (!raw || raw.userId !== owner._id || account?.ownerId !== owner._id || raw.evidenceSourceId !== account.evidenceSourceId) throw new Error("Mailbox evidence unavailable.");
      return { id: record._id, senderDomain: record.senderDomain, rawEvidenceId: raw._id,
        accountLabel: account.accountLabel, payload: raw.deletedAt ? "This evidence was removed by its owner." : raw.payload, capturedAt: raw.capturedAt,
        provenance: raw.captureProvenance };
    }));
    return { ...result, page };
  },
});

export const reviewUnknown = mutation({
  args: { id: v.id("mailboxUnknownRecords"), decision: v.union(v.literal("DISMISSED"), v.literal("LINKED")), propId: v.optional(v.id("props")) },
  handler: async (ctx, args) => {
    const owner = await requireUser(ctx);
    const record = await ctx.db.get(args.id);
    if (!record || record.ownerId !== owner._id) throw new Error("Mailbox evidence unavailable.");
    if ((args.decision === "LINKED") !== (args.propId !== undefined)) throw new Error("Choose a relationship before attaching evidence.");
    if (record.status !== "PENDING") {
      if (record.status === args.decision && record.linkedPropId === args.propId) return;
      throw new Error("This mailbox record has already been reviewed.");
    }
    if (args.propId) {
      const prop = await ctx.db.get(args.propId);
      const raw = await ctx.db.get(record.rawEvidenceId);
      if (!prop || prop.userId !== owner._id || !raw || raw.userId !== owner._id || raw.deletedAt) throw new Error("Owned relationship and evidence required.");
      const proof = await ctx.db.query("proofs").withIndex("by_propId_and_rawEvidenceId", q => q.eq("propId", prop._id).eq("rawEvidenceId", raw._id)).first();
      if (!proof) await ctx.db.insert("proofs", { propId: prop._id, type: "EMAIL_EVIDENCE", rawEvidenceId: raw._id, label: "Mailbox header selected by owner" });
    }
    await ctx.db.patch(record._id, { status: args.decision, linkedPropId: args.propId, reviewedAt: new Date().toISOString() });
  },
});
