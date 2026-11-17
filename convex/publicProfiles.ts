import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { consumeWriteLimit, requireUser } from "./authHelpers";
import { publicProfileValidator } from "./validators";
import { productBrandEligibility, retainedProductBrand } from "./productBrands";
import { projectPublicProfileV1, withHttpArtifacts } from "../src/domain/public-profile";
import { handleSchema, RESERVED_HANDLES } from "../src/domain/handle";
import { LISTED_BY_DEFAULT, SEARCH_RESULTS_MAX, searchListing, searchProblem, TOOL_CURSOR_MAX, TOOL_PEOPLE_PAGE } from "../src/domain/search-listing";
import { isHttpUrl } from "../src/domain/http-url";
import { isRelationshipLevel, type RelationshipLevel } from "../src/domain/relationship-level";
import { listedUses, type ProductUses } from "../src/domain/product-uses";
import { listedCredit, type PropsCredit } from "../src/domain/props-credit";
import { PUBLISHED_URL_MAX } from "../src/domain/published-text-limits";
import {
  publicRetainedMailboxAggregate,
  type RetainedMailboxRow,
  type StoredMailboxAccount,
} from "../src/domain/retained-mailbox-aggregate";
import { userError } from "../src/domain/user-error";

const cardValidator = publicProfileValidator.fields.cards.element;
const publicProfileV1Validator = v.object({
  ...publicProfileValidator.fields,
  cards: v.array(v.object({
    ...cardValidator.fields,
    primaryLink: v.object(cardValidator.fields.primaryLink.fields),
  })),
});

/** The publication a handle shows, directly or through an alias, or null when it shows none (missing, taken down or a stale alias). */
export async function publicPublication(ctx: QueryCtx, handle: string) {
  const alias = await ctx.db.query("publicProfileAliases").withIndex("by_handle", q => q.eq("handle", handle)).unique();
  if (alias && await ctx.db.query("publicProfileAliases").withIndex("by_handle", q => q.eq("handle", alias.targetHandle)).first()) return null;
  const published = await ctx.db
    .query("publishedProfiles")
    .withIndex("by_handle", (q) => q.eq("handle", alias?.targetHandle ?? handle))
    .unique();

  if (!published || (alias && alias.publicationId !== published._id)) return null;
  if (published.takenDownAt) return null;
  return published;
}

export async function readPublishedProfile(ctx: QueryCtx, handle: string) {
  const published = await publicPublication(ctx, handle);
  if (!published) return null;
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
  const cards = published.profile.cards.map(({ level: storedLevel, uses: storedUses, credit: storedCredit, ...rest }) => {
    // A level the registry no longer knows, uses the product no longer lists, and a credit that no longer fits its
    // platform's rule are dropped on read; storage is unchanged.
    const uses = listedUses(rest.product.slug, storedUses);
    const credit = listedCredit(storedCredit);
    const stored: typeof rest & { level?: RelationshipLevel; uses?: ProductUses; credit?: PropsCredit } = {
      ...rest, ...(isRelationshipLevel(storedLevel) ? { level: storedLevel } : {}), ...(uses ? { uses } : {}), ...(credit ? { credit } : {}),
    };
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
    await syncSearchListing(ctx, publication.handle);
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
    await syncSearchListing(ctx, publication.handle);
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
    if (!account || account.ownerId !== user._id) throw userError("Mailbox unavailable.");
    await ctx.db.patch(args.accountId, {
      retainedAggregateDisplay: args.display,
      ...(args.distinction ? { accountDistinction: args.distinction } : {}),
    });
    return null;
  },
});

/**
 * Which reserved handles an account, a site or an alias already holds. Read only.
 * Run: npx convex run publicProfiles:reservedHandlesHeld   (add --prod for production)
 * It returns the reserved words that are taken and where, and no account details.
 */
