import { isRelationshipConfirmed } from "@/src/domain/inventory";
import { creditPlatform, normalizeCredit, type CreditPlatform, type PropsCredit } from "@/src/domain/props-credit";
import { levelStatus, type RelationshipLevel, type RelationshipStatus } from "@/src/domain/relationship-level";
import type { ProductUses } from "@/src/domain/product-uses";
import { ownerLine } from "@/src/domain/system-lines";
import { initialOwnerHeadline } from "./headline-suggestion";

// One tool per screen, built from what the collection already holds (launch readiness, section 6, E1). Every answer is
// saved through inventory.save as it is given, so the queue itself is the progress: reload and it starts again at the
// first tool without a saved answer.

export type WalkthroughCard = Readonly<{
  prop: Readonly<{
    _id: string; productId: string; status: RelationshipStatus; level?: RelationshipLevel; visibility: "PUBLIC" | "PRIVATE" | "DRAFT";
    confirmedAt?: string; headline: string; note: string; ownerEntered?: boolean; goTo?: boolean; uses?: ProductUses; credit?: unknown;
    startedAt?: string; supportingUrl?: string; relationshipVersion?: number; activity?: unknown; activityEvidenceId?: string;
  }>;
  product?: Readonly<{ name: string; slug: string; domain: string }> | null;
  isPublishedAtCurrentHandle?: boolean;
}>;

export type WalkthroughItem = Readonly<{ propId: string; card: WalkthroughCard & { product: NonNullable<WalkthroughCard["product"]> } }>;

/** The owner's own words only, as share-all reads them: an app's words on an older card are dropped. */
const ownerWords = (card: WalkthroughCard, text: string) => ownerLine(text, card.product?.name ?? "");
/** A note stands in for a missing headline on the card, the same rule share-all uses, so "complete" here means "shares" there. */
export const walkthroughLine = (card: WalkthroughCard) => ownerWords(card, card.prop.headline).trim() || ownerWords(card, card.prop.note).trim();
const onPage = (card: WalkthroughCard) => card.isPublishedAtCurrentHandle === true || card.prop.visibility === "PUBLIC";
const complete = (card: WalkthroughCard) => isRelationshipConfirmed(card.prop) && Boolean(card.prop.level) && walkthroughLine(card) !== "";

/**
 * The tools still waiting for an answer, once per product: tools already confirmed first (they need a level or a line),
 * then finds awaiting a decision, each in collection order. A product already on the page, or with a complete record, is
 * left alone.
 */
export function walkthroughQueue(cards: readonly WalkthroughCard[]): WalkthroughItem[] {
  const byProduct = cards.filter((card): card is WalkthroughItem["card"] => Boolean(card.product)).reduce((groups, card) =>
    groups.set(card.prop.productId, [...groups.get(card.prop.productId) ?? [], card]), new Map<string, WalkthroughItem["card"][]>());
  const chosen = [...byProduct.values()].flatMap(members => members.some(member => onPage(member) || complete(member)) ? []
    : [members.find(member => isRelationshipConfirmed(member.prop)) ?? members[0]]);
  const confirmed = chosen.filter(card => isRelationshipConfirmed(card.prop));
  return [...confirmed, ...chosen.filter(card => !confirmed.includes(card))].map(card => ({ propId: card.prop._id, card }));
}

/** One stored source of a find, as inventory.evidence lists it. */
export type WalkthroughSource = Readonly<{ sourceType: string; route?: string; adapterId?: string }>;

const MAIL = new Set(["GMAIL", "MICROSOFT_MAIL"]);
const FILES = new Set(["FILE_UPLOAD", "SCREENSHOT", "CSV"]);

function sourceReason(productName: string, source: WalkthroughSource): string | undefined {
  if (MAIL.has(source.sourceType)) return "Found in your email";
  if (source.sourceType === "GITHUB") return "From your GitHub account";
  if (source.sourceType === "DEVIN") return "From your Devin account";
  if (source.adapterId === "sanitized-measurements") return `Your ${productName} usage`;
  if (source.route === "UPLOAD" || FILES.has(source.sourceType)) return "From a file you uploaded";
  return undefined;
}

