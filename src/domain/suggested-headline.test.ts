import { describe, expect, it } from "vitest";
import { RELATIONSHIP_LEVELS } from "./relationship-level";
import { SUGGESTED_HEADLINE_MAX, suggestedHeadline, type SuggestionInput } from "./suggested-headline";

const BUILD = "build features from a description";
const REVIEW = "review code before it merges";
const FIX = "find and fix bugs";
const LISTS = "build target account lists";
const ENRICH = "enrich lead and account lists";
const Y2021 = 2021;
const Y2022 = 2022;
const Y2024 = 2024;
const Y2025 = 2025;
const LIMIT = 240;
const LONG_USE_PADDING = 12;
const LONG_NAME_WORDS = 60;
// Dashes used as punctuation. The hyphen inside a word ("go-to") is not one.
const PUNCTUATION_DASHES = [" - ", "–", "—"];
// Marks of a broken sentence: a doubled space, space before a stop, a dangling "to", a doubled stop.
const BROKEN_MARKS = ["  ", " .", " ,", " to and ", " to .", "..", ",."];

function sentenceProblem(text: string) {
  if (PUNCTUATION_DASHES.some(dash => text.includes(dash))) return "dash";
  if (BROKEN_MARKS.some(mark => text.includes(mark))) return "broken";
  if (text[0] !== text[0]?.toUpperCase() || !text.endsWith(".")) return "not a sentence";
  return null;
}

function line(input: Partial<SuggestionInput> & Pick<SuggestionInput, "productName">) {
  return suggestedHeadline({ status: "ACTIVE", uses: [], ...input });
}