export const reservedHandlesHeld = internalQuery({
  args: {},
  handler: async ctx => {
    const taken: { handle: string; heldBy: string[] }[] = [];
    for (const handle of RESERVED_HANDLES) {
      const [account, site, alias] = await Promise.all([
        ctx.db.query("users").withIndex("by_handle", q => q.eq("handle", handle)).first(),
        ctx.db.query("sites").withIndex("by_handle", q => q.eq("handle", handle)).first(),
        ctx.db.query("publicProfileAliases").withIndex("by_handle", q => q.eq("handle", handle)).first(),
      ]);
      const heldBy = [account && "account", site && "site", alias && "alias"].filter((place): place is string => typeof place === "string");
      if (heldBy.length > 0) taken.push({ handle, heldBy });
    }
    return taken;
  },
});

// Search (C1 to C4). The read model holds only what syncSearchListing copies from a listed public page.
// A query can't write, so no per-caller limit can be kept here. Each public search query instead reads a fixed,
// small number of index rows and refuses over-long input; a per-caller limit would sit in front of Convex.
const PAGE_TOOLS_MAX = 500;
const SITEMAP_ENTRIES_MAX = 2000;
const REBUILD_BATCH = 25;
const REBUILD_TOOL_BATCH = 5;
const TOOL_RECOUNT_MAX = 1000;

type ListedCardValue = Omit<Doc<"listedCards">, "_id" | "_creationTime">;
type ToolChange = { productSlug: string; productName?: string; searchText?: string; now: number; before: number };

function sameRow<T extends object>(held: T, wanted: Partial<T>) {
  return Object.entries(wanted).every(([key, value]) => held[key as keyof T] === value);
}

async function changeToolCounts(ctx: MutationCtx, change: ToolChange) {
  if (change.now === 0 && change.before === 0 && change.productName === undefined) return;
  const tool = await ctx.db.query("listedTools").withIndex("by_slug", q => q.eq("productSlug", change.productSlug)).unique();
  const peopleNow = Math.max(0, (tool?.peopleNow ?? 0) + change.now);
  const peopleBefore = Math.max(0, (tool?.peopleBefore ?? 0) + change.before);
  if (peopleNow + peopleBefore === 0) {
    if (tool) await ctx.db.delete(tool._id);
    return;
  }
  const value = {
    productSlug: change.productSlug, productName: change.productName ?? tool?.productName ?? change.productSlug,
    searchText: change.searchText ?? tool?.searchText ?? change.productSlug, peopleNow, peopleBefore, people: peopleNow + peopleBefore,
  };
  if (!tool) await ctx.db.insert("listedTools", value);
  else if (!sameRow(tool, value)) await ctx.db.patch(tool._id, value);
}

/** The card write a row needs, and how it moves its tool's counts. */
function cardEffect(ctx: MutationCtx, held: Doc<"listedCards"> | undefined, wanted: { value: ListedCardValue; searchText: string } | undefined) {
  const value = wanted?.value;
  const productSlug = (held ?? value)!.productSlug;
  const leaving = held ? { now: held.usedBefore ? 0 : -1, before: held.usedBefore ? -1 : 0 } : { now: 0, before: 0 };
  const arriving = value ? { now: value.usedBefore ? 0 : 1, before: value.usedBefore ? 1 : 0 } : { now: 0, before: 0 };
  const named = value && held?.productName !== value.productName ? { productName: value.productName, searchText: wanted!.searchText } : {};
  const tool: ToolChange = { productSlug, now: leaving.now + arriving.now, before: leaving.before + arriving.before, ...named };
  if (!value) return { tool, write: () => ctx.db.delete(held!._id) };
  if (!held) return { tool, write: () => ctx.db.insert("listedCards", value) };
  return { tool, write: sameRow(held, value) ? undefined : () => ctx.db.patch(held._id, value) };
}

/**
 * Makes the read model match what the page at this handle shows now, writing only what differs. Every place that
 * writes, replaces, moves or takes down a published page calls it after that write, in the same transaction.
 * GitHub activity refreshes (convex/connectors.ts) change only a card's activity, which the read model doesn't hold.
 */
