import { mkdtempSync, realpathSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { collectCodexRolloutHistory } from "./codex-history-collector.ts";
import { CollectorCompanion, type CollectorTransport } from "./collector-companion.ts";
import { CollectorService } from "./collector-service.ts";
import { buildReviewDelivery, CODEX_METRICS, grantSchema, type CommitReceipt, type ReviewManifest } from "../domain/collector-contract.ts";

const directories: string[] = [];
const window = { start: "2026-10-01T00:00:00.000Z", end: "2026-10-08T00:00:00.000Z" };
const now = Date.parse("2026-10-02T00:00:00.000Z");
const initial = () => grantSchema.parse({ connectionId: "one", descriptor: { kind: "codex-local-history", provider: "codex", sourceId: "source", deviceId: "device", collectorVersion: "v1", context: "PERSONAL", account: { kind: "UNKNOWN" } }, generation: 1, window, expiresAt: "2026-10-03T00:00:00.000Z", allowedMetrics: ["total_tokens"], checkpoint: null });
const review = () => collectCodexRolloutHistory({ window, signal: new AbortController().signal }, []);
function fixture() {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "collector-companion-"))); directories.push(directory);
  const databasePath = join(directory, "private.sqlite");
  let grant = initial(), loseAck = false;
  const receipts = new Map<string, CommitReceipt>();
  const transport: CollectorTransport = {
    getGrant: vi.fn(async () => grant), stageChunk: vi.fn(async () => undefined),
    deliveryStatus: async ({ manifest }) => {
      const receipt = receipts.get(manifest.batchId);
      return receipt ? { kind: "COMMITTED", receipt } : { kind: manifest.expectedCheckpoint === grant.checkpoint ? "READY" : "STALE", checkpoint: grant.checkpoint };
    },
    commitReview: vi.fn(async ({ manifest }: { manifest: ReviewManifest }) => {
      const receipt = receipts.get(manifest.batchId) ?? { format: "collector-commit-receipt-v1", connectionId: grant.connectionId, generation: grant.generation, batchId: manifest.batchId, digest: manifest.digest, checkpoint: manifest.nextCheckpoint, committedAt: new Date(now).toISOString() } satisfies CommitReceipt;
      receipts.set(manifest.batchId, receipt); grant = { ...grant, checkpoint: receipt.checkpoint };
      if (loseAck) { loseAck = false; throw new Error("synthetic lost acknowledgment"); }
      return receipt;
    }),
  };
  const companion = new CollectorCompanion({ databasePath, transport, now: () => now });
  companion.connect({ grant, credential: "synthetic-scoped-credential" });
  return { companion, transport, databasePath, loseAck: () => { loseAck = true; } };
}
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

it("persists pending delivery before upload and recovers a lost acknowledgment after restart without reading again", async () => {
  const test = fixture(), collect = vi.fn(async () => review()); test.loseAck();
  await expect(test.companion.sync({ connectionId: "one", collect })).rejects.toThrow();
  expect(test.companion.pending({ connectionId: "one" })).not.toBeNull();
  expect(test.companion.checkpoint({ connectionId: "one" })).toBeNull();
  expect(statSync(test.databasePath).mode & 0o077).toBe(0);
  test.companion.close();
  const restarted = new CollectorCompanion({ databasePath: test.databasePath, transport: test.transport, now: () => now });
  const receipt = await restarted.sync({ connectionId: "one", collect });
  expect(collect).toHaveBeenCalledTimes(1);
  expect(restarted.pending({ connectionId: "one" })).toBeNull();
  expect(restarted.checkpoint({ connectionId: "one" })).toBe(receipt.checkpoint);
  restarted.close();
});

