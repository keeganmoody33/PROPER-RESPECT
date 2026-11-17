import { normalizeCredit, type CreditPlatform } from "@/src/domain/props-credit";
import { productUseOptions, USE_OTHER_MAX, USE_PICKS_MAX } from "@/src/domain/product-uses";
import { isStartDate, isYearOnly } from "@/src/domain/start-date";
import { SUGGESTED_HEADLINE_MAX } from "@/src/domain/suggested-headline";
import { initialAnswer, keptNote, walkthroughSave, type WalkthroughAnswer, type WalkthroughItem } from "./walkthrough";

// Rapid fire (voice onboarding spec, section 4b): one card per tool, answered by talking or tapping. Moving on saves
// the card privately in the background; a check screen at the end lets the owner fix anything; publishing and removal
// stay taps. Everything here is pure, so voice and taps reach the same answers.

/** The walkthrough's answer plus what the owner said about the tool, kept in their own words. */
export type RapidFireAnswer = WalkthroughAnswer & Readonly<{ comment: string }>;

/**
 * open: not moved on from yet. saved: the answer as last moved on from is saved. noAnswer: no level, so nothing saved.
 * never: Never used it, waiting for the batched removal at the check screen. notSaved: the save was refused.
 * removed and kept: what the batched removal did.
 */
export type RapidFireStatus = "open" | "saving" | "saved" | "noAnswer" | "never" | "notSaved" | "removed" | "kept";

export type RapidFireCard = Readonly<{
  item: WalkthroughItem; answer: RapidFireAnswer; status: RapidFireStatus;
  /** The record's version this card's next save names, so a change made elsewhere is refused, not overwritten. */
  version: number;
  /** The save arguments last sent, so moving on again without a change saves nothing new. */
  savedBody?: string; error?: string;
  /** Fixed on the tool's own screen at the check: what shows is what that screen saved. */
  fixed?: boolean;
}>;

export const rapidFireCards = (items: readonly WalkthroughItem[]): RapidFireCard[] => items.map(item => ({
  item, answer: { ...initialAnswer(item.card), comment: "" }, status: "open", version: item.card.prop.relationshipVersion ?? 0,
}));

export const STATUS_LABEL: Readonly<Record<RapidFireStatus, string>> = {
  open: "No answer yet", saving: "Saving…", saved: "Saved", noAnswer: "No answer yet", never: "Never used it",
  notSaved: "Not saved", removed: "Removed", kept: "Kept: it has evidence attached",
};

// Sounds that carry no meaning, and two phrases only when set off as asides. "Like" alone is a real word, so it goes
// only between commas or before one at the start ("like, it's great").
const FILLER_WORDS = /(^|[\s,.;!?])(?:u+m+|u+h+|e+r+m+|e+r+|h+m+|m+h*m+)(?=$|[\s,.;!?])/gi;
const ASIDE = "(?:you know|i mean|like|sort of|kind of)";
const FILLER_ASIDES = new RegExp(`\\s*,\\s*${ASIDE}\\s*,\\s*`, "gi");
const TRAILING_ASIDES = new RegExp(`\\s*,\\s*${ASIDE}\\s*(?=[.!?]|$)`, "gi");
const LEADING_LIKE = /^(\s*)like\s*,\s*/i;

/** Their words as said, with filler sounds and asides taken out and nothing else changed (decision 4). */
export function removeFillers(text: string): string {
  let words = text.replace(/\s+/g, " ");
  for (let before = ""; before !== words;) {
    before = words;
    words = words.replace(FILLER_WORDS, "$1").replace(FILLER_ASIDES, " ").replace(TRAILING_ASIDES, "").replace(LEADING_LIKE, "$1");
  }
  return words.replace(/\s+([,.;!?])/g, "$1").replace(/([,;])(?:\s*[,;])+/g, "$1").replace(/\s+/g, " ")
    .replace(/^[\s,;]+|[\s,;]+$/g, "").replace(/^\p{Ll}/u, letter => letter.toUpperCase());
}

/** Adds what they just said to what they said earlier about this tool. */
export function addComment(comment: string, said: string): string {
  const cleaned = removeFillers(said);
  if (!cleaned) return comment;
  return comment ? `${comment} ${cleaned}` : cleaned;
}