export async function syncSearchListing(ctx: MutationCtx, handle: string) {
  const [profile, owner] = await Promise.all([
    readPublishedProfile(ctx, handle),
    ctx.db.query("users").withIndex("by_handle", q => q.eq("handle", handle)).first(),
  ]);
  // An old handle reads the page it moved to, whose rows belong to the new handle.
  const listing = searchListing(profile?.handle === handle ? profile : null, owner?.listedInSearch);
  const page = await ctx.db.query("listedPages").withIndex("by_handle", q => q.eq("handle", handle)).unique();
  if (!listing && page) await ctx.db.delete(page._id);
  if (listing && !page) await ctx.db.insert("listedPages", listing.page);
  if (listing && page && !sameRow(page, listing.page)) await ctx.db.patch(page._id, listing.page);

  const held = await ctx.db.query("listedCards").withIndex("by_handle", q => q.eq("handle", handle)).take(PAGE_TOOLS_MAX);
  // The first row held for a tool is kept; any other is a duplicate to remove.
  const firstHeld = new Map(held.map(row => [row.productSlug, row] as const).reverse());
  const wanted = new Map((listing?.cards ?? []).map(card => [card.productSlug, {
    value: { handle, displayName: listing!.page.displayName, sortName: listing!.page.sortName, productSlug: card.productSlug,
      productName: card.productName, usedBefore: card.usedBefore, levelLabel: card.levelLabel },
    searchText: card.searchText,
  }] as const));
  const effects = [
    ...[...new Set([...firstHeld.keys(), ...wanted.keys()])].map(slug => cardEffect(ctx, firstHeld.get(slug), wanted.get(slug))),
    ...held.filter(row => firstHeld.get(row.productSlug) !== row).map(row => cardEffect(ctx, row, undefined)),
  ];
  await Promise.all(effects.map(effect => effect.write?.()));
  // One count change per tool, so two rows for the same tool never race on its counts.
  const tools = effects.reduce((bySlug, { tool }) => {
    const prior = bySlug.get(tool.productSlug);
    return bySlug.set(tool.productSlug, prior ? { ...prior, ...tool, now: prior.now + tool.now, before: prior.before + tool.before } : tool);
  }, new Map<string, ToolChange>());
  await Promise.all([...tools.values()].map(change => changeToolCounts(ctx, change)));
  return listing !== null;
}

function searchTerm(q: string) {
  const problem = searchProblem(q);
  if (problem) throw userError(problem);
  return q.trim();
}

const toolSummaryValidator = v.object({ slug: v.string(), name: v.string(), peopleNow: v.number(), peopleBefore: v.number() });
const toolSummary = (tool: Doc<"listedTools">) => ({ slug: tool.productSlug, name: tool.productName, peopleNow: tool.peopleNow, peopleBefore: tool.peopleBefore });
const toolGroupValidator = v.object({
  people: v.array(v.object({ handle: v.string(), displayName: v.string(), levelLabel: v.string() })),
  nextAfter: v.union(v.string(), v.null()),
});

/** People with a listed page whose handle or name matches, A to Z. An empty search lists the first people A to Z. */
export const searchPeople = query({
  args: { q: v.string() },
  returns: v.object({ people: v.array(v.object({ handle: v.string(), displayName: v.string() })), more: v.boolean() }),
  handler: async (ctx, { q }) => {
    const term = searchTerm(q);
    const rows = term
      ? await ctx.db.query("listedPages").withSearchIndex("search_people", search => search.search("searchText", term)).take(SEARCH_RESULTS_MAX + 1)
      : await ctx.db.query("listedPages").withIndex("by_sort_name").take(SEARCH_RESULTS_MAX + 1);
    const people = rows.slice(0, SEARCH_RESULTS_MAX).sort((a, b) => a.sortName.localeCompare(b.sortName, "en"));
    return { people: people.map(({ handle, displayName }) => ({ handle, displayName })), more: rows.length > SEARCH_RESULTS_MAX };
  },
});

