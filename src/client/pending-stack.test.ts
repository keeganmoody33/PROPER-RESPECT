import { expect, test } from "vitest";
import { directoryEntry } from "@/src/domain/product-directory";
import { PENDING_STACK_MAX_CHARS, PENDING_WEBSITE_MAX, parsePendingStack, pendingStackValue, restorablePicks, serializePendingStack } from "./pending-stack";
import { emptyTray, TRAY_LIMIT, TYPED_NAME_MAX, trayReducer, type Tray, type TrayEntry } from "./stack-tray";
import { resolveTypedPick } from "./typed-pick";

const directory = { entry: directoryEntry, resolveTypedPick };
const firecrawl: TrayEntry = { slug: "firecrawl", name: "Firecrawl", domain: "firecrawl.dev" };
const clay: TrayEntry = { slug: "clay", name: "Clay", domain: "clay.com" };
const BUILT = 3;
const NEXT_VERSION = 2;
const pick = { kind: "directory", slug: "clay", status: "ACTIVE" };
const FIELD_NOTES_KEY = 'typed:["field notes","field-notes.example"]';

function restore(raw: string | null, held: readonly string[] = [], tray: Tray = emptyTray): Tray {
  return trayReducer(tray, { type: "restore", picks: restorablePicks(parsePendingStack(raw), directory), held });
}

function built(): Tray {
  let tray = trayReducer(emptyTray, { type: "addStarterSet", entries: [firecrawl, clay], held: [] });
  tray = trayReducer(tray, { type: "addTyped", name: "Field Notes", website: "field-notes.example", resolution: { kind: "typed", domain: "field-notes.example" }, held: [] });
  tray = trayReducer(tray, { type: "setStatus", key: "directory:firecrawl", status: "TESTING" });
  return trayReducer(tray, { type: "setStatus", key: "directory:clay", status: "ARCHIVED" });
}

test("a list round-trips with every status and typed website, and an empty list stores nothing", () => {
  const raw = serializePendingStack(built());
  expect(raw).toBe('{"version":1,"picks":[{"kind":"directory","slug":"firecrawl","status":"TESTING"},{"kind":"directory","slug":"clay","status":"ARCHIVED"},{"kind":"typed","name":"Field Notes","website":"field-notes.example","status":"ACTIVE"}]}');
  const restored = restore(raw);
  expect(restored.items).toEqual([
    { key: "directory:firecrawl", kind: "directory", slug: "firecrawl", name: "Firecrawl", domain: "firecrawl.dev", status: "TESTING" },
    { key: "directory:clay", kind: "directory", slug: "clay", name: "Clay", domain: "clay.com", status: "ARCHIVED" },
    { key: FIELD_NOTES_KEY, kind: "typed", name: "Field Notes", website: "field-notes.example", status: "ACTIVE" },
  ]);
  expect(restored.lastAdded).toEqual({ added: BUILT, alreadySaved: 0, alreadyListed: 0, overLimit: 0 });
  expect(serializePendingStack(emptyTray)).toBeNull();
});

test.each([
  null, "", "not json", "[]", "null",
  JSON.stringify({ version: NEXT_VERSION, picks: [pick] }),
  JSON.stringify({ version: 1, picks: [pick], extra: true }),
  JSON.stringify({ version: 1, picks: [{ ...pick, name: "Injected name" }] }),
  JSON.stringify({ version: 1, picks: [{ ...pick, status: "PUBLIC" }] }),
  JSON.stringify({ version: 1, picks: [{ kind: "typed", name: "x".repeat(TYPED_NAME_MAX + 1), status: "ACTIVE" }] }),
  JSON.stringify({ version: 1, picks: [{ kind: "typed", name: "Tool", website: "x".repeat(PENDING_WEBSITE_MAX + 1), status: "ACTIVE" }] }),
  JSON.stringify({ version: 1, picks: Array.from({ length: TRAY_LIMIT + 1 }, () => pick) }),
  JSON.stringify({ version: 1, picks: [pick], padding: " ".repeat(PENDING_STACK_MAX_CHARS) }),
])("a tampered, foreign or oversize payload restores an empty list: %#", raw => {
  expect(parsePendingStack(raw)).toEqual([]);
  expect(restore(raw).items).toEqual([]);
});

test("only a signed-out visitor's list is stored; a signed-in owner's list clears the shared key", () => {
  expect(pendingStackValue(built(), false)).toBe(serializePendingStack(built()));
  expect(pendingStackValue(built(), true)).toBeNull();
});

test("the largest list the builder allows, with names that need escaping, still reads back", () => {
  const picks = Array.from({ length: TRAY_LIMIT }, (_, index) => ({
    kind: "typed", name: `${index}`.padEnd(TYPED_NAME_MAX, "\u0001"), website: "x".repeat(PENDING_WEBSITE_MAX), status: "ACTIVE",
  }));
  const raw = JSON.stringify({ version: 1, picks });
  expect(raw.length).toBeLessThanOrEqual(PENDING_STACK_MAX_CHARS);
  expect(parsePendingStack(raw)).toEqual(picks);
});

test("an unknown slug and a name the server would refuse are dropped once the directory is loaded; a typed directory name rejoins as that product", () => {
  const raw = JSON.stringify({ version: 1, picks: [
    { kind: "directory", slug: "not-a-real-product", status: "ACTIVE" },
    { kind: "directory", slug: "clay", status: "TESTING" },
    { kind: "typed", name: "GitHub", website: "notion.so", status: "ACTIVE" },
    { kind: "typed", name: "codeium", status: "ARCHIVED" },
  ] });
  expect(restore(raw).items).toEqual([
    { key: "directory:clay", kind: "directory", slug: "clay", name: "Clay", domain: "clay.com", status: "TESTING" },
    { key: "directory:windsurf", kind: "directory", slug: "windsurf", name: "Windsurf", domain: "windsurf.com", status: "ARCHIVED" },
  ]);
});

test("restoring keeps the tray limit and skips tools already saved or listed", () => {
  const typed = Array.from({ length: TRAY_LIMIT }, (_, index) => ({ kind: "typed", name: `Tool ${index}`, status: "ACTIVE" }));
  const raw = JSON.stringify({ version: 1, picks: [{ kind: "directory", slug: "firecrawl", status: "ACTIVE" }, ...typed.slice(0, TRAY_LIMIT - 1)] });
  const listed = trayReducer(emptyTray, { type: "addEntry", entry: clay, held: [] });
  const restored = restore(raw, ["firecrawl"], listed);
  expect(restored.items).toHaveLength(TRAY_LIMIT);
  expect(restored.lastAdded).toEqual({ added: TRAY_LIMIT - 1, alreadySaved: 1, alreadyListed: 0, overLimit: 0 });
  const full = restore(JSON.stringify({ version: 1, picks: typed }), [], listed);
  expect(full.items).toHaveLength(TRAY_LIMIT);
  expect(full.lastAdded).toEqual({ added: TRAY_LIMIT - 1, alreadySaved: 0, alreadyListed: 0, overLimit: 1 });
  expect(restore(JSON.stringify({ version: 1, picks: [{ kind: "directory", slug: "clay", status: "ACTIVE" }] }), [], listed).lastAdded)
    .toEqual({ added: 0, alreadySaved: 0, alreadyListed: 1, overLimit: 0 });
});
