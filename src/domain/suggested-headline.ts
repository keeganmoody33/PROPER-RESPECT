import type { RelationshipLevel, RelationshipStatus } from "./relationship-level";

// A first line built from the owner's own answers, in the owner's voice (spec of 2026-11-17). Nothing is called and
// nothing is guessed: no answer, no words for it.

/** The longest headline a card saves (inventory's relationshipEditSchema). */
export const SUGGESTED_HEADLINE_MAX = 240;
/** A line names at most the first two uses the owner picked. */
const USES_NAMED = 2;

export type SuggestionInput = Readonly<{
  productName: string;
  level?: RelationshipLevel;
  status: RelationshipStatus;
  /** What the product does for the owner, each finishing "I use it to …", in the order the card lists them. */
  uses: readonly string[];
  sinceYear?: number;
  stoppedYear?: number;
}>;

type Years = Readonly<{ since?: number; stopped?: number }>;
/** The sentence without its full stop, given the product's name and its uses joined ("a and b", or nothing). */
type Writer = (product: string, uses: string, years: Years) => string;

/** "from 2022 to 2025", "in 2024", or nothing: a past line says when only when it knows both ends. */
function period({ since, stopped }: Years): string {
  if (since === undefined || stopped === undefined) return "";
  return since === stopped ? ` in ${since}` : ` from ${since} to ${stopped}`;
}

const inUse = (frequency: string, noUses: string): Writer => (product, uses, { since }) => {
  if (since !== undefined) return `I've used ${product}${frequency} since ${since}${uses ? ` to ${uses}` : ""}`;
  return uses ? `I use ${product}${frequency} to ${uses}` : `I use ${product}${noUses}`;
};

const stopped: Writer = (product, uses, years) => {
  const when = period(years);
  if (when) return `I used ${product}${when}${uses ? ` to ${uses}` : ""}`;
  return uses ? `I don't use ${product} anymore, but I used it to ${uses}` : `I don't use ${product} anymore, but I have used it`;
};

const testing: Writer = (product, uses) => uses ? `I'm testing ${product} to ${uses}` : `I'm testing ${product} and haven't decided yet`;

const LEVEL_WRITERS: Readonly<Record<RelationshipLevel, Writer>> = {
  TRIED_NOT_ADOPTED: (product, uses) => `I tried ${product}${uses ? ` to ${uses}` : ""} and didn't adopt it`,
  STOPPED: stopped,
  PAUSED: (product, uses, years) => {
    const when = period(years);
    if (!uses && !when) return `I've paused ${product} for now and may come back`;
    return `I used ${product}${when}${uses ? ` to ${uses}` : ""} and paused it for now`;
  },
  OCCASIONAL: (product, uses) => `I reach for ${product} when a job needs it${uses ? `, to ${uses}` : ""}`,
  TESTING: testing,
  WEEKLY: inUse(" most weeks", " most weeks"),
  DAILY: inUse(" daily", " on most working days"),
};

/** A card saved before levels says only Using, Testing or Used before, so its line says no more than that. */
const STATUS_WRITERS: Readonly<Record<RelationshipStatus, Writer>> = {
  ACTIVE: inUse("", ""),
  TESTING: testing,
  ARCHIVED: stopped,
};

/** The words up to the limit, ending on a whole word. Once a word doesn't fit, no later word is added. */
function wholeWords(text: string, limit: number): string {
  const { line } = text.split(" ").reduce((cut, word) => {
    if (cut.full) return cut;
    const next = cut.line ? `${cut.line} ${word}` : word;
    return next.length <= limit ? { line: next, full: false } : { line: cut.line, full: true };
  }, { line: "", full: false });
  return line.endsWith(",") ? line.slice(0, -1) : line;
}

export function suggestedHeadline(input: SuggestionInput): string {
  const write = input.level ? LEVEL_WRITERS[input.level] : STATUS_WRITERS[input.status];
  const product = input.productName.trim();
  const uses = [...new Set(input.uses.map(use => use.trim()).filter(Boolean))].slice(0, USES_NAMED);
  const years = { since: input.sinceYear, stopped: input.stoppedYear };
  // Both uses, then the first, then none, until the line fits.
  const lines = Array.from({ length: uses.length + 1 }, (_, dropped) => `${write(product, uses.slice(0, uses.length - dropped).join(" and "), years)}.`);
  return lines.find(line => line.length <= SUGGESTED_HEADLINE_MAX)
    ?? `${wholeWords(lines.at(-1)!.slice(0, -1), SUGGESTED_HEADLINE_MAX - 1)}.`;
}
