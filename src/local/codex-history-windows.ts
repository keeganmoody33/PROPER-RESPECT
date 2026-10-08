import { historyWindowSchema } from "../domain/connection-history.ts";
import { prepareCodexRolloutHistory, type CodexRolloutFile, type CodexRolloutHistory } from "./codex-history-collector.ts";

/** Dense real histories can exceed a seven-day result limit. Split time, keeping
 * the complete local lineage and baselines for every bounded projection. */
export function* collectCodexHistoryWindows(request: { window: CodexRolloutHistory["window"]; signal: AbortSignal }, files: readonly CodexRolloutFile[]): Generator<CodexRolloutHistory> {
  const window = historyWindowSchema.parse(request.window);
  yield* prepareCodexHistoryWindows(files, request.signal)(window);
}

export function prepareCodexHistoryWindows(files: readonly CodexRolloutFile[], signal: AbortSignal) {
  const select = prepareCodexRolloutHistory(files, signal);
  return function* (requestedWindow: CodexRolloutHistory["window"]): Generator<CodexRolloutHistory> {
    const pending = [historyWindowSchema.parse(requestedWindow)];
    let attempts = 0;
    while (pending.length) {
      if (++attempts > 2048 || signal.aborted) throw new Error("rollout-window-limit");
      const window = pending.pop()!;
      let history: CodexRolloutHistory;
      try { history = select(window); }
      catch (error) {
        if (!(error instanceof Error) || error.message !== "rollout-output-limit") throw error;
        const start = Date.parse(window.start), end = Date.parse(window.end), middle = Math.floor((start + end) / 2);
        if (middle <= start || middle >= end) throw error;
        const at = new Date(middle).toISOString();
        pending.push({ start: at, end: window.end }, { start: window.start, end: at });
        continue;
      }
      yield history;
    }
  };
}
