import { describe, expect, it } from "vitest";
import { LISTED_BY_DEFAULT, SHOW_PAST_USERS, searchListing, usedBefore, type ListingProfile } from "./search-listing";
import { RELATIONSHIP_LEVELS } from "./relationship-level";

const card = (slug: string, fields: Partial<ListingProfile["cards"][number]> = {}): ListingProfile["cards"][number] => ({
  product: { slug, name: slug[0].toUpperCase() + slug.slice(1) }, status: "ACTIVE", ...fields,
});
const profile = (cards: ListingProfile["cards"], fields: Partial<ListingProfile> = {}): ListingProfile => ({
  handle: "synthetic-sam", displayName: "Synthetic Sam", cards, ...fields,
});

describe("the search listing rule", () => {
  it("lists a page by default, and says so in one place", () => {
    expect(LISTED_BY_DEFAULT).toBe(true);
    expect(SHOW_PAST_USERS).toBe(true);
    expect(searchListing(profile([card("clay")]), undefined)).toEqual({
      page: { handle: "synthetic-sam", displayName: "Synthetic Sam", sortName: "synthetic sam synthetic-sam", searchText: "synthetic-sam synthetic sam Synthetic Sam" },
      cards: [{ productSlug: "clay", productName: "Clay", searchText: "Clay clay", usedBefore: false, levelLabel: "Using" }],
    });
  });

  it("lists nothing for a page that is not public: missing, unpublished or taken down", () => {
    expect(searchListing(null, true)).toBeNull();
    expect(searchListing(null, undefined)).toBeNull();
  });

  it("lists nothing when the owner turned the switch off, and lists when they turned it on", () => {
    expect(searchListing(profile([card("clay")]), false)).toBeNull();
    expect(searchListing(profile([card("clay")]), true)?.cards).toHaveLength(1);
  });

  it("lists nothing for a page with no cards", () => {
    expect(searchListing(profile([]), true)).toBeNull();
  });

  it("marks every past level as used before, keeps its own words, and keeps testing as current", () => {
    const listing = searchListing(profile(RELATIONSHIP_LEVELS.map(level => card(level.key.toLowerCase().replaceAll("_", "-"), { level: level.key, status: level.status }))), true);
    expect(listing?.cards.map(row => [row.productSlug, row.usedBefore, row.levelLabel])).toEqual([
      ["tried-not-adopted", true, "Tried, didn't adopt"], ["stopped", true, "Stopped using"], ["paused", true, "Paused"],
      ["occasional", false, "Occasionally"], ["testing", false, "Testing"], ["weekly", false, "Weekly"], ["daily", false, "Daily"],
    ]);
  });

  it("reads a card with no level, or a level it does not know, by its status", () => {
    expect([usedBefore({ status: "ARCHIVED" }), usedBefore({ status: "ACTIVE" }), usedBefore({ status: "TESTING" })]).toEqual([true, false, false]);
    expect(usedBefore({ status: "ARCHIVED", level: "RETIRED_LEVEL" })).toBe(true);
    expect(usedBefore({ status: "ACTIVE", level: "RETIRED_LEVEL" })).toBe(false);
    expect(searchListing(profile([card("clay", { status: "ARCHIVED" })]), true)?.cards[0]).toMatchObject({ usedBefore: true, levelLabel: "Used before" });
    expect(searchListing(profile([card("clay", { status: "ACTIVE", level: "RETIRED_LEVEL" })]), true)?.cards[0]).toMatchObject({ usedBefore: false, levelLabel: "Using" });
  });

  it("counts a person once per tool, current use first", () => {
    const listing = searchListing(profile([card("clay", { level: "STOPPED", status: "ARCHIVED" }), card("clay", { level: "DAILY" }), card("clay", { level: "WEEKLY" })]), true);
    expect(listing?.cards.map(row => [row.productSlug, row.usedBefore, row.levelLabel])).toEqual([["clay", false, "Daily"]]);
  });

  it("keeps a tool added by name off every tool list, and still lists the page", () => {
    const listing = searchListing(profile([card("manual-acme-0123456789abcdef012345")]), true);
    expect(listing?.page.handle).toBe("synthetic-sam");
    expect(listing?.cards).toEqual([]);
  });

  it("never makes an email address searchable: an email-like name lists as the handle", () => {
    const listing = searchListing(profile([card("clay")], { displayName: "sam@example.com" }), true);
    expect(listing?.page).toEqual({ handle: "synthetic-sam", displayName: "synthetic-sam", sortName: "synthetic-sam synthetic-sam", searchText: "synthetic-sam synthetic sam synthetic-sam" });
    expect(JSON.stringify(listing)).not.toContain("example.com");
  });

  it("copies nothing but the handle, the name, and each tool's name, slug and level words", () => {
    const listing = searchListing({ ...profile([{ ...card("clay"), headline: "Private?", note: "n", cost: { amount: 1 } } as ListingProfile["cards"][number]]), bio: "bio" } as ListingProfile, true);
    for (const word of ["Private?", "\"bio\"", "cost", "amount"]) expect(JSON.stringify(listing)).not.toContain(word);
  });
});
