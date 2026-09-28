// "Download my data" (R15): the owner's records, assembled from the paged
// export queries in convex/inventory.ts. Originals, storage references,
// tokens and credentials are never part of the export.

export type ExportPage<T> = { page: T[]; isDone: boolean; continueCursor: string };

/** Reads every page, following the cursor, and stops if it fails to advance. */
export async function collectPages<T>(fetchPage: (cursor: string | null) => Promise<ExportPage<T>>, maxPages = 1000): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | null = null;
  for (let pages = 0; pages < maxPages; pages++) {
    const result: ExportPage<T> = await fetchPage(cursor);
    rows.push(...result.page);
    if (result.isDone) return rows;
    if (result.continueCursor === cursor) break;
    cursor = result.continueCursor;
  }
  throw new Error("The export did not finish. Try again; nothing was changed.");
}

export const EXPORT_EXCLUSIONS = [
  "Original files and retained original text (delete or view them in your private collection).",
  "Connector credentials, upload tokens and storage references.",
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
