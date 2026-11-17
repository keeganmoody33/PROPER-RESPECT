import { fetchQuery } from "convex/nextjs";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { handleSchema } from "@/src/domain/handle";
import { bySortName, SEARCH_RESULTS_MAX, searchListing, searchProblem, TOOL_PEOPLE_PAGE, type SearchListing } from "@/src/domain/search-listing";
import { getServerEnv } from "@/src/env";
import { e2eSearchProfiles } from "./e2e-search-profiles";

export type SearchPerson = { handle: string; displayName: string };
export type SearchTool = { slug: string; name: string; peopleNow: number; peopleBefore: number };
export type ToolPerson = SearchPerson & { levelLabel: string };
export type ToolGroup = { people: ToolPerson[]; nextAfter: string | null };
export type ToolPageData = SearchTool & { now: ToolGroup; before: ToolGroup };

// Every handle and slug here becomes a link path, so a row whose handle or slug isn't one is dropped.
const linkName = z.string().refine(value => handleSchema.safeParse(value).data === value);
const personSchema = z.object({ handle: linkName, displayName: z.string().min(1) });
const toolSchema = z.object({ slug: linkName, name: z.string().min(1), peopleNow: z.number().int().nonnegative(), peopleBefore: z.number().int().nonnegative() });
const toolPersonSchema = personSchema.extend({ levelLabel: z.string().min(1) });

