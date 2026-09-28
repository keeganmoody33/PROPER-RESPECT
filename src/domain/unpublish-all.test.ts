import { describe, expect, it } from "vitest";
import { unpublishAllSelections } from "./review";

const card = (id: string, slug: string, published: boolean, version = 3) => ({
  prop: { _id: id, visibility: published ? "PUBLIC" as const : "PRIVATE" as const, status: "ACTIVE" as const, headline: `H ${id}`, note: `N ${id}`, relationshipVersion: version },
  product: { domain: `${slug}.example`, slug },
  links: [],
  isPublishedAtCurrentHandle: published,
});

describe("unpublishAllSelections (R15)", () => {
  it("unpublishes every relationship of each product that has a published card", () => {
    const selections = unpublishAllSelections([
      card("a1", "alpha", true), card("a2", "alpha", false),
      card("b1", "beta", false),
      card("c1", "gamma", true),
    ], true);
    // a2 is included so an older card shared by alpha's relationships is removed too.
    expect(selections.map(selection => selection.propId)).toEqual(["a1", "a2", "c1"]);
    for (const selection of selections) {
      expect(selection).toMatchObject({ publish: false, autoRefresh: false, expectedRelationshipVersion: 3 });
      expect(selection).not.toHaveProperty("primaryLink");
      expect(selection).not.toHaveProperty("activity");
    }
  });

  it("carries each relationship's saved status, headline and note", () => {
    expect(unpublishAllSelections([card("a1", "alpha", true)], true)[0])
      .toMatchObject({ status: "ACTIVE", headline: "H a1", note: "N a1" });
  });

  it("omits the relationship version when private saves are unavailable", () => {
    expect(unpublishAllSelections([card("a1", "alpha", true)], false)[0]).not.toHaveProperty("expectedRelationshipVersion");
  });

  it("returns nothing when no card is published", () => {
    expect(unpublishAllSelections([card("a1", "alpha", false)], true)).toEqual([]);
  });
});
