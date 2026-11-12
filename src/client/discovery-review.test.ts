import { load } from "cheerio";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "../../convex/_generated/dataModel";
import type { api } from "../../convex/_generated/api";
import { DiscoveryResolutionView } from "../../components/discovery-review";

type Detail = FunctionReturnType<typeof api.discoveryReview.details>;
const detail: Detail = {
  id: "draft" as Id<"draftImports">, name: "GitHub",
  sources: [{ id: "original" as Id<"rawEvidence">, sourceType: "GITHUB", capturedAt: "2026-09-19T00:00:00.000Z", deleted: false }],
  batch: { offset: 0, end: 1, total: 1, skippedDeleted: 0 }, target: null, expectedHash: undefined,
};
const candidate = { id: "prop" as Id<"props">, headline: "My work record", note: "Saved owner explanation", status: "ACTIVE" as const, confirmed: true, goTo: false, expectedHash: "current-hash" };
const props = { detail, candidates: [candidate], hasMoreCandidates: false, loadingMore: false, onLoadMore: vi.fn(), onAttach: vi.fn() };

test("initial relationship attachment requires an explicit choice even with only one candidate", () => {
  const $ = load(renderToStaticMarkup(createElement(DiscoveryResolutionView, props)));
  expect($("select option[selected]").attr("value")).toBe("");
  expect($("select").attr("required")).toBeDefined();
  expect($("button[type=submit]").attr("disabled")).toBeDefined();
  expect($.text()).toContain("My work record");
  expect($.text()).toContain("GITHUB");
  expect($.text()).toContain("2026-09-19T00:00:00.000Z");
  expect($.text()).toContain("saved decisions and public profile unchanged");
});

test("a durable bound target offers Continue with exact batch progress and no retarget selector", () => {
  const current: Detail = { ...detail, target: candidate, expectedHash: "resume-hash", batch: { offset: 100, end: 200, total: 205, skippedDeleted: 3 } };
  const $ = load(renderToStaticMarkup(createElement(DiscoveryResolutionView, { ...props, detail: current, candidates: [] })));
  expect($("select")).toHaveLength(0);
  expect($("button[type=submit]").text()).toBe("Continue attachment (101–200)");
  expect($("button[type=submit]").attr("disabled")).toBeUndefined();
  expect($.text()).toContain("100 of 205 reviewed originals processed. 3 deleted originals excluded.");
  expect($.text()).toContain("Chosen relationship: My work record");
});

test("deleted originals stay labeled and completed attachments cannot be submitted again", () => {
  const current: Detail = { ...detail, target: candidate, expectedHash: "complete-hash", sources: [{ ...detail.sources[0], deleted: true }], batch: { offset: 1, end: 1, total: 1, skippedDeleted: 1 } };
  const $ = load(renderToStaticMarkup(createElement(DiscoveryResolutionView, { ...props, detail: current })));
  expect($.text()).toContain("Deleted; excluded from attachment");
  expect($("button[type=submit]").text()).toBe("Attachment complete");
  expect($("button[type=submit]").attr("disabled")).toBeDefined();
});

test("candidate continuation remains available and zero matches remain explicit", () => {
  const more = load(renderToStaticMarkup(createElement(DiscoveryResolutionView, { ...props, candidates: [], hasMoreCandidates: true })));
  expect(more('button[type="button"]').text()).toBe("Load more matching relationships");
  const empty = load(renderToStaticMarkup(createElement(DiscoveryResolutionView, { ...props, candidates: [] })));
  expect(empty.text()).toContain("No matching saved relationships are available.");
  expect(empty('button[type="submit"]').attr("disabled")).toBeDefined();
});

test("owner source labels distinguish retained accounts while unlabeled sources retain their honest type and time", () => {
  const current: Detail = { ...detail, sources: [{ ...detail.sources[0], sourceLabel: "Synthetic personal GitHub" }, { ...detail.sources[0], id: "second-original" as Id<"rawEvidence"> }] };
  const $ = load(renderToStaticMarkup(createElement(DiscoveryResolutionView, { ...props, detail: current })));
  expect($("li").eq(0).text()).toBe("Synthetic personal GitHub · GITHUB · 2026-09-19T00:00:00.000Z · Retained original");
  expect($("li").eq(1).text()).toBe("GITHUB · 2026-09-19T00:00:00.000Z · Retained original");
});

test("candidates and the chosen target read their level or fallback words, never a raw status", () => {
  const archived = { ...candidate, id: "archived" as Id<"props">, status: "ARCHIVED" as const };
  const paused = { ...candidate, id: "paused" as Id<"props">, status: "ARCHIVED" as const, level: "PAUSED" as const };
  const $ = load(renderToStaticMarkup(createElement(DiscoveryResolutionView, { ...props, candidates: [archived, paused] })));
  expect($("select option").map((_, node) => $(node).text()).get().slice(1)).toEqual(["My work record · Used before", "My work record · Paused"]);
  const bound = load(renderToStaticMarkup(createElement(DiscoveryResolutionView, { ...props, detail: { ...detail, target: paused, expectedHash: "hash" }, candidates: [] })));
  expect(bound.text()).toContain("Chosen relationship: My work record · Paused.");
  expect(bound.text().toLowerCase()).not.toContain("archived");
});
