"use node";
import { createHash } from "node:crypto";
import { v } from "convex/values";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { buildAuthorizationUrl, createMailboxOAuthConfig, createOAuthState, createPkce, parseOAuthCallback } from "../src/server/mailbox-oauth";
import { exchangeMailboxAuthorization, refreshMailboxAuthorization, MailboxProviderError } from "../src/server/mailbox-provider-http";
import { decryptMailboxCredential, encryptMailboxCredential, type MailboxKeyring } from "../src/server/mailbox-credentials";
import { readGmailPage, MailboxCursorError } from "../src/server/mailbox-gmail";
import { mailboxScanModeValidator } from "./mailboxTables";

function config() {
  const clientId = process.env.MAILBOX_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.MAILBOX_GOOGLE_CLIENT_SECRET;
  const applicationOrigin = process.env.MAILBOX_APPLICATION_ORIGIN;
  if (!clientId || !clientSecret || !applicationOrigin) throw new Error("Gmail connection is not configured.");
  return { oauth: createMailboxOAuthConfig({ provider: "GOOGLE", clientId, applicationOrigin, allowLoopbackHttp: process.env.MAILBOX_ALLOW_LOOPBACK_HTTP === "true" }), clientSecret };
}
function keyring(): MailboxKeyring {
  try {
    const activeVersion = process.env.MAILBOX_ENCRYPTION_ACTIVE_VERSION;
    const keys: unknown = JSON.parse(process.env.MAILBOX_ENCRYPTION_KEYS ?? "null");
    if (!activeVersion || !keys || typeof keys !== "object" || Array.isArray(keys) ||
      Object.values(keys).some(key => typeof key !== "string" || Buffer.from(key, "base64").length !== 32 || Buffer.from(key, "base64").toString("base64") !== key) || !Object.hasOwn(keys, activeVersion)) throw new Error();
    return { activeVersion, keys: keys as Record<string, string> };
  } catch { throw new Error("Mailbox encryption is not configured."); }
}
const digest = (state: string) => createHash("sha256").update(state, "ascii").digest("hex");

export const start = action({
  args: { accountId: v.optional(v.id("mailboxAccounts")), expectedGeneration: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ url: string }> => {
    const { oauth } = config();
    keyring();
    const state = createOAuthState();
    const { verifier } = createPkce();
    await ctx.runMutation(internal.mailboxOAuthState.store, { ...args, stateHash: digest(state), verifier });
    return { url: buildAuthorizationUrl(oauth, { state, verifier }) };
  },
});
export const callback = action({
  args: { query: v.string() },
  handler: async (ctx, args): Promise<{ accountId: Id<"mailboxAccounts">; generation: number }> => {
    try {
      if (args.query.length > 16384) throw new Error();
      const params = new URLSearchParams(args.query);
      const state = params.get("state") ?? "";
      if (!/^[A-Za-z0-9_-]{43,128}$/.test(state) || params.getAll("state").length !== 1) throw new Error();
      const pending = await ctx.runMutation(internal.mailboxOAuthState.consume, { stateHash: digest(state) });
      const { code } = parseOAuthCallback(params, state);
      const { oauth, clientSecret } = config();
      const verified = await exchangeMailboxAuthorization(oauth, { code, verifier: pending.verifier!, clientSecret });
      if (pending.providerAccountId && verified.identity.providerAccountId !== pending.providerAccountId) throw new Error();
      const credential = encryptMailboxCredential(verified.credential, {
        ownerId: pending.ownerId, provider: "GOOGLE", providerAccountId: verified.identity.providerAccountId,
        generation: pending.expectedGeneration + 1,
      }, keyring());
      return await ctx.runMutation(internal.mailboxes.finalizeVerifiedConnection, {
        oauthStateId: pending._id, ownerId: pending.ownerId, provider: "GOOGLE", ...verified.identity,
        scopes: verified.scopes, expectedGeneration: pending.expectedGeneration, credential,
      });
    } catch { throw new Error("Gmail authorization failed. Start a new connection attempt."); }
  },
});

type Scan = { discoveryRunId?: Id<"mailboxDiscoveryRuns">; jobId: Id<"mailboxScanJobs">; generation: number; cursor: string | null; query?: string; queryKey?: string };
type ReadResult = {
  readCount: number; proposals: number; hasMore: boolean; unmatchedCount?: number;
  ambiguousProducts?: Array<{ productSlug: string; reason: "MULTIPLE_OWNER_RELATIONSHIPS" }>;
};