it("does not acquire when receiver authority is unavailable and never advances for a mismatched receipt", async () => {
  const test = fixture(), collect = vi.fn(async () => review());
  test.transport.getGrant = async () => { throw new Error("offline"); };
  await expect(test.companion.sync({ connectionId: "one", collect })).rejects.toThrow();
  expect(collect).not.toHaveBeenCalled();
  test.transport.getGrant = async () => initial();
  test.transport.commitReview = async ({ manifest }) => ({ format: "collector-commit-receipt-v1", connectionId: "other", generation: 1, batchId: manifest.batchId, digest: manifest.digest, checkpoint: manifest.nextCheckpoint, committedAt: new Date(now).toISOString() });
  await expect(test.companion.sync({ connectionId: "one", collect })).rejects.toThrow();
  expect(test.companion.checkpoint({ connectionId: "one" })).toBeNull();
  expect(test.companion.pending({ connectionId: "one" })).not.toBeNull();
  test.companion.close();
});

it("disconnect aborts acquisition and fences an old result across another companion instance", async () => {
  const test = fixture();
  let finish: (value: unknown) => void = () => {};
  let signal: AbortSignal | undefined;
  const started = test.companion.sync({ connectionId: "one", collect: async (_grant, inputSignal) => { signal = inputSignal; return new Promise(resolve => { finish = resolve; }); } });
  await vi.waitFor(() => expect(signal).toBeDefined());
  const second = new CollectorCompanion({ databasePath: test.databasePath, transport: test.transport, now: () => now });
  second.disconnect({ connectionId: "one" });
  finish(review());
  await expect(started).rejects.toThrow();
  expect(test.companion.pending({ connectionId: "one" })).toBeNull();
  expect(test.transport.commitReview).not.toHaveBeenCalled();
  second.close(); test.companion.close();
});

it("disconnect interrupts an uncooperative reader immediately and remains revoked after restart", async () => {
  const test = fixture();
  let signal: AbortSignal | undefined;
  const started = test.companion.sync({ connectionId: "one", collect: async (_grant, inputSignal) => { signal = inputSignal; return new Promise(() => {}); } });
  const rejected = expect(started).rejects.toThrow();
  await vi.waitFor(() => expect(signal).toBeDefined());
  test.companion.disconnect({ connectionId: "one" });
  await rejected;
  expect(signal?.aborted).toBe(true);
  expect(test.companion.pending({ connectionId: "one" })).toBeNull();
  test.companion.close();
  const restarted = new CollectorCompanion({ databasePath: test.databasePath, transport: test.transport, now: () => now });
  const collect = vi.fn(async () => review());
  await expect(restarted.sync({ connectionId: "one", collect })).rejects.toThrow();
  expect(collect).not.toHaveBeenCalled();
  expect(() => restarted.connect({ grant: initial(), credential: "synthetic-scoped-credential" })).toThrow("fresh generation");
  restarted.close();
});

it("rejects expiry and generation changes after acquisition before storing or uploading", async () => {
  const test = fixture();
  let reads = 0;
  test.transport.getGrant = async () => ({ ...initial(), generation: ++reads === 1 ? 1 : 2 });
  const collect = vi.fn(async () => review());
  await expect(test.companion.sync({ connectionId: "one", collect })).rejects.toThrow();
  expect(collect).toHaveBeenCalledTimes(1);
  expect(test.companion.pending({ connectionId: "one" })).toBeNull();
  expect(test.transport.commitReview).not.toHaveBeenCalled();
  test.companion.close();
});

it("coalesces concurrent sync calls and pauses when an ignored receiver request times out", async () => {
  const test = fixture(), collect = vi.fn(async () => review());
  const first = test.companion.sync({ connectionId: "one", collect });
  const second = test.companion.sync({ connectionId: "one", collect });
  expect(first).toBe(second);
  await first;
  expect(collect).toHaveBeenCalledTimes(1);
  vi.useFakeTimers();
  try {
    test.transport.getGrant = async () => new Promise(() => {});
    const stalled = test.companion.sync({ connectionId: "one", collect });
    const rejected = expect(stalled).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(5001);
    await rejected;
    expect(collect).toHaveBeenCalledTimes(1);
  } finally { vi.useRealTimers(); test.companion.close(); }
});

