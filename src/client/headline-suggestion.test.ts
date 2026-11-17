import { describe, expect, it } from "vitest";
import { shareAllSelections } from "@/src/domain/share-all";
import { headlineField, headlineHelp, initialOwnerHeadline } from "./headline-suggestion";

const SUGGESTION = "I use Clay daily to build target account lists.";
const clay = { productName: "Clay", productSlug: "clay", confirmed: true, status: "ACTIVE" as const };

describe("headline field", () => {
  it("shows an untouched suggestion but saves nothing for it, so the card can't be shared on it", () => {
    const field = headlineField(initialOwnerHeadline(""), SUGGESTION);
    expect(field).toEqual({ value: SUGGESTION, suggested: true, toSave: "" });
    const share = shareAllSelections([{ propId: "clay", visibility: "PRIVATE", onPublishedPage: false, matchesUnresolvedPublishedCard: false,
      status: "ACTIVE", headline: field.toSave, note: "", product: { name: "Clay", domain: "clay.com" } }]);
    expect(share.selections).toEqual([]);
    expect(share.skipped).toEqual([{ propId: "clay", productName: "Clay", reason: "NEEDS_A_LINE" }]);
  });

  it("saves the suggestion once the owner keeps it, and the owner's own words once they edit it", () => {
    expect(headlineField(SUGGESTION, SUGGESTION)).toEqual({ value: SUGGESTION, suggested: false, toSave: SUGGESTION });
    expect(headlineField("Where the receipts live.", SUGGESTION)).toEqual({ value: "Where the receipts live.", suggested: false, toSave: "Where the receipts live." });
    // Clearing the field is the owner's choice too: the suggestion doesn't come back.
    expect(headlineField("", SUGGESTION)).toEqual({ value: "", suggested: false, toSave: "" });
  });

  it("keeps a saved line, and follows the answers while the suggestion is untouched", () => {
    expect(initialOwnerHeadline("Talking is faster than typing.")).toBe("Talking is faster than typing.");
    expect(initialOwnerHeadline("   ")).toBeNull();
    const untouched = initialOwnerHeadline("");
    expect(headlineField(untouched, "I use Clay most weeks.").value).toBe("I use Clay most weeks.");
    expect(headlineField(untouched, undefined)).toEqual({ value: "", suggested: false, toSave: "" });
  });
});

describe("headline help", () => {
  it("prefills a suggestion for a product with listed uses", () => {
    expect(headlineHelp({ ...clay, level: "DAILY", uses: ["build target account lists"], startedAt: "" }))
      .toEqual({ suggestion: SUGGESTION });
    expect(headlineHelp({ ...clay, level: "DAILY", uses: [], startedAt: "2023-04-01" }))
      .toEqual({ suggestion: "I've used Clay daily since 2023." });
  });

  it("offers a product without listed uses an example as a placeholder, never a value", () => {
    expect(headlineHelp({ productName: "Field Notes", productSlug: "manual-field-notes", confirmed: true, status: "ACTIVE", level: "WEEKLY", uses: [], startedAt: "" }))
      .toEqual({ placeholder: "I use Field Notes most weeks." });
  });

  it("suggests nothing for a discovery until its owner picks a level", () => {
    expect(headlineHelp({ ...clay, confirmed: false, status: "TESTING", uses: [], startedAt: "" })).toEqual({});
    expect(headlineHelp({ ...clay, confirmed: false, status: "TESTING", level: "TESTING", uses: [], startedAt: "" }))
      .toEqual({ suggestion: "I'm testing Clay and haven't decided yet." });
  });
});
