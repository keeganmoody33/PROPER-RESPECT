import { describe, expect, it } from "vitest";
import { shareAllSelections } from "@/src/domain/share-all";
import { suggestedHeadline } from "@/src/domain/suggested-headline";
import {
  choiceFields, initialAnswer, keptNote, lineAction, MORE_CHOICES, neverUsedAction, PRIMARY_CHOICES, progressLine, resumeSession, settle,
  startSession, currentTool, walkthroughQueue, walkthroughReason, walkthroughSave, type WalkthroughCard,
} from "./walkthrough";

let next = 0;
const SAVED_VERSION = 3;
const LATER_VERSION = 2;
function card(name: string, prop: Partial<WalkthroughCard["prop"]> = {}, extra: Partial<WalkthroughCard> = {}): WalkthroughCard {
  const slug = name.toLowerCase().replaceAll(" ", "-");
  next += 1;
  return {
    product: { name, slug, domain: `${slug}.com` },
    prop: { _id: `prop-${slug}-${next}`, productId: `product-${slug}`, status: "ACTIVE", visibility: "PRIVATE", headline: "", note: "", ...prop },
    isPublishedAtCurrentHandle: false,
    ...extra,
  };
}
const picked = (name: string, prop: Partial<WalkthroughCard["prop"]> = {}) =>
  card(name, { level: "WEEKLY", confirmedAt: "2026-11-17T12:00:00Z", relationshipVersion: 1, ownerEntered: true, goTo: false, ...prop });
const found = (name: string, prop: Partial<WalkthroughCard["prop"]> = {}) => card(name, { status: "TESTING", visibility: "DRAFT", ...prop });

describe("the walkthrough queue", () => {
  it("asks every tool still waiting for an answer, picks first and finds after, each in collection order", () => {
    const github = found("GitHub");
    const clay = picked("Clay");
    const cursor = picked("Cursor");
    const devin = found("Devin");
    expect(walkthroughQueue([github, clay, devin, cursor]).map(item => item.card.product?.name)).toEqual(["Clay", "Cursor", "GitHub", "Devin"]);
  });

  it("never asks again about a tool that is complete: confirmed, with a level and a line, from its headline or its note", () => {
    const done = picked("Clay", { headline: "Where my lists start." });
    const noted = picked("Cursor", { note: "My editor." });
    const levelOnly = picked("Exa");
    expect(walkthroughQueue([done, noted, levelOnly]).map(item => item.propId)).toEqual([levelOnly.prop._id]);
  });

  it("asks about a confirmed card saved before levels, and a draft with words a system wrote, since neither is complete", () => {
    const beforeLevels = picked("Clay", { level: undefined, headline: "Lists." });
    const systemWords = found("Wispr Flow", { headline: "Wispr Flow may be in your stack." });
    expect(walkthroughQueue([beforeLevels, systemWords]).map(item => item.propId)).toEqual([beforeLevels.prop._id, systemWords.prop._id]);
  });

  it("asks again about a confirmed card whose only words an app wrote, since share-all doesn't count them as a line", () => {
    const older = picked("GitHub", { headline: "GitHub is in my stack.", note: "Connected activity is private until I approve this card." });
    expect(walkthroughQueue([older]).map(item => item.propId)).toEqual([older.prop._id]);
    expect(initialAnswer(older).ownerLine).toBeNull();
    expect(walkthroughSave(older, { ...initialAnswer(older), choice: "DAILY" }, "")).toMatchObject({ ok: true, args: { note: "" } });
  });

  it("leaves a tool already on the page to the sharing step", () => {
    const shared = picked("Clay", {}, );
    const onPage = { ...shared, isPublishedAtCurrentHandle: true };
    const publicCard = picked("Exa", { visibility: "PUBLIC" });
    expect(walkthroughQueue([onPage, publicCard])).toEqual([]);
  });

  it("asks once per product, about its confirmed record, and not at all when another record for it is done", () => {
    const draft = found("Clay", { productId: "product-clay" });
    const confirmed = picked("Clay", { productId: "product-clay" });
    expect(walkthroughQueue([draft, confirmed]).map(item => item.propId)).toEqual([confirmed.prop._id]);
    const finished = picked("Exa", { productId: "product-exa", headline: "Search that reads." });
    const second = found("Exa", { productId: "product-exa" });
    expect(walkthroughQueue([second, finished])).toEqual([]);
  });

  it("skips a record whose product is unavailable", () => {
    expect(walkthroughQueue([{ ...picked("Clay"), product: null }])).toEqual([]);
  });
});