it("recovers against the real SQLite receiver after both databases restart and retains approved history after revocation", async () => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "collector-integration-"))); directories.push(directory);
  const servicePath = join(directory, "receiver.sqlite"), companionPath = join(directory, "companion.sqlite");
  let service = new CollectorService({ databasePath: servicePath, now: () => now });
  const owner = { issuer: "https://synthetic-owner.invalid", subject: "synthetic-owner" };
  const verifier = "synthetic-private-pairing-verifier-0000000000000000000000000000000000000000";
  const request = await service.requestPairing({ descriptor: initial().descriptor, window, verifier });
  await service.approvePairing({ pairingId: request.pairingId, owner, expiresAt: initial().expiresAt, allowedMetrics: [...CODEX_METRICS] });
  const claimed = await service.claimPairing({ pairingId: request.pairingId, verifier });
  let loseAck = true;
  const transport: CollectorTransport = { getGrant: input => service.getGrant(input), stageChunk: input => service.stageChunk(input), deliveryStatus: input => service.deliveryStatus(input), commitReview: async input => {
    const receipt = await service.commitReview(input);
    if (loseAck) { loseAck = false; throw new Error("synthetic lost response after durable commit"); }
    return receipt;
  } };
  let companion = new CollectorCompanion({ databasePath: companionPath, transport, now: () => now });
  companion.connect(claimed);
  const collect = vi.fn(async () => collectCodexRolloutHistory({ window, signal: new AbortController().signal }, [{ lines: [
    JSON.stringify({ type: "session_meta", payload: { id: "synthetic-thread" } }),
    JSON.stringify({ type: "token_usage_record", timestamp: "2026-10-02T00:00:00.000Z", payload: { thread_id: "synthetic-thread", response_id: "synthetic-response", usage: { input_tokens: 20, cached_input_tokens: 0, output_tokens: 10, reasoning_output_tokens: 0, cache_write_input_tokens: 0, total_tokens: 30 } } }),
  ] }]));
  try {
    await expect(companion.sync({ connectionId: claimed.grant.connectionId, collect })).rejects.toThrow();
    expect((await service.privateHistory({ owner, connectionId: claimed.grant.connectionId })).receiptCount).toBe(1);
    companion.close(); service.close();
    service = new CollectorService({ databasePath: servicePath, now: () => now });
    companion = new CollectorCompanion({ databasePath: companionPath, transport, now: () => now });
    await companion.sync({ connectionId: claimed.grant.connectionId, collect });
    expect(collect).toHaveBeenCalledTimes(1);
    const history = await service.privateHistory({ owner, connectionId: claimed.grant.connectionId });
    expect(history.receiptCount).toBe(1);
    expect(history.responses.totals.find(row => row.metric === "total_tokens")?.value).toBe("30");
    await service.disconnectOwner({ owner, connectionId: claimed.grant.connectionId });
    companion.disconnect({ connectionId: claimed.grant.connectionId });
    expect((await service.privateHistory({ owner, connectionId: claimed.grant.connectionId })).responses).toEqual(history.responses);
    await expect(companion.sync({ connectionId: claimed.grant.connectionId, collect })).rejects.toThrow();
    expect(collect).toHaveBeenCalledTimes(1);
  } finally { companion.close(); service.close(); }
});

