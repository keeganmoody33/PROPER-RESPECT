import { internalMutation } from "./_generated/server";
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

export const seedKeegan = internalMutation({
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
      logoUrl: "https://github.githubassets.com/favicons/favicon.svg",
    });

    const wisprflowId = await upsertProduct(ctx, {
      seedKey: "wisprflow",
      name: "Wisprflow",
      slug: "wisprflow",
      domain: "wisprflow.ai",
      description: "Voice dictation that keeps up with how I actually think.",
      logoUrl: "https://wisprflow.ai/favicon.ico",
    });

    const notebooklmId = await upsertProduct(ctx, {
      seedKey: "notebooklm",
      name: "NotebookLM",
      slug: "notebooklm",
      domain: "notebooklm.google.com",
      description: "Grounded research and synthesis over my own sources.",
      logoUrl: "https://notebooklm.google.com/favicon.ico",
    });

    const devinId = await upsertProduct(ctx, {
      seedKey: "devin",
      name: "Devin",
      slug: "devin",
      domain: "devin.ai",
      description: "Autonomous software engineering activity.",
      logoUrl: "https://devin.ai/favicon.ico",
    });

    const devinDesktopId = await upsertProduct(ctx, {
      seedKey: "devin-desktop",
      name: "Devin Desktop",
      slug: "devin-desktop",
      domain: "devin.ai",
      description: "Desktop coding activity in the Devin product family.",
      logoUrl: "https://devin.ai/favicon.ico",
    });

    const windsurfId = await upsertProduct(ctx, {
      seedKey: "windsurf",
      name: "Windsurf",
      slug: "windsurf",
      domain: "windsurf.com",
      description: "AI-assisted coding activity across editor workflows.",
      logoUrl: "https://windsurf.com/favicon.ico",
    });

    const greptileId = await upsertProduct(ctx, {
      seedKey: "greptile",
      name: "Greptile",
      slug: "greptile",
      domain: "greptile.com",
      description: "AI code review activity and bugs caught.",
      logoUrl: "https://greptile.com/favicon.ico",
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
        startedAtSource: "USER_CONFIRMED",
        activity: {
          kind: "contributionCalendar",
          attributionScope: "PERSONAL",
          capturedAt: "2026-07-26T18:00:00.000Z",
          freshness: "STALE",
          provenanceLabel: "GitHub public profile snapshot",
          period: {
            start: "2025-07-26",
            end: "2026-07-26",
            label: "Last 12 months",
          },
          total: 523,
          days: [],
        },
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

    const wisprflowPropId = await upsertProp(ctx, {
        seedKey: "keegan-wisprflow-public",
        userId,
        productId: wisprflowId,
        status: "ACTIVE",
        visibility: "PUBLIC",
        headline: "Talking is faster than typing.",
        note: "I use Wisprflow to dictate specs, notes, and messages at the speed of thought.",
        startedAt: "2025-01-01",
        startedAtSource: "USER_CONFIRMED",
        activity: {
          kind: "headlineMetrics",
          attributionScope: "PERSONAL",
          capturedAt: "2026-07-26T18:00:00.000Z",
          freshness: "STALE",
          provenanceLabel: "Wispr Flow Insights snapshot",
          primary: {
            label: "Total words dictated",
            value: 373701,
            unit: "words",
          },
          supporting: [
            { label: "Average speed", value: 113, unit: "WPM" },
            { label: "Current streak", value: 9, unit: "days" },
            { label: "Longest streak", value: 38, unit: "days" },
            { label: "Apps used", value: 65 },
          ],
        },
    });

    await upsertLink(ctx, {
      seedKey: "keegan-wisprflow-primary",
      propId: wisprflowPropId,
      type: "CANONICAL",
      url: "https://wisprflow.ai",
      label: "Check out Wisprflow",
      isPrimary: true,
    });

    const notebooklmPropId = await upsertProp(ctx, {
        seedKey: "keegan-notebooklm-public",
        userId,
        productId: notebooklmId,
        status: "ACTIVE",
        visibility: "PUBLIC",
        headline: "Research grounded in my own sources.",
        note: "I use NotebookLM to synthesize docs and research into working knowledge.",
        startedAt: "2025-01-01",
        startedAtSource: "USER_CONFIRMED",
        activity: {
          kind: "artifactCollection",
          attributionScope: "PERSONAL",
          capturedAt: "2026-07-26T18:00:00.000Z",
          freshness: "STALE",
          provenanceLabel: "NotebookLM library snapshot",
          total: 42,
          artifacts: [],
        },
    });

    await upsertLink(ctx, {
      seedKey: "keegan-notebooklm-primary",
      propId: notebooklmPropId,
      type: "CANONICAL",
      url: "https://notebooklm.google.com",
      label: "Check out NotebookLM",
      isPrimary: true,
    });

    const devinPropId = await upsertProp(ctx, {
      seedKey: "keegan-devin-public",
      userId,
      productId: devinId,
      status: "ACTIVE",
      visibility: "PUBLIC",
      headline: "Delegated engineering work, measured at the organization.",
      note: "This card reports organization-scoped activity, not personal spend.",
      startedAt: "2026-01-01",
      startedAtSource: "USER_CONFIRMED",
      activity: {
        kind: "headlineMetrics",
        attributionScope: "ORGANIZATION",
        capturedAt: "2026-07-26T18:00:00.000Z",
        freshness: "STALE",
        provenanceLabel: "Devin organization usage snapshot",
        primary: { label: "Sessions", value: 90 },
        supporting: [
          { label: "Searches", value: 13 },
          { label: "PRs created", value: 27 },
          { label: "PRs merged", value: 22 },
        ],
      },
    });

    await upsertLink(ctx, {
      seedKey: "keegan-devin-primary",
      propId: devinPropId,
      type: "CANONICAL",
      url: "https://app.devin.ai/org/lecturesfrom",
      label: "Open Devin",
      isPrimary: true,
    });

    const devinDesktopPropId = await upsertProp(ctx, {
      seedKey: "keegan-devin-desktop-public",
      userId,
      productId: devinDesktopId,
      status: "ACTIVE",
      visibility: "PUBLIC",
      headline: "A distinct desktop surface in the coding stack.",
      note: "Desktop activity remains separate from Devin cloud activity.",
      startedAt: "2026-06-01",
      startedAtSource: "USER_CONFIRMED",
    });

    await upsertLink(ctx, {
      seedKey: "keegan-devin-desktop-primary",
      propId: devinDesktopPropId,
      type: "CANONICAL",
      url: "https://devin.ai",
      label: "Open Devin Desktop",
      isPrimary: true,
    });

    const windsurfPropId = await upsertProp(ctx, {
      seedKey: "keegan-windsurf-public",
      userId,
      productId: windsurfId,
      status: "ACTIVE",
      visibility: "PUBLIC",
      headline: "Cascade activity, visible on the card front.",
      note: "Windsurf is tracked independently from Devin and Devin Desktop.",
      startedAt: "2026-06-01",
      startedAtSource: "USER_CONFIRMED",
      activity: {
        kind: "codingActivity",
        attributionScope: "PERSONAL",
        capturedAt: "2026-07-26T18:00:00.000Z",
        freshness: "STALE",
        provenanceLabel: "Windsurf account activity snapshot",
        primary: { label: "Lines written by Cascade", value: 7627 },
        supporting: [
          { label: "AI-written code", value: 99, unit: "%" },
          { label: "Conversations", value: 26 },
          { label: "Messages", value: 123 },
          { label: "Terminal messages", value: 1639 },
        ],
      },
    });

    await upsertLink(ctx, {
      seedKey: "keegan-windsurf-primary",
      propId: windsurfPropId,
      type: "CANONICAL",
      url: "https://windsurf.com",
      label: "Open Windsurf",
      isPrimary: true,
    });

    const greptilePropId = await upsertProp(ctx, {
      seedKey: "keegan-greptile-public",
      userId,
      productId: greptileId,
      status: "ACTIVE",
      visibility: "PUBLIC",
      headline: "Code review activity and bugs caught, aggregated.",
      note: "Only approved aggregates publish; repository-level review details stay private.",
      startedAt: "2026-02-01",
      startedAtSource: "USER_CONFIRMED",
      activity: {
        kind: "reviewActivity",
        attributionScope: "ORGANIZATION",
        capturedAt: "2026-07-26T18:00:00.000Z",
        freshness: "STALE",
        provenanceLabel: "Greptile analytics CSV",
        reviews: 127,
        bugsCaught: 76,
        severity: [
          { label: "P1", count: 40 },
          { label: "P2", count: 36 },
        ],
        points: [],
      },
    });

    await upsertLink(ctx, {
      seedKey: "keegan-greptile-primary",
      propId: greptilePropId,
      type: "CANONICAL",
      url: "https://greptile.com",
      label: "Open Greptile",
      isPrimary: true,
    });

    await upsertSite(ctx, {
      seedKey: "keegan-hosted-site",
      ownerId: userId,
      handle: "keegan",
      status: "ACTIVE",
    });

    const props = await ctx.db
      .query("props")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const projectedProps = await Promise.all(
      props.map(async (prop) => {
        const product = (await ctx.db.get(prop.productId))!;
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
          activity: prop.activity,
          product: {
            name: product.name,
            slug: product.slug,
            domain: product.domain,
            description: product.description,
            logoUrl: product.logoUrl,
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
