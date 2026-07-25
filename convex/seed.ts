import { mutation } from "./_generated/server";
import type {
  GenericMutationCtx,
  WithoutSystemFields,
} from "convex/server";
import type { DataModel, Doc } from "./_generated/dataModel";
import { projectPublicProfile } from "../src/domain/public-profile";

type MutationCtx = GenericMutationCtx<DataModel>;

async function upsertUser(
  ctx: MutationCtx,
  value: WithoutSystemFields<Doc<"users">>,
) {
  const existing = await ctx.db
    .query("users")
    .withIndex("by_seed_key", (q) => q.eq("seedKey", value.seedKey))
    .unique();
  if (existing) {
    await ctx.db.replace(existing._id, value);
    return existing._id;
  }
  return await ctx.db.insert("users", value);
}

async function upsertProduct(
  ctx: MutationCtx,
  value: WithoutSystemFields<Doc<"products">>,
) {
  const existing = await ctx.db
    .query("products")
    .withIndex("by_seed_key", (q) => q.eq("seedKey", value.seedKey))
    .unique();
  if (existing) {
    await ctx.db.replace(existing._id, value);
    return existing._id;
  }
  return await ctx.db.insert("products", value);
}

async function upsertProp(
  ctx: MutationCtx,
  value: WithoutSystemFields<Doc<"props">>,
) {
  const existing = await ctx.db
    .query("props")
    .withIndex("by_seed_key", (q) => q.eq("seedKey", value.seedKey))
    .unique();
  if (existing) {
    await ctx.db.replace(existing._id, value);
    return existing._id;
  }
  return await ctx.db.insert("props", value);
}

async function upsertLink(
  ctx: MutationCtx,
  value: WithoutSystemFields<Doc<"links">>,
) {
  const existing = await ctx.db
    .query("links")
    .withIndex("by_seed_key", (q) => q.eq("seedKey", value.seedKey))
    .unique();
  if (existing) {
    await ctx.db.replace(existing._id, value);
    return existing._id;
  }
  return await ctx.db.insert("links", value);
}

async function upsertSite(
  ctx: MutationCtx,
  value: WithoutSystemFields<Doc<"sites">>,
) {
  const existing = await ctx.db
    .query("sites")
    .withIndex("by_seed_key", (q) => q.eq("seedKey", value.seedKey))
    .unique();
  if (existing) {
    await ctx.db.replace(existing._id, value);
    return existing._id;
  }
  return await ctx.db.insert("sites", value);
}

export const seedKeegan = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await upsertUser(ctx, {
      seedKey: "keegan",
      handle: "keegan",
      displayName: "Keegan Moody",
      bio: "GTM engineer, system builder, ideator, and hip-hop evangelist.",
    });

    const githubId = await upsertProduct(ctx, {
      seedKey: "github",
      name: "GitHub",
      slug: "github",
      domain: "github.com",
      description: "The home base for code, collaboration, and shipped work.",
    });

    const publicPropId = await upsertProp(ctx, {
        seedKey: "keegan-github-public",
        userId,
        productId: githubId,
        status: "ACTIVE",
        visibility: "PUBLIC",
        headline: "Where the receipts live.",
        note: "I use GitHub to turn product thinking into inspectable, attributable work.",
        startedAt: "2024-01-01",
    });

    const draftPropId = await upsertProp(ctx, {
        seedKey: "keegan-github-draft",
        userId,
        productId: githubId,
        status: "TESTING",
        visibility: "DRAFT",
        headline: "Draft source record",
        note: "This must never enter the public projection.",
    });

    const privatePropId = await upsertProp(ctx, {
        seedKey: "keegan-github-private",
        userId,
        productId: githubId,
        status: "ACTIVE",
        visibility: "PRIVATE",
        headline: "Private source record",
        note: "This must never enter the public projection.",
    });

    await upsertLink(ctx, {
      seedKey: "keegan-github-primary",
      propId: publicPropId,
      type: "CANONICAL",
      url: "https://github.com/keeganmoody33",
      label: "See Keegan on GitHub",
      isPrimary: true,
    });

    await upsertSite(ctx, {
      seedKey: "keegan-hosted-site",
      ownerId: userId,
      handle: "keegan",
      status: "ACTIVE",
    });

    const product = (await ctx.db.get(githubId))!;
    const props = await ctx.db
      .query("props")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const projectedProps = await Promise.all(
      props.map(async (prop) => {
        const links = await ctx.db
          .query("links")
          .withIndex("by_prop", (q) => q.eq("propId", prop._id))
          .collect();

        return {
          visibility: prop.visibility,
          status: prop.status,
          headline: prop.headline,
          note: prop.note,
          startedAt: prop.startedAt,
          product: {
            name: product.name,
            slug: product.slug,
            domain: product.domain,
            description: product.description,
          },
          links: links.map((link) => ({
            type: link.type,
            url: link.url,
            label: link.label,
            isPrimary: link.isPrimary,
          })),
        };
      }),
    );

    const profile = projectPublicProfile({
      user: {
        handle: "keegan",
        displayName: "Keegan Moody",
        bio: "GTM engineer, system builder, ideator, and hip-hop evangelist.",
      },
      props: projectedProps,
    });

    const published = await ctx.db
      .query("publishedProfiles")
      .withIndex("by_handle", (q) => q.eq("handle", "keegan"))
      .unique();

    const publishedValue = {
      handle: "keegan",
      revision: 1,
      publishedAt: "2026-07-25T00:00:00.000Z",
      profile,
    };

    if (published) {
      await ctx.db.replace(published._id, publishedValue);
    } else {
      await ctx.db.insert("publishedProfiles", publishedValue);
    }

    return {
      handle: "keegan",
      publicCards: profile.cards.length,
      excludedSourcePropIds: [draftPropId, privatePropId],
    };
  },
});
