import { internal } from "./_generated/api";
import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUser } from "./authHelpers";
import { mailboxCredentialValidator, mailboxProviderValidator, mailboxScanModeValidator, mailboxFailureValidator } from "./mailboxTables";
import { mailboxSearchWindow, MAILBOX_DAILY_INTERVAL_MS, type MailboxScanMode } from "../src/server/mailbox-search";

export const MAILBOX_LEASE_MS = 2 * 60 * 1000;
export function mailboxSourceType(provider: Doc<"mailboxAccounts">["provider"]) {
  return provider === "GOOGLE" ? "GMAIL" as const : "MICROSOFT_MAIL" as const;
}
export function mailboxSourceKey(provider: Doc<"mailboxAccounts">["provider"], accountId: string) {
  return JSON.stringify(["mailbox-v1", provider, accountId]);
}
export function requireMailboxGeneration(account: Doc<"mailboxAccounts">, generation: number) {
  if (!Number.isSafeInteger(generation) || generation < 1 || account.generation !== generation) {
    throw new Error("Mailbox generation changed; discard stale work.");
  }
}

async function cancelActiveJob(ctx: MutationCtx, account: Doc<"mailboxAccounts">, now: string) {
  if (account.discoveryRunId) {
    const run = await ctx.db.get(account.discoveryRunId);
    if (run && !["COMPLETE", "LIMIT_REACHED", "CANCELLED"].includes(run.status)) await ctx.db.patch(run._id, {
      status: "CANCELLED", activeJobId: undefined, leaseExpiresAt: undefined, step: run.step + 1, updatedAt: now,
    });
  }
  if (!account.activeJobId) return;
  const job = await ctx.db.get(account.activeJobId);
  if (!job || job.accountId !== account._id || job.ownerId !== account.ownerId) {
    throw new Error("Mailbox job ownership mismatch.");
  }
  await ctx.db.patch(job._id, { status: "CANCELLED", updatedAt: now });
}

function validateConnection(args: {
  provider: Doc<"mailboxAccounts">["provider"]; providerAccountId: string;
  accountLabel: string; scopes: string[]; expectedGeneration: number;
  credential: Doc<"mailboxSecrets">["credential"];
}) {
  if (!args.providerAccountId.trim() || args.providerAccountId.length > 256 ||
      !args.accountLabel.trim() || args.accountLabel.length > 256 ||
      !Number.isSafeInteger(args.expectedGeneration) || args.expectedGeneration < 0) {
    throw new Error("Invalid mailbox connection identity or generation.");
  }
  const readScope = args.provider === "GOOGLE" ? "https://www.googleapis.com/auth/gmail.readonly" : "Mail.Read";
  const allowed = args.provider === "GOOGLE"
    ? [readScope, "openid", "email", "profile"]
    : [readScope, "openid", "email", "profile", "offline_access", "User.Read"];
  if (args.scopes.length > allowed.length || !args.scopes.includes(readScope) || args.scopes.some(scope => !allowed.includes(scope))) {
    throw new Error("Mailbox connection requires only supported read-only scopes.");
  }
  const { ciphertext, iv, keyVersion } = args.credential;
  const base64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  if (!keyVersion.trim() || keyVersion.length > 64 || !base64.test(iv) || !base64.test(ciphertext) ||
      iv.length !== 16 || atob(iv).length !== 12 || ciphertext.length > 32768 || atob(ciphertext).length < 17) {
    throw new Error("Invalid encrypted mailbox credential envelope.");
  }
}

