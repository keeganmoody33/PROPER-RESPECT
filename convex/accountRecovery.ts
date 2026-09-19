import { v, type Infer } from "convex/values";
import { internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { canonicalJson } from "../src/domain/canonical-json";
import { claimableHandleSchema } from "../src/domain/onboarding";
import { sha256 } from "../src/domain/product-knowledge";

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

const handleRestorationArgs = {
  userId: v.id("users"),
  siteId: v.id("sites"),
  publicationId: v.id("publishedProfiles"),
  expectedSubject: v.string(),
  expectedSeedKey: v.string(),
  fromHandle: v.string(),
  toHandle: v.string(),
  expectedCardPropIds: v.array(v.id("props")),
};
const handleRestorationValidator = v.object(handleRestorationArgs);
type HandleRestorationArgs = Infer<typeof handleRestorationValidator>;

async function prepareHandleRestoration(ctx: Pick<QueryCtx, "db">, args: HandleRestorationArgs) {
  if (!args.expectedSubject.trim() || !args.expectedSeedKey.trim() ||
      claimableHandleSchema.parse(args.fromHandle) !== args.fromHandle ||
      claimableHandleSchema.parse(args.toHandle) !== args.toHandle ||
      args.fromHandle === args.toHandle || args.expectedSeedKey !== args.toHandle) {
    throw new Error("Handle restoration requires distinct valid handles and the original seed key.");
  }
  const user = await ctx.db.get(args.userId);
  const site = await ctx.db.get(args.siteId);
  const publication = await ctx.db.get(args.publicationId);
  if (!user || !site || !publication || user.seedKey !== args.expectedSeedKey ||
      user.authSubject !== args.expectedSubject || site.ownerId !== user._id ||
      publication.handle !== args.toHandle || publication.profile.handle !== args.toHandle) {
    throw new Error("Seeded handle restoration preconditions failed.");
  }
  const alreadyRestored = user.handle === args.toHandle && site.handle === args.toHandle;
  if (!alreadyRestored && (user.handle !== args.fromHandle || site.handle !== args.fromHandle)) {
    throw new Error("User and site must share the expected current handle or both be restored.");
  }
  const subjects = await ctx.db.query("users")
    .withIndex("by_auth_subject", q => q.eq("authSubject", args.expectedSubject)).take(2);
  const seeds = await ctx.db.query("users")
    .withIndex("by_seed_key", q => q.eq("seedKey", args.expectedSeedKey)).take(2);
  const sites = await ctx.db.query("sites")
    .withIndex("by_owner", q => q.eq("ownerId", user._id)).take(2);
  if (subjects.length !== 1 || subjects[0]._id !== user._id ||
      seeds.length !== 1 || seeds[0]._id !== user._id ||
      sites.length !== 1 || sites[0]._id !== site._id) {
    throw new Error("Restoration requires a unique seeded owner, auth subject, and site.");
  }
  for (const handle of [args.fromHandle, args.toHandle]) {
    const owners = await ctx.db.query("users")
      .withIndex("by_handle", q => q.eq("handle", handle)).take(2);
    const handleSites = await ctx.db.query("sites")
      .withIndex("by_handle", q => q.eq("handle", handle)).take(2);
    const expectedCount = user.handle === handle ? 1 : 0;
    if (owners.length !== expectedCount || owners.some(owner => owner._id !== user._id) ||
        handleSites.length !== expectedCount || handleSites.some(candidate => candidate._id !== site._id)) {
      throw new Error("A source or destination handle has conflicting ownership.");
    }
  }
  const sourcePublication = await ctx.db.query("publishedProfiles")
    .withIndex("by_handle", q => q.eq("handle", args.fromHandle)).first();
  const targetPublications = await ctx.db.query("publishedProfiles")
    .withIndex("by_handle", q => q.eq("handle", args.toHandle)).take(2);
  if (sourcePublication || targetPublications.length !== 1 || targetPublications[0]._id !== publication._id) {
    throw new Error("Restoration requires only the unique original publication.");
  }
  if (args.expectedCardPropIds.length !== publication.profile.cards.length ||
      new Set(args.expectedCardPropIds).size !== args.expectedCardPropIds.length ||
      (publication.cardPropIds !== undefined && publication.cardPropIds.length !== publication.profile.cards.length)) {
    throw new Error("Review every published card with a distinct relationship identity.");
  }
  const correspondence = await Promise.all(publication.profile.cards.map(async (card, index) => {
    const propId = args.expectedCardPropIds[index];
    const explicitId = publication.cardPropIds?.[index];
    const prop = await ctx.db.get(propId);
    if (!prop || prop.userId !== user._id || prop.visibility !== "PUBLIC" ||
        (explicitId != null && explicitId !== propId) ||
        prop.headline !== card.headline || prop.note !== card.note ||
        prop.status !== card.status || prop.startedAt !== card.startedAt) {
      throw new Error("A reviewed public relationship no longer matches its published card.");
    }
    const product = await ctx.db.get(prop.productId);
    if (!product || product.slug !== card.product.slug || product.domain !== card.product.domain) {
      throw new Error("A reviewed product no longer matches its published card.");
    }
    return { prop, product };
  }));
  // Bind the complete retained records; only these two handles differ on replay.
  const fingerprint = (handle: string) => sha256(canonicalJson({
    args, user: { ...user, handle }, site: { ...site, handle }, publication, correspondence,
  }));
  const [beforeFingerprint, afterFingerprint] = await Promise.all([
    fingerprint(args.fromHandle), fingerprint(args.toHandle),
  ]);
  return { alreadyRestored, beforeFingerprint, afterFingerprint };
}

// This operator review does not grant public reclaim rights or repair card identities.
export const previewHandleRestoration = internalQuery({
  args: handleRestorationValidator,
  handler: async (ctx, args) => {
    const prepared = await prepareHandleRestoration(ctx, args);
    return {
      status: prepared.alreadyRestored ? "already-restored" as const : "ready" as const,
      beforeFingerprint: prepared.beforeFingerprint,
      afterFingerprint: prepared.afterFingerprint,
      changes: [
        { table: "users" as const, field: "handle" as const, from: args.fromHandle, to: args.toHandle },
        { table: "sites" as const, field: "handle" as const, from: args.fromHandle, to: args.toHandle },
      ],
    };
  },
});

export const restoreHandle = internalMutation({
  args: {
    ...handleRestorationArgs,
    expectedBeforeFingerprint: v.string(),
    expectedAfterFingerprint: v.string(),
  },
  handler: async (ctx, { expectedBeforeFingerprint, expectedAfterFingerprint, ...args }) => {
    if (!/^[a-f0-9]{64}$/.test(expectedBeforeFingerprint) || !/^[a-f0-9]{64}$/.test(expectedAfterFingerprint)) {
      throw new Error("Valid reviewed restoration fingerprints are required.");
    }
    const prepared = await prepareHandleRestoration(ctx, args);
    if (prepared.beforeFingerprint !== expectedBeforeFingerprint || prepared.afterFingerprint !== expectedAfterFingerprint) {
      throw new Error("Restoration state changed. Review a fresh restoration preview.");
    }
    if (prepared.alreadyRestored) return { status: "already-restored" as const };
    await ctx.db.patch(args.userId, { handle: args.toHandle });
    await ctx.db.patch(args.siteId, { handle: args.toHandle });
    return { status: "restored" as const };
  },
});
