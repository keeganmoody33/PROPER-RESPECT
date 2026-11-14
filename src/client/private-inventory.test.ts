import { load } from "cheerio";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import { InventoryRelationshipDetails, PrivateInventoryView, type InventoryData, type InventoryEvidence } from "../../components/private-inventory";
import { ObservedStartDateAction } from "../../components/private-evidence-panel";

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

test("relationship fields, independent evidence forms, private save, and optional metadata follow the same reading order", () => {
  const $ = load(renderToStaticMarkup(createElement(InventoryRelationshipDetails, {
    focused: true, item, evidence: [testimony], onSave: vi.fn(),
    renderEvidence: () => createElement("form", { "aria-label": "Synthetic evidence correction" }, createElement("button", { type: "submit" }, "Correct synthetic evidence")),
  })));
  const relationship = $('select[name="level"]').closest("form");
  const formId = relationship.attr("id");
  expect(formId).toBeTruthy();
  expect($('input[name="supportingUrl"]').attr("form")).toBe(formId);
  expect(relationship.find('input[name="supportingUrl"]')).toHaveLength(0);
  expect($('form[aria-label="Synthetic evidence correction"]').parents("form")).toHaveLength(0);
  const save = $('button[type="submit"][form]');
  expect(save.attr("form")).toBe(formId);
  const nodes = $("*").toArray();
  const evidence = $('aside[aria-label="Evidence for Example product"]');
  const extras = $('input[name="supportingUrl"]').closest("details");
  expect(nodes.indexOf(relationship[0])).toBeLessThan(nodes.indexOf(evidence[0]));
  expect(nodes.indexOf(evidence[0])).toBeLessThan(nodes.indexOf(save[0]));
  expect(nodes.indexOf(save[0])).toBeLessThan(nodes.indexOf(extras[0]));
  expect(extras.attr("open")).toBeUndefined();
});

test("relationship evidence receives an explicit draft-date action without saving", () => {
  const save = vi.fn();
  const $ = load(renderToStaticMarkup(createElement(InventoryRelationshipDetails, {
    item, evidence: [], onSave: save,
    renderEvidence: (_item, controls) => controls && createElement(ObservedStartDateAction, {
      observation: { kind: "FIRST_USE", scope: "PERSONAL", date: "2024-06-03", excerpt: "Used this tool on 2024-06-03", acquisition: "USER_SUPPLIED" },
      verdict: "CORRECT", ...controls,
    }),
  })));
  expect($("button").text()).toContain("Use this observed date as my start date");
  expect($('input[name="startedAt"]').attr("value")).toBe("");
  expect(save).not.toHaveBeenCalled();
});

test("a short retained answer stays with its original question and is not silently rewritten into an owner explanation", () => {
  const html = renderToStaticMarkup(createElement(InventoryRelationshipDetails, { item, evidence: [testimony], onSave: vi.fn() }));
  const $ = load(html);
  expect($.text()).toContain("Did you use this to dictate notes?");
  expect($.text()).toContain("Yes, correct.");
  expect($('textarea[name="note"]').text()).toBe("");
  expect($('select[name="level"] option[selected]').attr("value")).toBe("");
  expect($('input[name="goTo"]').attr("checked")).toBeUndefined();
});

test("the owner's manual note is reused for private review without confirming a relationship", () => {
  const manual = { ...item, prop: { ...item.prop, ownerEntered: true, note: "An essential occasional workflow." } };
  const $ = load(renderToStaticMarkup(createElement(InventoryRelationshipDetails, { item: manual, evidence: [], onSave: vi.fn() })));
  expect($('textarea[name="note"]').text()).toBe("An essential occasional workflow.");
  expect($('select[name="level"] option[selected]').attr("value")).toBe("");
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

test.each(["UNVERIFIED_LEGACY", "VERIFIED_OWNER_SESSION"] as const)("uploaded context distinguishes %s without claiming usage or authorship", (attribution) => {
  const source: InventoryEvidence[number] = {
    ...testimony, sourceType: "FILE_UPLOAD", sourceLabel: "Private uploaded original",
    ownerStatement: undefined, ownerStatementQuestion: undefined,
    uploadedFile: { filename: "export.json", mimeType: "application/json", byteSize: 100, attribution },
  };
  const $ = load(renderToStaticMarkup(createElement(InventoryRelationshipDetails, { item, evidence: [source], onSave: vi.fn() })));
  expect($.text()).toContain(attribution === "UNVERIFIED_LEGACY" ? "original uploader is unverified" : "authorship and product usage are not verified");
  expect($('input[name="goTo"]').attr("checked")).toBeUndefined();
});

test("the editor offers the seven levels; a card saved before levels shows no level and its fallback wording", () => {
  const older = { ...item, prop: { ...item.prop, visibility: "PRIVATE" as const, status: "ARCHIVED" as const, relationshipVersion: 2, confirmedAt: "2026-01-01T00:00:00.000Z", goTo: true } };
  const $ = load(renderToStaticMarkup(createElement(InventoryRelationshipDetails, { item: older, evidence: [], onSave: vi.fn() })));
  const select = $('select[name="level"]');
  expect(select.attr("required")).toBeDefined();
  expect(select.find("option").map((_, node) => [[$(node).attr("value"), $(node).text()]]).get()).toEqual([
    ["", "Used before: choose how often"],
    ["TRIED_NOT_ADOPTED", "Tried, didn't adopt"], ["STOPPED", "Stopped using"], ["PAUSED", "Paused"], ["OCCASIONAL", "Occasionally"],
    ["TESTING", "Testing"], ["WEEKLY", "Weekly"], ["DAILY", "Daily"],
  ]);
  expect(select.find("option[selected]").attr("value")).toBe("");
  expect($(`#${select.attr("aria-describedby")}`).text()).toBe("Pick the level that matches how you use it now.");
  expect($('input[name="goTo"]').attr("checked")).toBeDefined();
  expect($.text().toLowerCase()).not.toContain("archiv");
  const view = load(renderToStaticMarkup(createElement(PrivateInventoryView, { data: { cards: [older], hasMore: false }, onSave: vi.fn(), onImport: vi.fn() })));
  expect(view(".card-title .eyebrow").text()).toBe("Used before");
  expect(view("nav button").map((_, node) => view(node).text()).get()).toContain("Used before");
  expect(view.text().toLowerCase()).not.toContain("archiv");
});

test("a card with a level shows it selected with its definition, beside an unchanged go-to control", () => {
  const leveled = { ...item, prop: { ...item.prop, visibility: "PRIVATE" as const, status: "ACTIVE" as const, level: "OCCASIONAL" as const, relationshipVersion: 1, confirmedAt: "2026-01-01T00:00:00.000Z", goTo: true, startedAt: "2023-02-03" } };
  const $ = load(renderToStaticMarkup(createElement(InventoryRelationshipDetails, { item: leveled, evidence: [], onSave: vi.fn() })));
  const select = $('select[name="level"]');
  expect(select.find("option[selected]").attr("value")).toBe("OCCASIONAL");
  expect($(`#${select.attr("aria-describedby")}`).text()).toBe("I reach for it less than once a week, when a job needs it.");
  expect($('input[name="goTo"]').attr("checked")).toBeDefined();
  const view = load(renderToStaticMarkup(createElement(PrivateInventoryView, { data: { cards: [leveled], hasMore: false }, onSave: vi.fn(), onImport: vi.fn() })));
  expect(view(".card-title .eyebrow").text()).toBe("Occasionally · since 2023");
  expect(view(".card-footer .card-go-to").text()).toBe("Owner-selected go-to");
});
