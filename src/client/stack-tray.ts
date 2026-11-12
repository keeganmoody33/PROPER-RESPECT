import { DEFAULT_STACK_LEVEL, levelStatus, RELATIONSHIP_LEVELS, type RelationshipLevel, type RelationshipStatus } from "@/src/domain/relationship-level";

export type TrayStatus = RelationshipStatus;

export const TRAY_LEVELS = RELATIONSHIP_LEVELS;

/**
 * What the owner chose for one tool. A level always travels with the status it implies. A list
 * saved before levels existed holds a status alone, so no level is chosen for it until the owner picks one.
 */
export type TrayChoice = Readonly<{ status: TrayStatus; level?: RelationshipLevel }>;

export function levelChoice(level: RelationshipLevel): TrayChoice {
  return { status: levelStatus(level), level };
}

// Matches MAX_STACK_PICKS in convex/stack.ts, which refuses anything larger.
export const TRAY_LIMIT = 100;
// normalizeProductName in convex/manualProducts.ts refuses a longer name, and one refusal fails the whole save.
export const TYPED_NAME_MAX = 160;

export type TrayEntry = Readonly<{ slug: string; name: string; domain: string }>;

/**
 * What the server would make of a typed name and website: a directory product, the owner's own
 * product (one per normalized name and website domain, "" without a website), or a refusal.
 */
export type TypedResolution =
  | Readonly<{ kind: "directory"; entry: TrayEntry }>
  | Readonly<{ kind: "typed"; domain: string }>
  | Readonly<{ kind: "refused"; message: string }>;

export type TrayItem =
  | (Readonly<{ key: string; kind: "directory"; slug: string; name: string; domain: string }> & TrayChoice)
  | (Readonly<{ key: string; kind: "typed"; name: string; website?: string }> & TrayChoice);

export type TrayAdded = Readonly<{ added: number; alreadySaved: number; alreadyListed: number; overLimit: number }>;

export type SavedSummary = Readonly<{ saved: number; created: number; confirmed: number; unchanged: number }>;

export type Tray = Readonly<{
  items: readonly TrayItem[];
  lastAdded: TrayAdded | null;
  saved: SavedSummary | null;
}>;

export type TrayAction =
  | { type: "addStarterSet"; entries: readonly TrayEntry[]; held: readonly string[] }
  | { type: "addEntry"; entry: TrayEntry; held: readonly string[] }
  | { type: "addTyped"; name: string; website?: string; resolution: Exclude<TypedResolution, { kind: "refused" }>; held: readonly string[] }
  | { type: "restore"; picks: readonly RestoredPick[]; held: readonly string[] }
  | { type: "setLevel"; key: string; level: RelationshipLevel }
  | { type: "remove"; key: string }
  | { type: "saved"; result: { created: number; confirmed: number; unchanged: number } };

export type StackPick =
  | { kind: "directory"; slug: string; status: TrayStatus; level?: RelationshipLevel }
  | { kind: "typed"; name: string; website?: string; status: TrayStatus; level?: RelationshipLevel };

/** A stored pick resolved again against the directory, ready to rejoin the tray with its choice. */
export type RestoredPick =
  | (Readonly<{ kind: "directory"; entry: TrayEntry }> & TrayChoice)
  | (Readonly<{ kind: "typed"; name: string; website?: string; domain: string }> & TrayChoice);

// Before the directory loads nothing can say which product a typed name is, and two
// spellings of one tool would both join the list and fail the whole save.
export type DirectoryLoad = "loading" | "failed";

/** A failed load never recovers on its own, so it must not offer anything that needs the list. */
export function directoryNote(load: DirectoryLoad) {
  return load === "failed" ? "The product list did not load. Reload the page to try again." : "Loading starter sets…";
}

export function resolveTypedWhenReady(resolver: ((name: string, website?: string) => TypedResolution) | null,
  name: string, website?: string, load: DirectoryLoad = "loading"): TypedResolution {
  if (resolver) return resolver(name, website);
  return { kind: "refused", message: load === "failed" ? directoryNote("failed") : "The product list is still loading. Add this tool again in a moment." };
}

export const emptyTray: Tray = { items: [], lastAdded: null, saved: null };

// Collapses whitespace like normalizeProductName in convex/manualProducts.ts, so a pasted
// non-breaking space keys the same product the server sees.
function typedName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function choiceOf(choice: TrayChoice): TrayChoice {
  return choice.level ? levelChoice(choice.level) : { status: choice.status };
}

function directoryItem(entry: TrayEntry, choice = levelChoice(DEFAULT_STACK_LEVEL)): TrayItem {
  return { key: `directory:${entry.slug}`, kind: "directory", slug: entry.slug, name: entry.name, domain: entry.domain, ...choiceOf(choice) };
}

function typedItem(name: string, website: string | undefined, domain: string, choice = levelChoice(DEFAULT_STACK_LEVEL)): TrayItem {
  const trimmed = website?.trim();
  return { key: `typed:${JSON.stringify([name.toLowerCase(), domain])}`, kind: "typed", name, ...(trimmed ? { website: trimmed } : {}), ...choiceOf(choice) };
}

