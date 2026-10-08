import { expect, it } from "vitest";
import { collectCodexHistoryWindows, prepareCodexHistoryWindows } from "./codex-history-windows.ts";
import { collectCodexRolloutHistory } from "./codex-history-collector.ts";

it("preserves every response when a real-sized week exceeds the result bound", () => {
  const lines = [JSON.stringify({ type: "session_meta", payload: { id: "dense-thread" } })];
  for (let i = 0; i < 10001; i++) lines.push(JSON.stringify({ type: "token_usage_record", timestamp: i < 5000 ? "2026-10-01T00:00:00.000Z" : "2026-10-06T00:00:00.000Z", payload: { thread_id: "dense-thread", response_id: `r-${i}`, usage: { input_tokens: 1, output_tokens: 0, total_tokens: 1 } } }));
  let sourcePasses = 0;
  const files = [{ get lines() { sourcePasses++; return lines; } }];
  const histories = [...collectCodexHistoryWindows({ window: { start: "2026-10-01T00:00:00.000Z", end: "2026-10-08T00:00:00.000Z" }, signal: new AbortController().signal }, files)];
  expect(histories).toHaveLength(2);
  expect(histories.reduce((count, history) => count + history.responses.rows.length, 0)).toBe(10001);
  expect(histories[0].window.end).toBe(histories[1].window.start);
  expect(sourcePasses).toBe(1);
});

it("shares one reconciliation across a year's windows without changing any bounded result", () => {
  const counts = (input: number) => ({ input_tokens: input, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: input, cache_write_input_tokens: 0 });
  const event = (type: string, timestamp: string, payload: unknown) => JSON.stringify({ type, timestamp, payload });
  const response = (at: string, value: number) => event("token_usage_record", at, { thread_id: "modern", response_id: "same", usage: counts(value) });
  const files = [
    { lines: [event("session_meta", "2026-01-01T00:00:00.000Z", { id: "modern" }), response("2026-02-01T00:00:00.000Z", 5), response("2026-09-01T00:00:00.000Z", 7)] },
    { lines: [event("session_meta", "2026-01-01T00:00:00.000Z", { id: "legacy" }), ...[1, 2, 8, 9].map(day => event("event_msg", `2026-01-${String(day).padStart(2, "0")}T00:00:00.000Z`, { type: "token_count", info: { total_token_usage: counts(day), last_token_usage: counts(day === 8 ? 6 : 1) } }))] },
  ];
  let passes = 0;
  const prepared = prepareCodexHistoryWindows(files.map(file => ({ get lines() { passes++; return file.lines; } })), new AbortController().signal);
  const start = Date.parse("2026-01-01T00:00:00.000Z"), end = Date.parse("2027-01-01T00:00:00.000Z");
  for (let at = start; at < end; at += 7 * 86400_000) {
    const window = { start: new Date(at).toISOString(), end: new Date(Math.min(at + 7 * 86400_000, end)).toISOString() };
    expect([...prepared(window)]).toEqual([collectCodexRolloutHistory({ window, signal: new AbortController().signal }, files)]);
  }
  expect(passes).toBe(files.length);
});

it("checks cancellation even after a page was prepared", () => {
  const controller = new AbortController();
  const prepared = prepareCodexHistoryWindows([{ lines: [JSON.stringify({ type: "session_meta", payload: { id: "cancelled" } })] }], controller.signal);
  controller.abort();
  expect(() => [...prepared({ start: "2026-10-01T00:00:00.000Z", end: "2026-10-08T00:00:00.000Z" })]).toThrow();
});
