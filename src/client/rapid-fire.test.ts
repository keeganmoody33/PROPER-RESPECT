import { describe, expect, it } from "vitest";
import {
  addComment, creditAnswer, rapidFireUrl, withoutRapidFire, lineFromComment, rapidFireCards, rapidFireNote, rapidFireSave, rapidFireTally, removeFillers, sinceAnswer, usesAnswer,
  type RapidFireCard,
} from "./rapid-fire";
import { walkthroughQueue, type WalkthroughCard } from "./walkthrough";

let next = 0;
function card(name: string, prop: Partial<WalkthroughCard["prop"]> = {}): WalkthroughCard {
  const slug = name.toLowerCase().replaceAll(" ", "-");
  next += 1;
  return {
    product: { name, slug, domain: `${slug}.com` },
    prop: { _id: `prop-${slug}-${next}`, productId: `product-${slug}`, status: "TESTING", visibility: "DRAFT", headline: "", note: "", ...prop },
    isPublishedAtCurrentHandle: false,
  };
}
const deck = (...cards: WalkthroughCard[]) => rapidFireCards(walkthroughQueue(cards));
const answered = (value: RapidFireCard, answer: Partial<RapidFireCard["answer"]>): RapidFireCard => ({ ...value, answer: { ...value.answer, ...answer } });

describe("opening rapid fire", () => {
  it("reloads the same page with the flag, and takes the flag off once it opens", () => {
    const opened = rapidFireUrl("http://localhost:3000/app/collection?tab=all#share-all");
    expect(opened).toBe("http://localhost:3000/app/collection?tab=all&rapid=1#walkthrough");
    expect(withoutRapidFire(opened)).toBe("http://localhost:3000/app/collection?tab=all#walkthrough");
    expect(withoutRapidFire("http://localhost:3000/app/collection")).toBeUndefined();
  });
});

describe("what the owner said, kept as said", () => {
  it.each([
    ["um I use it for, like, lead lists, you know, and uh enrichment", "I use it for lead lists and enrichment"],
    ["Uhh honestly it's the best, I mean, for scraping", "Honestly it's the best for scraping"],
    ["like, Jordan put me on it", "Jordan put me on it"],
    ["I like it a lot", "I like it a lot"],
    ["  hmm  ", ""],
  ])("takes the filler out of %j and changes nothing else", (said, kept) => {
    expect(removeFillers(said)).toBe(kept);
  });

  it("adds each thing they say to what they said before", () => {
    expect(addComment("", "um it's fast")).toBe("It's fast");
    expect(addComment("It's fast", "and cheap")).toBe("It's fast And cheap");
    expect(addComment("It's fast", "uh")).toBe("It's fast");
  });

  it("offers a comment as the line, cut on a whole word to 240 characters", () => {
    expect(lineFromComment("Where my lists start.")).toBe("Where my lists start.");
    const long = `${"word ".repeat(60)}end`;
    const line = lineFromComment(long);
    expect(line.length).toBeLessThanOrEqual(240);
    expect(line.endsWith("word")).toBe(true);
  });

  it("keeps the saved note and adds the comment under it", () => {
    const [noted] = deck(card("Clay", { ownerEntered: true, note: "My lists." }));
    expect(rapidFireNote(noted.item, "Jordan put me on.")).toBe("My lists.\n\nJordan put me on.");
    const [found] = deck(card("Exa", { note: "Found in a newsletter." }));
    // A draft's note was written by the system that found it, so only the owner's comment is kept.
    expect(rapidFireNote(found.item, "")).toBe("");
  });
});

