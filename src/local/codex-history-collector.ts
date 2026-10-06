import { ExactJsonNumber, parseExactJson, type ExactJson } from "../domain/exact-json.ts";
import { z } from "zod";
import { historyBatchSchema, type HistoryBatch, type HistoryObservation } from "../domain/connection-history.ts";
import type { CollectionRequest } from "./usage-connection.ts";

export type CodexFixtureFile = { sessionAlias: string; lines: readonly string[] };
const metrics = ["input_tokens", "cached_input_tokens", "output_tokens", "reasoning_output_tokens", "total_tokens"] as const;
const timestampSchema = z.iso.datetime();
function object(value: ExactJson | undefined): Record<string, ExactJson> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof ExactJsonNumber) ? value : null;
}
function counter(value: ExactJson | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (!(value instanceof ExactJsonNumber) || !/^(0|[1-9][0-9]{0,127})$/.test(value.lexeme)) throw new Error("unsupported-counter");
  return value.lexeme;
}

/** Restricted fixture contract, not a production rollout scanner. No filesystem/auth/network APIs. */
export function collectCodexHistoryFixture(request: CollectionRequest, files: readonly CodexFixtureFile[]): HistoryBatch {
  if (request.descriptor.provider !== "codex" || request.descriptor.collectorVersion !== "codex-fixture-v1") throw new Error("unsupported-source");
  if (files.length > 8) throw new Error("fixture-limit");
  let bytes = 0, lines = 0;
  const observations: HistoryObservation[] = [];
  for (const file of files) for (const line of file.lines) {
    if (request.signal.aborted) throw new Error("disconnected");
    bytes += new TextEncoder().encode(line).length;
    if (bytes > 256_000 || ++lines > 1000) throw new Error("fixture-limit");
    const record = object(parseExactJson(line));
    if (!record) throw new Error("invalid-fixture");
    // Forks, compactions and per-response records need a richer reconciler. Reject
    // those source formats instead of quietly treating inherited history as usage.
    if (record.type !== "event_msg" && record.type !== "response_item") throw new Error("unsupported-record");
    if (record.type === "response_item") continue;
    const payload = object(record.payload);
    if (!payload || payload.type !== "token_count") throw new Error("unsupported-event");
    const time = Date.parse(timestampSchema.parse(record.timestamp));
    // Bounds are applied before projection. No pre-window baseline is retained.
    if (time < Date.parse(request.window.start) || time >= Date.parse(request.window.end)) continue;
    const info = object(payload.info), counts = object(info?.total_token_usage);
    if (!counts) throw new Error("unsupported-usage");
    const values = Object.fromEntries(metrics.map(metric => [metric, counter(counts[metric])]));
    for (const [subset, total] of [["cached_input_tokens", "input_tokens"], ["reasoning_output_tokens", "output_tokens"]]) {
      if (values[subset] !== null && values[total] !== null && BigInt(values[subset]) > BigInt(values[total])) throw new Error("invalid-subset");
    }
    for (const metric of metrics) observations.push({ stream: file.sessionAlias, at: new Date(time).toISOString(), metric, unit: "tokens", value: values[metric] });
  }
  // Only the allowlist above survives; raw records, prompts, paths and credentials do not.
  return historyBatchSchema.parse({ descriptor: request.descriptor, observations });
}