describe("why a tool is here", () => {
  it("says the person added it when they did, whatever else is attached", () => {
    expect(walkthroughReason(picked("Clay"), [{ sourceType: "GMAIL" }])).toBe("You added it");
  });

  it("names the stored source of a find, never a guess", () => {
    const find = found("Linear");
    expect(walkthroughReason(find, [{ sourceType: "GMAIL" }])).toBe("Found in your email");
    expect(walkthroughReason(find, [{ sourceType: "MICROSOFT_MAIL" }])).toBe("Found in your email");
    expect(walkthroughReason(found("GitHub"), [{ sourceType: "GITHUB" }])).toBe("From your GitHub account");
    expect(walkthroughReason(found("Devin"), [{ sourceType: "DEVIN" }])).toBe("From your Devin account");
    expect(walkthroughReason(found("Claude Code"), [{ sourceType: "FILE_UPLOAD", adapterId: "sanitized-measurements", route: "UPLOAD" }])).toBe("Your Claude Code usage");
    expect(walkthroughReason(found("Wispr Flow"), [{ sourceType: "FILE_UPLOAD", route: "UPLOAD" }])).toBe("From a file you uploaded");
    expect(walkthroughReason(found("Wispr Flow"), [{ sourceType: "SCREENSHOT" }])).toBe("From a file you uploaded");
  });

  it("falls back to what is true when no source is stored", () => {
    expect(walkthroughReason(found("Devin", { activity: { kind: "headlineMetrics" } }), [])).toBe("Your Devin activity, from a connected account");
    expect(walkthroughReason(found("Linear"), [])).toBe("Waiting for your answer");
    expect(walkthroughReason(found("Linear"), undefined)).toBe("Waiting for your answer");
    expect(walkthroughReason(picked("Linear", { ownerEntered: false }), [])).toBe("In your collection");
  });
});

describe("how you use it", () => {
  it("offers Daily, Weekly, Testing, Stopped and Never used it, with the other three levels under More", () => {
    expect(PRIMARY_CHOICES).toEqual(["DAILY", "WEEKLY", "TESTING", "STOPPED", "NEVER"]);
    expect(MORE_CHOICES).toEqual(["OCCASIONAL", "PAUSED", "TRIED_NOT_ADOPTED"]);
  });

  it("maps each level to the status it implies and the questions that follow; Never used it saves nothing and asks nothing", () => {
    expect(choiceFields("DAILY")).toEqual({ saves: { level: "DAILY", status: "ACTIVE" }, asksUses: true, asksSince: true, asksCredit: true, asksLine: true });
    expect(choiceFields("STOPPED")).toMatchObject({ saves: { level: "STOPPED", status: "ARCHIVED" }, asksSince: true });
    expect(choiceFields("TESTING")).toMatchObject({ saves: { level: "TESTING", status: "TESTING" } });
    // A card never shows "since" for a tool that wasn't adopted.
    expect(choiceFields("TRIED_NOT_ADOPTED")).toMatchObject({ saves: { level: "TRIED_NOT_ADOPTED", status: "ARCHIVED" }, asksSince: false });
    expect(choiceFields("NEVER")).toEqual({ saves: null, asksUses: false, asksSince: false, asksCredit: false, asksLine: false });
    expect(choiceFields(undefined)).toEqual({ saves: null, asksUses: false, asksSince: false, asksCredit: false, asksLine: false });
  });

  it("starts from the owner's saved answers and never preselects a level a system guessed", () => {
    const stack = picked("Clay", { level: "DAILY", uses: { picks: ["build-lists"], other: "score leads" }, startedAt: "2022-03-01",
      credit: { platform: "X", handle: "jack" }, headline: "" });
    expect(initialAnswer(stack)).toEqual({ choice: "DAILY", usePicks: ["build-lists"], useOther: "score leads", startedAt: "2022-03-01",
      creditPlatform: "X", creditHandle: "jack", creditPlatformName: "", ownerLine: null });
    expect(initialAnswer(found("GitHub"))).toMatchObject({ choice: undefined, creditPlatform: "PROPER_RESPECT", ownerLine: null });
    // A draft's system words are never offered back as the owner's line.
    expect(initialAnswer(found("Wispr", { headline: "Wispr may be in your stack." })).ownerLine).toBeNull();
  });
});

