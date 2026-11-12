import { expect, test } from "vitest";
import { addedMessage, emptyTray, nextActiveOption, saveAttempt, saveButtonLabel, savedMessage, TRAY_LIMIT, trayPicks, trayReducer, type Tray, type TrayEntry } from "./stack-tray";
import { resolveTypedPick } from "./typed-pick";

const windsurf: TrayEntry = { slug: "windsurf", name: "Windsurf", domain: "windsurf.com" };
const hubspot: TrayEntry = { slug: "hubspot", name: "HubSpot", domain: "hubspot.com" };
const clay: TrayEntry = { slug: "clay", name: "Clay", domain: "clay.com" };
const slack: TrayEntry = { slug: "slack", name: "Slack", domain: "slack.com" };
const OVER_LIMIT = 2;
const CREATED = 4;
const SAVED = 6;

test("a starter set adds its entries as currently used, skipping saved products and ones already listed", () => {
  const listed = trayReducer(emptyTray, { type: "addEntry", entry: clay, held: [] });
  const tray = trayReducer(listed, { type: "addStarterSet", entries: [hubspot, clay, slack], held: ["slack"] });
  expect(tray.items).toEqual([
    { key: "directory:clay", kind: "directory", slug: "clay", name: "Clay", domain: "clay.com", status: "ACTIVE" },
    { key: "directory:hubspot", kind: "directory", slug: "hubspot", name: "HubSpot", domain: "hubspot.com", status: "ACTIVE" },
  ]);
  expect(tray.lastAdded).toEqual({ added: 1, alreadySaved: 1, alreadyListed: 1, overLimit: 0 });
  expect(addedMessage(tray.lastAdded!)).toBe("Added 1 to your list. 1 already saved. 1 already in your list.");
});

function addTyped(tray: Tray, name: string, website?: string, held: readonly string[] = []): Tray {
  const resolution = resolveTypedPick(name, website);
  if (resolution.kind === "refused") throw new Error(resolution.message);
  return trayReducer(tray, { type: "addTyped", name, website, resolution, held });
}

test("a typed product keeps its trimmed name and website, and one named exactly like a directory product joins as that product", () => {
  const typed = addTyped(emptyTray, "  Field   Notes ", " field-notes.example ");
  expect(typed.items).toEqual([{ key: "typed:field notes", kind: "typed", name: "Field Notes", website: "field-notes.example", status: "ACTIVE" }]);
  const matched = addTyped(typed, "clay");
  expect(matched.items.map(item => item.key)).toEqual(["typed:field notes", "directory:clay"]);
  expect(addTyped(matched, "   ")).toBe(matched);
});

test("Windsurf from search and then a typed codeium alias make one entry", () => {
  const tray = addTyped(trayReducer(emptyTray, { type: "addEntry", entry: windsurf, held: [] }), "codeium");
  expect(tray.items).toEqual([{ key: "directory:windsurf", kind: "directory", slug: "windsurf", name: "Windsurf", domain: "windsurf.com", status: "ACTIVE" }]);
  expect(tray.lastAdded).toEqual({ added: 0, alreadySaved: 0, alreadyListed: 1, overLimit: 0 });
  expect(trayPicks(tray)).toEqual([{ kind: "directory", slug: "windsurf", status: "ACTIVE" }]);
});

test("a typed Codeium first and then Windsurf from search make one entry, and a saved Windsurf is not added again", () => {
  const typed = addTyped(emptyTray, "Codeium");
  expect(typed.items.map(item => item.key)).toEqual(["directory:windsurf"]);
  const tray = trayReducer(typed, { type: "addEntry", entry: windsurf, held: [] });
  expect(tray.items.map(item => item.key)).toEqual(["directory:windsurf"]);
  expect(tray.lastAdded).toEqual({ added: 0, alreadySaved: 0, alreadyListed: 1, overLimit: 0 });
  expect(addTyped(emptyTray, "codeium", undefined, ["windsurf"]).lastAdded).toEqual({ added: 0, alreadySaved: 1, alreadyListed: 0, overLimit: 0 });
});

test("a typed website on a directory domain joins as that product; an unknown product stays typed", () => {
  expect(resolveTypedPick("My editor", "codeium.com")).toEqual({ kind: "directory", entry: windsurf });
  expect(addTyped(emptyTray, "My editor", "https://codeium.com/").items.map(item => item.key)).toEqual(["directory:windsurf"]);
  expect(resolveTypedPick("Field Notes", "field-notes.example")).toEqual({ kind: "typed" });
  expect(addTyped(emptyTray, "Field Notes", "field-notes.example").items).toEqual([
    { key: "typed:field notes", kind: "typed", name: "Field Notes", website: "field-notes.example", status: "ACTIVE" },
  ]);
});

