import { load } from "cheerio";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import { InventoryRelationshipDetails, type InventoryData, type InventoryEvidence } from "../../components/private-inventory";

const item: InventoryData["cards"][number] = {
  prop: { _id: "test-prop" as Id<"props">, _creationTime: 1, productId: "test-product" as Id<"products">, userId: "test-owner" as Id<"users">,
    visibility: "DRAFT", status: "TESTING", headline: "Proposed relationship", note: "Proposed from a capture, not an owner explanation." },
  product: { _id: "test-product" as Id<"products">, _creationTime: 1, name: "Example product", slug: "example", domain: "", description: "", brand: undefined },
  links: [], previousStatuses: [],
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
