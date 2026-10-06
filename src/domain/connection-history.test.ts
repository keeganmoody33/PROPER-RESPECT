import { expect, it } from "vitest";
import {
  historyBatchSchema, historyObservationSchema, historyWindowSchema,
  mergeConnectionObservations, reconcileConnectionHistory, type HistoryObservation,
} from "./connection-history.ts";
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

it.each(["start", "end"] as const)("rejects submillisecond precision at the window %s before normalization", edge => {
  const window = { start: "2026-10-02T00:00:00.000Z", end: "2026-10-03T00:00:00.000Z" };
  window[edge] = window[edge].replace(".000Z", ".0005Z");
  expect(historyWindowSchema.safeParse(window).success).toBe(false);
});

it.each([".0001Z", ".0002Z", ".0000Z", ".123456Z"])("rejects retained batch timestamp precision %s before distinct instants can collapse", fraction => {
  const batch = {
    descriptor: {
      provider: "codex", sourceKind: "local-history", authMode: "none", ownerAlias: "owner", sourceAlias: "source",
      deviceAlias: "device", accountAlias: null, sample: "synthetic", collectorVersion: "codex-fixture-v1",
    },
    observations: [{ ...row(1, "100"), at: `2026-10-02T01:00:00${fraction}` }],
  };
  expect(historyBatchSchema.safeParse(batch).success).toBe(false);
});

it.each([
  ["2026-10-02T01:00:00Z", "2026-10-02T01:00:00.000Z"],
  ["2026-10-02T01:00:00.1Z", "2026-10-02T01:00:00.100Z"],
  ["2026-10-02T01:00:00.12Z", "2026-10-02T01:00:00.120Z"],
  ["2026-10-02T01:00:00.123Z", "2026-10-02T01:00:00.123Z"],
  ["2024-02-29T01:00:00Z", "2024-02-29T01:00:00.000Z"],
])("canonicalizes supported timestamp %s without rounding", (at, canonical) => {
  expect(historyObservationSchema.parse({ ...row(1, "100"), at }).at).toBe(canonical);
});

it("keeps equivalent supported timestamp spellings replay-safe", () => {
  for (const spellings of [["Z", ".0Z", ".00Z", ".000Z"], [".1Z", ".10Z", ".100Z"]]) {
    const observations = spellings.map(fraction => historyObservationSchema.parse({ ...row(1, "100"), at: `2026-10-02T01:00:00${fraction}` }));
    const result = reconcileConnectionHistory(observations);
    expect(result.observations).toBe(1);
    expect(result.replays).toBe(spellings.length - 1);
    expect(result.rows[0].status).toBe("baseline");
  }
});

it.each([
  ["2026-02-29T01:00:00Z", "2026-03-02T00:00:00Z"],
  ["2026-04-31T01:00:00.123Z", "2026-05-02T00:00:00Z"],
])("rejects invalid calendar timestamp %s", (at, end) => {
  expect(historyObservationSchema.safeParse({ ...row(1, "100"), at }).success).toBe(false);
  expect(historyWindowSchema.safeParse({ start: at, end }).success).toBe(false);
});

it("accepts second and millisecond precision at window boundaries", () => {
  expect(historyWindowSchema.safeParse({ start: "2026-10-02T00:00:00Z", end: "2026-10-02T00:00:00.001Z" }).success).toBe(true);
  expect(historyWindowSchema.safeParse({ start: "2026-10-02T00:00:00.999Z", end: "2026-10-02T00:00:01Z" }).success).toBe(true);
});
