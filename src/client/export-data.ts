// "Download my data" (R15): the owner's records, assembled from the paged
// export queries in convex/inventory.ts. Originals, storage references,
// tokens and credentials are never part of the export.

export type ExportPage<T> = { page: T[]; isDone: boolean; continueCursor: string };

/** Reads every page, however many, and stops if a cursor repeats. */
export async function collectPages<T>(fetchPage: (cursor: string | null) => Promise<ExportPage<T>>): Promise<T[]> {
  const rows: T[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  for (;;) {
    const result: ExportPage<T> = await fetchPage(cursor);
    rows.push(...result.page);
    if (result.isDone) return rows;
    if (seen.has(result.continueCursor) || result.continueCursor === cursor) {
      throw new Error("The export did not finish. Try again; nothing was changed.");
    }
    seen.add(result.continueCursor);
    cursor = result.continueCursor;
  }
}

export const EXPORT_EXCLUSIONS = [
  "Original files and retained original text (delete or view them in your private collection).",
  "Connector credentials, upload tokens and storage references.",
  "Private imported exact measurement rows and measurement review history. Approved projections already in your public snapshot are included with that snapshot.",
  "Content hashes and deduplication keys, which only identify files and records inside Proper Respect.",
  "Not in this file yet: connected accounts, usage readings collected from connected accounts (the activity saved on each relationship is included), daily refresh settings and their run history, your verdicts on individual observations, supporting proofs and artifacts, earlier handles, and imports still in review. Ask through the contact page for a copy.",
] as const;

export function buildExport<P, R, E>({ profile, relationships, evidence, exportedAt }: { profile: P; relationships: R[]; evidence: E[]; exportedAt: string }) {
  return { format: "proper-respect-export" as const, version: 1 as const, exportedAt, excluded: [...EXPORT_EXCLUSIONS], profile, relationships, evidence };
}

export function exportFilename(handle: string | undefined, exportedAt: string) {
  return `proper-respect-${handle || "account"}-${exportedAt.slice(0, 10)}.json`;
}

/** Saves a JSON file in the browser. */
export function downloadJson(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
