import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { requireUser } from "./authHelpers";
import { requireMailboxGeneration } from "./mailboxes";

const intent = { accountId: v.optional(v.id("mailboxAccounts")), expectedGeneration: v.optional(v.number()) };
export const store = internalMutation({
  args: { ...intent, stateHash: v.string(), verifier: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireUser(ctx);
    if (!/^[a-f0-9]{64}$/.test(args.stateHash) || !/^[A-Za-z0-9._~-]{43,128}$/.test(args.verifier)) throw new Error("Invalid OAuth state.");
    let providerAccountId: string | undefined;
    if (args.accountId) {
      const account = await ctx.db.get(args.accountId);
      if (!account || account.ownerId !== owner._id || account.provider !== "GOOGLE") throw new Error("Mailbox unavailable.");
      requireMailboxGeneration(account, args.expectedGeneration ?? -1);
      providerAccountId = account.providerAccountId;
    } else if (args.expectedGeneration !== undefined) throw new Error("Reconnect requires a mailbox.");
    // A single pending consent per owner/provider avoids parallel callbacks
    // competing to install different versions of the same credentials.
    const pending = await ctx.db.query("mailboxOAuthStates").withIndex("by_owner", q => q.eq("ownerId", owner._id)).collect();
    for (const state of pending) await ctx.db.delete(state._id);
    return await ctx.db.insert("mailboxOAuthStates", {
      ownerId: owner._id, provider: "GOOGLE", stateHash: args.stateHash, verifier: args.verifier,
      accountId: args.accountId, providerAccountId, expectedGeneration: args.expectedGeneration ?? 0,
      expiresAt: Date.now() + 10 * 60 * 1000, status: "PENDING",
    });
  },
});
export const consume = internalMutation({
  args: { stateHash: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireUser(ctx);
    const state = await ctx.db.query("mailboxOAuthStates").withIndex("by_hash", q => q.eq("stateHash", args.stateHash)).unique();
    if (!state || state.ownerId !== owner._id || state.provider !== "GOOGLE" || state.status !== "PENDING" || state.expiresAt <= Date.now() || !state.verifier) throw new Error("OAuth state unavailable.");
    if (state.accountId) {
      const account = await ctx.db.get(state.accountId);
      if (!account || account.ownerId !== owner._id || account.providerAccountId !== state.providerAccountId) throw new Error("Mailbox unavailable.");
      requireMailboxGeneration(account, state.expectedGeneration);
    }
    await ctx.db.patch(state._id, { status: "EXCHANGING", verifier: undefined });
    return state;
  },
});

// Only authenticated actions receive these private records. Never expose this
// as a public query or return its result from an action.
export const scanCredential = internalQuery({
  args: { accountId: v.id("mailboxAccounts"), expectedGeneration: v.number() },
  handler: async (ctx, args) => {
    const owner = await requireUser(ctx);
    const account = await ctx.db.get(args.accountId);
    if (!account || account.ownerId !== owner._id || account.provider !== "GOOGLE" || account.status !== "CONNECTED") throw new Error("Mailbox unavailable.");
    requireMailboxGeneration(account, args.expectedGeneration);
    const secret = await ctx.db.query("mailboxSecrets").withIndex("by_account", q => q.eq("accountId", account._id)).unique();
    if (!secret || secret.generation !== account.generation) throw new Error("Mailbox credentials unavailable.");
    return { account, credential: secret.credential };
  },
});

export const finishFailedScan = internalMutation({
  args: { accountId: v.id("mailboxAccounts"), jobId: v.id("mailboxScanJobs"), expectedGeneration: v.number() },
  handler: async (ctx, args) => {
    const owner = await requireUser(ctx);
    const account = await ctx.db.get(args.accountId);
    if (!account || account.ownerId !== owner._id || account.generation !== args.expectedGeneration || account.activeJobId !== args.jobId) return;
    const job = await ctx.db.get(args.jobId);
    if (!job || job.accountId !== account._id || job.status !== "ACTIVE") return;
    const updatedAt = new Date().toISOString();
    await ctx.db.patch(job._id, { status: "CANCELLED", updatedAt });
    await ctx.db.patch(account._id, { activeJobId: undefined, lastReadStatus: "FAILED", updatedAt });
  },
});
