import { expect, test } from "vitest";
import { inInventoryView, relationshipEditSchema } from "./inventory";
import { RELATIONSHIP_LEVELS } from "./relationship-level";

test("collection views overlap through recorded history and go-to stays explicitly owner-selected", () => {
  const item = { prop: { status: "ACTIVE" as const, visibility: "PRIVATE", goTo: true }, previousStatuses: ["TESTING"] };
  for (const view of ["All", "Current", "Go-to", "History"] as const) expect(inInventoryView(view, item)).toBe(true);
  expect(inInventoryView("Testing", item)).toBe(false);
  expect(inInventoryView("Go-to", { ...item, prop: { ...item.prop, goTo: false } })).toBe(false);
  const archived = { ...item, prop: { ...item.prop, status: "ARCHIVED" as const } };
  expect(inInventoryView("Used before", archived)).toBe(true);
  expect(inInventoryView("Go-to", archived)).toBe(false);
  expect(archived.prop.goTo).toBe(true);
  const discovery = { ...item, prop: { status: "TESTING" as const, visibility: "DRAFT" } };
  expect(inInventoryView("Discoveries", discovery)).toBe(true);
  expect(inInventoryView("Testing", discovery)).toBe(false);
});

test("each level lands in the view its status implies, and Go-to still reads only the go-to mark", () => {
  const views = ["Current", "Testing", "Go-to", "History", "Used before"] as const;
  const placed = RELATIONSHIP_LEVELS.map(level => {
    const card = { prop: { status: level.status, level: level.key, visibility: "PRIVATE", goTo: level.key === "OCCASIONAL" }, previousStatuses: [] };
    return [level.key, views.filter(view => inInventoryView(view, card))];
  });
  expect(placed).toEqual([
    ["TRIED_NOT_ADOPTED", ["History", "Used before"]],
    ["STOPPED", ["History", "Used before"]],
    ["PAUSED", ["History", "Used before"]],
    ["OCCASIONAL", ["Current", "Go-to"]],
    ["TESTING", ["Testing"]],
    ["WEEKLY", ["Current"]],
    ["DAILY", ["Current"]],
  ]);
});

test("an edit's level must match its status", () => {
  const edit = { goTo: false, headline: "", note: "" };
  expect(relationshipEditSchema.parse({ ...edit, status: "ARCHIVED", level: "PAUSED" }).level).toBe("PAUSED");
  expect(relationshipEditSchema.safeParse({ ...edit, status: "ACTIVE", level: "PAUSED" }).error?.issues.map(issue => issue.message))
    .toEqual(["This level does not match its status. Choose the level again."]);
  expect(relationshipEditSchema.safeParse({ ...edit, status: "ACTIVE", level: "CO_SIGN" }).success).toBe(false);
});

test("relationship context is optional; dates and credential-free HTTPS work links are validated", () => {
  const edit = { status: "TESTING", goTo: false, headline: "", note: "" };
  expect(relationshipEditSchema.parse(edit).startedAt).toBeUndefined();
  for (const supportingUrl of ["javascript:alert(1)", "https://user:secret@example.com", "http://example.com"]) expect(relationshipEditSchema.safeParse({ ...edit, supportingUrl }).success).toBe(false);
  expect(relationshipEditSchema.safeParse({ ...edit, startedAt: "2026-02-30" }).success).toBe(false);
  expect(relationshipEditSchema.safeParse({ ...edit, note: "a".repeat(4001) }).success).toBe(false);
});

test("a work link that isn't a URL gets the rule's message, not a TypeError", () => {
  const result = relationshipEditSchema.safeParse({ status: "TESTING", goTo: false, headline: "", note: "", supportingUrl: "not a url" });
  expect(result.success).toBe(false);
  expect(result.error?.issues.map(issue => issue.message)).toContain("Use an HTTPS work sample or workflow link without credentials.");
});
