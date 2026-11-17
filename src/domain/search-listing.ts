import { cardStatusLabel, isRelationshipLevel, levelStatus, type RelationshipStatus } from "./relationship-level";

// The one place that decides who search, tool pages and the sitemap show. The owner was least sure of these
// defaults (decision 2, docs/plans/2026-11-17-launch-readiness.md), so each is a single switch here.

/** A page whose owner never answered "List my page in search" is listed. */
export const LISTED_BY_DEFAULT = true;
/** People who no longer use a tool show on its tool page, under "Used before". Past tools count. */
export const SHOW_PAST_USERS = true;
/** A tool added by name has an identity per owner, so it would split by person and never gather a list of people. */
const PER_OWNER_TOOL_PREFIX = "manual-";

/** The longest search a visitor may send. Longer input is refused, never cut short. */
export const SEARCH_QUERY_MAX = 80;

/** The public page as a visitor reads it, after takedowns and the read filters. Null when nothing is public at the handle. */
export type ListingProfile = {
  handle: string;
  displayName: string;
  cards: readonly { product: { slug: string; name: string }; status: RelationshipStatus; level?: string }[];
};

export type SearchListing = {
  page: { handle: string; displayName: string; sortName: string; searchText: string };
  cards: { productSlug: string; productName: string; searchText: string; usedBefore: boolean; levelLabel: string }[];
};

/** Tried, stopped or paused, or with no level and only marked as used before. Testing is current use. */
export function usedBefore(card: { status: RelationshipStatus; level?: string }): boolean {
  return (isRelationshipLevel(card.level) ? levelStatus(card.level) : card.status) === "ARCHIVED";
}

/**
 * What search may hold for one page: nothing unless the page is public, its owner left it listed and it shows a card.
 * Built only from what the page shows, so search can never say more than the page does.
 */
export function searchListing(profile: ListingProfile | null, listedInSearch: boolean | undefined): SearchListing | null {
  if (!profile || !(listedInSearch ?? LISTED_BY_DEFAULT) || profile.cards.length === 0) return null;
  const { handle } = profile;
  // A name that is an email address was never chosen as a name, so the handle stands in for it.
  const displayName = profile.displayName.includes("@") ? handle : profile.displayName;
  const rows = profile.cards
    .filter(card => !card.product.slug.startsWith(PER_OWNER_TOOL_PREFIX) && (SHOW_PAST_USERS || !usedBefore(card)))
    .map(card => ({
      productSlug: card.product.slug, productName: card.product.name, searchText: `${card.product.name} ${card.product.slug.replaceAll("-", " ")}`,
      usedBefore: usedBefore(card), levelLabel: cardStatusLabel({ status: card.status, level: isRelationshipLevel(card.level) ? card.level : undefined }),
    }));
  // One person counts once per tool, and current use outranks past use.
  const cards = rows.reduce((kept, row) => {
    const held = kept.get(row.productSlug);
    return held && (row.usedBefore || !held.usedBefore) ? kept : kept.set(row.productSlug, row);
  }, new Map<string, SearchListing["cards"][number]>());
  return {
    page: { handle, displayName, sortName: `${displayName.toLowerCase()} ${handle}`, searchText: `${handle} ${handle.replaceAll("-", " ")} ${displayName}` },
    cards: [...cards.values()],
  };
}