// Future trusted OAuth callback seam. The caller must already have verified
// provider identity and bound the callback to this owner and generation.
// This function neither verifies OAuth nor accepts browser-supplied identity.
export const finalizeVerifiedConnection = internalMutation({
  args: {
    oauthStateId: v.optional(v.id("mailboxOAuthStates")),
    ownerId: v.id("users"), provider: mailboxProviderValidator,
    providerAccountId: v.string(), accountLabel: v.string(), scopes: v.array(v.string()),
    expectedGeneration: v.number(), credential: mailboxCredentialValidator,
  },
  handler: async (ctx, args) => {
    validateConnection(args);
    if (args.oauthStateId) {
      const state = await ctx.db.get(args.oauthStateId);
      if (!state || state.ownerId !== args.ownerId || state.provider !== args.provider ||
          state.status !== "EXCHANGING" || state.expiresAt <= Date.now() ||
          state.expectedGeneration !== args.expectedGeneration ||
          (state.providerAccountId !== undefined && state.providerAccountId !== args.providerAccountId)) {
        throw new Error("OAuth state unavailable.");
      }
      if (state.accountId) {
        const intended = await ctx.db.get(state.accountId);
        if (!intended || intended.ownerId !== args.ownerId || intended.provider !== args.provider || intended.providerAccountId !== args.providerAccountId) throw new Error("Mailbox identity changed.");
        requireMailboxGeneration(intended, state.expectedGeneration);
      }
      await ctx.db.patch(state._id, { status: "COMPLETE", verifier: undefined });
    }
    if (!await ctx.db.get(args.ownerId)) throw new Error("Mailbox owner unavailable.");
    let account = await ctx.db.query("mailboxAccounts")
      .withIndex("by_owner_provider_account", q => q.eq("ownerId", args.ownerId).eq("provider", args.provider).eq("providerAccountId", args.providerAccountId))
      .unique();
    const now = new Date().toISOString();
    if (account) {
      requireMailboxGeneration(account, args.expectedGeneration);
      await cancelActiveJob(ctx, account, now);
    } else {
      if (args.expectedGeneration !== 0) throw new Error("Mailbox generation changed; account unavailable.");
      const sourceKey = mailboxSourceKey(args.provider, args.providerAccountId);
      const type = mailboxSourceType(args.provider);
      const existingSource = await ctx.db.query("evidenceSources")
        .withIndex("by_user_type_sourceKey", q => q.eq("userId", args.ownerId).eq("type", type).eq("sourceKey", sourceKey)).unique();
      const evidenceSourceId = existingSource?._id ?? await ctx.db.insert("evidenceSources", {
        userId: args.ownerId, type, sourceKey, provider: args.provider,
        label: args.accountLabel, connectedAt: now,
      });
      const accountId = await ctx.db.insert("mailboxAccounts", {
        ownerId: args.ownerId, provider: args.provider, providerAccountId: args.providerAccountId,
        evidenceSourceId, accountLabel: args.accountLabel, scopes: [...new Set(args.scopes)],
        status: "CONNECTED", generation: 1, cursor: null, connectedAt: now, updatedAt: now,
      });
      account = (await ctx.db.get(accountId))!;
    }
    const generation = args.expectedGeneration + 1;
    const priorSecret = await ctx.db.query("mailboxSecrets").withIndex("by_account", q => q.eq("accountId", account._id)).unique();
    if (priorSecret) await ctx.db.delete(priorSecret._id);
    await ctx.db.insert("mailboxSecrets", { accountId: account._id, generation, credential: args.credential, createdAt: now });
    await ctx.db.patch(account._id, {
      status: "CONNECTED", generation, accountLabel: args.accountLabel, scopes: [...new Set(args.scopes)],
      activeJobId: undefined, lastReadStatus: undefined, lastFailure: undefined, updatedAt: now,
      maintenanceEnabled: false, nextMaintenanceAt: undefined,
    });
    return { accountId: account._id, generation };
  },
});

export const listAccounts = query({
  args: {},
  handler: async ctx => {
    const owner = await requireUser(ctx);
    const accounts = await ctx.db.query("mailboxAccounts").withIndex("by_owner", q => q.eq("ownerId", owner._id)).collect();
    return await Promise.all(accounts.map(async account => ({
      accountId: account._id, provider: account.provider, accountLabel: account.accountLabel,
      status: account.status, generation: account.generation,
      connectedAt: account.connectedAt, lastSyncedAt: account.lastSyncedAt,
      lastReadStatus: account.lastReadStatus, hasMore: account.cursor !== null,
      lastFailure: account.lastFailure, maintenanceEnabled: account.maintenanceEnabled ?? false,
      nextMaintenanceAt: account.nextMaintenanceAt,
      capability: "READ_ONLY_HEADERS" as const,
      discoveryRun: account.discoveryRunId ? publicDiscoveryRun(await ctx.db.get(account.discoveryRunId)) : null,
      contexts: await ctx.db.query("mailboxScanContexts").withIndex("by_account_mode", q => q.eq("accountId", account._id)).take(3),
    })));
  },
});