/** Why a tool is on screen, from what is stored about it. Without a stored source it says only what is true. */
export function walkthroughReason(card: WalkthroughCard, sources: readonly WalkthroughSource[] | undefined): string {
  const name = card.product?.name ?? "this tool";
  if (card.prop.ownerEntered) return "You added it";
  const named = sources?.map(source => sourceReason(name, source)).find(Boolean);
  if (named) return named;
  if (card.prop.activity) return `Your ${name} activity, from a connected account`;
  return isRelationshipConfirmed(card.prop) ? "In your collection" : "Waiting for your answer";
}

/** Never used it is an answer, not a level: it saves nothing. */
export type WalkthroughChoice = RelationshipLevel | "NEVER";
export const PRIMARY_CHOICES = ["DAILY", "WEEKLY", "TESTING", "STOPPED", "NEVER"] as const satisfies readonly WalkthroughChoice[];
export const MORE_CHOICES = ["OCCASIONAL", "PAUSED", "TRIED_NOT_ADOPTED"] as const satisfies readonly WalkthroughChoice[];

export function choiceFields(choice: WalkthroughChoice | undefined) {
  if (!choice || choice === "NEVER") return { saves: null, asksUses: false, asksSince: false, asksCredit: false, asksLine: false };
  // A card never says "since" for a tool its owner didn't adopt.
  return { saves: { level: choice, status: levelStatus(choice) }, asksUses: true, asksSince: choice !== "TRIED_NOT_ADOPTED", asksCredit: true, asksLine: true };
}

export type WalkthroughAnswer = Readonly<{
  choice?: WalkthroughChoice; usePicks: readonly string[]; useOther: string; startedAt: string;
  creditPlatform: CreditPlatform; creditHandle: string; creditPlatformName: string;
  /** The owner's line, or null while untouched, so a suggestion can show without counting as theirs. */
  ownerLine: string | null;
  /**
   * The record's version when the screen opened. The answers on screen belong to that version, so a save or a removal
   * names it: if another tab has saved since, the server refuses instead of letting a form left open overwrite it.
   */
  openedVersion: number;
}>;

function savedCredit(stored: unknown): { platform: CreditPlatform; handle: string; platformName: string } {
  const credit = stored && typeof stored === "object" ? stored as Partial<PropsCredit> & { platformName?: string } : undefined;
  return { platform: creditPlatform(credit?.platform) ?? "PROPER_RESPECT", handle: credit?.handle ?? "", platformName: credit?.platformName ?? "" };
}

/** The screen starts from the owner's saved answers. A draft's status is a system guess, so no level is preselected for it. */
export function initialAnswer(card: WalkthroughCard): WalkthroughAnswer {
  const confirmed = isRelationshipConfirmed(card.prop);
  const credit = savedCredit(card.prop.credit);
  return {
    choice: confirmed ? card.prop.level : undefined, usePicks: card.prop.uses?.picks ?? [], useOther: card.prop.uses?.other ?? "",
    startedAt: card.prop.startedAt ?? "", creditPlatform: credit.platform, creditHandle: credit.handle, creditPlatformName: credit.platformName,
    ownerLine: initialOwnerHeadline(confirmed ? ownerWords(card, card.prop.headline) : ""),
    openedVersion: card.prop.relationshipVersion ?? 0,
  };
}

/**
 * What the main button says and the line it saves. An untouched suggestion is saved only by a button that says it keeps
 * it, and then exactly as shown. Skip is a separate control and never saves anything.
 */
export function lineAction(owner: string | null, suggestion: string | undefined, note = ""): { label: string; headline: string; keepsSuggestion: boolean; standIn?: string } {
  if (owner === null && suggestion) return { label: "Keep this line and go on", headline: suggestion, keepsSuggestion: true };
  if (owner !== null && owner.trim()) return { label: "Save and go on", headline: owner, keepsSuggestion: false };
  // A kept note shows on the card in place of a line, so the button doesn't say the card has none.
  return note ? { label: "Save and go on", headline: "", keepsSuggestion: false, standIn: note }
    : { label: "Save without a line and go on", headline: "", keepsSuggestion: false };
}

/**
 * Never used it removes a bare record: one never published, with no evidence, activity or measurement attached
 * (inventory.removeNeverUsed checks the same on the server). Anything else stays as it is and nothing new is saved.
 * Until its sources have loaded, nothing is removed. The server has the last word: once it has kept a record this screen
 * took for bare, the answer is to leave it.
 */