/** A comment as the card's line: cut on a whole word to the line's length. */
export function lineFromComment(comment: string): string {
  const text = comment.trim();
  if (text.length <= SUGGESTED_HEADLINE_MAX) return text;
  const cut = text.slice(0, SUGGESTED_HEADLINE_MAX + 1);
  const space = cut.lastIndexOf(" ");
  return (space > 0 ? cut.slice(0, space) : text.slice(0, SUGGESTED_HEADLINE_MAX)).replace(/[\s,;:]+$/, "");
}

export const NOTE_MAX = 4000;
const NOTE_TOO_LONG = "Your saved note and what you said come to more than 4,000 characters. Shorten what you said.";
/** The note a save keeps: the owner's saved note, then what they said here. Never cut: a save over the limit is refused. */
export function rapidFireNote(item: WalkthroughItem, comment: string): string {
  return [keptNote(item.card), comment.trim()].filter(Boolean).join("\n\n");
}

/** What moving on from a card does: save these arguments, or nothing, and why. */
export function rapidFireSave(card: RapidFireCard) {
  const { answer, item } = card;
  if (!answer.choice) return { kind: "none" as const, status: "noAnswer" as const };
  if (answer.choice === "NEVER") return { kind: "none" as const, status: "never" as const };
  if (answer.startedAt && !isStartDate(answer.startedAt)) return { kind: "error" as const, message: "Say the year, or a full date." };
  // Only the owner's own line is saved. A template suggestion is never kept without the tap that says it keeps it.
  const result = walkthroughSave(item.card, { ...answer, openedVersion: card.version }, answer.ownerLine?.trim() ? answer.ownerLine : "");
  if (!result.ok) return { kind: "error" as const, message: result.message };
  const note = rapidFireNote(item, answer.comment);
  if (note.length > NOTE_MAX) return { kind: "error" as const, message: NOTE_TOO_LONG };
  const args = { ...result.args, note };
  // The answers alone, without the version they name, so going back and on again unchanged saves nothing new.
  return { kind: "save" as const, args, body: JSON.stringify({ ...args, expectedVersion: undefined }) };
}

/** A year or a full date, as heard. A month or day that wasn't said is never filled in (decision 6). */
export function sinceAnswer(said: string, today = new Date()): { ok: true; value: string } | { ok: false; message: string } {
  const value = said.trim();
  if (!isStartDate(value)) return { ok: false, message: "Give a year like 2023, or a full date like 2023-04-01." };
  const year = Number(value.slice(0, 4));
  if (year < 1990 || (isYearOnly(value) ? year > today.getUTCFullYear() : value > today.toISOString().slice(0, 10))) {
    return { ok: false, message: "That date is out of range." };
  }
  return { ok: true, value };
}

/** Uses heard by voice: only listed ids, the rest in their words in Something else. */
export function usesAnswer(answer: RapidFireAnswer, productSlug: string, picks: readonly string[], other: string | undefined, mode: "replace" | "add") {
  const listed = new Set(productUseOptions(productSlug).map(option => option.id));
  const known = picks.filter(id => listed.has(id));
  const unknown = picks.filter(id => !listed.has(id));
  const merged = [...new Set([...(mode === "add" ? answer.usePicks : []), ...known])].slice(0, USE_PICKS_MAX);
  const words = other === undefined ? (mode === "add" ? answer.useOther : "") : removeFillers(other).slice(0, USE_OTHER_MAX).trim();
  return { patch: { usePicks: merged, useOther: words }, unknown };
}

/** Who put them on it, checked the way a save checks it before it shows. */
export function creditAnswer(platform: CreditPlatform, handle: string, platformName?: string) {
  const credit = normalizeCredit({ platform, handle, ...(platformName?.trim() ? { platformName } : {}) });
  if (!credit.ok) return { ok: false as const, message: credit.message };
  return { ok: true as const, patch: { creditPlatform: platform, creditHandle: handle.trim(), creditPlatformName: platform === "OTHER" ? platformName?.trim() ?? "" : "" } };
}

export function rapidFireTally(cards: readonly RapidFireCard[]) {
  const count = (...statuses: RapidFireStatus[]) => cards.filter(card => statuses.includes(card.status)).length;
  return { saved: count("saved"), never: count("never"), notSaved: count("notSaved"), waiting: count("open", "noAnswer", "saving") };
}
