import { expect, it } from "vitest";
import { collectCodexHistoryFixture } from "./codex-history-collector.ts";
import { reconcileConnectionHistory } from "../domain/connection-history.ts";
import { codexFixtureDescriptor, codexFixtureFiles, codexFixtureWindow, fixtureTokenLine } from "../../tests/support/codex-history-fixture.ts";
const request = () => ({ descriptor: codexFixtureDescriptor, window: codexFixtureWindow, signal: new AbortController().signal });
it("projects numeric fields only and removes content even when mixed into source records", () => {
  const batch = collectCodexHistoryFixture(request(), codexFixtureFiles());
  expect(batch.observations).toHaveLength(20);
  expect(JSON.stringify(batch)).not.toMatch(/PRIVATE_|path-sentinel|payload|credential|content/);
  expect(batch.descriptor.accountAlias).toBeNull();
});
it("preserves integer lexemes above Number.MAX_SAFE_INTEGER", () => {
  const text = fixtureTokenLine("2026-10-02T00:00:00.000Z", 1, 0).replace('"total_tokens":1', '"total_tokens":90071992547409931234567890');
  const batch = collectCodexHistoryFixture(request(), [{ sessionAlias: "one", lines: [text] }]);
  expect(batch.observations.find(row => row.metric === "total_tokens")?.value).toBe("90071992547409931234567890");
});
it("keeps missing counters unknown and excludes out-of-window records", () => {
  const text = fixtureTokenLine("2026-10-02T00:00:00.000Z", 1, 0).replace('"cached_input_tokens":0,', "");
  const batch = collectCodexHistoryFixture(request(), [{ sessionAlias: "one", lines: [text, fixtureTokenLine(codexFixtureWindow.end, 100, 100)] }]);
  expect(batch.observations).toHaveLength(5);
  expect(batch.observations.find(row => row.metric === "cached_input_tokens")?.value).toBeNull();
});
for (const token of ["-1", "0.0000000000000000000001", "1.000000000000000000001", "1e3", '"10"']) {
  it(`rejects noncanonical token counter ${token}`, () => {
    const text = fixtureTokenLine("2026-10-02T00:00:00.000Z", 1, 0).replace('"total_tokens":1', `"total_tokens":${token}`);
    expect(() => collectCodexHistoryFixture(request(), [{ sessionAlias: "one", lines: [text] }])).toThrow();
  });
}
it("fails closed on unsupported history formats and invalid subset counters", () => {
  for (const line of [JSON.stringify({ type: "session_meta", payload: { forked_from_id: "parent" } }), JSON.stringify({ type: "event_msg", payload: { type: "token_usage_record" } }),
    fixtureTokenLine("2026-10-02T00:00:00.000Z", 1, 0).replace('"cached_input_tokens":0', '"cached_input_tokens":2')]) {
    expect(() => collectCodexHistoryFixture(request(), [{ sessionAlias: "one", lines: [line] }])).toThrow();
  }
});
it("does not read after abort and enforces batch size", () => {
  const controller = new AbortController(); controller.abort();
  expect(() => collectCodexHistoryFixture({ ...request(), signal: controller.signal }, codexFixtureFiles())).toThrow("disconnected");
  expect(() => collectCodexHistoryFixture(request(), [{ sessionAlias: "one", lines: [" ".repeat(256_001)] }])).toThrow("fixture-limit");
});

it.each([".0001Z", ".0002Z", ".0000Z", ".123456Z"])("rejects source timestamp precision %s before projection", fraction => {
  const text = fixtureTokenLine(`2026-10-02T00:00:00${fraction}`, 1, 0);
  expect(() => collectCodexHistoryFixture(request(), [{ sessionAlias: "one", lines: [text] }])).toThrow();
});

it.each(["start", "end"] as const)("rejects unsupported request window %s precision before reading source records", edge => {
  const window = { start: "2026-10-02T00:00:00.000Z", end: "2026-10-02T00:00:01.000Z" };
  window[edge] = window[edge].replace(".000Z", ".0005Z");
  const lines = [fixtureTokenLine("2026-10-02T00:00:00.000Z", 1, 0)];
  expect(() => collectCodexHistoryFixture({ ...request(), window }, [{ sessionAlias: "one", lines }])).toThrow();
  expect(() => collectCodexHistoryFixture({ ...request(), window }, [])).toThrow();
});

it("does not collapse distinct submillisecond source instants into a false conflict", () => {
  const lines = [fixtureTokenLine("2026-10-02T00:00:00.0001Z", 1, 0), fixtureTokenLine("2026-10-02T00:00:00.0002Z", 2, 0)];
  expect(() => collectCodexHistoryFixture(request(), [{ sessionAlias: "one", lines }])).toThrow();
});

it("normalizes equivalent supported source spellings as replays", () => {
  const lines = ["Z", ".0Z", ".00Z", ".000Z"].map(fraction => fixtureTokenLine(`2026-10-02T00:00:00${fraction}`, 1, 0));
  const batch = collectCodexHistoryFixture(request(), [{ sessionAlias: "one", lines }]);
  const history = reconcileConnectionHistory(batch.observations);
  expect(history.observations).toBe(5);
  expect(history.replays).toBe(15);
  expect(history.rows.every(row => row.at === "2026-10-02T00:00:00.000Z" && row.status === "baseline")).toBe(true);
});

it("preserves millisecond precision and half-open window bounds", () => {
  const lines = ["000", "001", "002", "003"].map((fraction, index) => fixtureTokenLine(`2026-10-02T00:00:00.${fraction}Z`, index, 0));
  const batch = collectCodexHistoryFixture({ ...request(), window: { start: "2026-10-02T00:00:00.001Z", end: "2026-10-02T00:00:00.003Z" } }, [{ sessionAlias: "one", lines }]);
  expect([...new Set(batch.observations.map(row => row.at))]).toEqual(["2026-10-02T00:00:00.001Z", "2026-10-02T00:00:00.002Z"]);
  expect(reconcileConnectionHistory(batch.observations).totals.find(row => row.metric === "total_tokens")?.value).toBe("1");
});

it("rejects invalid source calendar dates before Date can normalize them", () => {
  const text = fixtureTokenLine("2026-02-29T00:00:00.000Z", 1, 0);
  expect(() => collectCodexHistoryFixture(request(), [{ sessionAlias: "one", lines: [text] }])).toThrow();
});