test("typed products are the same entry when the server would make them one product: same name and website domain", () => {
  const payroll = addTyped(emptyTray, "Portal", "payroll.example");
  const both = addTyped(payroll, "Portal", "expenses.example");
  expect(trayPicks(both)).toEqual([
    { kind: "typed", name: "Portal", website: "payroll.example", status: "ACTIVE" },
    { kind: "typed", name: "Portal", website: "expenses.example", status: "ACTIVE" },
  ]);
  expect(both.lastAdded).toEqual({ added: 1, alreadySaved: 0, alreadyListed: 0, overLimit: 0 });

  const respelled = addTyped(payroll, "portal", "https://www.payroll.example/");
  expect(trayPicks(respelled)).toEqual([{ kind: "typed", name: "Portal", website: "payroll.example", status: "ACTIVE" }]);
  expect(respelled.lastAdded).toEqual({ added: 0, alreadySaved: 0, alreadyListed: 1, overLimit: 0 });

  const bare = addTyped(addTyped(emptyTray, "Portal"), "Portal");
  expect(trayPicks(bare)).toEqual([{ kind: "typed", name: "Portal", status: "ACTIVE" }]);
  expect(bare.lastAdded).toEqual({ added: 0, alreadySaved: 0, alreadyListed: 1, overLimit: 0 });
});

test("a name and website the server would refuse are refused with its message before anything is added", () => {
  expect(resolveTypedPick("GitHub", "notion.so")).toEqual({ kind: "refused", message: "That website does not match the named catalog product. Correct the name or website." });
  expect(resolveTypedPick("Tool", "javascript:alert(1)")).toEqual({ kind: "refused", message: "Use a public HTTP or HTTPS product website without credentials, or leave it blank." });
});

test("status and removal change only the named item, and picks keep tray order", () => {
  const tray = [
    { type: "addEntry", entry: hubspot, held: [] },
    { type: "addTyped", name: "Field Notes", resolution: { kind: "typed" }, held: [] },
    { type: "addEntry", entry: clay, held: [] },
    { type: "setStatus", key: "directory:clay", status: "ARCHIVED" },
    { type: "setStatus", key: "typed:field notes", status: "TESTING" },
    { type: "remove", key: "directory:hubspot" },
  ] as const;
  const result = tray.reduce<Tray>((current, action) => trayReducer(current, action), emptyTray);
  expect(trayPicks(result)).toEqual([
    { kind: "typed", name: "Field Notes", status: "TESTING" },
    { kind: "directory", slug: "clay", status: "ARCHIVED" },
  ]);
  expect(saveButtonLabel(result.items.length)).toBe("Save 2 tools privately");
  expect(saveButtonLabel(1)).toBe("Save 1 tool privately");
});

test("the tray holds at most the server's limit and says how many it left out", () => {
  const entries = Array.from({ length: TRAY_LIMIT + OVER_LIMIT }, (_, index) => ({ slug: `tool-${index}`, name: `Tool ${index}`, domain: `tool${index}.example` }));
  const tray = trayReducer(emptyTray, { type: "addStarterSet", entries, held: [] });
  expect(tray.items).toHaveLength(TRAY_LIMIT);
  expect(tray.lastAdded).toEqual({ added: TRAY_LIMIT, alreadySaved: 0, alreadyListed: 0, overLimit: OVER_LIMIT });
  expect(addedMessage(tray.lastAdded!)).toBe("Added 100 to your list. Your list holds 100 tools. Save these first, then add the rest.");
});

test("saving empties the tray and reports what the server did", () => {
  const tray = trayReducer(trayReducer(emptyTray, { type: "addEntry", entry: clay, held: [] }), { type: "saved", result: { created: CREATED, confirmed: 1, unchanged: 1 } });
  expect(tray).toEqual({ items: [], lastAdded: null, saved: { saved: SAVED, created: CREATED, confirmed: 1, unchanged: 1 } });
  expect(savedMessage(tray.saved!)).toBe("Saved 6 tools privately. Nothing is public yet. 1 discovery was confirmed. 1 already in your collection kept its saved choices.");
  expect(trayReducer(tray, { type: "addEntry", entry: hubspot, held: [] }).saved).toBeNull();
});

test("arrow keys from no active option go to the first or last option, then wrap", () => {
  const DOWN = 1;
  const UP = -1;
  const UNSET = -1;
  const NINE = 9;
  const LAST = 8;
  const MIDDLE = 3;
  const cases = [
    [UNSET, DOWN, 0, UNSET], [UNSET, UP, 0, UNSET],
    [UNSET, DOWN, 1, 0], [UNSET, UP, 1, 0], [0, DOWN, 1, 0], [0, UP, 1, 0],
    [UNSET, DOWN, NINE, 0], [UNSET, UP, NINE, LAST], [LAST, DOWN, NINE, 0], [0, UP, NINE, LAST],
    [MIDDLE, UP, NINE, MIDDLE - 1], [MIDDLE, DOWN, NINE, MIDDLE + 1],
  ] as const;
  expect(cases.map(([current, step, count]) => nextActiveOption(current, step, count))).toEqual(cases.map(([, , , expected]) => expected));
});

test("a retry of the same picks reuses its operation, and any change in picks or order starts a new one", () => {
  const ids = ["first", "second", "third"];
  const next = () => ids.shift()!;
  const picks = [{ kind: "directory", slug: "clay", status: "ACTIVE" }, { kind: "directory", slug: "slack", status: "ACTIVE" }] as const;
  const first = saveAttempt(null, picks, next);
  expect(first.operationId).toBe("first");
  expect(saveAttempt(first, [...picks], next).operationId).toBe("first");
  expect(saveAttempt(first, [picks[1], picks[0]], next).operationId).toBe("second");
  expect(saveAttempt(first, [{ ...picks[0], status: "TESTING" }, picks[1]], next).operationId).toBe("third");
});