export function neverUsedAction(card: WalkthroughCard, sourceCount: number | undefined, keptByServer = false) {
  const bare = !keptByServer && sourceCount === 0 && !onPage(card) && !card.prop.activity && !card.prop.activityEvidenceId;
  return bare ? { kind: "remove" as const, label: "Remove it and go on" } : { kind: "leave" as const, label: "Leave it as it is and go on" };
}

const MISSING_CHOICE = "Choose how you use it first.";

// A draft's note was written by the system that found it; the owner writes their own (as RelationshipEditor does).
const savedNote = (card: WalkthroughCard) => isRelationshipConfirmed(card.prop) || card.prop.ownerEntered ? ownerWords(card, card.prop.note) : "";
/** The note a save keeps: the owner's own words. On the card it stands in for a missing line. */
export const keptNote = (card: WalkthroughCard) => savedNote(card).trim();

/** The inventory.save arguments for an answer, less its operation id. What the walkthrough doesn't ask is sent back as saved. */
export function walkthroughSave(card: WalkthroughCard, answer: WalkthroughAnswer, headline: string) {
  const fields = choiceFields(answer.choice);
  if (!fields.saves) return { ok: false as const, message: MISSING_CHOICE };
  const credit = normalizeCredit({ platform: answer.creditPlatform, handle: answer.creditHandle,
    ...(answer.creditPlatformName.trim() ? { platformName: answer.creditPlatformName } : {}) });
  if (!credit.ok) return { ok: false as const, message: credit.message };
  const other = answer.useOther.trim();
  return { ok: true as const, args: {
    propId: card.prop._id, expectedVersion: answer.openedVersion, ...fields.saves, goTo: card.prop.goTo ?? false,
    headline, note: savedNote(card),
    uses: answer.usePicks.length || other ? { picks: [...answer.usePicks], ...(other ? { other } : {}) } : undefined,
    credit: credit.credit, startedAt: answer.startedAt || undefined, supportingUrl: card.prop.supportingUrl,
  } };
}

export type WalkthroughOutcome = "saved" | "skipped" | "removed" | "left";
/** `products` names the product each tool in `order` is a record of, so a product is asked about once. */
export type WalkthroughSession = Readonly<{ order: readonly string[]; settled: Readonly<Record<string, WalkthroughOutcome>>; products: Readonly<Record<string, string>> }>;

const productsOf = (items: readonly WalkthroughItem[]) => Object.fromEntries(items.map(item => [item.propId, item.card.prop.productId]));

/** The tools there are when the walkthrough starts. Skips live only here: after a reload a skipped tool is asked again. */
export function startSession(queue: readonly WalkthroughItem[]): WalkthroughSession {
  return { order: queue.map(item => item.propId), settled: {}, products: productsOf(queue) };
}

/**
 * Adds tools that arrived since it started, for example a later page of the collection. Another record of a product
 * already answered here stays out: removing one record of a product must not bring its twin up as a new tool.
 */
export function resumeSession(session: WalkthroughSession, queue: readonly WalkthroughItem[]): WalkthroughSession {
  const answered = new Set(session.order.filter(id => session.settled[id]).map(id => session.products[id]));
  const added = queue.filter(item => !session.order.includes(item.propId) && !answered.has(item.card.prop.productId));
  return added.length ? { ...session, order: [...session.order, ...added.map(item => item.propId)], products: { ...session.products, ...productsOf(added) } } : session;
}

export function settle(session: WalkthroughSession, propId: string, outcome: WalkthroughOutcome): WalkthroughSession {
  return { ...session, settled: { ...session.settled, [propId]: outcome } };
}

/** The first tool not yet answered here and still waiting, so one finished elsewhere is passed over. */
export function currentTool(session: WalkthroughSession, queue: readonly WalkthroughItem[]): WalkthroughItem | undefined {
  const waiting = new Map(queue.map(item => [item.propId, item]));
  const id = session.order.find(propId => !session.settled[propId] && waiting.has(propId));
  return id === undefined ? undefined : waiting.get(id);
}

/** "6 of 14", counted against the tools there were when it started, so a saved answer doesn't shrink the total. */
export function progressLine(session: WalkthroughSession, queue: readonly WalkthroughItem[]): string {
  const current = currentTool(session, queue);
  return current ? `${session.order.indexOf(current.propId) + 1} of ${session.order.length}` : "";
}
