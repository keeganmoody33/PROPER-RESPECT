export type TrayStatus = "ACTIVE" | "TESTING" | "ARCHIVED";

export const TRAY_STATUSES: readonly { value: TrayStatus; label: string }[] = [
  { value: "ACTIVE", label: "Currently use" },
  { value: "TESTING", label: "Testing" },
  { value: "ARCHIVED", label: "Used before" },
];

// Matches MAX_STACK_PICKS in convex/stack.ts, which refuses anything larger.
export const TRAY_LIMIT = 100;

export type TrayEntry = Readonly<{ slug: string; name: string; domain: string }>;

/** What the server would make of a typed name and website: a directory product, the owner's own product, or a refusal. */
export type TypedResolution =
  | Readonly<{ kind: "directory"; entry: TrayEntry }>
  | Readonly<{ kind: "typed" }>
  | Readonly<{ kind: "refused"; message: string }>;

export type TrayItem =
  | Readonly<{ key: string; kind: "directory"; slug: string; name: string; domain: string; status: TrayStatus }>
  | Readonly<{ key: string; kind: "typed"; name: string; website?: string; status: TrayStatus }>;

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
  | { type: "setStatus"; key: string; status: TrayStatus }
  | { type: "remove"; key: string }
  | { type: "saved"; result: { created: number; confirmed: number; unchanged: number } };

export type StackPick =
  | { kind: "directory"; slug: string; status: TrayStatus }
  | { kind: "typed"; name: string; website?: string; status: TrayStatus };

export const emptyTray: Tray = { items: [], lastAdded: null, saved: null };

function typedName(name: string) {
  return name.split(" ").filter(Boolean).join(" ").trim();
}

function directoryItem(entry: TrayEntry): TrayItem {
  return { key: `directory:${entry.slug}`, kind: "directory", slug: entry.slug, name: entry.name, domain: entry.domain, status: "ACTIVE" };
}

function typedItem(name: string, website: string | undefined): TrayItem {
  const trimmed = website?.trim();
  return { key: `typed:${name.toLowerCase()}`, kind: "typed", name, ...(trimmed ? { website: trimmed } : {}), status: "ACTIVE" };
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
  addStarterSet: (tray, action) => add(tray, action.entries.map(directoryItem), action.held),
  addEntry: (tray, action) => add(tray, [directoryItem(action.entry)], action.held),
  addTyped: (tray, action) => {
    // A typed pick the server would resolve to a directory product joins as that
    // entry, so it is counted as saved or listed instead of saved twice.
    if (action.resolution.kind === "directory") return add(tray, [directoryItem(action.resolution.entry)], action.held);
    const name = typedName(action.name);
    return name ? add(tray, [typedItem(name, action.website)], action.held) : tray;
  },
  setStatus: (tray, action) => ({
    ...tray,
    items: tray.items.map(item => item.key === action.key ? { ...item, status: action.status } : item),
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
  return tray.items.map(item => item.kind === "directory"
    ? { kind: "directory", slug: item.slug, status: item.status }
    : { kind: "typed", name: item.name, ...(item.website ? { website: item.website } : {}), status: item.status });
}

export type SaveAttempt = Readonly<{ body: string; operationId: string }>;

/** A retry of the same picks, in the same order, reuses its operation; any change starts a new one. */
export function saveAttempt(previous: SaveAttempt | null, picks: readonly StackPick[], newId: () => string): SaveAttempt {
  const body = JSON.stringify(picks);
  return previous?.body === body ? previous : { body, operationId: newId() };
}

export function saveButtonLabel(count: number) {
  return `Save ${count} tool${count === 1 ? "" : "s"} privately`;
}

export function savedMessage(summary: SavedSummary) {
  const parts = [`Saved ${summary.saved} tool${summary.saved === 1 ? "" : "s"} privately. Nothing is public yet.`];
  if (summary.confirmed) parts.push(`${summary.confirmed} discover${summary.confirmed === 1 ? "y was" : "ies were"} confirmed.`);
  if (summary.unchanged) parts.push(`${summary.unchanged} already in your collection kept ${summary.unchanged === 1 ? "its" : "their"} saved choices.`);
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