async function invalidateConnection(ctx: MutationCtx, account: Doc<"mailboxAccounts">, status: "DISCONNECTED" | "NEEDS_REAUTH") {
  const now = new Date().toISOString();
  await cancelActiveJob(ctx, account, now);
  const secret = await ctx.db.query("mailboxSecrets").withIndex("by_account", q => q.eq("accountId", account._id)).unique();
  if (secret) await ctx.db.delete(secret._id);
  await ctx.db.patch(account._id, {
    status, generation: account.generation + 1, activeJobId: undefined, lastReadStatus: undefined, updatedAt: now,
    maintenanceEnabled: false, nextMaintenanceAt: undefined,
    lastFailure: status === "NEEDS_REAUTH" ? "REAUTHORIZE" : undefined,
  });
  // Retained originals, reviews, source identity and resumable cursor survive.
  return { generation: account.generation + 1 };
}

export const disconnect = mutation({
  args: { accountId: v.id("mailboxAccounts"), expectedGeneration: v.number() },
  handler: async (ctx, args) => {
    const owner = await requireUser(ctx);
    const account = await ctx.db.get(args.accountId);
    if (!account || account.ownerId !== owner._id) throw new Error("Mailbox unavailable.");
    requireMailboxGeneration(account, args.expectedGeneration);
    return await invalidateConnection(ctx, account, "DISCONNECTED");
  },
});

export const markNeedsReauth = internalMutation({
  args: { accountId: v.id("mailboxAccounts"), expectedGeneration: v.number() },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) throw new Error("Mailbox unavailable.");
    requireMailboxGeneration(account, args.expectedGeneration);
    return await invalidateConnection(ctx, account, "NEEDS_REAUTH");
  },
});

async function startLease(ctx: MutationCtx, account: Doc<"mailboxAccounts">, mode?: MailboxScanMode, scheduled = false, discoveryRunId?: Id<"mailboxDiscoveryRuns">) {
  if (account.status !== "CONNECTED") throw new Error("Mailbox is not connected.");
  if (!discoveryRunId) await requireNoDiscoveryRun(ctx, account);
  const secret = await ctx.db.query("mailboxSecrets").withIndex("by_account", q => q.eq("accountId", account._id)).unique();
  if (!secret || secret.generation !== account.generation) throw new Error("Mailbox credentials unavailable.");
  const now = Date.now();
  const timestamp = new Date(now).toISOString();
  if (account.activeJobId) {
    const active = await ctx.db.get(account.activeJobId);
    if (!active || active.accountId !== account._id || active.ownerId !== account.ownerId) throw new Error("Mailbox job ownership mismatch.");
    if (active.status === "ACTIVE" && active.leaseExpiresAt > now) throw new Error("Mailbox scan already active.");
    await ctx.db.patch(active._id, { status: "EXPIRED", updatedAt: timestamp });
  }
  let context: Doc<"mailboxScanContexts"> | null = null;
  if (mode) {
    context = await ctx.db.query("mailboxScanContexts").withIndex("by_account_mode", q => q.eq("accountId", account._id).eq("mode", mode)).unique();
    if (context?.lastFailure === "CURSOR_EXPIRED") throw new Error("This search cursor expired. Restart its page search; retained evidence is preserved.");
    if (!context || context.status === "COMPLETE") {
      const window = mailboxSearchWindow(mode, now, context?.completedThrough);
      const fields = { ...window, cursor: null, status: "READY" as const, pagesRead: 0, messagesRead: 0, retainedRecords: 0,
        observedEarliest: undefined, observedLatest: undefined, startedAt: timestamp, updatedAt: timestamp,
        lastFailure: undefined, restartCount: context?.restartCount ?? 0 };
      if (context) await ctx.db.patch(context._id, fields);
      else {
        const contextId = await ctx.db.insert("mailboxScanContexts", { ownerId: account.ownerId, accountId: account._id, mode, ...fields });
        context = (await ctx.db.get(contextId))!;
      }
      context = (await ctx.db.get(context._id))!;
    }
    if (context.ownerId !== account.ownerId) throw new Error("Mailbox search ownership mismatch.");
  }
  const cursor = context ? context.cursor : account.cursor;
  const jobId = await ctx.db.insert("mailboxScanJobs", {
    accountId: account._id, ownerId: account.ownerId, generation: account.generation, status: "ACTIVE",
    cursor, leaseExpiresAt: now + MAILBOX_LEASE_MS, startedAt: timestamp, updatedAt: timestamp,
    ...(context ? { contextId: context._id, queryKey: context.queryKey } : {}),
    credentialRevision: secret.revision ?? 0, scheduled, discoveryRunId,
  });
  await ctx.db.patch(account._id, { activeJobId: jobId, lastReadStatus: "READING", lastFailure: undefined, updatedAt: timestamp });
  return { jobId, generation: account.generation, cursor, ...(context ? { contextId: context._id, query: context.query, queryKey: context.queryKey } : {}) };
}

