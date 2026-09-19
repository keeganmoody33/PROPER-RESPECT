import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// Operator-only recovery for a verified owner of an existing seeded profile.
// Never expose this through the public API or infer ownership from a handle.
export const linkSeededOwner = internalMutation({
  args: {
    targetId: v.id("users"),
    pendingId: v.id("users"),
    expectedSubject: v.string(),
    expectedSeedKey: v.string(),
    dryRun: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (args.targetId === args.pendingId) throw new Error("Distinct accounts required.");
    const target = await ctx.db.get(args.targetId);
    const pending = await ctx.db.get(args.pendingId);
    if (!target || target.seedKey !== args.expectedSeedKey || !pending) {
      throw new Error("Account recovery preconditions failed.");
    }
    const owner = await ctx.db.query("users")
      .withIndex("by_auth_subject", q => q.eq("authSubject", args.expectedSubject)).unique();
    if (owner?._id === target._id && !pending.authSubject) return { status: "already-linked" };
    if (target.authSubject || owner?._id !== pending._id ||
        pending.authSubject !== args.expectedSubject ||
        !pending.handle.startsWith("pending-") || pending.seedKey ||
        pending.onboardingStatus !== "PROFILE") {
      throw new Error("Only an empty pending account can be linked to an unowned seed.");
    }
    for (const table of ["props", "evidenceSources", "rawEvidence", "draftImports",
      "connectorAccounts", "connectorSecrets", "usageSignals", "metricSubscriptions", "artifacts", "claimReviews"] as const) {
      const row = await ctx.db.query(table).filter(q => q.eq(q.field("userId"), pending._id)).first();
      if (row) throw new Error(`Pending account has data in ${table}; manual reconciliation required.`);
    }
    if (await ctx.db.query("sites").withIndex("by_owner", q => q.eq("ownerId", pending._id)).first()) {
      throw new Error("Pending account already owns a site.");
    }
    if (args.dryRun) return { status: "ready" };
    // Atomic transfer; preserve both records and every existing profile field.
    await ctx.db.patch(pending._id, { authSubject: undefined });
    await ctx.db.patch(target._id, { authSubject: args.expectedSubject });
    return { status: "linked" };
  },
});
