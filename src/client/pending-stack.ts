import { z } from "zod";
import { TRAY_LIMIT, TYPED_NAME_MAX, trayPicks, type RestoredPick, type StackPick, type Tray, type TrayChoice, type TrayEntry, type TypedResolution } from "./stack-tray";
import { levelMatchesStatus, relationshipLevelSchema } from "@/src/domain/relationship-level";

/**
 * The list a visitor builds before signing in rides across sign-in in this tab's
 * sessionStorage. Only product picks are stored: directory slugs, typed names and
 * websites, and levels with their statuses. Names and domains are looked up again when the list returns.
 * Version 1 lists, stored before levels, hold statuses alone and still restore.
 */
export const PENDING_STACK_KEY = "proper-respect:pending-stack:v1";

// A full list of typed picks with long websites stays well under this.
export const PENDING_STACK_MAX_CHARS = 64_000;
export const PENDING_WEBSITE_MAX = 2_048;
const SLUG_MAX = 80;

const status = z.enum(["ACTIVE", "TESTING", "ARCHIVED"]);
const directoryPick = z.object({ kind: z.literal("directory"), slug: z.string().min(1).max(SLUG_MAX), status }).strict();
const typedPick = z.object({ kind: z.literal("typed"), name: z.string().min(1).max(TYPED_NAME_MAX), website: z.string().max(PENDING_WEBSITE_MAX).optional(), status }).strict();
const level = { level: relationshipLevelSchema.optional() };
const pendingStackSchema = z.union([
  z.object({ version: z.literal(1), picks: z.array(z.discriminatedUnion("kind", [directoryPick, typedPick])).max(TRAY_LIMIT) }).strict(),
  z.object({ version: z.literal(2), picks: z.array(z.discriminatedUnion("kind", [directoryPick.extend(level), typedPick.extend(level)])
    .refine(pick => levelMatchesStatus(pick.level, pick.status))).max(TRAY_LIMIT) }).strict(),
]);

// Testing is the one status that names exactly one level; the others leave the level for the owner to choose.
function restoredChoice(pick: StackPick): TrayChoice {
  if (pick.level) return { status: pick.status, level: pick.level };
  return pick.status === "TESTING" ? { status: "TESTING", level: "TESTING" } : { status: pick.status };
}

export type PendingDirectory = Readonly<{
  entry: (slug: string) => TrayEntry | null;
  resolveTypedPick: (name: string, website?: string) => TypedResolution;
}>;

export function serializePendingStack(tray: Tray): string | null {
  return tray.items.length ? JSON.stringify({ version: 2, picks: trayPicks(tray) }) : null;
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
      return entry ? [{ kind: "directory", entry: { slug: entry.slug, name: entry.name, domain: entry.domain }, ...restoredChoice(pick) }] : [];
    }
    const resolution = directory.resolveTypedPick(pick.name, pick.website);
    if (resolution.kind === "refused") return [];
    if (resolution.kind === "directory") return [{ kind: "directory", entry: resolution.entry, ...restoredChoice(pick) }];
    return [{ kind: "typed", name: pick.name, ...(pick.website ? { website: pick.website } : {}), domain: resolution.domain, ...restoredChoice(pick) }];
  });
}

export function readPendingStack(): StackPick[] {
  try {
    return parsePendingStack(window.sessionStorage.getItem(PENDING_STACK_KEY));
  } catch {
    return [];
  }
}

export function writePendingStack(tray: Tray) {
  try {
    const value = serializePendingStack(tray);
    if (value) window.sessionStorage.setItem(PENDING_STACK_KEY, value);
    else window.sessionStorage.removeItem(PENDING_STACK_KEY);
  } catch {
    // Storage can be full or blocked; the list still works for this page view.
  }
}
