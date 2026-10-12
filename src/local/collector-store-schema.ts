import type { DatabaseSync } from "node:sqlite";

export const COMPANION_SCHEMA_VERSION = 1;
export const RECEIVER_SCHEMA_VERSION = 1;

function versionRow(database: DatabaseSync): number {
  const row = database.prepare("PRAGMA user_version").get();
  if (!row || typeof row !== "object" || !("user_version" in row) || typeof row.user_version !== "number" || !Number.isInteger(row.user_version) || row.user_version < 0) {
    throw new Error("Collector store schema version is unavailable.");
  }
  return row.user_version;
}

/** Refuse a store written by a newer binary; callers migrate older versions. */
export function readStoreSchemaVersion(database: DatabaseSync, expected: number): number {
  const version = versionRow(database);
  if (version > expected) throw new Error("Collector store schema is newer than this process.");
  return version;
}

export function setStoreSchemaVersion(database: DatabaseSync, version: number): void {
  if (!Number.isInteger(version) || version < 1 || version > 0xffff) throw new Error("Collector store schema version is invalid.");
  database.exec(`PRAGMA user_version = ${version}`);
}
