import { z } from "zod";

export type RelationshipStatus = "ACTIVE" | "TESTING" | "ARCHIVED";

/**
 * How often a person says they use a tool, cold to hot. The person picks it; nothing derives it
 * from activity. The order is for display and filtering only, never a score. Status is the stored
 * compatibility field each level implies.
 */
export const RELATIONSHIP_LEVELS = [
  { key: "TRIED_NOT_ADOPTED", label: "Tried, didn't adopt", definition: "I tried it and decided not to use it.", status: "ARCHIVED" },
  { key: "STOPPED", label: "Stopped using", definition: "I used it for real work and no longer do.", status: "ARCHIVED" },
  { key: "PAUSED", label: "Paused", definition: "I'm not using it now and may come back.", status: "ARCHIVED" },
  { key: "OCCASIONAL", label: "Occasionally", definition: "I reach for it less than once a week, when a job needs it.", status: "ACTIVE" },
  { key: "TESTING", label: "Testing", definition: "I'm evaluating it and haven't decided.", status: "TESTING" },
  { key: "WEEKLY", label: "Weekly", definition: "I use it most weeks.", status: "ACTIVE" },
  { key: "DAILY", label: "Daily", definition: "I use it on most working days.", status: "ACTIVE" },
] as const satisfies readonly { key: string; label: string; definition: string; status: RelationshipStatus }[];

export type RelationshipLevel = typeof RELATIONSHIP_LEVELS[number]["key"];
export type RelationshipLevelEntry = typeof RELATIONSHIP_LEVELS[number];

export const RELATIONSHIP_LEVEL_KEYS = RELATIONSHIP_LEVELS.map(level => level.key) as [RelationshipLevel, ...RelationshipLevel[]];
export const relationshipLevelSchema = z.enum(RELATIONSHIP_LEVEL_KEYS);

export const DEFAULT_STACK_LEVEL: RelationshipLevel = "WEEKLY";

const STATUS_FALLBACK_LABELS: Record<RelationshipStatus, string> = {
  ACTIVE: "Using",
  TESTING: "Testing",
  ARCHIVED: "Used before",
};

const byKey = new Map<string, RelationshipLevelEntry>(RELATIONSHIP_LEVELS.map(level => [level.key, level]));

export function isRelationshipLevel(value: unknown): value is RelationshipLevel {
  return typeof value === "string" && byKey.has(value);
}

function entry(key: RelationshipLevel): RelationshipLevelEntry {
  return byKey.get(key)!;
}

export function levelStatus(key: RelationshipLevel): RelationshipStatus {
  return entry(key).status;
}

export function levelLabel(key: RelationshipLevel): string {
  return entry(key).label;
}

export function levelDefinition(key: RelationshipLevel): string {
  return entry(key).definition;
}

export function statusFallbackLabel(status: RelationshipStatus): string {
  return STATUS_FALLBACK_LABELS[status];
}

/** A level and a status may travel together only when the status is the one the level implies. */
export function levelMatchesStatus(level: RelationshipLevel | undefined, status: RelationshipStatus): boolean {
  return level === undefined || levelStatus(level) === status;
}

export function cardStatusLabel(card: { status: RelationshipStatus; level?: RelationshipLevel }): string {
  return card.level ? levelLabel(card.level) : statusFallbackLabel(card.status);
}

const YEAR_LENGTH = 4;

/** The card's top line, for example "DAILY · SINCE 2021". Never invents a date. */
export function cardTopLine(card: { status: RelationshipStatus; level?: RelationshipLevel; startedAt?: string }): string {
  const label = cardStatusLabel(card).toUpperCase();
  // Someone who never adopted a tool has no "since".
  if (!card.startedAt || card.level === "TRIED_NOT_ADOPTED") return label;
  return `${label} · SINCE ${card.startedAt.slice(0, YEAR_LENGTH)}`;
}