it("review regression: A to B to A to B reports advance the authoritative checkpoint and complete view each time", async () => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "collector-report-chain-"))); directories.push(directory);
  const service = new CollectorService({ databasePath: join(directory, "receiver.sqlite"), now: () => now });
  const owner = { issuer: "https://synthetic-owner.invalid", subject: "synthetic-owner" };
  const verifier = "synthetic-private-verifier-000000000000000000000000000000000000000000";
  const request = await service.requestPairing({ descriptor: { kind: "cursor-complete-export", provider: "cursor", sourceId: "cursor-source", deviceId: "device", collectorVersion: "cursor-v1", context: "PERSONAL", account: { kind: "UNKNOWN" } }, window, verifier });
  await service.approvePairing({ pairingId: request.pairingId, owner, expiresAt: initial().expiresAt, allowedMetrics: ["requests"] });
  const claimed = await service.claimPairing({ pairingId: request.pairingId, verifier });
  const companion = new CollectorCompanion({ databasePath: join(directory, "companion.sqlite"), now: () => now, transport: { getGrant: input => service.getGrant(input), stageChunk: input => service.stageChunk(input), deliveryStatus: input => service.deliveryStatus(input), commitReview: input => service.commitReview(input) } });
  companion.connect(claimed);
  const report = (value: string) => ({ format: "cursor-complete-report-v1", reportId: "one-report", source: { provider: "cursor", kind: "owner-supplied-report", accountAlias: null, sample: "unknown" }, window, complete: true, coverage: "partial", rows: [{ id: "one", at: "2026-10-02T00:00:00.000Z", metric: "requests", value, unit: "requests", kind: "NATIVE_QUANTITY" }] });
  const checkpoints = new Set<string>();
  try {
    for (const value of ["1", "2", "1", "2"]) {
      const receipt = await companion.sync({ connectionId: claimed.grant.connectionId, collect: async () => report(value) });
      const history = await service.privateHistory({ owner, connectionId: claimed.grant.connectionId });
      expect(history.cursorViews[0].rows[0].value).toBe(value);
      expect(history.checkpoint).toBe(receipt.checkpoint);
      checkpoints.add(receipt.checkpoint);
    }
    expect(checkpoints.size).toBe(4);
    expect((await service.privateHistory({ owner, connectionId: claimed.grant.connectionId })).receiptCount).toBe(4);
  } finally { companion.close(); service.close(); }
});

it("review regression: an unaccepted stale outbox is discarded only after receiver status and replaced by a fresh acquisition", async () => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "collector-stale-outbox-"))); directories.push(directory);
  const service = new CollectorService({ databasePath: join(directory, "receiver.sqlite"), now: () => now });
  const owner = { issuer: "https://synthetic-owner.invalid", subject: "synthetic-owner" };
  const verifier = "synthetic-private-verifier-000000000000000000000000000000000000000000";
  const request = await service.requestPairing({ descriptor: { kind: "cursor-complete-export", provider: "cursor", sourceId: "cursor-source", deviceId: "device", collectorVersion: "cursor-v1", context: "PERSONAL", account: { kind: "UNKNOWN" } }, window, verifier });
  await service.approvePairing({ pairingId: request.pairingId, owner, expiresAt: initial().expiresAt, allowedMetrics: ["requests"] });
  const claimed = await service.claimPairing({ pairingId: request.pairingId, verifier });
  const report = (value: string) => ({ format: "cursor-complete-report-v1", reportId: "one-report", source: { provider: "cursor", kind: "owner-supplied-report", accountAlias: null, sample: "unknown" }, window, complete: true, coverage: "partial", rows: [{ id: "one", at: "2026-10-02T00:00:00.000Z", metric: "requests", value, unit: "requests", kind: "NATIVE_QUANTITY" }] });
  let interrupt = true;
  const transport: CollectorTransport = { getGrant: input => service.getGrant(input), stageChunk: async input => {
    const result = await service.stageChunk(input);
    if (interrupt) {
      interrupt = false;
      const other = buildReviewDelivery({ grant: claimed.grant, review: report("2") });
      for (const chunk of other.chunks) await service.stageChunk({ ...claimed, connectionId: claimed.grant.connectionId, chunk });
      await service.commitReview({ connectionId: claimed.grant.connectionId, credential: claimed.credential, manifest: other.manifest });
      throw new Error("synthetic transport interruption before stale commit");
    }
    return result;
  }, commitReview: input => service.commitReview(input), deliveryStatus: input => service.deliveryStatus(input) };
  const companion = new CollectorCompanion({ databasePath: join(directory, "companion.sqlite"), now: () => now, transport });
  companion.connect(claimed);
  const collect = vi.fn().mockResolvedValueOnce(report("1")).mockResolvedValueOnce(report("3"));
  try {
    await expect(companion.sync({ connectionId: claimed.grant.connectionId, collect })).rejects.toThrow();
    expect(companion.pending({ connectionId: claimed.grant.connectionId })).not.toBeNull();
    const receipt = await companion.sync({ connectionId: claimed.grant.connectionId, collect });
    const history = await service.privateHistory({ owner, connectionId: claimed.grant.connectionId });
    expect(collect).toHaveBeenCalledTimes(2);
    expect(history.cursorViews[0].rows[0].value).toBe("3");
    expect(history.checkpoint).toBe(receipt.checkpoint);
    expect(companion.pending({ connectionId: claimed.grant.connectionId })).toBeNull();
  } finally { companion.close(); service.close(); }
});

