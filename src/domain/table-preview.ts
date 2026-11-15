import { z } from "zod";

/** A preview stays a glance: a few columns, a few rows, short cells, and a caption that can say where the list came from. */
export const TABLE_PREVIEW_LIMITS = { columns: 4, rows: 8, text: 40, caption: 80 } as const;
/** A waterfall tries at most this many providers in turn. */
const MAX_WATERFALL_STEPS = 6;

const text = z.string().min(1).max(TABLE_PREVIEW_LIMITS.text);
/** Which provider of a waterfall answered (or, while it runs, is being asked), counting from 1, of how many it tries in turn. */
const waterfallSchema = z.object({ step: z.number().int().min(1), of: z.number().int().min(1).max(MAX_WATERFALL_STEPS) })
  .refine(waterfall => waterfall.step <= waterfall.of, "A waterfall's step is one of its providers.");
/** What a pending cell shows once it has filled in: a value found, or nothing found. */
const filledSchema = z.object({ text, state: z.enum(["filled", "empty"]), waterfall: waterfallSchema.optional() });
/**
 * A cell can say it was filled in, is still being looked up, or came back empty, the way an enrichment table shows it,
 * and can carry a second, quieter line under its text (a person's title under their name).
 */
const cellSchema = z.object({ text, detail: text.optional(), state: z.enum(["filled", "pending", "empty"]).optional(), waterfall: waterfallSchema.optional(), fillsIn: filledSchema.optional() });
/** The kinds of column an enrichment table draws a glyph for: typed text, a found address, a provider waterfall, an AI prompt, a formula. */
export const TABLE_COLUMN_KINDS = ["text", "email", "waterfall", "ai", "formula"] as const;
/** A column is its label, or its label with how it's drawn: "enriched" for a column the product fills in (its header is tinted), and its kind for the glyph in its header. */
const columnSchema = z.union([
  text.transform(label => ({ label, enriched: false })),
  z.object({ label: text, kind: z.enum(TABLE_COLUMN_KINDS).optional(), enriched: z.boolean().default(false) }),
]);

const tablePreviewSchema = z.object({
  caption: z.string().min(1).max(TABLE_PREVIEW_LIMITS.caption),
  columns: z.array(columnSchema).min(1).max(TABLE_PREVIEW_LIMITS.columns).readonly(),
  rows: z.array(z.array(cellSchema).readonly()).min(1).max(TABLE_PREVIEW_LIMITS.rows).readonly(),
  /** How many of the rows the card's front shows; the back shows them all. */
  frontRows: z.number().int().min(1).optional(),
  /** How many rows the whole table has, of which these are a few. */
  totalRows: z.number().int().min(1).optional(),
  /** What the whole table came to, in a line under it on both faces ("171 of 214 emails found · 80%"). */
  summary: z.string().min(1).max(TABLE_PREVIEW_LIMITS.caption).optional(),
}).refine(table => table.rows.every(row => row.length === table.columns.length), "Every row needs one cell per column.")
  .refine(table => (table.frontRows ?? 0) <= table.rows.length, "The front shows some of the rows.")
  .refine(table => (table.totalRows ?? Infinity) >= table.rows.length, "The whole table has at least the rows shown.");

/** A table as its author writes it: a column may be a bare label. */
export type TablePreviewInput = z.input<typeof tablePreviewSchema>;
export type TablePreview = Readonly<z.output<typeof tablePreviewSchema>>;
export type TablePreviewColumn = TablePreview["columns"][number];
export type TablePreviewCell = TablePreview["rows"][number][number];
export type TableColumnKind = typeof TABLE_COLUMN_KINDS[number];

/** The preview when it fits the caps, with every column spelled out; undefined otherwise, so an oversized or ragged table is never drawn. */
export function tablePreview(value: unknown): TablePreview | undefined {
  const parsed = tablePreviewSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
