import { expect, it } from "vitest";
import { collectCodexHistoryFixture } from "./codex-history-collector.ts";
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