// Creating the lease owns one bounded page and its credential rotation.
export const startScan = mutation({
  args: { accountId: v.id("mailboxAccounts"), expectedGeneration: v.number(), mode: v.optional(mailboxScanModeValidator) },
  handler: async (ctx, args) => {
    const owner = await requireUser(ctx);
    const account = await ctx.db.get(args.accountId);
    if (!account || account.ownerId !== owner._id) throw new Error("Mailbox unavailable.");
    requireMailboxGeneration(account, args.expectedGeneration);
    return await startLease(ctx, account, args.mode);
  },
});

const leaseArgs = { accountId: v.id("mailboxAccounts"), expectedGeneration: v.number(), jobId: v.id("mailboxScanJobs") };
async function activeLease(ctx: Pick<QueryCtx, "db">, args: { accountId: Id<"mailboxAccounts">; expectedGeneration: number; jobId: Id<"mailboxScanJobs"> }) {
  const account = await ctx.db.get(args.accountId);
  if (!account) throw new Error("Mailbox unavailable.");
  requireMailboxGeneration(account, args.expectedGeneration);
  const job = await ctx.db.get(args.jobId);
  if (account.status !== "CONNECTED" || account.activeJobId !== args.jobId || !job ||
      job.accountId !== account._id || job.ownerId !== account.ownerId || job.generation !== account.generation ||
      job.status !== "ACTIVE" || job.leaseExpiresAt <= Date.now() || (job.scheduled && !account.maintenanceEnabled)) {
    throw new Error("Mailbox job lease is no longer active.");
  }
  if (job.discoveryRunId) {
    const run = await ctx.db.get(job.discoveryRunId);
    if (!run || run.status !== "RUNNING" || run.activeJobId !== job._id || account.discoveryRunId !== run._id) throw new Error("Discovery run is no longer active.");
  }
  return { account, job };
}

/** Internal action-only secret access bound to the already-authorized job. */
export const leaseCredential = internalQuery({
  args: leaseArgs,
  handler: async (ctx, args) => {
    const { account, job } = await activeLease(ctx, args);
    const secret = await ctx.db.query("mailboxSecrets").withIndex("by_account", q => q.eq("accountId", account._id)).unique();
    if (!secret || secret.generation !== account.generation || (secret.revision ?? 0) !== (job.credentialRevision ?? 0)) throw new Error("Mailbox credential changed.");
    return { account, credential: secret.credential, revision: secret.revision ?? 0 };
  },
});

