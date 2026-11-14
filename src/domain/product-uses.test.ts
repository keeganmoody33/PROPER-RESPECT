import { expect, test } from "vitest";
import { listedUses, normalizeUses, productUsesSchema, productUseLabels, productUseOptions, USE_OTHER_MAX, USE_PICK_ID_MAX, USE_PICKS_MAX } from "./product-uses";

test("saving refuses a pick that isn't one of the product's choices, with a message the owner can act on", () => {
  expect(normalizeUses("clay", { picks: ["enrich-leads", "write-features"] })).toEqual({ ok: false, message: "Choose from the listed uses." });
});

test("saving drops repeated picks and keeps them in the order the product lists them", () => {
  expect(normalizeUses("clay", { picks: ["sync-crm", "enrich-leads", "sync-crm"] }))
    .toEqual({ ok: true, uses: { picks: ["enrich-leads", "sync-crm"] } });
});

test("saving trims the owner's own words and drops them when nothing is left", () => {
  expect(normalizeUses("clay", { picks: ["build-lists"], other: "  score inbound leads  " }))
    .toEqual({ ok: true, uses: { picks: ["build-lists"], other: "score inbound leads" } });
  expect(normalizeUses("clay", { picks: ["build-lists"], other: "   " }))
    .toEqual({ ok: true, uses: { picks: ["build-lists"] } });
});

test("saving nothing stores nothing", () => {
  expect(normalizeUses("clay", { picks: [], other: " " })).toEqual({ ok: true, uses: undefined });
  expect(normalizeUses("clay", undefined)).toEqual({ ok: true, uses: undefined });
});

test("a product without listed choices offers none and accepts only the owner's own words", () => {
  expect(productUseOptions("wisprflow")).toEqual([]);
  expect(normalizeUses("wisprflow", { picks: [], other: "dictate long messages" }))
    .toEqual({ ok: true, uses: { picks: [], other: "dictate long messages" } });
  expect(normalizeUses("wisprflow", { picks: ["enrich-leads"] })).toEqual({ ok: false, message: "Choose from the listed uses." });
});

test("showing a card's uses drops unknown ids, follows the product's order and puts the owner's words last", () => {
  expect(productUseLabels("clay", { picks: ["sync-crm", "retired-choice", "enrich-leads"], other: "score inbound leads" }))
    .toEqual(["enrich lead and account lists", "keep my CRM records filled in", "score inbound leads"]);
  expect(productUseLabels("clay", { picks: ["build-lists"], other: "build target account lists" })).toEqual(["build target account lists"]);
  expect(productUseLabels("wisprflow", { picks: ["enrich-leads"] })).toEqual([]);
  expect(productUseLabels("clay", undefined)).toEqual([]);
});

test("a published card keeps only the picks the product still lists, in its order, and the owner's trimmed words", () => {
  expect(listedUses("clay", { picks: ["sync-crm", "retired-choice", "enrich-leads"], other: "  score inbound leads " }))
    .toEqual({ picks: ["enrich-leads", "sync-crm"], other: "score inbound leads" });
  expect(listedUses("clay", { picks: ["build-lists"], other: "  " })).toEqual({ picks: ["build-lists"] });
  expect(listedUses("clay", { picks: ["retired-choice"], other: "score inbound leads" })).toEqual({ picks: [], other: "score inbound leads" });
});

test("a published card gets no uses when none of them is still listed", () => {
  expect(listedUses("clay", { picks: ["retired-choice"], other: " " })).toBeUndefined();
  expect(listedUses("wisprflow", { picks: ["enrich-leads"] })).toBeUndefined();
  expect(listedUses("clay", undefined)).toBeUndefined();
});

test("the stored shape caps picks, pick length and the owner's own words", () => {
  const pick = "a".repeat(USE_PICK_ID_MAX);
  expect(productUsesSchema.parse({ picks: [pick], other: `  ${"b".repeat(USE_OTHER_MAX)}  ` }))
    .toEqual({ picks: [pick], other: "b".repeat(USE_OTHER_MAX) });
  expect(productUsesSchema.safeParse({ picks: [`${pick}a`] }).success).toBe(false);
  expect(productUsesSchema.safeParse({ picks: Array.from({ length: USE_PICKS_MAX + 1 }, (_, index) => `pick-${index}`) }).success).toBe(false);
  expect(productUsesSchema.safeParse({ picks: [], other: "b".repeat(USE_OTHER_MAX + 1) }).success).toBe(false);
});
