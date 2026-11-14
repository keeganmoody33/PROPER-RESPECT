import { z } from "zod";

/** A preview stays a glance: a few columns, a few rows, short cells. */
export const TABLE_PREVIEW_LIMITS = { columns: 4, rows: 6, text: 40 } as const;

const text = z.string().min(1).max(TABLE_PREVIEW_LIMITS.text);
/** What a pending cell shows once it has filled in: a value found, or nothing found. */
const filledSchema = z.object({ text, state: z.enum(["filled", "empty"]) });
/** A cell can say it was filled in, is still being looked up, or came back empty, the way an enrichment table shows it. */
const cellSchema = z.object({ text, state: z.enum(["filled", "pending", "empty"]).optional(), fillsIn: filledSchema.optional() });
/**
 * A column is its label, or its label with how it's drawn: "enriched" for a column the product fills in (its header is tinted),
 * "droppable" for one a narrow card leaves out so the rest fit.
 */
const columnSchema = z.union([
  text.transform(label => ({ label, droppable: false, enriched: false })),
  z.object({ label: text, droppable: z.boolean().default(false), enriched: z.boolean().default(false) }),
]);

const tablePreviewSchema = z.object({
  caption: text,
  columns: z.array(columnSchema).min(1).max(TABLE_PREVIEW_LIMITS.columns).readonly(),
  rows: z.array(z.array(cellSchema).readonly()).min(1).max(TABLE_PREVIEW_LIMITS.rows).readonly(),
}).refine(table => table.rows.every(row => row.length === table.columns.length), "Every row needs one cell per column.");

/** A table as its author writes it: a column may be a bare label. */
export type TablePreviewInput = z.input<typeof tablePreviewSchema>;
export type TablePreview = Readonly<z.output<typeof tablePreviewSchema>>;
export type TablePreviewColumn = TablePreview["columns"][number];
export type TablePreviewCell = TablePreview["rows"][number][number];

/** The preview when it fits the caps, with every column spelled out; undefined otherwise, so an oversized or ragged table is never drawn. */
export function tablePreview(value: unknown): TablePreview | undefined {
  const parsed = tablePreviewSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