describe("moving on from a card", () => {
  it("saves nothing when no level was heard, and marks Never used it for the check screen", () => {
    const [clay] = deck(card("Clay"));
    expect(rapidFireSave(clay)).toEqual({ kind: "none", status: "noAnswer" });
    expect(rapidFireSave(answered(clay, { choice: "NEVER" }))).toEqual({ kind: "none", status: "never" });
  });

  it("saves privately with the comment in the note, a year-only since, and no line it didn't hear", () => {
    const [clay] = deck(card("Clay", { relationshipVersion: 4 }));
    const plan = rapidFireSave(answered(clay, { choice: "WEEKLY", startedAt: "2023", comment: "Where my lists start." }));
    expect(plan.kind).toBe("save");
    if (plan.kind !== "save") return;
    expect(plan.args).toMatchObject({ level: "WEEKLY", status: "ACTIVE", startedAt: "2023", headline: "", note: "Where my lists start.", expectedVersion: 4 });
    // What moving on compares: the answers, not the version they name.
    expect(JSON.parse(plan.body)).toEqual(JSON.parse(JSON.stringify({ ...plan.args, expectedVersion: undefined })));
    expect(plan.body).not.toContain("expectedVersion");
  });

  it("saves the owner's own line, and names the version its last save made", () => {
    const [clay] = deck(card("Clay"));
    const plan = rapidFireSave({ ...answered(clay, { choice: "DAILY", ownerLine: "Where my lists start." }), version: 7 });
    expect(plan.kind === "save" && plan.args).toMatchObject({ headline: "Where my lists start.", expectedVersion: 7 });
  });

  it("refuses a note and comment over the note's limit instead of cutting what was said", () => {
    const [noted] = deck(card("Clay", { ownerEntered: true, note: "n".repeat(3950) }));
    expect(rapidFireSave(answered(noted, { choice: "DAILY", comment: "c".repeat(100) }))).toMatchObject({ kind: "error" });
    expect(rapidFireSave(answered(noted, { choice: "DAILY", comment: "c".repeat(48) })).kind).toBe("save");
  });

  it("refuses a since that isn't a year or a real date, and a credit that doesn't fit its platform", () => {
    const [clay] = deck(card("Clay"));
    expect(rapidFireSave(answered(clay, { choice: "DAILY", startedAt: "2023-02-30" }))).toMatchObject({ kind: "error" });
    expect(rapidFireSave(answered(clay, { choice: "DAILY", creditPlatform: "GITHUB", creditHandle: "https://evil.example/x" }))).toMatchObject({ kind: "error" });
  });
});

describe("answers heard by voice", () => {
  it("takes a year or a full date, never fills in a month, and refuses the future", () => {
    const today = new Date("2026-11-17T12:00:00Z");
    expect(sinceAnswer("2023", today)).toEqual({ ok: true, value: "2023" });
    expect(sinceAnswer("2024-04-01", today)).toEqual({ ok: true, value: "2024-04-01" });
    expect(sinceAnswer("2027", today).ok).toBe(false);
    expect(sinceAnswer("2026-12-01", today).ok).toBe(false);
    expect(sinceAnswer("April 2023", today).ok).toBe(false);
  });

  it("keeps only listed uses, and their own words in Something else", () => {
    const [clay] = deck(card("Clay"));
    const first = usesAnswer(clay.answer, "clay", ["not-a-use"], "um scraping job boards", "replace");
    expect(first.unknown).toEqual(["not-a-use"]);
    expect(first.patch).toEqual({ usePicks: [], useOther: "Scraping job boards" });
  });

  it("checks a credit before it shows", () => {
    expect(creditAnswer("OTHER", "Jordan Crawford", "Twitter")).toEqual({ ok: true,
      patch: { creditPlatform: "OTHER", creditHandle: "Jordan Crawford", creditPlatformName: "Twitter" } });
    expect(creditAnswer("GITHUB", "a/b").ok).toBe(false);
  });

  it("counts the cards for the check screen", () => {
    const [a, b, c] = deck(card("Clay"), card("Exa"), card("Devin"));
    expect(rapidFireTally([{ ...a, status: "saved" }, { ...b, status: "never" }, c])).toEqual({ saved: 1, never: 1, notSaved: 0, waiting: 1 });
  });
});
