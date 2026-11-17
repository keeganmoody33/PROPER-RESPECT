import { describe, expect, it } from "vitest";
import { ownerLine } from "./system-lines";
import { shareAllSelections, type ShareAllProp } from "./share-all";
import { projectVisiblePublicProfile } from "./visible-public-profile";
import { e2eReferenceProfile } from "../data/e2e-reference-profile";

describe("ownerLine", () => {
  it.each([
    "GitHub is in my stack.",
    "GitHub may be in your stack.",
    "GitHub: uploaded evidence to review.",
    "Connected activity is private until I approve this card.",
    "This file has not been interpreted as product use. Review it before describing your relationship.",
    "Proposed from signup email evidence. Review before publishing.",
    "  GitHub is in my stack.  ",
    "",
    "   ",
  ])("treats %j as no line: the app wrote it, or nobody wrote anything", text => {
    expect(ownerLine(text, "GitHub")).toBe("");
  });

  it.each([
    "Where the receipts live.",
    "GitHub is in my stack, and I mean it.",
    "Clay is in my stack.",
  ])("keeps %j, which the owner wrote", text => {
    expect(ownerLine(text, "GitHub")).toBe(text);
  });
});

const prop = (overrides: Partial<ShareAllProp<string, never>>): ShareAllProp<string, never> => ({
  propId: "prop", visibility: "PRIVATE", onPublishedPage: false, matchesUnresolvedPublishedCard: false, relationshipVersion: 1,
  status: "ACTIVE", headline: "", note: "", product: { name: "GitHub", domain: "github.com" }, ...overrides,
});

it("share-all holds back an older card whose only words are ones the app wrote", () => {
  const { selections, skipped } = shareAllSelections([
    prop({ propId: "legacy", headline: "GitHub is in my stack.", note: "Connected activity is private until I approve this card." }),
    prop({ propId: "owned", headline: "Where the receipts live." }),
  ]);
  expect(selections.map(selection => selection.propId)).toEqual(["owned"]);
  expect(skipped).toEqual([{ propId: "legacy", productName: "GitHub", reason: "NEEDS_A_LINE" }]);
});

it("a visitor never sees a line the app wrote on an older published card", () => {
  const [first] = e2eReferenceProfile.cards;
  const name = first.product.name;
  const visible = projectVisiblePublicProfile({ ...e2eReferenceProfile, cards: [
    { ...first, headline: `${name} is in my stack.`, note: "Connected activity is private until I approve this card." },
    { ...first, headline: "", note: "My own note." },
  ] });
  expect(visible.cards.map(card => [card.headline, card.note])).toEqual([["", ""], ["My own note.", "My own note."]]);
});
