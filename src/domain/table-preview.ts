import { z } from "zod";

/** A preview stays a glance: a few columns, a few rows, short cells. */
export const TABLE_PREVIEW_LIMITS = { columns: 4, rows: 6, text: 40 } as const;

const text = z.string().min(1).max(TABLE_PREVIEW_LIMITS.text);
/** A cell can say it was filled in, is still being looked up, or came back empty, the way an enrichment table shows it. */
const cellSchema = z.object({ text, state: z.enum(["filled", "pending", "empty"]).optional() });

const tablePreviewSchema = z.object({
  caption: text,
  columns: z.array(text).min(1).max(TABLE_PREVIEW_LIMITS.columns),
  rows: z.array(z.array(cellSchema)).min(1).max(TABLE_PREVIEW_LIMITS.rows),
}).refine(table => table.rows.every(row => row.length === table.columns.length), "Every row needs one cell per column.");

export type TablePreview = Readonly<{
  caption: string;
  columns: readonly string[];
  rows: readonly (readonly Readonly<z.infer<typeof cellSchema>>[])[];
}>;

/** The preview when it fits the caps; undefined otherwise, so an oversized or ragged table is never drawn. */
export function tablePreview(value: unknown): TablePreview | undefined {
  const parsed = tablePreviewSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