function add(tray: Tray, candidates: readonly TrayItem[], held: readonly string[]): Tray {
  const heldSlugs = new Set(held);
  const result = candidates.reduce((next, candidate) => {
    if (candidate.kind === "directory" && heldSlugs.has(candidate.slug)) return { ...next, alreadySaved: next.alreadySaved + 1 };
    if (next.items.some(item => item.key === candidate.key)) return { ...next, alreadyListed: next.alreadyListed + 1 };
    if (next.items.length >= TRAY_LIMIT) return { ...next, overLimit: next.overLimit + 1 };
    return { ...next, items: [...next.items, candidate], added: next.added + 1 };
  }, { items: tray.items, added: 0, alreadySaved: 0, alreadyListed: 0, overLimit: 0 });
  const { items, ...lastAdded } = result;
  return { items, lastAdded, saved: lastAdded.added > 0 ? null : tray.saved };
}

type Handlers = { [Type in TrayAction["type"]]: (tray: Tray, action: Extract<TrayAction, { type: Type }>) => Tray };

const handlers: Handlers = {
  addStarterSet: (tray, action) => add(tray, action.entries.map(entry => directoryItem(entry)), action.held),
  addEntry: (tray, action) => add(tray, [directoryItem(action.entry)], action.held),
  addTyped: (tray, action) => {
    // A typed pick the server would resolve to a directory product joins as that
    // entry, so it is counted as saved or listed instead of saved twice.
    if (action.resolution.kind === "directory") return add(tray, [directoryItem(action.resolution.entry)], action.held);
    const name = typedName(action.name);
    return name && name.length <= TYPED_NAME_MAX ? add(tray, [typedItem(name, action.website, action.resolution.domain)], action.held) : tray;
  },
  restore: (tray, action) => add(tray, action.picks.flatMap((pick): TrayItem[] => {
    if (pick.kind === "directory") return [directoryItem(pick.entry, pick)];
    const name = typedName(pick.name);
    return name && name.length <= TYPED_NAME_MAX ? [typedItem(name, pick.website, pick.domain, pick)] : [];
  }), action.held),
  setLevel: (tray, action) => ({
    ...tray,
    items: tray.items.map(item => item.key === action.key ? { ...item, ...levelChoice(action.level) } : item),
  }),
  remove: (tray, action) => ({ ...tray, items: tray.items.filter(item => item.key !== action.key), lastAdded: null }),
  saved: (_tray, action) => ({
    items: [], lastAdded: null,
    saved: { saved: action.result.created + action.result.confirmed + action.result.unchanged, ...action.result },
  }),
};

export function trayReducer(tray: Tray, action: TrayAction): Tray {
  return (handlers[action.type] as (tray: Tray, action: TrayAction) => Tray)(tray, action);
}

export function trayPicks(tray: Tray): StackPick[] {
  return tray.items.map(item => {
    const choice = choiceOf(item);
    return item.kind === "directory"
      ? { kind: "directory", slug: item.slug, ...choice }
      : { kind: "typed", name: item.name, ...(item.website ? { website: item.website } : {}), ...choice };
  });
}

export type SaveAttempt = Readonly<{ body: string; operationId: string }>;

/** A retry of the same picks, in the same order, reuses its operation; any change starts a new one. */
export function saveAttempt(previous: SaveAttempt | null, picks: readonly StackPick[], newId: () => string): SaveAttempt {
  const body = JSON.stringify(picks);
  return previous?.body === body ? previous : { body, operationId: newId() };
}

/** The option an arrow key makes active among `count` options; a negative `current` means none is active yet. */
export function nextActiveOption(current: number, step: 1 | -1, count: number): number {
  if (count <= 0) return -1;
  if (current < 0 || current >= count) return step === 1 ? 0 : count - 1;
  return (current + step + count) % count;
}

export function saveButtonLabel(count: number) {
  return `Save ${count} tool${count === 1 ? "" : "s"} privately`;
}

export function signInToSaveLabel(count: number) {
  return `Sign in to save ${count} tool${count === 1 ? "" : "s"}`;
}

export function savedMessage(summary: SavedSummary) {
  // An unchanged tool may already be public, so the message speaks only for this save.
  const fresh = summary.created + summary.confirmed;
  const parts = [fresh ? `Saved ${fresh} tool${fresh === 1 ? "" : "s"} privately.` : "No new tools were saved.", "This save made nothing public."];
  if (summary.confirmed) parts.push(`${summary.confirmed} discover${summary.confirmed === 1 ? "y was" : "ies were"} confirmed.`);
  if (summary.unchanged) parts.push(`${summary.unchanged} already in your collection ${summary.unchanged === 1 ? "was left as it is" : "were left as they are"}, public or private.`);
  return parts.join(" ");
}

export function addedMessage(added: TrayAdded) {
  const parts: string[] = [];
  if (added.added) parts.push(`Added ${added.added} to your list.`);
  if (added.alreadySaved) parts.push(`${added.alreadySaved} already saved.`);
  if (added.alreadyListed) parts.push(`${added.alreadyListed} already in your list.`);
  if (added.overLimit) parts.push(`Your list holds ${TRAY_LIMIT} tools. Save these first, then add the rest.`);
  return parts.join(" ");
}
