import { expect, it, vi } from "vitest";
import { reconcileConnectionHistory, type HistoryObservation } from "../domain/connection-history.ts";
import { UsageConnection } from "./usage-connection.ts";
import { collectCodexHistoryFixture } from "./codex-history-collector.ts";
import { codexFixtureDescriptor, codexFixtureFiles, codexFixtureWindow, fixtureTokenLine } from "../../tests/support/codex-history-fixture.ts";

const row = (hour: number, value: string | null): HistoryObservation => ({
  stream: "one", metric: "total_tokens", unit: "tokens", at: `2026-10-02T0${hour}:00:00.000Z`, value,
});
const batch = (advanced = false) => collectCodexHistoryFixture({
  descriptor: codexFixtureDescriptor, window: codexFixtureWindow, signal: new AbortController().signal,
}, codexFixtureFiles(advanced));

it("review: an unknown sample cannot conceal a known cumulative decrease", () => {
  const result = reconcileConnectionHistory([
    row(1, "100"), row(2, "150"), row(3, null), row(4, "80"), row(5, "120"),
  ]);
  expect(result.totals[0].value).toBeNull();
  expect(result.rows.every(item => item.status === "conflict")).toBe(true);
});

it("review: invalid calendar dates cannot be normalized into the approved window", () => {
  expect(() => collectCodexHistoryFixture({
    descriptor: codexFixtureDescriptor, window: codexFixtureWindow, signal: new AbortController().signal,
  }, [{ sessionAlias: "one", lines: [fixtureTokenLine("2026-09-31T00:00:00Z", 100, 0)] }])).toThrow();
});

it("review: source timestamps must carry an explicit timezone", () => {
  expect(() => collectCodexHistoryFixture({
    descriptor: codexFixtureDescriptor, window: codexFixtureWindow, signal: new AbortController().signal,
  }, [{ sessionAlias: "one", lines: [fixtureTokenLine("2026-10-02T00:00:00", 100, 0)] }])).toThrow();
});

it("review: a late old-generation result cannot overwrite a reconnected session", async () => {
  let finishOld: (value: unknown) => void = () => {};
  const collect = vi.fn<() => Promise<unknown>>()
    .mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
    .mockResolvedValueOnce(batch(true));
  const connection = new UsageConnection({ descriptor: codexFixtureDescriptor, window: codexFixtureWindow, collect });
  connection.requestConnection();
  const old = connection.approve();
  connection.disconnect();
  connection.requestConnection();
  await connection.approve();
  const current = connection.getSnapshot();
  finishOld(batch());
  await old;
  expect(connection.getSnapshot()).toEqual(current);
  expect(current.phase).toBe("connected");
  expect(current.history.totals.find(item => item.metric === "total_tokens")?.value).toBe("200");
});

it("review: a late old-generation failure cannot set a new session's error", async () => {
  let rejectOld: (value: unknown) => void = () => {};
  const collect = vi.fn<() => Promise<unknown>>()
    .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectOld = reject; }))
    .mockResolvedValueOnce(batch());
  const connection = new UsageConnection({ descriptor: codexFixtureDescriptor, window: codexFixtureWindow, collect });
  connection.requestConnection();
  const old = connection.approve();
  connection.disconnect();
  connection.requestConnection();
  await connection.approve();
  const current = connection.getSnapshot();
  rejectOld(new Error("old-generation-failure"));
  await old;
  expect(connection.getSnapshot()).toEqual(current);
  expect(current.error).toBeNull();
});

it("review: equivalent timestamp spellings are replayed, not double-counted", async () => {
  const first = batch();
  const duplicate = { ...first, observations: first.observations.map(item => ({ ...item, at: item.at.replace(".000Z", "Z") })) };
  const collect = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(duplicate);
  const connection = new UsageConnection({ descriptor: codexFixtureDescriptor, window: codexFixtureWindow, collect });
  connection.requestConnection();
  await connection.approve();
  await connection.sync();
  expect(connection.getSnapshot().history.observations).toBe(first.observations.length);
  expect(connection.getSnapshot().history.replays).toBe(first.observations.length);
});