export const rotateCredential = internalMutation({
  args: { ...leaseArgs, expectedRevision: v.number(), credential: mailboxCredentialValidator, scopes: v.array(v.string()) },
  handler: async (ctx, args) => {
    const { account, job } = await activeLease(ctx, args);
    validateConnection({ ...account, expectedGeneration: args.expectedGeneration, credential: args.credential, scopes: args.scopes });
    const secret = await ctx.db.query("mailboxSecrets").withIndex("by_account", q => q.eq("accountId", account._id)).unique();
    if (!secret || secret.generation !== account.generation || (secret.revision ?? 0) !== args.expectedRevision || (job.credentialRevision ?? 0) !== args.expectedRevision) throw new Error("Mailbox credential changed.");
    const revision = args.expectedRevision + 1;
    await ctx.db.patch(secret._id, { credential: args.credential, revision, rotatedAt: new Date().toISOString() });
    await ctx.db.patch(job._id, { credentialRevision: revision });
    await ctx.db.patch(account._id, { scopes: [...new Set(args.scopes)] });
    return { revision };
  },
});

export const finishFailedJob = internalMutation({
  args: { ...leaseArgs, failure: mailboxFailureValidator },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account || account.generation !== args.expectedGeneration || account.activeJobId !== args.jobId) return;
    const job = await ctx.db.get(args.jobId);
    if (!job || job.accountId !== account._id || job.ownerId !== account.ownerId || job.status !== "ACTIVE") return;
    const updatedAt = new Date().toISOString();
    if (job.contextId) {
      const context = await ctx.db.get(job.contextId);
      if (context?.accountId === account._id && context.queryKey === job.queryKey) {
        await ctx.db.patch(context._id, { status: "FAILED", lastFailure: args.failure, updatedAt });
      }
    }
    if (job.discoveryRunId) await ctx.db.patch(job.discoveryRunId, {
      status: "FAILED", failure: args.failure, activeJobId: undefined, leaseExpiresAt: undefined, updatedAt,
    });
    if (args.failure === "REAUTHORIZE") await invalidateConnection(ctx, account, "NEEDS_REAUTH");
    else {
      await ctx.db.patch(job._id, { status: "CANCELLED", updatedAt });
      await ctx.db.patch(account._id, { activeJobId: undefined, lastReadStatus: "FAILED", lastFailure: args.failure, updatedAt });
    }
  },
});

export const restartSearch = mutation({
  args: { accountId: v.id("mailboxAccounts"), expectedGeneration: v.number(), mode: mailboxScanModeValidator, expectedQueryKey: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireUser(ctx);
    const account = await ctx.db.get(args.accountId);
    if (!account || account.ownerId !== owner._id) throw new Error("Mailbox unavailable.");
    requireMailboxGeneration(account, args.expectedGeneration);
    await requireNoDiscoveryRun(ctx, account);
    if (account.activeJobId) throw new Error("Wait for the active mailbox read to finish.");
    const context = await ctx.db.query("mailboxScanContexts").withIndex("by_account_mode", q => q.eq("accountId", account._id).eq("mode", args.mode)).unique();
    if (!context || context.ownerId !== owner._id || context.queryKey !== args.expectedQueryKey) throw new Error("Mailbox search changed.");
    await ctx.db.patch(context._id, { cursor: null, status: "READY", lastFailure: undefined, pagesRead: 0, messagesRead: 0, retainedRecords: 0,
      observedEarliest: undefined, observedLatest: undefined, restartCount: context.restartCount + 1, updatedAt: new Date().toISOString() });
  },
});