/** Tools on listed pages whose name matches, A to Z. An empty search lists tools by how many people list them. */
export const searchTools = query({
  args: { q: v.string() },
  returns: v.object({ tools: v.array(toolSummaryValidator), more: v.boolean() }),
  handler: async (ctx, { q }) => {
    const term = searchTerm(q);
    const rows = term
      ? (await ctx.db.query("listedTools").withSearchIndex("search_tools", search => search.search("searchText", term)).take(SEARCH_RESULTS_MAX + 1))
      : await ctx.db.query("listedTools").withIndex("by_people").order("desc").take(SEARCH_RESULTS_MAX + 1);
    const tools = rows.slice(0, SEARCH_RESULTS_MAX);
    if (term) tools.sort((a, b) => a.productName.localeCompare(b.productName, "en"));
    return { tools: tools.map(toolSummary), more: rows.length > SEARCH_RESULTS_MAX };
  },
});

async function toolGroup(ctx: QueryCtx, productSlug: string, usedBefore: boolean, after: string | undefined) {
  const rows = await ctx.db.query("listedCards").withIndex("by_product_people", q => {
    const group = q.eq("productSlug", productSlug).eq("usedBefore", usedBefore);
    return after === undefined ? group : group.gt("sortName", after);
  }).take(TOOL_PEOPLE_PAGE + 1);
  const people = rows.slice(0, TOOL_PEOPLE_PAGE);
  return {
    people: people.map(({ handle, displayName, levelLabel }) => ({ handle, displayName, levelLabel })),
    nextAfter: rows.length > TOOL_PEOPLE_PAGE ? people[people.length - 1].sortName : null,
  };
}

/** A tool and the people who list it, in two groups A to Z: using it now, and used before. Null when no listed page has it. */
export const toolPage = query({
  args: { slug: v.string(), nowAfter: v.optional(v.string()), beforeAfter: v.optional(v.string()) },
  returns: v.union(v.null(), v.object({ ...toolSummaryValidator.fields, now: toolGroupValidator, before: toolGroupValidator })),
  handler: async (ctx, args) => {
    if (handleSchema.safeParse(args.slug).data !== args.slug) return null;
    if ([args.nowAfter, args.beforeAfter].some(after => (after?.length ?? 0) > TOOL_CURSOR_MAX)) throw userError("That page of people is out of range.");
    const tool = await ctx.db.query("listedTools").withIndex("by_slug", q => q.eq("productSlug", args.slug)).unique();
    if (!tool) return null;
    const [now, before] = await Promise.all([
      toolGroup(ctx, tool.productSlug, false, args.nowAfter),
      toolGroup(ctx, tool.productSlug, true, args.beforeAfter),
    ]);
    return { ...toolSummary(tool), now, before };
  },
});

/** The tools a listed page links to their tool pages. Empty for a page that isn't listed. */
export const listedToolSlugs = query({
  args: { handle: v.string() },
  returns: v.array(v.string()),
  handler: async (ctx, { handle }) => {
    if (handleSchema.safeParse(handle).data !== handle) return [];
    const rows = await ctx.db.query("listedCards").withIndex("by_handle", q => q.eq("handle", handle)).take(PAGE_TOOLS_MAX);
    return rows.map(row => row.productSlug);
  },
});

/** Listed pages and tool pages for the sitemap, bounded. Unlisted and unpublished pages are never here. */
export const sitemapListing = query({
  args: {},
  returns: v.object({ handles: v.array(v.string()), tools: v.array(v.string()) }),
  handler: async ctx => {
    const [pages, tools] = await Promise.all([
      ctx.db.query("listedPages").withIndex("by_sort_name").take(SITEMAP_ENTRIES_MAX),
      ctx.db.query("listedTools").withIndex("by_people").order("desc").take(SITEMAP_ENTRIES_MAX),
    ]);
    return { handles: pages.map(page => page.handle), tools: tools.map(tool => tool.productSlug) };
  },
});

/** The owner's answer to "List my page in search". */
export const searchListingChoice = query({
  args: {},
  returns: v.object({ listed: v.boolean() }),
  handler: async ctx => ({ listed: (await requireUser(ctx)).listedInSearch ?? LISTED_BY_DEFAULT }),
});