it("review regression: accepted pending delivery with a lost acknowledgment survives a later writer without reacquiring or replacing its view", async () => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "collector-accepted-outbox-"))); directories.push(directory);
  const service = new CollectorService({ databasePath: join(directory, "receiver.sqlite"), now: () => now });
  const owner = { issuer: "https://synthetic-owner.invalid", subject: "synthetic-owner" };
  const verifier = "synthetic-private-verifier-000000000000000000000000000000000000000000";
  const request = await service.requestPairing({ descriptor: { kind: "cursor-complete-export", provider: "cursor", sourceId: "cursor-source", deviceId: "device", collectorVersion: "cursor-v1", context: "PERSONAL", account: { kind: "UNKNOWN" } }, window, verifier });
  await service.approvePairing({ pairingId: request.pairingId, owner, expiresAt: initial().expiresAt, allowedMetrics: ["requests"] });
  const claimed = await service.claimPairing({ pairingId: request.pairingId, verifier });
  const report = (value: string) => ({ format: "cursor-complete-report-v1", reportId: "one-report", source: { provider: "cursor", kind: "owner-supplied-report", accountAlias: null, sample: "unknown" }, window, complete: true, coverage: "partial", rows: [{ id: "one", at: "2026-10-02T00:00:00.000Z", metric: "requests", value, unit: "requests", kind: "NATIVE_QUANTITY" }] });
  let interrupt = true;
  const transport: CollectorTransport = { getGrant: input => service.getGrant(input), stageChunk: input => service.stageChunk(input), deliveryStatus: input => service.deliveryStatus(input), commitReview: async input => {
    const receipt = await service.commitReview(input);
    if (interrupt) {
      interrupt = false;
      const grant = await service.getGrant({ connectionId: claimed.grant.connectionId, credential: claimed.credential });
      const other = buildReviewDelivery({ grant, review: report("2") });
      for (const chunk of other.chunks) await service.stageChunk({ connectionId: grant.connectionId, credential: claimed.credential, chunk });
      await service.commitReview({ connectionId: grant.connectionId, credential: claimed.credential, manifest: other.manifest });
      throw new Error("synthetic lost acknowledgment followed by another accepted writer");
    }
    return receipt;
  } };
  const companion = new CollectorCompanion({ databasePath: join(directory, "companion.sqlite"), now: () => now, transport });
  companion.connect(claimed);
  const collect = vi.fn().mockResolvedValueOnce(report("1")).mockResolvedValueOnce(report("3"));
  try {
    await expect(companion.sync({ connectionId: claimed.grant.connectionId, collect })).rejects.toThrow();
    await companion.sync({ connectionId: claimed.grant.connectionId, collect });
    expect(collect).toHaveBeenCalledTimes(1);
    expect(companion.pending({ connectionId: claimed.grant.connectionId })).toBeNull();
    expect((await service.privateHistory({ owner, connectionId: claimed.grant.connectionId })).cursorViews[0].rows[0].value).toBe("2");
    await companion.sync({ connectionId: claimed.grant.connectionId, collect });
    expect(collect).toHaveBeenCalledTimes(2);
    expect((await service.privateHistory({ owner, connectionId: claimed.grant.connectionId })).cursorViews[0].rows[0].value).toBe("3");
  } finally { companion.close(); service.close(); }
});
