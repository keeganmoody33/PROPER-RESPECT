import { describe, expect, it } from "vitest";
import { LINK_LABEL_MAX, PUBLISHED_URL_MAX } from "./published-text-limits";
import { SHARE_ALL_MAX, shareAllSelections, type ShareAllProp } from "./share-all";
import { prepareImportedProp } from "./discovery";

const MONTHLY_PRICE = 20;
const SAVED_VERSION = 2;
const OVERFLOW = 5;
const EXPECTED_BATCH = 100;
const cost = { amount: MONTHLY_PRICE, currency: "USD", cadence: "MONTHLY", basis: "OWNER_REPORTED", asOf: "2026-11-01" } as const;

function prop(propId: string, overrides: Partial<ShareAllProp<string, typeof cost>> = {}): ShareAllProp<string, typeof cost> {
  return {
    propId, visibility: "PRIVATE", onPublishedPage: false, matchesUnresolvedPublishedCard: false, relationshipVersion: SAVED_VERSION,
    status: "ACTIVE", headline: `Headline ${propId}`, note: `Note ${propId}`,
    product: { name: `Product ${propId}`, domain: `${propId}.example` },
    ...overrides,
  };
}

describe("shareAllSelections", () => {
  it("sends a saved level beside its status and sends none for a card without one", () => {
    const result = shareAllSelections([prop("a", { status: "ARCHIVED", level: "PAUSED" }), prop("b")]);
    expect(result.selections.map(selection => [selection.status, selection.level])).toEqual([["ARCHIVED", "PAUSED"], ["ACTIVE", undefined]]);
    expect(result.selections[1]).not.toHaveProperty("level");
  });

  it("builds one selection per confirmed private card from saved values only", () => {
    const result = shareAllSelections([
      prop("a", { startedAt: "2025-01-02", startedAtSource: "USER_CONFIRMED", cost,
        primaryLink: { type: "REFERRAL", url: "https://a.example/ref", label: "My referral" } }),
      prop("b", { status: "ARCHIVED", relationshipVersion: undefined }),
    ]);
    expect(result).toEqual({
      selections: [
        { propId: "a", expectedRelationshipVersion: SAVED_VERSION, publish: true, status: "ACTIVE", headline: "Headline a", note: "Note a",
          startedAt: "2025-01-02", startedAtSource: "USER_CONFIRMED",
          primaryLink: { type: "REFERRAL", url: "https://a.example/ref", label: "My referral" },
          autoRefresh: false, cost, costVisibility: "PRIVATE" },
        { propId: "b", expectedRelationshipVersion: 0, publish: true, status: "ARCHIVED", headline: "Headline b", note: "Note b",
          primaryLink: { type: "CANONICAL", url: "https://b.example", label: "Open product" },
          autoRefresh: false, costVisibility: "PRIVATE" },
      ],
      skipped: [],
      remainingCount: 0,
    });
  });

  it("leaves out drafts, public cards and cards already on the page", () => {
    const result = shareAllSelections([
      prop("draft", { visibility: "DRAFT" }),
      prop("public", { visibility: "PUBLIC", onPublishedPage: true }),
      prop("listed", { onPublishedPage: true }),
      prop("private"),
    ]);
    expect(result.selections.map(selection => selection.propId)).toEqual(["private"]);
    expect(result.skipped).toEqual([]);
    expect(result.remainingCount).toBe(0);
  });

  it("never carries activity, measurements, usage links or a refresh", () => {
    const [selection] = shareAllSelections([prop("a")]).selections;
    expect(Object.keys(selection).sort()).toEqual([
      "autoRefresh", "costVisibility", "expectedRelationshipVersion", "headline", "note", "primaryLink", "propId", "publish", "status",
    ]);
  });

  it("skips and names a card whose saved owner link can't go public, and keeps the good one", () => {
    const links = ["javascript:alert(1)", "data:text/html,x", "ftp://files.example/tool", "https://user:pass@tool.example"];
    const result = shareAllSelections([
      ...links.map((url, index) => prop(`bad${index}`, { primaryLink: { type: "CANONICAL", url, label: "Open" } })),
      prop("good", { primaryLink: { type: "CANONICAL", url: "https://good.example", label: "Open" } }),
      prop("long", { primaryLink: { type: "CANONICAL", url: `https://long.example/${"a".repeat(PUBLISHED_URL_MAX)}`, label: "Open" } }),
      prop("label", { primaryLink: { type: "CANONICAL", url: "https://label.example", label: "x".repeat(LINK_LABEL_MAX + 1) } }),
      prop("blank", { primaryLink: { type: "CANONICAL", url: "https://blank.example", label: "" } }),
    ]);
    expect(result.selections.map(selection => [selection.propId, selection.primaryLink?.url])).toEqual([["good", "https://good.example"]]);
    expect(result.skipped).toEqual([
      { propId: "bad0", productName: "Product bad0", reason: "LINK_NEEDS_REVIEW" },
      { propId: "bad1", productName: "Product bad1", reason: "LINK_NEEDS_REVIEW" },
      { propId: "bad2", productName: "Product bad2", reason: "LINK_NEEDS_REVIEW" },
      { propId: "bad3", productName: "Product bad3", reason: "LINK_NEEDS_REVIEW" },
      { propId: "long", productName: "Product long", reason: "LINK_TOO_LONG" },
      { propId: "label", productName: "Product label", reason: "LINK_TOO_LONG" },
      { propId: "blank", productName: "Product blank", reason: "LINK_NEEDS_REVIEW" },
    ]);
  });

  it("skips and names a card whose product matches a published card it can't be told apart from", () => {
    const result = shareAllSelections([
      prop("twin", { matchesUnresolvedPublishedCard: true, primaryLink: { type: "CANONICAL", url: "javascript:alert(1)", label: "Open" } }),
      prop("other"),
    ]);
    expect(result.selections.map(selection => selection.propId)).toEqual(["other"]);
    expect(result.skipped).toEqual([{ propId: "twin", productName: "Product twin", reason: "ALREADY_ON_PAGE_NEEDS_REVIEW" }]);
    expect(result.remainingCount).toBe(0);
  });

  it("shares a card with no domain and no saved link without a link", () => {
    const [selection] = shareAllSelections([prop("bare", { product: { name: "Bare", domain: "" } })]).selections;
    expect(selection.propId).toBe("bare");
    expect(selection.primaryLink).toBeUndefined();
  });

  it("drops a domain default link that isn't a web address instead of skipping the card", () => {
    const result = shareAllSelections([prop("odd", { product: { name: "Odd", domain: "bad domain" } })]);
    expect(result.selections.map(selection => [selection.propId, selection.primaryLink])).toEqual([["odd", undefined]]);
    expect(result.skipped).toEqual([]);
  });

  it("skips and names a card with neither a headline nor a note, so no card goes public without a line", () => {
    const result = shareAllSelections([
      prop("empty", { headline: "", note: "" }),
      prop("blank", { headline: "   ", note: " \n " }),
      prop("noteOnly", { headline: "", note: "The owner's note" }),
      prop("headlineOnly", { note: "" }),
    ]);
    expect(result.selections.map(selection => selection.propId)).toEqual(["noteOnly", "headlineOnly"]);
    expect(result.skipped).toEqual(["empty", "blank"].map(id => ({ propId: id, productName: `Product ${id}`, reason: "NEEDS_A_LINE" })));
  });

  it("never selects a discovery draft, whatever its words", () => {
    const discovery = prepareImportedProp({ product: { slug: "clay", name: "Clay", domain: "clay.com", description: "" }, canonicalUrl: "https://clay.com", signalIndexes: [0] }, "GMAIL");
    const result = shareAllSelections([prop("draft", { ...discovery, product: { name: "Clay", domain: "clay.com" } })]);
    expect(result).toEqual({ selections: [], skipped: [], remainingCount: 0 });
  });

  it("shares the first 100 shareable cards in collection order and counts the rest", () => {
    const props = [prop("bad", { primaryLink: { type: "CANONICAL", url: "javascript:alert(1)", label: "Open" } }),
      ...Array.from({ length: SHARE_ALL_MAX + OVERFLOW }, (_, index) => prop(`p${index}`))];
    const result = shareAllSelections(props);
    expect(SHARE_ALL_MAX).toBe(EXPECTED_BATCH);
    expect(result.selections.map(selection => selection.propId)).toEqual(Array.from({ length: EXPECTED_BATCH }, (_, index) => `p${index}`));
    expect(result.remainingCount).toBe(OVERFLOW);
    expect(result.skipped).toEqual([{ propId: "bad", productName: "Product bad", reason: "LINK_NEEDS_REVIEW" }]);
  });
});
