import { expect, test } from "vitest";
import { addedMessage, emptyTray, saveAttempt, saveButtonLabel, savedMessage, TRAY_LIMIT, trayPicks, trayReducer, type Tray, type TrayEntry } from "./stack-tray";

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

test("a typed product keeps its trimmed name and website, and one named exactly like a directory product joins as that product", () => {
  const typed = trayReducer(emptyTray, { type: "addTyped", name: "  Field   Notes ", website: " field-notes.example ", directoryMatch: null, held: [] });
  expect(typed.items).toEqual([{ key: "typed:field notes", kind: "typed", name: "Field Notes", website: "field-notes.example", status: "ACTIVE" }]);
  const matched = trayReducer(typed, { type: "addTyped", name: "clay", directoryMatch: clay, held: [] });
  expect(matched.items.map(item => item.key)).toEqual(["typed:field notes", "directory:clay"]);
  expect(trayReducer(matched, { type: "addTyped", name: "   ", directoryMatch: null, held: [] })).toBe(matched);
});

test("status and removal change only the named item, and picks keep tray order", () => {
  const tray = [
    { type: "addEntry", entry: hubspot, held: [] },
    { type: "addTyped", name: "Field Notes", directoryMatch: null, held: [] },
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
