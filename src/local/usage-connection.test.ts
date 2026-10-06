import { describe, expect, it, vi } from "vitest";
import { UsageConnection, type CollectionRequest } from "./usage-connection.ts";
import { collectCodexHistoryFixture } from "./codex-history-collector.ts";
import { codexFixtureDescriptor, codexFixtureFiles, codexFixtureWindow } from "../../tests/support/codex-history-fixture.ts";

const initial = () => collectCodexHistoryFixture({ descriptor: codexFixtureDescriptor, window: codexFixtureWindow, signal: new AbortController().signal }, codexFixtureFiles());
const total = (connection: UsageConnection) => connection.getSnapshot().history.totals.find(row => row.metric === "total_tokens")?.value;
function setup(collect = vi.fn<(request: CollectionRequest) => Promise<ReturnType<typeof initial>>>(async () => initial()), now = () => Date.parse("2026-10-06T15:00:00Z")) {
  const connection = new UsageConnection({ descriptor: codexFixtureDescriptor, window: codexFixtureWindow, collect, now });
  return { connection, collect };
}
async function connect(connection: UsageConnection) { connection.requestConnection(); await connection.approve(); }

describe("bounded usage connection", () => {
  it("does not acquire before explicit approval and cancel remains side-effect free", async () => {
    const { connection, collect } = setup();
    await connection.sync(); await connection.approve();
    connection.requestConnection(); await connection.sync(); connection.cancelConnection(); await connection.approve();
    expect(collect).not.toHaveBeenCalled();
    expect(connection.getSnapshot().phase).toBe("disconnected");
  });
  it("backfills automatically and repeat syncs preserve totals and rows", async () => {
    const { connection, collect } = setup();
    await connect(connection);
    expect(total(connection)).toBe("150");
    const before = connection.getSnapshot().history;
    await connection.sync(); await connection.sync();
    expect(collect).toHaveBeenCalledTimes(3);
    expect(total(connection)).toBe("150");
    expect(connection.getSnapshot().history.rows).toEqual(before.rows);
    expect(connection.getSnapshot().history.replays).toBe(40);
  });
  it("new counters add only observed increases and reconnect does not duplicate history", async () => {
    const { connection, collect } = setup();
    await connect(connection);
    collect.mockResolvedValue(collectCodexHistoryFixture({ descriptor: codexFixtureDescriptor, window: codexFixtureWindow, signal: new AbortController().signal }, codexFixtureFiles(true)));
    await connection.sync();
    expect(total(connection)).toBe("200");
    connection.disconnect();
    expect(total(connection)).toBe("200");
    await connect(connection);
    expect(total(connection)).toBe("200");
  });
  it("discards in-flight results after disconnect even when the collector ignores abort", async () => {
    let finish: (value: unknown) => void = () => {};
    let request: CollectionRequest | undefined;
    const connection = new UsageConnection({ descriptor: codexFixtureDescriptor, window: codexFixtureWindow,
      collect: value => { request = value; return new Promise(resolve => { finish = resolve; }); } });
    connection.requestConnection(); const pending = connection.approve();
    connection.disconnect(); finish(initial()); await pending;
    expect(request?.signal.aborted).toBe(true);
    expect(connection.getSnapshot().phase).toBe("disconnected");
    expect(connection.getSnapshot().history.observations).toBe(0);
    await connection.sync();
    expect(connection.getSnapshot().lastSyncedAt).toBeNull();
  });
  it("coalesces repeated approval and sync calls while acquisition is pending", async () => {
    let finish: (value: unknown) => void = () => {};
    const collect = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const connection = new UsageConnection({ descriptor: codexFixtureDescriptor, window: codexFixtureWindow, collect });
    connection.requestConnection(); const pending = connection.approve();
    await connection.approve(); await connection.sync(); connection.requestConnection();
    expect(collect).toHaveBeenCalledTimes(1);
    finish(initial()); await pending;
    expect(total(connection)).toBe("150");
  });
  it("expires the grant and requires a new consent before another read", async () => {
    let now = Date.parse("2026-10-06T15:00:00Z");
    const { connection, collect } = setup(undefined, () => now);
    await connect(connection); now += 600_000;
    await connection.sync();
    expect(collect).toHaveBeenCalledTimes(1);
    expect(connection.getSnapshot().phase).toBe("expired");
    connection.requestConnection(); expect(connection.getSnapshot().phase).toBe("awaiting-approval");
    connection.cancelConnection(); expect(total(connection)).toBe("150");
  });
  it("discards results that arrive at or after expiry", async () => {
    let now = Date.parse("2026-10-06T15:00:00Z");
    const collect = vi.fn(async () => { now += 600_000; return initial(); });
    const { connection } = setup(collect, () => now);
    await connect(connection);
    expect(connection.getSnapshot().phase).toBe("expired");
    expect(connection.getSnapshot().history.observations).toBe(0);
  });
  it("times out a stuck collector and aborts its capability", async () => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | undefined;
      const connection = new UsageConnection({ descriptor: codexFixtureDescriptor, window: codexFixtureWindow,
        collect: request => { signal = request.signal; return new Promise(() => {}); } });
      connection.requestConnection(); const pending = connection.approve();
      await vi.advanceTimersByTimeAsync(5000); await pending;
      expect(signal?.aborted).toBe(true);
      expect(connection.getSnapshot().phase).toBe("error");
      expect(connection.getSnapshot().history.observations).toBe(0);
    } finally { vi.useRealTimers(); }
  });
  it.each([5000, 5100])("rejects a read at %i ms even when the timeout callback has not run", async elapsed => {
    let now = Date.parse("2026-10-06T15:00:00Z");
    let signal: AbortSignal | undefined;
    const { connection, collect } = setup(undefined, () => now);
    await connect(connection);
    const retained = connection.getSnapshot();
    collect.mockImplementationOnce(async request => {
      signal = request.signal;
      now += elapsed;
      return initial();
    });
    await connection.sync();
    const after = connection.getSnapshot();
    expect(signal?.aborted).toBe(true);
    expect(after.phase).toBe("error");
    expect(after.history).toEqual(retained.history);
    expect(after.lastSyncedAt).toBe(retained.lastSyncedAt);
    expect(after.expiresAt).toBe(retained.expiresAt);
    await connection.sync();
    expect(connection.getSnapshot().phase).toBe("connected");
    expect(connection.getSnapshot().expiresAt).toBe(retained.expiresAt);
  });
  it("accepts a read just before its absolute deadline", async () => {
    let now = Date.parse("2026-10-06T15:00:00Z");
    const { connection } = setup(vi.fn(async () => { now += 4999; return initial(); }), () => now);
    await connect(connection);
    expect(connection.getSnapshot().phase).toBe("connected");
    expect(total(connection)).toBe("150");
  });
  it.each(["serialization", "schema-validation"])("charges %s time to the same acquisition deadline", async stage => {
    let now = Date.parse("2026-10-06T15:00:00Z");
    let signal: AbortSignal | undefined;
    const { connection, collect } = setup(undefined, () => now);
    await connect(connection);
    const retained = connection.getSnapshot();
    const incoming = initial(), first = incoming.observations[0];
    let reads = 0;
    incoming.observations[0] = { ...first, get value() {
      if (++reads === (stage === "serialization" ? 1 : 2)) now += 5000;
      return first.value;
    } };
    collect.mockImplementationOnce(async request => { signal = request.signal; return incoming; });
    await connection.sync();
    expect(reads).toBeGreaterThanOrEqual(stage === "serialization" ? 1 : 2);
    const after = connection.getSnapshot();
    expect(signal?.aborted).toBe(true);
    expect(after.phase).toBe("error");
    expect(after.history).toEqual(retained.history);
    expect(after.lastSyncedAt).toBe(retained.lastSyncedAt);
  });
  it("uses the original approval expiry when less than five seconds remain", async () => {
    let now = Date.parse("2026-10-06T15:00:00Z");
    let signal: AbortSignal | undefined;
    const { connection, collect } = setup(undefined, () => now);
    await connect(connection);
    const retained = connection.getSnapshot();
    now += 599_999;
    collect.mockImplementationOnce(async request => { signal = request.signal; now += 1; return initial(); });
    await connection.sync();
    const after = connection.getSnapshot();
    expect(signal?.aborted).toBe(true);
    expect(after.phase).toBe("expired");
    expect(after.expiresAt).toBe(retained.expiresAt);
    expect(after.history).toEqual(retained.history);
    expect(after.lastSyncedAt).toBe(retained.lastSyncedAt);
  });
  it("rejects submillisecond retained observations atomically", async () => {
    const { connection, collect } = setup();
    await connect(connection);
    const retained = connection.getSnapshot();
    const incoming = initial();
    incoming.observations[0].at = "2026-10-02T09:00:00.0001Z";
    collect.mockResolvedValueOnce(incoming);
    await connection.sync();
    const after = connection.getSnapshot();
    expect(after.phase).toBe("error");
    expect(after.history).toEqual(retained.history);
    expect(after.lastSyncedAt).toBe(retained.lastSyncedAt);
  });
  it("keeps retained history on failures and recovers without zeroing it", async () => {
    const { connection, collect } = setup();
    await connect(connection);
    collect.mockRejectedValueOnce(new Error("PRIVATE_RAW_ERROR_SENTINEL"));
    await connection.sync();
    expect(connection.getSnapshot().phase).toBe("error");
    expect(JSON.stringify(connection.getSnapshot())).not.toContain("PRIVATE_RAW_ERROR_SENTINEL");
    expect(total(connection)).toBe("150");
    await connection.sync(); expect(connection.getSnapshot().phase).toBe("connected");
  });
  for (const change of ["ownerAlias", "sourceAlias", "deviceAlias", "provider", "collectorVersion"] as const) {
    it(`rejects a changed ${change} without modifying history`, async () => {
      const { connection, collect } = setup(); await connect(connection);
      const changed = initial(); changed.descriptor[change] = "different";
      collect.mockResolvedValueOnce(changed); await connection.sync();
      expect(connection.getSnapshot().phase).toBe("error"); expect(total(connection)).toBe("150");
      expect(connection.getSnapshot().history.replays).toBe(0);
    });
  }
  it("rejects an out-of-window batch atomically", async () => {
    const { connection, collect } = setup(); await connect(connection);
    const changed = initial(); changed.observations[0].at = codexFixtureWindow.end;
    collect.mockResolvedValueOnce(changed); await connection.sync();
    expect(connection.getSnapshot().phase).toBe("error");
    expect(connection.getSnapshot().history.replays).toBe(0);
  });
  it("rejects unknown payload fields and scope elevation at the retention boundary", async () => {
    const collect = vi.fn(async () => ({ ...initial(), prompts: "PRIVATE_CONTENT" }));
    const { connection } = setup(collect); await connect(connection);
    expect(connection.getSnapshot().phase).toBe("error");
    expect(connection.getSnapshot().history.observations).toBe(0);
    expect(() => new UsageConnection({ descriptor: { ...codexFixtureDescriptor, accountAlias: "real-account" } as never, window: codexFixtureWindow, collect })).toThrow();
  });
  it("does not disguise a Cursor report page as cumulative local history", async () => {
    const { connection, collect } = setup();
    await connect(connection);
    collect.mockResolvedValueOnce({
      descriptor: { ...codexFixtureDescriptor, provider: "cursor", sourceKind: "remote-report" },
      observations: [], page: 1, totalPages: 2, chargedCents: "120",
    } as never);
    await connection.sync();
    expect(connection.getSnapshot().phase).toBe("error");
    expect(total(connection)).toBe("150");
  });
  it("returns isolated views that cannot change retained data or grant scope", async () => {
    const { connection } = setup(); await connect(connection);
    const view = connection.getSnapshot();
    view.descriptor.sourceAlias = "changed"; view.window.start = "2020-01-01T00:00:00.000Z";
    view.history.rows[0].value = "999999";
    expect(connection.getSnapshot().descriptor.sourceAlias).toBe("demo-local-history");
    expect(total(connection)).toBe("150");
  });
  it("rejects overlarge and negative windows", () => {
    for (const end of ["2026-10-09T00:00:00.000Z", "2026-09-30T00:00:00.000Z"]) {
      expect(() => new UsageConnection({ descriptor: codexFixtureDescriptor, window: { ...codexFixtureWindow, end }, collect: async () => initial() })).toThrow();
    }
  });
});