/** Records the owner's answer and applies it to a published page at once. A page stays public at its link either way. */
export const setSearchListing = mutation({
  args: { listed: v.boolean() },
  returns: v.object({ listed: v.boolean() }),
  handler: async (ctx, { listed }) => {
    const user = await requireUser(ctx);
    if (user.listedInSearch === listed) return { listed };
    // The switch changes where a page shows, so it shares the publishing budget.
    await consumeWriteLimit(ctx, user._id, "publishSelected");
    await ctx.db.patch(user._id, { listedInSearch: listed });
    await syncSearchListing(ctx, user.handle);
    return { listed };
  },
});

const REBUILD_PHASES = ["publications", "pages", "cards", "tools"] as const;
type RebuildPhase = typeof REBUILD_PHASES[number];
const rebuildPhaseValidator = v.union(...REBUILD_PHASES.map(phase => v.literal(phase)));

async function recountTool(ctx: MutationCtx, tool: Doc<"listedTools">) {
  const [now, before] = await Promise.all([false, true].map(usedBefore => ctx.db.query("listedCards")
    .withIndex("by_product_people", q => q.eq("productSlug", tool.productSlug).eq("usedBefore", usedBefore)).take(TOOL_RECOUNT_MAX + 1)));
  // A tool listed by more people than one step can count keeps the counts each sync kept.
  if (now.length > TOOL_RECOUNT_MAX || before.length > TOOL_RECOUNT_MAX) return;
  if (now.length + before.length === 0) return await ctx.db.delete(tool._id);
  const counts = { peopleNow: now.length, peopleBefore: before.length, people: now.length + before.length };
  if (!sameRow(tool, counts)) await ctx.db.patch(tool._id, counts);
}

const inSequence = <T>(items: readonly T[], step: (item: T) => Promise<unknown>) =>
  items.reduce<Promise<void>>(async (done, item) => {
    await done;
    await step(item);
  }, Promise.resolve());

// Each table whose rows name a handle to sync again.
const REBUILD_SOURCES = { publications: "publishedProfiles", pages: "listedPages", cards: "listedCards" } as const;

async function rebuildStep(ctx: MutationCtx, phase: RebuildPhase, cursor: string | null) {
  if (phase === "tools") {
    const page = await ctx.db.query("listedTools").paginate({ numItems: REBUILD_TOOL_BATCH, cursor });
    await inSequence(page.page, tool => recountTool(ctx, tool));
    return { page, count: page.page.length };
  }
  const page = await ctx.db.query(REBUILD_SOURCES[phase]).paginate({ numItems: REBUILD_BATCH, cursor });
  const handles = [...new Set(page.page.map(row => row.handle))];
  // In turn, because two pages can share a tool's counts.
  await inSequence(handles, handle => syncSearchListing(ctx, handle));
  return { page, count: handles.length };
}

/**
 * Rebuilds the search read model from what each published page shows, changing no other data. Safe to run twice:
 * a second run writes nothing. One batch per call; pass the returned `next` back until it is null.
 * Run: npx convex run publicProfiles:rebuildSearch '{}'   (add --prod for production)
 */
export const rebuildSearch = internalMutation({
  args: { phase: v.optional(rebuildPhaseValidator), cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.object({
    phase: rebuildPhaseValidator, synced: v.number(),
    next: v.union(v.null(), v.object({ phase: rebuildPhaseValidator, cursor: v.union(v.string(), v.null()) })),
  }),
  handler: async (ctx, args) => {
    const phase = args.phase ?? "publications";
    const { page, count } = await rebuildStep(ctx, phase, args.cursor ?? null);
    if (!page.isDone) return { phase, synced: count, next: { phase, cursor: page.continueCursor } };
    const following: RebuildPhase | undefined = REBUILD_PHASES[REBUILD_PHASES.indexOf(phase) + 1];
    return { phase, synced: count, next: following ? { phase: following, cursor: null } : null };
  },
});
