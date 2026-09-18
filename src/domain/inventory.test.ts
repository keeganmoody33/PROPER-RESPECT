import { expect, test } from "vitest";
import { inInventoryView, relationshipEditSchema } from "./inventory";

test("collection views overlap through recorded history and go-to stays explicitly owner-selected", () => {
  const item = { prop: { status: "ACTIVE" as const, visibility: "PRIVATE", goTo: true }, previousStatuses: ["TESTING"] };
  for (const view of ["All", "Current", "Go-to", "History"] as const) expect(inInventoryView(view, item)).toBe(true);
  expect(inInventoryView("Testing", item)).toBe(false);
  expect(inInventoryView("Go-to", { ...item, prop: { ...item.prop, goTo: false } })).toBe(false);
  const archived = { ...item, prop: { ...item.prop, status: "ARCHIVED" as const } };
  expect(inInventoryView("Archived", archived)).toBe(true);
  expect(inInventoryView("Go-to", archived)).toBe(false);
  expect(archived.prop.goTo).toBe(true);
  const discovery = { ...item, prop: { status: "TESTING" as const, visibility: "DRAFT" } };
  expect(inInventoryView("Discoveries", discovery)).toBe(true);
  expect(inInventoryView("Testing", discovery)).toBe(false);
});

test("relationship context is optional; dates and credential-free HTTPS work links are validated", () => {
  const edit = { status: "TESTING", goTo: false, headline: "", note: "" };
  expect(relationshipEditSchema.parse(edit).startedAt).toBeUndefined();
  for (const supportingUrl of ["javascript:alert(1)", "https://user:secret@example.com", "http://example.com"]) expect(relationshipEditSchema.safeParse({ ...edit, supportingUrl }).success).toBe(false);
  expect(relationshipEditSchema.safeParse({ ...edit, startedAt: "2026-02-30" }).success).toBe(false);
  expect(relationshipEditSchema.safeParse({ ...edit, note: "a".repeat(4001) }).success).toBe(false);
});