export const setMaintenance = mutation({
  args: { accountId: v.id("mailboxAccounts"), expectedGeneration: v.number(), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const owner = await requireUser(ctx);
    const account = await ctx.db.get(args.accountId);
    if (!account || account.ownerId !== owner._id || account.provider !== "GOOGLE") throw new Error("Mailbox unavailable.");
    requireMailboxGeneration(account, args.expectedGeneration);
    if (args.enabled && account.status !== "CONNECTED") throw new Error("Reconnect this mailbox before enabling maintenance.");
    if ((account.maintenanceEnabled ?? false) === args.enabled) return;
    const now = Date.now();
    if (!args.enabled && account.activeJobId) {
      const job = await ctx.db.get(account.activeJobId);
      if (job?.scheduled) {
        await cancelActiveJob(ctx, account, new Date(now).toISOString());
        await ctx.db.patch(account._id, { activeJobId: undefined, lastReadStatus: undefined });
      }
    }
    await ctx.db.patch(account._id, { maintenanceEnabled: args.enabled,
      maintenanceApprovedAt: args.enabled ? new Date(now).toISOString() : account.maintenanceApprovedAt,
      nextMaintenanceAt: args.enabled ? now : undefined });
  },
});

export const dueMaintenance = internalQuery({
  args: {},
  handler: async ctx => (await ctx.db.query("mailboxAccounts")
    .withIndex("by_maintenance_due", q => q.eq("maintenanceEnabled", true).lte("nextMaintenanceAt", Date.now()))
    .take(10)).filter(account => account.provider === "GOOGLE" && account.status === "CONNECTED")
    .map(account => ({ accountId: account._id, expectedGeneration: account.generation })),
});

export const startScheduledScan = internalMutation({
  args: { accountId: v.id("mailboxAccounts"), expectedGeneration: v.number() },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account || account.generation !== args.expectedGeneration || account.status !== "CONNECTED" || account.provider !== "GOOGLE" ||
        !account.maintenanceEnabled || account.nextMaintenanceAt === undefined || account.nextMaintenanceAt > Date.now()) return null;
    if (account.discoveryRunId) {
      const run = await ctx.db.get(account.discoveryRunId);
      if (run && !isDiscoveryTerminal(run)) return null;
    }
    if (account.activeJobId) {
      const active = await ctx.db.get(account.activeJobId);
      if (active?.status === "ACTIVE" && active.leaseExpiresAt > Date.now()) return null;
    }
    const context = await ctx.db.query("mailboxScanContexts").withIndex("by_account_mode", q => q.eq("accountId", account._id).eq("mode", "INCREMENTAL")).unique();
    if (context?.lastFailure === "CURSOR_EXPIRED") {
      // No provider retry can repair an opaque invalid page token. Keep the
      // visible owner recovery action and avoid blocking other opted-in accounts.
      await ctx.db.patch(account._id, { nextMaintenanceAt: Date.now() + MAILBOX_DAILY_INTERVAL_MS });
      return null;
    }
    // Claim the scheduled attempt atomically, including concurrent cron runs.
    await ctx.db.patch(account._id, { nextMaintenanceAt: Date.now() + MAILBOX_DAILY_INTERVAL_MS });
    return await startLease(ctx, account, "INCREMENTAL", true);
  },
});

export const DISCOVERY_PHASE_ATTEMPTS = 100;
function isDiscoveryTerminal(run: Doc<"mailboxDiscoveryRuns">) {
  return ["COMPLETE", "LIMIT_REACHED", "CANCELLED"].includes(run.status);
}
function publicDiscoveryRun(run: Doc<"mailboxDiscoveryRuns"> | null) {
  if (!run) return null;
  return { id: run._id, status: run.status, phase: run.phase, phaseAttempts: run.phaseAttempts,
    totalAttempts: run.totalAttempts, pagesRead: run.pagesRead, messagesRead: run.messagesRead,
    retainedRecords: run.retainedRecords, failure: run.failure, updatedAt: run.updatedAt,
    leaseExpiresAt: run.leaseExpiresAt, maxAttemptsPerPhase: DISCOVERY_PHASE_ATTEMPTS, maxHeaders: 1000 };
}
async function requireNoDiscoveryRun(ctx: Pick<QueryCtx, "db">, account: Doc<"mailboxAccounts">) {
  const run = account.discoveryRunId ? await ctx.db.get(account.discoveryRunId) : null;
  if (run && !isDiscoveryTerminal(run)) throw new Error("Pause or finish discovery first; cancel it before starting a separate search.");
}