async function readLeasedPage(ctx: ActionCtx, args: { accountId: Id<"mailboxAccounts">; expectedGeneration: number }, scan: Scan): Promise<ReadResult> {
  const lease = { ...args, jobId: scan.jobId };
  const phase: { value: "READ" | "REFRESH" } = { value: "READ" };
  try {
    // The authenticated owner or explicitly opted-in schedule already owns
    // this lease. Internal access is bound to that immutable owner/account/job.
    const stored = await ctx.runQuery(internal.mailboxes.leaseCredential, lease);
    if (stored.account.provider !== "GOOGLE") throw new Error("Gmail account required.");
    const context = { ownerId: stored.account.ownerId, provider: "GOOGLE" as const,
      providerAccountId: stored.account.providerAccountId, generation: stored.account.generation };
    let credential = decryptMailboxCredential(stored.credential, context, keyring());
    let revision = stored.revision;
    let refreshed = false;
    async function refresh() {
      phase.value = "REFRESH";
      const { oauth, clientSecret } = config();
      const verified = await refreshMailboxAuthorization(oauth, { refreshToken: credential.refreshToken, clientSecret,
        expectedProviderAccountId: stored.account.providerAccountId });
      const rotated = await ctx.runMutation(internal.mailboxes.rotateCredential, { ...lease, expectedRevision: revision,
        credential: encryptMailboxCredential(verified.credential, context, keyring()), scopes: verified.scopes });
      credential = verified.credential;
      revision = rotated.revision;
      refreshed = true;
      phase.value = "READ";
    }
    if (credential.expiresAt <= Date.now() + 60_000) await refresh();
    const readPage = () => readGmailPage({ accessToken: credential.accessToken, providerAccountId: stored.account.providerAccountId,
      cursor: scan.cursor, ...(scan.query ? { query: scan.query, retainUnknown: true } : {}) });
    let page;
    try { page = await readPage(); }
    catch (error) {
      if (!(error instanceof MailboxProviderError) || error.status !== 401 || refreshed || scan.discoveryRunId) throw error;
      await refresh();
      page = await readPage();
    }
    const result = await ctx.runMutation(internal.mailboxDiscovery.persistBatch, {
      ...lease, expectedCursor: scan.cursor, nextCursor: page.nextCursor,
      batchId: "page-1", complete: true, signals: page.signals,
      ...(scan.queryKey ? { queryKey: scan.queryKey, readCount: page.readCount, unknown: page.unknown,
        observedEarliest: page.observedEarliest, observedLatest: page.observedLatest } : {}),
    });
    // One action owns one bounded page/job. Further pages use the persisted
    // query-specific cursor and never borrow historical/incremental tokens.
    return { readCount: page.readCount, proposals: result.proposals, hasMore: !page.complete,
      ...(result.ambiguousProducts?.length ? { ambiguousProducts: result.ambiguousProducts } : {}),
      ...(scan.queryKey ? { unmatchedCount: page.unknown?.length ?? 0 } : {}) };
  } catch (error) {
    const status = error instanceof MailboxProviderError ? error.status : undefined;
    const failure = status === 401 || (phase.value === "REFRESH" && status === 400) ? "REAUTHORIZE" :
      (error instanceof MailboxCursorError || (phase.value === "READ" && scan.cursor !== null && status === 400)) ? "CURSOR_EXPIRED" : "TEMPORARY";
    await ctx.runMutation(internal.mailboxes.finishFailedJob, { ...lease, failure });
    throw new Error(failure === "REAUTHORIZE" ? "Gmail read failed. Reconnect this account to restore access." :
      failure === "CURSOR_EXPIRED" ? "Gmail read failed. This page cursor expired; restart this search. Retained evidence is safe." :
        "Gmail read failed. Retained evidence is safe; retry or check the connection.");
  }
}

export const read = action({
  args: { accountId: v.id("mailboxAccounts"), expectedGeneration: v.number(), mode: v.optional(mailboxScanModeValidator) },
  handler: async (ctx, args): Promise<ReadResult> => {
    // The public mutation authenticates and authorizes before secret access or HTTP.
    const scan = await ctx.runMutation(api.mailboxes.startScan, args);
    return await readLeasedPage(ctx, { accountId: args.accountId, expectedGeneration: args.expectedGeneration }, scan);
  },
});

/** No account is enabled by deployment. Only an explicit owner's daily opt-in is eligible. */
export const refreshDue = internalAction({
  args: {},
  handler: async ctx => {
    const due = await ctx.runQuery(internal.mailboxes.dueMaintenance, {});
    let completed = 0;
    let failed = 0;
    for (const account of due) {
      try {
        const scan = await ctx.runMutation(internal.mailboxes.startScheduledScan, account);
        if (!scan) continue;
        await readLeasedPage(ctx, account, scan); completed++;
      }
      catch { failed++; /* The account/search retain a sanitized recoverable failure. */ }
    }
    return { completed, failed };
  },
});

export const discoveryPage = internalAction({
  args: { runId: v.id("mailboxDiscoveryRuns"), step: v.number() },
  handler: async (ctx, args): Promise<void> => {
    const scan = await ctx.runMutation(internal.mailboxes.claimDiscoveryPage, args);
    if (!scan) return;
    try { await readLeasedPage(ctx, { accountId: scan.accountId, expectedGeneration: scan.expectedGeneration }, scan); }
    catch { /* The bounded page records its sanitized failure; recovery is explicit. */ }
  },
});
