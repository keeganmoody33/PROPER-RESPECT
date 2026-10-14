import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUser } from "./authHelpers";
import { publicProfileValidator } from "./validators";
import { productBrandEligibility, retainedProductBrand } from "./productBrands";
import { projectPublicProfileV1, withHttpArtifacts } from "../src/domain/public-profile";
import { isHttpUrl } from "../src/domain/http-url";
import { PUBLISHED_URL_MAX } from "../src/domain/published-text-limits";
import {
  publicRetainedMailboxAggregate,
  type RetainedMailboxRow,
  type StoredMailboxAccount,
} from "../src/domain/retained-mailbox-aggregate";

const cardValidator = publicProfileValidator.fields.cards.element;
const publicProfileV1Validator = v.object({
  ...publicProfileValidator.fields,
  cards: v.array(v.object({
    ...cardValidator.fields,
    primaryLink: v.object(cardValidator.fields.primaryLink.fields),
  })),
});

export async function readPublishedProfile(ctx: QueryCtx, handle: string) {
  const alias = await ctx.db.query("publicProfileAliases").withIndex("by_handle", q => q.eq("handle", handle)).unique();
  if (alias && await ctx.db.query("publicProfileAliases").withIndex("by_handle", q => q.eq("handle", alias.targetHandle)).first()) return null;
  const published = await ctx.db
    .query("publishedProfiles")
    .withIndex("by_handle", (q) => q.eq("handle", alias?.targetHandle ?? handle))
    .unique();

  if (!published || (alias && alias.publicationId !== published._id)) return null;
  if (published.takenDownAt) return null;
  // Only presentation is refreshed. The owner's published evidence and
  // relationship projection stays byte-for-byte unchanged in storage.
  // Read only the products in this profile, once per slug. Avoid scanning the
  // global catalog or all historical snapshots to hydrate a public page.
  const brands = new Map(await Promise.all(
    [...new Set(published.profile.cards.map(card => card.product.slug))].map(async slug => {
      const product = await ctx.db.query("products").withIndex("by_slug", q => q.eq("slug", slug)).unique();
      return [slug, product ? { domain: product.domain, brand: await retainedProductBrand(ctx, product) } : null] as const;
    }),
  ));
  // Links and artifact links from before the http(s) rule are dropped on read; storage is unchanged.
  const cards = published.profile.cards.map(stored => {
    const linked = stored.primaryLink && !isHttpUrl(stored.primaryLink.url) ? { ...stored, primaryLink: undefined } : stored;
    const activity = withHttpArtifacts(linked.activity);
    const card = activity === linked.activity ? linked : { ...linked, activity };
    if (card.product.brand?.provider === "context.dev" && productBrandEligibility(card.product) === "PRODUCT_IDENTITY_REQUIRED") {
      const product = { ...card.product };
      delete product.brand;
      return { ...card, product };
    }
    const retained = brands.get(card.product.slug);
    return retained?.brand && retained.domain === card.product.domain
      ? { ...card, product: { ...card.product, brand: retained.brand } } : card;
  });
  const { avatarUrl, profileLinks, preferredLinkUrl, ...profile } = published.profile;
  const links = profileLinks?.filter(link => isHttpUrl(link.url));
  return {
    ...profile,
    ...(avatarUrl !== undefined && isHttpUrl(avatarUrl) && avatarUrl.length <= PUBLISHED_URL_MAX ? { avatarUrl } : {}),
    ...(links !== undefined ? { profileLinks: links } : {}),
    ...(preferredLinkUrl !== undefined && links?.some(link => link.url === preferredLinkUrl) ? { preferredLinkUrl } : {}),
    cards,
  };
}

/** Compatibility endpoint for deployed readers that dereference primaryLink. */
export const getByHandle = query({
  args: { handle: v.string() },
  returns: v.union(publicProfileV1Validator, v.null()),
  handler: async (ctx, { handle }) => {
    const profile = await readPublishedProfile(ctx, handle);
    return profile === null ? null : projectPublicProfileV1(profile);
  },
});

/** Current readers also render explicitly shared products without a website. */
export const getByHandleV2 = query({
  args: { handle: v.string() },
  returns: v.union(publicProfileValidator, v.null()),
  handler: (ctx, { handle }) => readPublishedProfile(ctx, handle),
});

const TAKEDOWN_REASON_MAX = 500;

/** The publication a reported URL shows: its own handle, or an alias's target. */
async function reportedPublication(ctx: MutationCtx, handle: string) {
  const direct = await ctx.db.query("publishedProfiles").withIndex("by_handle", q => q.eq("handle", handle)).unique();
  if (direct) return direct;
  const alias = await ctx.db.query("publicProfileAliases").withIndex("by_handle", q => q.eq("handle", handle)).unique();
  const target = alias ? await ctx.db.get(alias.publicationId) : null;
  if (!target || target.handle !== alias?.targetHandle) throw new Error("No published profile has that handle.");
  return target;
}

/**
 * Operator takedown, run from the Convex CLI (docs/runbooks/takedown.md).
 * Storage keeps the snapshot so a restore returns it unchanged.
 */