describe("suggestedHeadline", () => {
  it("writes every level with two uses in the owner's voice", () => {
    expect(RELATIONSHIP_LEVELS.map(level => line({ productName: "Clay", level: level.key, status: level.status, uses: [LISTS, ENRICH] }))).toEqual([
      `I tried Clay to ${LISTS} and ${ENRICH} and didn't adopt it.`,
      `I don't use Clay anymore, but I used it to ${LISTS} and ${ENRICH}.`,
      `I used Clay to ${LISTS} and ${ENRICH} and paused it for now.`,
      `I reach for Clay when a job needs it, to ${LISTS} and ${ENRICH}.`,
      `I'm testing Clay to ${LISTS} and ${ENRICH}.`,
      `I use Clay most weeks to ${LISTS} and ${ENRICH}.`,
      `I use Clay daily to ${LISTS} and ${ENRICH}.`,
    ]);
  });

  it("writes every level as a whole sentence with no uses picked", () => {
    expect(RELATIONSHIP_LEVELS.map(level => line({ productName: "Linear", level: level.key, status: level.status }))).toEqual([
      "I tried Linear and didn't adopt it.",
      "I don't use Linear anymore, but I have used it.",
      "I've paused Linear for now and may come back.",
      "I reach for Linear when a job needs it.",
      "I'm testing Linear and haven't decided yet.",
      "I use Linear most weeks.",
      "I use Linear on most working days.",
    ]);
  });

  it("names one use, and only the first two of many", () => {
    expect(line({ productName: "Claude Code", level: "DAILY", uses: [BUILD] })).toBe(`I use Claude Code daily to ${BUILD}.`);
    expect(line({ productName: "Claude Code", level: "DAILY", uses: [BUILD, REVIEW, FIX] })).toBe(`I use Claude Code daily to ${BUILD} and ${REVIEW}.`);
  });

  it("reads a card with no level from its status", () => {
    expect(line({ productName: "Linear", status: "ACTIVE" })).toBe("I use Linear.");
    expect(line({ productName: "Clay", status: "ACTIVE", uses: [LISTS] })).toBe(`I use Clay to ${LISTS}.`);
    expect(line({ productName: "Clay", status: "ACTIVE", uses: [LISTS], sinceYear: Y2022 })).toBe(`I've used Clay since 2022 to ${LISTS}.`);
    expect(line({ productName: "Linear", status: "TESTING" })).toBe("I'm testing Linear and haven't decided yet.");
    expect(line({ productName: "Linear", status: "ARCHIVED" })).toBe("I don't use Linear anymore, but I have used it.");
    expect(line({ productName: "Clay", status: "ARCHIVED", uses: [LISTS] })).toBe(`I don't use Clay anymore, but I used it to ${LISTS}.`);
  });

  it("says since when for a tool used daily or most weeks", () => {
    expect(line({ productName: "Claude Code", level: "DAILY", sinceYear: Y2024, uses: [BUILD] })).toBe(`I've used Claude Code daily since 2024 to ${BUILD}.`);
    expect(line({ productName: "Linear", level: "WEEKLY", sinceYear: Y2021, uses: [FIX] })).toBe(`I've used Linear most weeks since 2021 to ${FIX}.`);
    expect(line({ productName: "Linear", level: "WEEKLY", sinceYear: Y2021 })).toBe("I've used Linear most weeks since 2021.");
    // A tool still in use has no stopped year to say.
    expect(line({ productName: "Linear", level: "DAILY", sinceYear: Y2021, stoppedYear: Y2025 })).toBe("I've used Linear daily since 2021.");
  });

  it("says from when to when for a tool put down, once both years are known", () => {
    expect(line({ productName: "Clay", level: "STOPPED", status: "ARCHIVED", uses: [LISTS], sinceYear: Y2022, stoppedYear: Y2025 }))
      .toBe(`I used Clay from 2022 to 2025 to ${LISTS}.`);
    expect(line({ productName: "Clay", level: "STOPPED", status: "ARCHIVED", sinceYear: Y2024, stoppedYear: Y2024 })).toBe("I used Clay in 2024.");
    expect(line({ productName: "Clay", level: "PAUSED", status: "ARCHIVED", sinceYear: Y2022, stoppedYear: Y2025 })).toBe("I used Clay from 2022 to 2025 and paused it for now.");
    expect(line({ productName: "Clay", status: "ARCHIVED", uses: [LISTS], sinceYear: Y2022, stoppedYear: Y2025 })).toBe(`I used Clay from 2022 to 2025 to ${LISTS}.`);
    // A start year alone says nothing about a tool put down.
    expect(line({ productName: "Clay", level: "STOPPED", status: "ARCHIVED", sinceYear: Y2022 })).toBe("I don't use Clay anymore, but I have used it.");
  });

  it("never goes past 240 characters: it drops the second use, then all uses, never cutting a word", () => {
    const long = (words: string) => `${"carefully ".repeat(LONG_USE_PADDING)}${words}`;
    const [first, second] = [long("handle chore one"), long("handle chore two")];
    const one = line({ productName: "Claude Code", level: "DAILY", uses: [first, second] });
    expect(SUGGESTED_HEADLINE_MAX).toBe(LIMIT);
    expect(one).toBe(`I use Claude Code daily to ${first}.`);
    const huge = `${long("")}${long("and more")}`;
    expect(line({ productName: "Claude Code", level: "DAILY", uses: [huge, second] })).toBe("I use Claude Code on most working days.");
  });

  it("cuts a product name too long for any sentence at a word, never mid-word", () => {
    const name = Array.from({ length: LONG_NAME_WORDS }, (_, index) => `word${index}`).join(" ");
    const result = line({ productName: name, level: "DAILY" });
    expect(result.length).toBeLessThanOrEqual(SUGGESTED_HEADLINE_MAX);
    expect(result.endsWith(".")).toBe(true);
    expect(name.split(" ")).toContain(result.slice(0, -1).split(" ").at(-1));
  });

  it("never writes a dash, and never leaves an empty or broken sentence", () => {
    const levels = [undefined, ...RELATIONSHIP_LEVELS.map(entry => entry.key)];
    const useSets = [[], [LISTS], [BUILD, REVIEW, LISTS]];
    const yearSets = [{}, { sinceYear: Y2022 }, { sinceYear: Y2022, stoppedYear: Y2025 }, { stoppedYear: Y2025 }];
    const statuses = ["ACTIVE", "TESTING", "ARCHIVED"] as const;
    const results = levels.flatMap(level => statuses.flatMap(status => useSets.flatMap(uses =>
      yearSets.map(years => line({ productName: "Clay", level, status, uses, ...years })))));
    expect(results.filter(sentenceProblem)).toEqual([]);
  });

  it("ignores blank and repeated uses", () => {
    expect(line({ productName: "Clay", level: "DAILY", uses: [" ", LISTS, LISTS] })).toBe(`I use Clay daily to ${LISTS}.`);
  });
});