describe("which control saves a line", () => {
  const suggestion = suggestedHeadline({ productName: "Clay", level: "DAILY", status: "ACTIVE", uses: ["build target account lists"] });

  it("keeps an untouched suggestion only through a button that says so, and saves exactly the words shown", () => {
    expect(lineAction(null, suggestion)).toEqual({ label: "Keep this line and go on", headline: suggestion, keepsSuggestion: true });
  });

  it("saves the owner's own words through a button that says save", () => {
    expect(lineAction("Where my lists start.", suggestion)).toEqual({ label: "Save and go on", headline: "Where my lists start.", keepsSuggestion: false });
  });

  it("says it saves no line when the field is cleared or there is no suggestion, so the card stays private", () => {
    expect(lineAction("   ", suggestion)).toEqual({ label: "Save without a line and go on", headline: "", keepsSuggestion: false });
    expect(lineAction(null, undefined)).toEqual({ label: "Save without a line and go on", headline: "", keepsSuggestion: false });
    // A saved note stands in for a missing line on the card, so the button never says the card has no line.
    expect(lineAction("   ", suggestion, "Lead lists")).toEqual({ label: "Save and go on", headline: "", keepsSuggestion: false, standIn: "Lead lists" });
    expect(lineAction(null, undefined, "Lead lists")).toEqual({ label: "Save and go on", headline: "", keepsSuggestion: false, standIn: "Lead lists" });
    expect(lineAction("My own line.", suggestion, "Lead lists")).toEqual({ label: "Save and go on", headline: "My own line.", keepsSuggestion: false });
    const share = shareAllSelections([{ propId: "clay", visibility: "PRIVATE", onPublishedPage: false, matchesUnresolvedPublishedCard: false,
      status: "ACTIVE", headline: lineAction(null, undefined).headline, note: "", product: { name: "Clay", domain: "clay.com" } }]);
    expect(share.selections).toEqual([]);
  });

  it("removes a bare find for Never used it, and leaves one with evidence, a measurement or a page alone", () => {
    expect(neverUsedAction(picked("Clay"), 0)).toEqual({ kind: "remove", label: "Remove it and go on" });
    expect(neverUsedAction(found("GitHub"), 1)).toEqual({ kind: "leave", label: "Leave it as it is and go on" });
    expect(neverUsedAction(found("Devin", { activity: { kind: "headlineMetrics" } }), 0).kind).toBe("leave");
    expect(neverUsedAction(picked("Clay", { activityEvidenceId: "raw-1" }), 0).kind).toBe("leave");
    expect(neverUsedAction(picked("Clay", { visibility: "PUBLIC" }), 0).kind).toBe("leave");
    // Until its sources load, nothing is removed.
    expect(neverUsedAction(picked("Clay"), undefined).kind).toBe("leave");
  });
});

