import { expect, it } from "vitest";
import { mergeConnectionObservations, reconcileConnectionHistory, type HistoryObservation } from "./connection-history.ts";
const row = (at: number, value: string | null, stream = "one"): HistoryObservation => ({ stream, metric: "total_tokens", unit: "tokens", at: `2026-10-02T0${at}:00:00.000Z`, value });
it("uses an independent baseline for each stream and preserves exact large integers", () => {
  const result = reconcileConnectionHistory([row(1, "900719925474099300000"), row(2, "900719925474099300150"), row(1, "500", "two"), row(2, "550", "two")]);
  expect(result.totals[0].value).toBe("200");
  expect(result.rows[0].status).toBe("baseline");
});
it("unknown breaks a baseline, while actual zero remains measured", () => {
  const result = reconcileConnectionHistory([row(1, "0"), row(2, "0"), row(3, null), row(4, "100"), row(5, "110")]);
  expect(result.totals[0].value).toBe("10");
  expect(result.rows.map(item => item.delta)).toEqual([null, "0", null, null, "10"]);
  expect(reconcileConnectionHistory([row(1, null)]).totals[0].value).toBeNull();
  expect(reconcileConnectionHistory([row(1, "100")]).totals[0].value).toBeNull();
});
it("quarantines conflicts and cumulative decreases rather than inferring resets", () => {
  for (const rows of [[row(1, "100"), row(1, "101")], [row(1, "100"), row(2, "80"), row(3, "120")]]) {
    const result = reconcileConnectionHistory(rows);
    expect(result.totals[0].value).toBeNull(); expect(result.rows.every(item => item.status === "conflict")).toBe(true);
  }
});
it("replays are repeat-safe while conflicting variants remain quarantined", () => {
  const first = mergeConnectionObservations([row(1, "100")], [row(1, "100"), row(1, "101")]);
  expect(first.replays).toBe(1); expect(first.observations).toHaveLength(2);
  const second = mergeConnectionObservations(first.observations, [row(1, "100")]);
  expect(reconcileConnectionHistory(second.observations).totals[0].value).toBeNull();
});
it("leaves retained observations intact when a merged batch reaches the bound", () => {
  const original = [row(1, "0")];
  expect(() => mergeConnectionObservations(original, Array.from({ length: 1000 }, (_, index) => ({ ...row(2, "1"), stream: `session-${index}` })))).toThrow("history-limit");
  expect(original).toEqual([row(1, "0")]);
});