function kept<T>(schema: z.ZodType<T>, rows: readonly unknown[]): T[] {
  return rows.flatMap(row => {
    const parsed = schema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

const fixtureMode = () => process.env.PROPER_RESPECT_E2E_REFERENCE === "1";
const convexUrl = () => ({ url: getServerEnv().NEXT_PUBLIC_CONVEX_URL });

/** What a visitor is told when a search is too long. Null when it can be sent. */
export function searchQueryProblem(q: string): string | null {
  return searchProblem(q);
}

// Fixture mode reads the same listing rule the backend writes from, over invented pages, so the two can't drift.
function fixtureListings(): SearchListing[] {
  return e2eSearchProfiles.flatMap(profile => {
    const listing = searchListing(profile, undefined);
    return listing ? [listing] : [];
  });
}

/** Any word of the text starts with any word of the search, as the backend's search index matches. */
function matches(text: string, q: string) {
  const words = text.toLowerCase().split(" ").filter(Boolean);
  return q.toLowerCase().split(" ").filter(Boolean).some(term => words.some(word => word.startsWith(term)));
}

const byText = (a: string, b: string) => a.localeCompare(b, "en");

function fixtureTools(): (SearchTool & { searchText: string })[] {
  const rows = fixtureListings().flatMap(listing => listing.cards);
  const tools = rows.reduce((bySlug, row) => {
    const prior = bySlug.get(row.productSlug) ?? { slug: row.productSlug, name: row.productName, peopleNow: 0, peopleBefore: 0, searchText: row.searchText };
    return bySlug.set(row.productSlug, { ...prior, peopleNow: prior.peopleNow + (row.usedBefore ? 0 : 1), peopleBefore: prior.peopleBefore + (row.usedBefore ? 1 : 0) });
  }, new Map<string, SearchTool & { searchText: string }>());
  // By how many people list each tool, as the backend's index orders them; ties A to Z.
  return [...tools.values()].sort((a, b) => b.peopleNow + b.peopleBefore - (a.peopleNow + a.peopleBefore) || byText(a.name, b.name));
}

const summary = ({ slug, name, peopleNow, peopleBefore }: SearchTool): SearchTool => ({ slug, name, peopleNow, peopleBefore });

/** People with a listed page, A to Z. An empty search shows the first people A to Z. */
export async function searchPeople(q: string): Promise<{ people: SearchPerson[]; more: boolean }> {
  const term = q.trim();
  if (fixtureMode()) {
    const found = fixtureListings().map(listing => listing.page).filter(page => !term || matches(page.searchText, term))
      .sort(bySortName);
    return { people: found.slice(0, SEARCH_RESULTS_MAX).map(({ handle, displayName }) => ({ handle, displayName })), more: found.length > SEARCH_RESULTS_MAX };
  }
  const result = await fetchQuery(api.publicProfiles.searchPeople, { q: term }, convexUrl());
  return { people: kept(personSchema, result.people), more: result.more };
}

/** Tools on listed pages: A to Z for a search, or by how many people list them when the search is empty. */
export async function searchTools(q: string): Promise<{ tools: SearchTool[]; more: boolean }> {
  const term = q.trim();
  if (fixtureMode()) {
    const tools = fixtureTools();
    const found = term ? tools.filter(tool => matches(tool.searchText, term)).sort((a, b) => byText(a.name, b.name)) : tools;
    return { tools: found.slice(0, SEARCH_RESULTS_MAX).map(summary), more: found.length > SEARCH_RESULTS_MAX };
  }
  const result = await fetchQuery(api.publicProfiles.searchTools, { q: term }, convexUrl());
  return { tools: kept(toolSchema, result.tools), more: result.more };
}

function fixtureGroup(slug: string, usedBefore: boolean, after: string | undefined): ToolGroup {
  const rows = fixtureListings().flatMap(listing => listing.cards.filter(card => card.productSlug === slug && card.usedBefore === usedBefore)
    .map(card => ({ handle: listing.page.handle, displayName: listing.page.displayName, levelLabel: card.levelLabel, sortName: listing.page.sortName })))
    .filter(row => after === undefined || row.sortName > after)
    .sort(bySortName);
  const people = rows.slice(0, TOOL_PEOPLE_PAGE);
  return {
    people: people.map(({ handle, displayName, levelLabel }) => ({ handle, displayName, levelLabel })),
    nextAfter: rows.length > TOOL_PEOPLE_PAGE ? people[people.length - 1].sortName : null,
  };
}

function checkedGroup(group: { people: readonly unknown[]; nextAfter: string | null }): ToolGroup {
  return { people: kept(toolPersonSchema, group.people), nextAfter: group.nextAfter };
}

/** A tool and who lists it, now and before. Null when no listed page has the tool. */
export async function getToolPage(rawSlug: string, cursors: { nowAfter?: string; beforeAfter?: string } = {}): Promise<ToolPageData | null> {
  const slug = linkName.safeParse(rawSlug);
  if (!slug.success) return null;
  if (fixtureMode()) {
    const tool = fixtureTools().find(candidate => candidate.slug === slug.data);
    if (!tool) return null;
    return { ...summary(tool), now: fixtureGroup(tool.slug, false, cursors.nowAfter), before: fixtureGroup(tool.slug, true, cursors.beforeAfter) };
  }
  const result = await fetchQuery(api.publicProfiles.toolPage, { slug: slug.data, ...cursors }, convexUrl());
  if (!result) return null;
  const tool = toolSchema.safeParse(result);
  if (!tool.success) return null;
  return { ...tool.data, now: checkedGroup(result.now), before: checkedGroup(result.before) };
}

/** The tools on this page that have a tool page. Empty when the page isn't listed, or when search can't be read. */
export async function getListedToolSlugs(handle: string): Promise<ReadonlySet<string>> {
  if (fixtureMode()) return new Set(fixtureListings().find(listing => listing.page.handle === handle)?.cards.map(card => card.productSlug));
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return new Set();
  try {
    const slugs = await fetchQuery(api.publicProfiles.listedToolSlugs, { handle }, { url });
    return new Set(slugs.filter(slug => linkName.safeParse(slug).success));
  } catch {
    // An older backend without search, or a failed read: the page shows its cards without tool links.
    return new Set();
  }
}

/** Listed pages and tool pages for the sitemap. Empty when search can't be read, so the rest of the sitemap still serves. */
export async function getSitemapListing(): Promise<{ handles: string[]; tools: string[] }> {
  if (fixtureMode()) {
    return { handles: fixtureListings().map(listing => listing.page.handle).sort(byText), tools: fixtureTools().map(tool => tool.slug) };
  }
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return { handles: [], tools: [] };
  try {
    const listing = await fetchQuery(api.publicProfiles.sitemapListing, {}, { url });
    const links = (values: readonly string[]) => values.filter(value => linkName.safeParse(value).success);
    return { handles: links(listing.handles), tools: links(listing.tools) };
  } catch {
    return { handles: [], tools: [] };
  }
}
