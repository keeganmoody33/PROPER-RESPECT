import { load } from "cheerio";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import { InventoryRelationshipDetails, PrivateInventoryView, type InventoryData, type InventoryEvidence } from "../../components/private-inventory";

const item: InventoryData["cards"][number] = {
  prop: { _id: "test-prop" as Id<"props">, _creationTime: 1, productId: "test-product" as Id<"products">, userId: "test-owner" as Id<"users">,
    visibility: "DRAFT", status: "TESTING", headline: "Proposed relationship", note: "Proposed from a capture, not an owner explanation." },
  product: { _id: "test-product" as Id<"products">, _creationTime: 1, name: "Example product", slug: "example", domain: "", description: "", brand: undefined },
  links: [], previousStatuses: [], associatedAccountEvidence: [],
};
const testimony: InventoryEvidence[number] = {
  id: "test-evidence" as Id<"rawEvidence">, capturedAt: "2026-09-18T12:00:00.000Z", sourceType: "MANUAL", sourceLabel: "Recorded owner answer",
  captureProvenance: undefined, artifact: undefined, suggestedActivity: undefined, originalText: undefined,
  limitations: [], observationCount: 0, ownerStatementQuestion: "Did you use this to dictate notes?", ownerStatement: "Yes, correct.",
};

test("a short retained answer stays with its original question and is not silently rewritten into an owner explanation", () => {
  const html = renderToStaticMarkup(createElement(InventoryRelationshipDetails, { item, evidence: [testimony], onSave: vi.fn() }));
  const $ = load(html);
  expect($.text()).toContain("Did you use this to dictate notes?");
  expect($.text()).toContain("Yes, correct.");
  expect($('textarea[name="note"]').text()).toBe("");
  expect($('select[name="status"] option[selected]').attr("value")).toBe("");
  expect($('input[name="goTo"]').attr("checked")).toBeUndefined();
});

test("the owner's manual note is reused for private review without confirming a relationship", () => {
  const manual = { ...item, prop: { ...item.prop, ownerEntered: true, note: "An essential occasional workflow." } };
  const $ = load(renderToStaticMarkup(createElement(InventoryRelationshipDetails, { item: manual, evidence: [], onSave: vi.fn() })));
  expect($('textarea[name="note"]').text()).toBe("An essential occasional workflow.");
  expect($('select[name="status"] option[selected]').attr("value")).toBe("");
  expect($('input[name="goTo"]').attr("checked")).toBeUndefined();
  expect($.text()).toContain("Confirm and save privately");
});

test("the private GitHub card opens the associated account instead of the vendor homepage", () => {
  const githubItem: InventoryData["cards"][number] = {
    ...item,
    product: { ...item.product, name: "GitHub", slug: "github", domain: "github.com", description: "Code" },
    links: [{
      _id: "test-link" as Id<"links">, _creationTime: 1, propId: item.prop._id,
      type: "CANONICAL", url: "https://github.com", label: "Check out GitHub", isPrimary: true,
    }],
    associatedAccountEvidence: [{
      relationshipOwnerId: item.prop.userId,
      evidenceOwnerId: item.prop.userId,
      productSlug: "github",
      accountId: "synthetic-account",
      url: "https://github.com/synthetic-account",
    }],
  };
  const $ = load(renderToStaticMarkup(createElement(PrivateInventoryView, {
    data: { cards: [githubItem], hasMore: false }, onSave: vi.fn(), onImport: vi.fn(),
  })));
  expect($('a[href="https://github.com/synthetic-account"]')).toHaveLength(2);
  expect($('a.card-visit').attr("href")).toBe("https://github.com/synthetic-account");
  expect($('a.card-visit').attr("aria-label")).toBe("Check out GitHub (opens in a new tab)");
  expect($("a.outbound-link").attr("href")).toBe("https://github.com/synthetic-account");
  expect($("a.outbound-link").text()).toContain("Check out GitHub");
  expect($('a[href="https://github.com"]')).toHaveLength(0);
});

test("one visible product retains every record and keeps same-domain products separate", () => {
  const sibling = { ...item, prop: { ...item.prop, _id: "second-prop" as Id<"props">, headline: "Different retained decision", visibility: "PRIVATE" as const, status: "ACTIVE" as const } };
  const separate = { ...item, prop: { ...item.prop, _id: "copilot-prop" as Id<"props">, productId: "copilot-product" as Id<"products"> }, product: { ...item.product, _id: "copilot-product" as Id<"products">, name: "Copilot", slug: "github-copilot" } };
  const before = JSON.stringify([item, sibling, separate]);
  const save = vi.fn();
  const $ = load(renderToStaticMarkup(createElement(PrivateInventoryView, {
    data: { cards: [item, sibling, separate], hasMore: true }, onSave: save, onImport: vi.fn(),
  })));
  expect($("article.product-card")).toHaveLength(2);
  expect($("select option").map((_, node) => $(node).attr("value")).get()).toEqual(["test-prop", "second-prop"]);
  expect($.text()).toContain("Different retained decision");
  expect($.text()).toContain("Selecting a record does not merge, confirm, or publish it");
  expect($.text()).toContain("More records, including other records for these products");
  expect(save).not.toHaveBeenCalled();
  expect(JSON.stringify([item, sibling, separate])).toBe(before);
});

test("accumulated pages never render a second card for the same owner and product", () => {
  const laterPage = { ...item, prop: { ...item.prop, _id: "later-prop" as Id<"props"> } };
  for (const cards of [[item], [item, laterPage]]) {
    const $ = load(renderToStaticMarkup(createElement(PrivateInventoryView, {
      data: { cards, hasMore: cards.length === 1 }, onSave: vi.fn(), onImport: vi.fn(),
    })));
    expect($("article.product-card")).toHaveLength(1);
  }
});