describe("the save a walkthrough answer sends", () => {
  const answer = (overrides: Partial<ReturnType<typeof initialAnswer>> = {}) => ({ ...initialAnswer(picked("Clay")), choice: "DAILY" as const, ...overrides });

  it("sends the level with the status it implies, the picked uses, the date and the line, and keeps what the walkthrough doesn't ask", () => {
    const stack = picked("Clay", { relationshipVersion: SAVED_VERSION, goTo: true, note: "My own words.", supportingUrl: "https://example.com/work" });
    const result = walkthroughSave(stack, answer({ usePicks: ["build-lists", "enrich-leads"], useOther: " ", startedAt: "2022-03-01" }), "I use Clay daily.");
    expect(result).toEqual({ ok: true, args: {
      propId: stack.prop._id, expectedVersion: SAVED_VERSION, level: "DAILY", status: "ACTIVE", goTo: true, headline: "I use Clay daily.", note: "My own words.",
      uses: { picks: ["build-lists", "enrich-leads"] }, credit: undefined, startedAt: "2022-03-01", supportingUrl: "https://example.com/work",
    } });
  });

  it("names the note it keeps, the one a card shows when it has no line: the owner's own, never an app's or a draft's", () => {
    expect(keptNote(picked("Clay", { note: " Lead lists " }))).toBe("Lead lists");
    expect(keptNote(picked("Clay", { note: "Connected activity is private until I approve this card." }))).toBe("");
    expect(keptNote(found("Wispr Flow", { note: "Unreviewed suggestion" }))).toBe("");
  });

  it("clears a draft's system note, sends no uses or date when none are given, and starts a never-saved record at version 0", () => {
    const draft = found("Wispr Flow", { note: "Connected activity is private until I approve this card." });
    const result = walkthroughSave(draft, { ...initialAnswer(draft), choice: "STOPPED" }, "");
    expect(result).toMatchObject({ ok: true, args: { expectedVersion: 0, level: "STOPPED", status: "ARCHIVED", goTo: false, note: "", uses: undefined, startedAt: undefined, headline: "" } });
  });

  it("checks props with the credit editor's own rule and refuses a bad handle with its message", () => {
    expect(walkthroughSave(picked("Clay"), answer({ creditPlatform: "X", creditHandle: "@jack" }), "")).toMatchObject({ ok: true, args: { credit: { platform: "X", handle: "jack" } } });
    expect(walkthroughSave(picked("Clay"), answer({ creditPlatform: "X", creditHandle: "not a handle!" }), ""))
      .toEqual({ ok: false, message: "Enter an X handle: up to 15 letters, numbers or underscores." });
  });

  it("refuses to save Never used it or no choice: those save nothing", () => {
    expect(walkthroughSave(picked("Clay"), answer({ choice: "NEVER" }), "")).toEqual({ ok: false, message: "Choose how you use it first." });
    expect(walkthroughSave(picked("Clay"), answer({ choice: undefined }), "")).toEqual({ ok: false, message: "Choose how you use it first." });
  });
});

describe("progress and resume", () => {
  const clay = picked("Clay");
  const exa = picked("Exa");
  const devin = picked("Devin");
  const queue = walkthroughQueue([clay, exa, devin]);

  it("counts against the tools there were when it started, so a saved answer doesn't shrink the total", () => {
    let session = startSession(queue);
    expect(currentTool(session, queue)?.propId).toBe(clay.prop._id);
    expect(progressLine(session, queue)).toBe("1 of 3");
    session = settle(session, clay.prop._id, "saved");
    const afterSave = walkthroughQueue([{ ...clay, prop: { ...clay.prop, headline: "Lists.", relationshipVersion: LATER_VERSION } }, exa, devin]);
    expect(currentTool(session, afterSave)?.propId).toBe(exa.prop._id);
    expect(progressLine(session, afterSave)).toBe("2 of 3");
    session = settle(session, exa.prop._id, "skipped");
    expect(progressLine(session, afterSave)).toBe("3 of 3");
    session = settle(session, devin.prop._id, "removed");
    expect(currentTool(session, afterSave)).toBeUndefined();
    expect(progressLine(session, afterSave)).toBe("");
  });

  it("resumes after a reload at the first tool without a saved answer, with only those left to count", () => {
    const reloaded = walkthroughQueue([{ ...clay, prop: { ...clay.prop, headline: "Lists." } }, exa, devin]);
    const session = startSession(reloaded);
    expect(currentTool(session, reloaded)?.propId).toBe(exa.prop._id);
    expect(progressLine(session, reloaded)).toBe("1 of 2");
  });

  it("adds tools that arrive while it runs and passes over one finished elsewhere", () => {
    let session = startSession(queue);
    const linear = found("Linear");
    session = resumeSession(session, walkthroughQueue([clay, exa, devin, linear]));
    expect(progressLine(session, walkthroughQueue([clay, exa, devin, linear]))).toBe("1 of 4");
    const clayDoneElsewhere = walkthroughQueue([{ ...clay, prop: { ...clay.prop, headline: "Lists." } }, exa, devin, linear]);
    expect(currentTool(session, clayDoneElsewhere)?.propId).toBe(exa.prop._id);
  });
});
