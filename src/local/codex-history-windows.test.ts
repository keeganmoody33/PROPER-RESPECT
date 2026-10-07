import { expect, it } from "vitest";
import { collectCodexHistoryWindows } from "./codex-history-windows.ts";

it("preserves every response when a real-sized week exceeds the result bound", () => {
  const lines = [JSON.stringify({ type: "session_meta", payload: { id: "dense-thread" } })];
  for (let i = 0; i < 10001; i++) lines.push(JSON.stringify({ type: "token_usage_record", timestamp: i < 5000 ? "2026-10-01T00:00:00.000Z" : "2026-10-06T00:00:00.000Z", payload: { thread_id: "dense-thread", response_id: `r-${i}`, usage: { input_tokens: 1, output_tokens: 0, total_tokens: 1 } } }));
  const histories = [...collectCodexHistoryWindows({ window: { start: "2026-10-01T00:00:00.000Z", end: "2026-10-08T00:00:00.000Z" }, signal: new AbortController().signal }, [{ lines }])];
  expect(histories).toHaveLength(2);
  expect(histories.reduce((count, history) => count + history.responses.rows.length, 0)).toBe(10001);
  expect(histories[0].window.end).toBe(histories[1].window.start);
});