export const takeDownHandle = internalMutation({
  args: { handle: v.string(), reason: v.string(), dryRun: v.boolean() },
  handler: async (ctx, args) => {
    const reason = args.reason.trim();
    if (!reason) throw new Error("Record why the profile is being taken down.");
    if (reason.length > TAKEDOWN_REASON_MAX) throw new Error(`Keep the reason within ${TAKEDOWN_REASON_MAX} characters.`);
    const publication = await reportedPublication(ctx, args.handle);
    const summary = { handle: publication.handle, revision: publication.revision, cardCount: publication.profile.cards.length };
    if (publication.takenDownAt) {
      return { status: "already-taken-down" as const, ...summary,
        takenDownAt: publication.takenDownAt, takedownReason: publication.takedownReason };
    }
    if (args.dryRun) return { status: "ready" as const, ...summary };
    await ctx.db.patch(publication._id, { takenDownAt: new Date().toISOString(), takedownReason: reason });
    return { status: "taken-down" as const, ...summary };
  },
});

export const restoreHandle = internalMutation({
  args: { handle: v.string(), dryRun: v.boolean() },
  handler: async (ctx, args) => {
    const publication = await reportedPublication(ctx, args.handle);
    const summary = { handle: publication.handle, revision: publication.revision, cardCount: publication.profile.cards.length };
    if (!publication.takenDownAt) return { status: "not-taken-down" as const, ...summary };
    const record = { takenDownAt: publication.takenDownAt, takedownReason: publication.takedownReason };
    if (args.dryRun) return { status: "ready" as const, ...summary, ...record };
    await ctx.db.patch(publication._id, { takenDownAt: undefined, takedownReason: undefined });
    return { status: "restored" as const, ...summary, ...record };
  },
});

const retainedSourceValidator = v.object({
  accountId: v.string(),
  recording: v.union(v.literal("recording"), v.literal("stopped")),
  label: v.union(v.literal("Personal"), v.literal("Former employer"), v.literal("Retained source")),
  retainedCount: v.number(),
});

function storedMailbox(account: Doc<"mailboxAccounts">): StoredMailboxAccount {
  return {
    id: account._id,
    status: account.status,
    ...(account.status === "DISCONNECTED" ? { disconnectedAt: account.updatedAt } : {}),
    ...(account.accountDistinction ? { distinction: account.accountDistinction } : {}),
    ...(account.retainedAggregateDisplay ? { display: account.retainedAggregateDisplay } : {}),
  };
}

async function retainedMailboxRows(
  ctx: QueryCtx,
  userId: Id<"users">,
  accounts: readonly Doc<"mailboxAccounts">[],
): Promise<RetainedMailboxRow[]> {
  const accountIdBySource = new Map(accounts.map(account => [account.evidenceSourceId, account._id]));
  const rows: RetainedMailboxRow[] = [];
  let cursor: string | null = null;
  for (;;) {
    const page = await ctx.db
      .query("rawEvidence")
      .withIndex("by_user", q => q.eq("userId", userId))
      .paginate({ numItems: 100, cursor });
    for (const evidence of page.page) {
      const accountId = accountIdBySource.get(evidence.evidenceSourceId);
      if (!accountId || evidence.deletedAt) continue;
      rows.push({ id: evidence._id, accountId, retainedAt: evidence.capturedAt });
    }
    if (page.isDone) break;
    cursor = page.continueCursor;
  }
  return rows;
}

/**
 * Public page aggregate for mailboxes the owner chose to display.
 * Visitors are not signed in. The result is counts and stored labels only:
 * no message payload, no account label, and no address.
 */
export const getRetainedMailboxAggregate = query({
  args: { handle: v.string() },
  returns: v.array(retainedSourceValidator),
  handler: async (ctx, args) => {
    const profile = await readPublishedProfile(ctx, args.handle);
    if (!profile) return [];
    const user = await ctx.db.query("users").withIndex("by_handle", q => q.eq("handle", profile.handle)).unique();
    if (!user) return [];
    const accounts = await ctx.db.query("mailboxAccounts").withIndex("by_owner", q => q.eq("ownerId", user._id)).collect();
    const rows = await retainedMailboxRows(ctx, user._id, accounts);
    return [...publicRetainedMailboxAggregate({
      accounts: accounts.map(storedMailbox),
      rows,
    })];
  },
});

/** Records the owner's display choice. Does not read a provider or change disconnect. */
export const setRetainedAggregateDisplay = mutation({
  args: {
    accountId: v.id("mailboxAccounts"),
    display: v.union(v.literal("public"), v.literal("private")),
    distinction: v.optional(v.union(v.literal("personal"), v.literal("former-employer"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const account = await ctx.db.get(args.accountId);
    if (!account || account.ownerId !== user._id) throw new Error("Mailbox unavailable.");
    await ctx.db.patch(args.accountId, {
      retainedAggregateDisplay: args.display,
      ...(args.distinction ? { accountDistinction: args.distinction } : {}),
    });
    return null;
  },
});
