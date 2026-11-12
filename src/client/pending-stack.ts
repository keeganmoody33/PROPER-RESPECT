import { z } from "zod";
import { TRAY_LIMIT, TYPED_NAME_MAX, trayPicks, type RestoredPick, type StackPick, type Tray, type TrayEntry, type TypedResolution } from "./stack-tray";

/**
 * The list a visitor builds before signing in rides across sign-in in this tab's
 * sessionStorage. Only product picks are stored: directory slugs, typed names and
 * websites, and statuses. Names and domains are looked up again when the list returns.
 */
export const PENDING_STACK_KEY = "proper-respect:pending-stack:v1";

export const PENDING_WEBSITE_MAX = 2_048;
const SLUG_MAX = 80;
// JSON writes a control character as six: \u0001.
const JSON_ESCAPE_MAX = 6;
const PICK_OVERHEAD = 100;
// The largest list the builder can write: a full tray of typed picks at their longest, every character escaped.
export const PENDING_STACK_MAX_CHARS = PICK_OVERHEAD + TRAY_LIMIT * (PICK_OVERHEAD + JSON_ESCAPE_MAX * (TYPED_NAME_MAX + PENDING_WEBSITE_MAX));

const status = z.enum(["ACTIVE", "TESTING", "ARCHIVED"]);
const pendingStackSchema = z.object({
  version: z.literal(1),
  picks: z.array(z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("directory"), slug: z.string().min(1).max(SLUG_MAX), status }).strict(),
    z.object({ kind: z.literal("typed"), name: z.string().min(1).max(TYPED_NAME_MAX), website: z.string().max(PENDING_WEBSITE_MAX).optional(), status }).strict(),
  ])).max(TRAY_LIMIT),
}).strict();

export type PendingDirectory = Readonly<{
  entry: (slug: string) => TrayEntry | null;
  resolveTypedPick: (name: string, website?: string) => TypedResolution;
}>;

export function serializePendingStack(tray: Tray): string | null {
  return tray.items.length ? JSON.stringify({ version: 1, picks: trayPicks(tray) }) : null;
}

/** Anything that is not exactly a current, in-limit pending stack restores nothing. */
export function parsePendingStack(raw: string | null): StackPick[] {
  if (!raw || raw.length > PENDING_STACK_MAX_CHARS) return [];
  try {
    const parsed = pendingStackSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data.picks : [];
  } catch {
    return [];
  }
}

export function restorablePicks(picks: readonly StackPick[], directory: PendingDirectory): RestoredPick[] {
  return picks.flatMap((pick): RestoredPick[] => {
    if (pick.kind === "directory") {
      const entry = directory.entry(pick.slug);
      return entry ? [{ kind: "directory", entry: { slug: entry.slug, name: entry.name, domain: entry.domain }, status: pick.status }] : [];
    }
    const resolution = directory.resolveTypedPick(pick.name, pick.website);
    if (resolution.kind === "refused") return [];
    if (resolution.kind === "directory") return [{ kind: "directory", entry: resolution.entry, status: pick.status }];
    return [{ kind: "typed", name: pick.name, ...(pick.website ? { website: pick.website } : {}), domain: resolution.domain, status: pick.status }];
  });
}

export function readPendingStack(): StackPick[] {
  try {
    return parsePendingStack(window.sessionStorage.getItem(PENDING_STACK_KEY));
  } catch {
    return [];
  }
}

/**
 * The key is shared by everyone who uses this tab, so it only carries a signed-out
 * visitor's list across sign-in. A signed-in owner's unsaved list is never written to it.
 */
export function pendingStackValue(tray: Tray, signedIn: boolean): string | null {
  return signedIn ? null : serializePendingStack(tray);
}

export function writePendingStack(tray: Tray, signedIn: boolean) {
  try {
    const value = pendingStackValue(tray, signedIn);
    if (value) window.sessionStorage.setItem(PENDING_STACK_KEY, value);
    else window.sessionStorage.removeItem(PENDING_STACK_KEY);
  } catch {
    // Storage can be full or blocked; the list still works for this page view.
  }
}
