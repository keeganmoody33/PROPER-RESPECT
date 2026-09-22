import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { claimableHandleSchema } from "../src/domain/onboarding";
import { canonicalJson } from "../src/domain/canonical-json";
import { sha256 } from "../src/domain/product-knowledge";

// Operator recovery of an already-published seeded snapshot, never a private-data projection.
export const moveSeededPublication = internalMutation({
  args: {
    ownerId: v.id("users"), publicationId: v.id("publishedProfiles"),
    expectedSubject: v.string(), expectedSeedKey: v.string(),
    fromHandle: v.string(), toHandle: v.string(),
    expectedRevision: v.number(), expectedProfileHash: v.string(), dryRun: v.boolean(),
  },
  handler: async (ctx, args) => {
    const from = claimableHandleSchema.parse(args.fromHandle);
    const to = claimableHandleSchema.parse(args.toHandle);
    if (from !== args.fromHandle || to !== args.toHandle || from === to || from !== args.expectedSeedKey) {
      throw new Error("Expected distinct canonical handles and the original seed identity.");
    }
    const owner = await ctx.db.get(args.ownerId);
    const targetOwners = await ctx.db.query("users").withIndex("by_handle", q => q.eq("handle", to)).take(2);
    const oldOwners = await ctx.db.query("users").withIndex("by_handle", q => q.eq("handle", from)).take(1);
    const authOwners = await ctx.db.query("users").withIndex("by_auth_subject", q => q.eq("authSubject", args.expectedSubject)).take(2);
    const sites = await ctx.db.query("sites").withIndex("by_owner", q => q.eq("ownerId", args.ownerId)).take(2);
    if (!owner || owner.seedKey !== args.expectedSeedKey || owner.authSubject !== args.expectedSubject ||
        owner.handle !== to || targetOwners.length !== 1 || targetOwners[0]._id !== owner._id || oldOwners.length ||
        authOwners.length !== 1 || authOwners[0]._id !== owner._id || sites.length !== 1 ||
        sites[0].handle !== to || sites[0].seedKey !== `${args.expectedSeedKey}-hosted-site`) {
      throw new Error("Verified owner and site preconditions no longer match.");
    }
    const publication = await ctx.db.get(args.publicationId);
    const sourceRows = await ctx.db.query("publishedProfiles").withIndex("by_handle", q => q.eq("handle", from)).take(2);
    const targetRows = await ctx.db.query("publishedProfiles").withIndex("by_handle", q => q.eq("handle", to)).take(2);
    const sourceAliases = await ctx.db.query("publicProfileAliases").withIndex("by_handle", q => q.eq("handle", from)).take(2);
    const targetAlias = await ctx.db.query("publicProfileAliases").withIndex("by_handle", q => q.eq("handle", to)).first();
    if (!publication || targetAlias) throw new Error("Publication or alias preconditions failed.");
    const originalProfile = { ...publication.profile, handle: from };
    if (await sha256(canonicalJson(originalProfile)) !== args.expectedProfileHash) {
      throw new Error("The approved public snapshot changed. Review a new receipt.");
    }
    const alias = sourceAliases[0];
    const replay = publication.handle === to && publication.profile.handle === to &&
      publication.revision === args.expectedRevision + 1 && targetRows.length === 1 &&
      targetRows[0]._id === publication._id && sourceRows.length === 0 && sourceAliases.length === 1 &&
      alias.targetHandle === to && alias.ownerId === owner._id && alias.publicationId === publication._id;
    if (replay) return { status: "already-migrated", fromHandle: from, toHandle: to, cardCount: publication.profile.cards.length };
    if (publication.handle !== from || publication.profile.handle !== from ||
        publication.revision !== args.expectedRevision || sourceRows.length !== 1 ||
        sourceRows[0]._id !== publication._id || targetRows.length || sourceAliases.length) {
      throw new Error("Publication revision, destination or alias changed. No migration applied.");
    }
    if (!args.dryRun) {
      await ctx.db.patch(publication._id, {
        handle: to, profile: { ...publication.profile, handle: to }, revision: publication.revision + 1,
      });
      await ctx.db.insert("publicProfileAliases", {
        handle: from, targetHandle: to, ownerId: owner._id, publicationId: publication._id,
        createdAt: new Date().toISOString(),
      });
    }
    return { status: args.dryRun ? "ready" : "migrated", fromHandle: from, toHandle: to, cardCount: publication.profile.cards.length };
  },
});
