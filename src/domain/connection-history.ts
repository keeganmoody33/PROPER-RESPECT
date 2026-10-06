import { z } from "zod";

export const CONNECTION_LIMITS = Object.freeze({ observations: 1000, bytes: 256_000, windowMs: 7 * 86400_000, approvalMs: 600_000 });
const alias = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$/);
export const connectionDescriptorSchema = z.strictObject({
  provider: alias, sourceKind: z.literal("local-history"), authMode: z.literal("none"),
  ownerAlias: alias, sourceAlias: alias, deviceAlias: alias, accountAlias: z.null(),
  sample: z.literal("synthetic"), collectorVersion: alias,
});
export type ConnectionDescriptor = z.infer<typeof connectionDescriptorSchema>;
// Date stores milliseconds. Reject finer source precision before canonicalization
// can merge distinct instants or move a requested window boundary.
export const historyTimestampSchema = z.iso.datetime()
  .refine(value => !/\.\d{4,}Z$/.test(value), "Timestamps support at most millisecond precision.")
  .transform(value => new Date(value).toISOString());
export const historyWindowSchema = z.strictObject({ start: historyTimestampSchema, end: historyTimestampSchema })
  .refine(value => Date.parse(value.end) > Date.parse(value.start) && Date.parse(value.end) - Date.parse(value.start) <= CONNECTION_LIMITS.windowMs);
export type HistoryWindow = z.infer<typeof historyWindowSchema>;
export const historyObservationSchema = z.strictObject({
  stream: alias, metric: alias, unit: alias,
  at: historyTimestampSchema,
  value: z.string().regex(/^(0|[1-9][0-9]{0,127})$/).nullable(),
});
export type HistoryObservation = z.infer<typeof historyObservationSchema>;
export const historyBatchSchema = z.strictObject({
  descriptor: connectionDescriptorSchema,
  observations: z.array(historyObservationSchema).max(CONNECTION_LIMITS.observations),
});
export type HistoryBatch = z.infer<typeof historyBatchSchema>;
export type HistoryRow = HistoryObservation & { delta: string | null; status: "baseline" | "measured" | "unknown" | "conflict" };
export type ConnectionHistory = {
  rows: HistoryRow[];
  totals: { metric: string; unit: string; value: string | null }[];
  observations: number;
  replays: number;
};
const position = (row: HistoryObservation) => JSON.stringify([row.stream, row.metric, row.unit, row.at]);
const family = (row: HistoryObservation) => JSON.stringify([row.stream, row.metric, row.unit]);

/** One already-pinned source only. First cumulative samples are baselines, not usage. */
export function reconcileConnectionHistory(inputs: readonly HistoryObservation[], replays = 0): ConnectionHistory {
  const positions = new Map<string, HistoryObservation[]>();
  for (const row of inputs) {
    const key = position(row), variants = positions.get(key) ?? [];
    if (variants.some(item => item.value === row.value)) replays++;
    else variants.push(row);
    positions.set(key, variants);
  }
  const streams = new Map<string, HistoryObservation[]>();
  for (const variants of positions.values()) for (const row of variants) {
    const key = family(row), stream = streams.get(key) ?? [];
    stream.push(row);
    streams.set(key, stream);
  }
  const rows: HistoryRow[] = [];
  for (const stream of streams.values()) {
    stream.sort((a, b) => a.at.localeCompare(b.at));
    let previous: string | null = null;
    let lastKnown: string | null = null;
    let conflict = stream.some(row => (positions.get(position(row))?.length ?? 0) > 1);
    const projected: HistoryRow[] = [];
    for (const row of stream) {
      if (row.value !== null && lastKnown !== null && BigInt(row.value) < BigInt(lastKnown)) conflict = true;
      projected.push({ ...row, delta: row.value === null || previous === null ? null : String(BigInt(row.value) - BigInt(previous)),
        status: row.value === null ? "unknown" : previous === null ? "baseline" : "measured" });
      previous = row.value;
      if (row.value !== null) lastKnown = row.value;
    }
    rows.push(...projected.map(row => conflict ? { ...row, delta: null, status: "conflict" as const } : row));
  }
  rows.sort((a, b) => a.at.localeCompare(b.at) || family(a).localeCompare(family(b)));
  const metrics = new Map<string, HistoryRow[]>();
  for (const row of rows) {
    const key = JSON.stringify([row.metric, row.unit]), values = metrics.get(key) ?? [];
    values.push(row);
    metrics.set(key, values);
  }
  const totals = [...metrics.values()].map(values => ({
    metric: values[0].metric, unit: values[0].unit,
    // A quarantined stream cannot silently disappear into a smaller plausible total.
    value: values.some(row => row.status === "conflict") || !values.some(row => row.delta !== null)
      ? null : String(values.reduce((sum, row) => sum + BigInt(row.delta ?? "0"), BigInt(0))),
  }));
  return { rows, totals, observations: [...positions.values()].reduce((count, variants) => count + variants.length, 0), replays };
}

/** Preserve conflicting variants so later replays cannot erase the conflict. */
export function mergeConnectionObservations(retained: readonly HistoryObservation[], incoming: readonly HistoryObservation[]) {
  const observations = [...retained], seen = new Set(retained.map(row => JSON.stringify([position(row), row.value])));
  let replays = 0;
  for (const row of incoming) {
    const key = JSON.stringify([position(row), row.value]);
    if (seen.has(key)) replays++;
    else { seen.add(key); observations.push(row); }
  }
  if (observations.length > CONNECTION_LIMITS.observations) throw new Error("history-limit");
  return { observations, replays };
}