// Runs reuse existing incomplete queries. A completed historical window stays
// complete; new arrivals belong to the separate incremental-refresh context.
export const startDiscoveryRun = mutation({
  args: { accountId: v.id("mailboxAccounts"), expectedGeneration: v.number(), requestId: v.string() },
  handler: async (ctx, args): Promise<Id<"mailboxDiscoveryRuns">> => {
    const owner = await requireUser(ctx);
    const account = await ctx.db.get(args.accountId);
    if (!account || account.ownerId !== owner._id || account.provider !== "GOOGLE") throw new Error("Mailbox unavailable.");
    requireMailboxGeneration(account, args.expectedGeneration);
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(args.requestId)) throw new Error("Invalid discovery request identity.");
    const replay = await ctx.db.query("mailboxDiscoveryRuns").withIndex("by_account_request", q => q.eq("accountId", account._id).eq("requestId", args.requestId)).unique();
    if (replay) {
      if (replay.generation !== account.generation) throw new Error("Discovery generation changed.");
      return replay._id;
    }
    await requireNoDiscoveryRun(ctx, account);
    if (account.status !== "CONNECTED") throw new Error("Reconnect this mailbox first.");
    if (account.activeJobId) {
      const job = await ctx.db.get(account.activeJobId);
      if (job?.status === "ACTIVE" && job.leaseExpiresAt > Date.now()) throw new Error("Wait for the active mailbox read to finish.");
      if (job?.status === "ACTIVE") await ctx.db.patch(job._id, { status: "EXPIRED" });
    }
    const now = new Date().toISOString();
    const runId = await ctx.db.insert("mailboxDiscoveryRuns", { ownerId: owner._id, accountId: account._id,
      generation: account.generation, requestId: args.requestId, status: "RUNNING", phase: "KNOWN_PRODUCTS",
      phaseAttempts: 0, totalAttempts: 0, pagesRead: 0, messagesRead: 0, retainedRecords: 0,
      limited: false, step: 0, cursorHashes: [], startedAt: now, updatedAt: now });
    await ctx.db.patch(account._id, { discoveryRunId: runId, activeJobId: undefined });
    await ctx.scheduler.runAfter(0, internal.mailboxGoogle.discoveryPage, { runId, step: 0 });
    return runId;
  },
});

// The step token is consumed before HTTP. Duplicate scheduler deliveries cannot
// borrow a page lease; failures and abandoned leases still spend their attempt.
export const claimDiscoveryPage = internalMutation({
  args: { runId: v.id("mailboxDiscoveryRuns"), step: v.number() },
  handler: async (ctx, args) => {
    let run = await ctx.db.get(args.runId);
    if (!run || run.status !== "RUNNING" || run.step !== args.step || run.activeJobId) return null;
    const account = await ctx.db.get(run.accountId);
    if (!account || account.discoveryRunId !== run._id || account.generation !== run.generation || account.status !== "CONNECTED") return null;
    for (let phase = 0; phase < 2; phase++) {
      const context = await ctx.db.query("mailboxScanContexts").withIndex("by_account_mode", q => q.eq("accountId", account._id).eq("mode", run!.phase)).unique();
      if (context?.status !== "COMPLETE" && run.phaseAttempts < DISCOVERY_PHASE_ATTEMPTS) break;
      const limited = run.limited || context?.status !== "COMPLETE";
      if (run.phase === "HISTORY") {
        await ctx.db.patch(run._id, { status: limited ? "LIMIT_REACHED" : "COMPLETE", limited, updatedAt: new Date().toISOString() });
        return null;
      }
      await ctx.db.patch(run._id, { phase: "HISTORY", phaseAttempts: 0, cursorHashes: [], limited });
      run = (await ctx.db.get(run._id))!;
    }
    const context = await ctx.db.query("mailboxScanContexts").withIndex("by_account_mode", q => q.eq("accountId", account._id).eq("mode", run.phase)).unique();
    if (context?.lastFailure === "CURSOR_EXPIRED") {
      await ctx.db.patch(run._id, { status: "FAILED", failure: "CURSOR_EXPIRED", updatedAt: new Date().toISOString() });
      return null;
    }
    const secret = await ctx.db.query("mailboxSecrets").withIndex("by_account", q => q.eq("accountId", account._id)).unique();
    if (!secret || secret.generation !== account.generation) {
      await ctx.db.patch(run._id, { status: "FAILED", failure: "REAUTHORIZE", updatedAt: new Date().toISOString() });
      return null;
    }
    const scan = await startLease(ctx, account, run.phase, false, run._id);
    const step = run.step + 1;
    const leaseExpiresAt = Date.now() + MAILBOX_LEASE_MS;
    await ctx.db.patch(run._id, { phaseAttempts: run.phaseAttempts + 1, totalAttempts: run.totalAttempts + 1,
      activeJobId: scan.jobId, step, leaseExpiresAt, failure: undefined, updatedAt: new Date().toISOString() });
    await ctx.scheduler.runAfter(MAILBOX_LEASE_MS, internal.mailboxes.expireDiscoveryPage, { runId: run._id, jobId: scan.jobId });
    return { ...scan, accountId: account._id, expectedGeneration: account.generation, discoveryRunId: run._id };
  },
});

