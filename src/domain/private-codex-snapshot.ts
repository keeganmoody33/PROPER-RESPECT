import { z } from "zod";
import { canonicalJson } from "./canonical-json.ts";
import { measurementDigest } from "./measurements.ts";

const DAY_MS = 86_400_000;
const exact = z.string().regex(/^(0|[1-9][0-9]{0,133})$/).nullable();
const rowSchema = z.strictObject({
  kind: z.literal("response"),
  thread: z.string().regex(/^[a-f0-9]{64}$/),
  response: z.string().regex(/^[a-f0-9]{64}$/),
  at: z.iso.datetime(),
  status: z.enum(["measured", "conflict"]),
  counts: z.strictObject({
    input_tokens: exact,
    cached_input_tokens: exact,
    output_tokens: exact,
    reasoning_output_tokens: exact,
    total_tokens: exact,
    cache_write_input_tokens: exact,
  }),
});
const inputSchema = z.strictObject({
  ownerId: z.string().min(1),
  sourceKey: z.string().regex(/^[a-f0-9]{64}$/),
  context: z.enum(["personal", "work", "unclassified"]),
  capturedAt: z.iso.datetime(),
  start: z.iso.datetime(),
  end: z.iso.datetime(),
  rows: z.array(rowSchema).min(1).max(8192),
}).superRefine((input, ctx) => {
  const start = Date.parse(input.start);
  const end = Date.parse(input.end);
  if (!input.start.endsWith("T00:00:00.000Z") || !input.end.endsWith("T00:00:00.000Z")
    || end <= start || end - start > 7 * DAY_MS) {
    ctx.addIssue({ code: "custom", message: "Select one to seven whole UTC days, with an exclusive end." });
  }
});

export const privateCodexSnapshotSchema = z.strictObject({
  format: z.literal("codex-history-window-v1"),
  visibility: z.literal("private"),
  start: z.string(),
  end: z.string(),
  totalTokens: z.string().regex(/^(0|[1-9][0-9]{0,133})$/),
  responseCount: z.number().int().positive(),
});
export type PrivateCodexSnapshot = z.infer<typeof privateCodexSnapshotSchema> & { identity: string };

/** Derives one private window snapshot. The caller retains it; nothing here publishes. */
export function retainPrivateCodexSnapshot(value: unknown): PrivateCodexSnapshot {
  const input = inputSchema.parse(value);
  const selected = input.rows.filter((row) => row.at >= input.start && row.at < input.end);
  if (!selected.length) throw new Error("No matching modern response history in this window.");
  let total = BigInt(0);
  for (const row of selected) {
    const value = row.counts.total_tokens;
    if (row.status === "conflict" || value === null) throw new Error("Conflicting or unknown totals cannot be kept as a private snapshot.");
    total += BigInt(value);
  }
  const snapshot = privateCodexSnapshotSchema.parse({
    format: "codex-history-window-v1",
    visibility: "private",
    start: input.start,
    end: input.end,
    totalTokens: total.toString(),
    responseCount: selected.length,
  });
  const identity = measurementDigest([
    "private-codex-snapshot-v1",
    input.ownerId,
    input.sourceKey,
    input.context,
    snapshot.start,
    snapshot.end,
    selected.map((row) => canonicalJson(row)),
  ]);
  return { ...snapshot, identity };
}