export const expireDiscoveryPage = internalMutation({
  args: { runId: v.id("mailboxDiscoveryRuns"), jobId: v.id("mailboxScanJobs") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run || run.status !== "RUNNING" || run.activeJobId !== args.jobId || (run.leaseExpiresAt ?? Infinity) > Date.now()) return;
    const now = new Date().toISOString();
    await ctx.db.patch(run._id, { status: "FAILED", failure: "LEASE_EXPIRED", activeJobId: undefined, leaseExpiresAt: undefined, updatedAt: now });
    await ctx.db.patch(args.jobId, { status: "EXPIRED", updatedAt: now });
    const account = await ctx.db.get(run.accountId);
    if (account?.activeJobId === args.jobId) await ctx.db.patch(account._id, { activeJobId: undefined, lastReadStatus: "FAILED", lastFailure: "TEMPORARY" });
  },
});

export const controlDiscoveryRun = mutation({
  args: { runId: v.id("mailboxDiscoveryRuns"), expectedGeneration: v.number(), action: v.union(v.literal("PAUSE"), v.literal("RESUME"), v.literal("CANCEL")) },
  handler: async (ctx, args): Promise<Id<"mailboxDiscoveryRuns">> => {
    const owner = await requireUser(ctx);
    const run = await ctx.db.get(args.runId);
    if (!run || run.ownerId !== owner._id) throw new Error("Discovery unavailable.");
    const account = await ctx.db.get(run.accountId);
    if (!account || account.discoveryRunId !== run._id || run.generation !== account.generation) throw new Error("Discovery generation changed.");
    requireMailboxGeneration(account, args.expectedGeneration);
    if (isDiscoveryTerminal(run)) return run._id;
    const now = new Date().toISOString();
    if (args.action === "RESUME") {
      if (run.status === "RUNNING") return run._id;
      if (account.status !== "CONNECTED" || ["REAUTHORIZE", "CURSOR_EXPIRED", "CURSOR_CYCLE"].includes(run.failure ?? "")) throw new Error("Cancel this run and recover its connection or search before starting another.");
      await ctx.db.patch(run._id, { status: "RUNNING", step: run.step + 1, failure: undefined, updatedAt: now });
      await ctx.scheduler.runAfter(0, internal.mailboxGoogle.discoveryPage, { runId: run._id, step: run.step + 1 });
    } else {
      if (run.activeJobId) await ctx.db.patch(run.activeJobId, { status: "CANCELLED", updatedAt: now });
      if (account.activeJobId === run.activeJobId) await ctx.db.patch(account._id, { activeJobId: undefined, lastReadStatus: undefined });
      await ctx.db.patch(run._id, { status: args.action === "PAUSE" ? "PAUSED" : "CANCELLED", step: run.step + 1,
        activeJobId: undefined, leaseExpiresAt: undefined, updatedAt: now });
    }
    return run._id;
  },
});
