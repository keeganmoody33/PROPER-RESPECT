import { mkdtemp, realpath, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { CollectorService } from "./collector-service";
import { buildReviewDelivery, CODEX_METRICS, type CollectorGrant } from "../domain/collector-contract";
import { collectCodexRolloutHistory } from "./codex-history-collector";

const owner = { issuer: "https://fixture-auth.invalid", subject: "fixture-owner" };
const other = { issuer: "https://fixture-auth.invalid", subject: "fixture-other" };
const descriptor = {
  kind: "codex-local-history", provider: "codex", sourceId: "fixture-source", deviceId: "fixture-mac",
  collectorVersion: "fixture-v1", context: "PERSONAL", account: { kind: "UNKNOWN" },
} as const;
const window = { start: "2026-10-01T00:00:00.000Z", end: "2026-10-02T00:00:00.000Z" };
const verifier = "fixture-private-verifier-0000000000000000000000000000000000000000";
const created: { directory: string; service: CollectorService }[] = [];

async function fixture() {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "collector-service-")));
  let now = Date.parse("2026-10-06T00:00:00.000Z");
  const databasePath = join(directory, "private.sqlite");
  const service = new CollectorService({ databasePath, now: () => now });
  created.push({ directory, service });
  return { service, databasePath, clock: (value: number) => { now = value; }, now: () => now };
}

async function pair(service: CollectorService) {
  const pairing = await service.requestPairing({ descriptor, window, verifier });
  const approval = await service.approvePairing({ pairingId: pairing.pairingId, owner,
    expiresAt: "2026-10-07T00:00:00.000Z", allowedMetrics: [...CODEX_METRICS] });
  const claimed = await service.claimPairing({ pairingId: pairing.pairingId, verifier });
  return { pairing, approval, ...claimed };
}

afterEach(async () => {
  const fixtures = created.splice(0);
  for (const fixture of fixtures) fixture.service.close();
  for (const directory of new Set(fixtures.map(fixture => fixture.directory))) await rm(directory, { recursive: true, force: true });
});

function codexReview(value = 3, response = "response-1", at = "2026-10-01T01:00:00.000Z") {
  return collectCodexRolloutHistory({ window, signal: new AbortController().signal }, [{ lines: [
    JSON.stringify({ type: "session_meta", payload: { id: "thread-1" } }),
    JSON.stringify({ type: "token_usage_record", timestamp: at, payload: {
      thread_id: "thread-1", response_id: response, usage: { input_tokens: value, cached_input_tokens: 0,
        output_tokens: 2, reasoning_output_tokens: 0, total_tokens: value + 2, cache_write_input_tokens: 0 },
    } }),
  ] }]);
}

async function deliver(service: CollectorService, grant: CollectorGrant, credential: string, review: unknown) {
  const delivery = buildReviewDelivery({ grant, review });
  for (const chunk of delivery.chunks) await service.stageChunk({ connectionId: grant.connectionId, credential, chunk });
  const receipt = await service.commitReview({ connectionId: grant.connectionId, credential, manifest: delivery.manifest });
  return { ...delivery, receipt };
}

describe("durable sanitized review acceptance", () => {
  it("rejects expiry at the final receipt timestamp and rolls back the whole review", async () => {
    const directory = await realpath(await mkdtemp(join(tmpdir(), "collector-final-expiry-")));
    const startedAt = Date.parse("2026-10-06T00:00:00.000Z");
    let commitClockReads: number[] | null = null;
    const databasePath = join(directory, "private.sqlite");
    const service = new CollectorService({ databasePath, now: () => commitClockReads?.shift() ?? startedAt });
    created.push({ directory, service });
    const { grant, credential } = await pair(service);
    const delivery = buildReviewDelivery({ grant, review: codexReview() });
    for (const chunk of delivery.chunks) await service.stageChunk({ connectionId: grant.connectionId, credential, chunk });
    // Authorization and pre-write checks pass, but the receipt instant expires.
    commitClockReads = [startedAt, startedAt, Date.parse(grant.expiresAt)];
    await expect(service.commitReview({ connectionId: grant.connectionId, credential, manifest: delivery.manifest })).rejects.toThrow("expired");
    commitClockReads = null;
    const history = await service.privateHistory({ owner, connectionId: grant.connectionId });
    expect(history.responses.rows).toEqual([]);
    expect(history.legacyViews).toEqual([]);
    expect(history.receiptCount).toBe(0);
    expect(history.checkpoint).toBeNull();
    const probe = new DatabaseSync(databasePath);
    try { expect(probe.prepare("SELECT COUNT(*) AS count FROM accepted_reviews").get()?.count).toBe(0); }
    finally { probe.close(); }
  });
  it("distinguishes committed lost acknowledgments from unaccepted stale deliveries with explicit status", async () => {
    const { service, databasePath } = await fixture();
    const { grant, credential } = await pair(service);
    const first = buildReviewDelivery({ grant, review: codexReview() });
    const stale = buildReviewDelivery({ grant, review: codexReview(4, "response-2") });
    expect(await service.deliveryStatus({ connectionId: grant.connectionId, credential, manifest: stale.manifest }))
      .toEqual({ kind: "READY", checkpoint: null });
    for (const chunk of stale.chunks) await service.stageChunk({ connectionId: grant.connectionId, credential, chunk });
    for (const chunk of first.chunks) await service.stageChunk({ connectionId: grant.connectionId, credential, chunk });
    const receipt = await service.commitReview({ connectionId: grant.connectionId, credential, manifest: first.manifest });
    expect(await service.deliveryStatus({ connectionId: grant.connectionId, credential, manifest: first.manifest }))
      .toEqual({ kind: "COMMITTED", receipt });
    expect(await service.deliveryStatus({ connectionId: grant.connectionId, credential, manifest: stale.manifest }))
      .toEqual({ kind: "STALE", checkpoint: receipt.checkpoint });
    const probe = new DatabaseSync(databasePath);
    try { expect(probe.prepare("SELECT COUNT(*) AS count FROM chunks WHERE batch_id=?").get(stale.manifest.batchId)?.count).toBe(0); }
    finally { probe.close(); }
    await expect(service.deliveryStatus({ connectionId: grant.connectionId, credential,
      manifest: { ...first.manifest, bytes: first.manifest.bytes + 1 } })).rejects.toThrow("collision");
    await expect(service.deliveryStatus({ connectionId: grant.connectionId, credential,
      manifest: { ...stale.manifest, batchId: "0".repeat(64) } })).rejects.toThrow();
    await expect(service.deliveryStatus({ connectionId: grant.connectionId, credential: verifier, manifest: stale.manifest })).rejects.toThrow();
    await service.disconnectOwner({ connectionId: grant.connectionId, owner });
    await expect(service.deliveryStatus({ connectionId: grant.connectionId, credential, manifest: first.manifest })).rejects.toThrow();
  });
  it("rolls back observations, view, receipt and checkpoint together after a persistence failure", async () => {
    const { service, databasePath } = await fixture();
    const { grant, credential } = await pair(service);
    const delivery = buildReviewDelivery({ grant, review: codexReview() });
    for (const chunk of delivery.chunks) await service.stageChunk({ connectionId: grant.connectionId, credential, chunk });
    const failure = new DatabaseSync(databasePath);
    try {
      failure.exec("CREATE TRIGGER fail_receipt BEFORE INSERT ON receipts BEGIN SELECT RAISE(ABORT, 'fixture-disk-write-failure'); END");
      await expect(service.commitReview({ connectionId: grant.connectionId, credential, manifest: delivery.manifest })).rejects.toThrow("fixture-disk-write-failure");
      const history = await service.privateHistory({ owner, connectionId: grant.connectionId });
      expect(history.responses.rows).toEqual([]);
      expect(history.legacyViews).toEqual([]);
      expect(history.receiptCount).toBe(0);
      expect(failure.prepare("SELECT COUNT(*) AS count FROM accepted_reviews").get()?.count).toBe(0);
      expect((await service.getGrant({ connectionId: grant.connectionId, credential })).checkpoint).toBeNull();
      failure.exec("DROP TRIGGER fail_receipt");
      await service.commitReview({ connectionId: grant.connectionId, credential, manifest: delivery.manifest });
      expect((await service.privateHistory({ owner, connectionId: grant.connectionId })).receiptCount).toBe(1);
    } finally { failure.close(); }
  });

  it("serializes two receiver connections and rejects a concurrent obsolete checkpoint", async () => {
    const state = await fixture();
    const secondReceiver = new CollectorService({ databasePath: state.databasePath, now: state.now });
    created.push({ directory: join(state.databasePath, ".."), service: secondReceiver });
    const { grant, credential } = await pair(state.service);
    const first = buildReviewDelivery({ grant, review: codexReview() });
    const second = buildReviewDelivery({ grant, review: codexReview(4, "response-2") });
    for (const chunk of first.chunks) await state.service.stageChunk({ connectionId: grant.connectionId, credential, chunk });
    for (const chunk of second.chunks) await secondReceiver.stageChunk({ connectionId: grant.connectionId, credential, chunk });
    const outcomes = await Promise.allSettled([
      state.service.commitReview({ connectionId: grant.connectionId, credential, manifest: first.manifest }),
      secondReceiver.commitReview({ connectionId: grant.connectionId, credential, manifest: second.manifest }),
    ]);
    expect(outcomes.filter(outcome => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(outcome => outcome.status === "rejected")).toHaveLength(1);
    const history = await secondReceiver.privateHistory({ owner, connectionId: grant.connectionId });
    expect(history.receiptCount).toBe(1);
    expect(history.responses.rows).toHaveLength(1);
  });
  it("rejects cross-source ingestion and unauthorized categories before committing any receipt", async () => {
    const { service, databasePath } = await fixture();
    const { grant, credential } = await pair(service);
    const delivery = buildReviewDelivery({ grant, review: codexReview() });
    const second = await service.requestPairing({ descriptor: { ...descriptor, sourceId: "other-account" }, window, verifier });
    await service.approvePairing({ pairingId: second.pairingId, owner,
      expiresAt: grant.expiresAt, allowedMetrics: [...CODEX_METRICS] });
    const otherSource = await service.claimPairing({ pairingId: second.pairingId, verifier });
    await service.stageChunk({ connectionId: otherSource.grant.connectionId, credential: otherSource.credential, chunk: delivery.chunks[0] });
    await expect(service.commitReview({ connectionId: otherSource.grant.connectionId, credential: otherSource.credential, manifest: delivery.manifest })).rejects.toThrow("identity");
    const unsafe = { ...delivery.chunks[0], prompt: "DO-NOT-STORE-THIS-TRANSCRIPT" };
    await expect(service.stageChunk({ connectionId: grant.connectionId, credential, chunk: unsafe })).rejects.toThrow();
    expect((await readFile(databasePath)).includes(Buffer.from("DO-NOT-STORE-THIS-TRANSCRIPT"))).toBe(false);
    expect((await service.privateHistory({ owner, connectionId: grant.connectionId })).receiptCount).toBe(0);
    const limitedPairing = await service.requestPairing({ descriptor, window, verifier });
    await service.approvePairing({ pairingId: limitedPairing.pairingId, owner,
      expiresAt: grant.expiresAt, allowedMetrics: ["total_tokens"] });
    const limited = await service.claimPairing({ pairingId: limitedPairing.pairingId, verifier });
    // Build with a broader forged grant to exercise the receiver's authorization.
    const forged = buildReviewDelivery({ grant: { ...limited.grant, allowedMetrics: [...CODEX_METRICS] }, review: codexReview() });
    for (const chunk of forged.chunks) await expect(service.stageChunk({ connectionId: limited.grant.connectionId, credential: limited.credential, chunk })).rejects.toThrow("metrics");
    await expect(service.commitReview({ connectionId: limited.grant.connectionId, credential: limited.credential, manifest: forged.manifest })).rejects.toThrow();
    expect((await service.privateHistory({ owner, connectionId: grant.connectionId })).receiptCount).toBe(0);
  });

  it("keeps overlapping legacy windows as separate replacement views", async () => {
    const { service } = await fixture();
    const first = await pair(service);
    const legacyReview = (reviewWindow: typeof window, increment: number) => collectCodexRolloutHistory({ window: reviewWindow, signal: new AbortController().signal }, [{ lines: [
      JSON.stringify({ type: "session_meta", payload: { id: "legacy-thread" } }),
      JSON.stringify({ type: "event_msg", timestamp: "2026-10-01T01:00:00.000Z", payload: { type: "token_count", info: {
        total_token_usage: { input_tokens: 10, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: 10, cache_write_input_tokens: 0 },
      } } }),
      JSON.stringify({ type: "event_msg", timestamp: "2026-10-01T02:00:00.000Z", payload: { type: "token_count", info: {
        total_token_usage: { input_tokens: 10 + increment, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: 10 + increment, cache_write_input_tokens: 0 },
        last_token_usage: { input_tokens: increment, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: increment, cache_write_input_tokens: 0 },
      } } }),
    ] }]);
    await deliver(service, first.grant, first.credential, legacyReview(window, 2));
    const secondWindow = { start: "2026-10-01T00:30:00.000Z", end: "2026-10-02T00:30:00.000Z" };
    const pairing = await service.requestPairing({ descriptor, window: secondWindow, verifier });
    await service.approvePairing({ pairingId: pairing.pairingId, owner,
      expiresAt: first.grant.expiresAt, allowedMetrics: [...CODEX_METRICS] });
    const second = await service.claimPairing({ pairingId: pairing.pairingId, verifier });
    await deliver(service, second.grant, second.credential, legacyReview(secondWindow, 2));
    const current = await service.getGrant({ connectionId: second.grant.connectionId, credential: second.credential });
    await deliver(service, current, second.credential, legacyReview(secondWindow, 3));
    const history = await service.privateHistory({ owner, connectionId: second.grant.connectionId });
    expect(history.legacyViews).toHaveLength(2);
    expect(history.legacyViews.map(view => view.legacy.totals.find(row => row.metric === "total_tokens")?.value).sort()).toEqual(["2", "3"]);
    expect(history.responses.totals.every(row => row.value === null)).toBe(true);
  });

  it("accepts Cursor complete report replacement atomically and retains equal rows as separate records", async () => {
    const { service } = await fixture();
    const pairing = await service.requestPairing({ descriptor: { ...descriptor, kind: "cursor-complete-export", provider: "cursor", sourceId: "cursor-work", context: "WORK",
      account: { kind: "OWNER_ASSOCIATED", alias: "fixture-work-account" } }, window, verifier });
    await service.approvePairing({ pairingId: pairing.pairingId, owner,
      expiresAt: "2026-10-07T00:00:00.000Z", allowedMetrics: ["requests", "usage_cost_usd"] });
    const { grant, credential } = await service.claimPairing({ pairingId: pairing.pairingId, verifier });
    const report = { format: "cursor-complete-report-v1", reportId: "fixture-report", source: {
      provider: "cursor", kind: "owner-supplied-report", accountAlias: null, sample: "unknown",
    }, window, coverage: "partial", complete: true, rows: [
      { id: "row-1", at: "2026-10-01T01:00:00.000Z", metric: "requests", value: "1", unit: "requests", kind: "NATIVE_QUANTITY" },
      { id: "row-2", at: "2026-10-01T01:00:00.000Z", metric: "requests", value: "1", unit: "requests", kind: "NATIVE_QUANTITY" },
    ] } as const;
    await expect(service.stageChunk({ connectionId: grant.connectionId, credential,
      chunk: { format: "collector-review-chunk-v1", batchId: "a".repeat(64), id: "b".repeat(64), index: 0,
        rows: [{ kind: "cursor-measurement", row: { ...report.rows[0], metric: "actual_charges_usd" } }] } })).rejects.toThrow();
    const firstDelivery = buildReviewDelivery({ grant, review: report });
    for (const chunk of firstDelivery.chunks) await service.stageChunk({ connectionId: grant.connectionId, credential, chunk });
    const firstReceipt = await service.commitReview({ connectionId: grant.connectionId, credential, manifest: firstDelivery.manifest });
    expect((await service.privateHistory({ owner, connectionId: grant.connectionId })).cursorViews[0].rows).toHaveLength(2);
    const current = await service.getGrant({ connectionId: grant.connectionId, credential });
    const replacement = buildReviewDelivery({ grant: current, review: { ...report, reportId: "fixture-report-2", rows: [report.rows[0]] } });
    await expect(service.commitReview({ connectionId: grant.connectionId, credential, manifest: replacement.manifest })).rejects.toThrow();
    expect((await service.privateHistory({ owner, connectionId: grant.connectionId })).cursorViews[0].rows).toHaveLength(2);
    for (const chunk of replacement.chunks) await service.stageChunk({ connectionId: grant.connectionId, credential, chunk });
    await service.commitReview({ connectionId: grant.connectionId, credential, manifest: replacement.manifest });
    const history = await service.privateHistory({ owner, connectionId: grant.connectionId });
    expect(history.cursorViews).toHaveLength(1);
    expect(history.cursorViews[0].rows).toHaveLength(1);
    expect(history.receiptCount).toBe(2);
    expect(history.descriptor.account).toEqual({ kind: "OWNER_ASSOCIATED", alias: "fixture-work-account" });
    const archivedFirst = { connectionId: grant.connectionId, generation: grant.generation, batchId: firstReceipt.batchId, owner };
    expect((await service.acceptedReview(archivedFirst)).review).toMatchObject({ reportId: "fixture-report", rows: report.rows });
    await expect(service.acceptedReview({ ...archivedFirst, owner: other })).rejects.toThrow();
    await expect(service.acceptedReview({ ...archivedFirst, owner: { ...owner, issuer: "https://other.invalid" } })).rejects.toThrow();
    await expect(service.commitReview({ connectionId: grant.connectionId, credential,
      manifest: { ...replacement.manifest, review: { ...replacement.manifest.review, complete: false } } })).rejects.toThrow();
    await service.disconnectOwner({ connectionId: grant.connectionId, owner });
    expect((await service.acceptedReview(archivedFirst)).receipt).toEqual(firstReceipt);
    expect((await service.acceptedReview(archivedFirst)).review).toMatchObject({ rows: report.rows });
  });
  it("recovers staged work across receiver restart and returns the original receipt after lost ACK", async () => {
    const fixtureState = await fixture();
    let service = fixtureState.service;
    const { grant, credential } = await pair(service);
    const delivery = buildReviewDelivery({ grant, review: codexReview() });
    await service.stageChunk({ connectionId: grant.connectionId, credential, chunk: delivery.chunks[0] });
    expect((await service.privateHistory({ owner, connectionId: grant.connectionId })).responses.rows).toEqual([]);
    service.close();
    service = new CollectorService({ databasePath: fixtureState.databasePath, now: fixtureState.now });
    created.push({ directory: join(fixtureState.databasePath, ".."), service });
    const receipt = await service.commitReview({ connectionId: grant.connectionId, credential, manifest: delivery.manifest });
    expect(await service.stageChunk({ connectionId: grant.connectionId, credential, chunk: delivery.chunks[0] })).toEqual({ duplicate: true });
    expect(await service.commitReview({ connectionId: grant.connectionId, credential, manifest: delivery.manifest })).toEqual(receipt);
    expect((await service.getGrant({ connectionId: grant.connectionId, credential })).checkpoint).toBe(receipt.checkpoint);
    service.close();
    const reopened = new CollectorService({ databasePath: fixtureState.databasePath, now: fixtureState.now });
    created.push({ directory: join(fixtureState.databasePath, ".."), service: reopened });
    expect((await reopened.privateHistory({ owner, connectionId: grant.connectionId })).responses.rows).toHaveLength(1);
    expect((await reopened.privateHistory({ owner, connectionId: grant.connectionId })).lastReceipt).toEqual(receipt);
    expect((await reopened.privateHistory({ owner, connectionId: grant.connectionId })).receiptCount).toBe(1);
  });

  it("rejects changed chunks, incomplete reviews, stale concurrent commits and changed accepted manifests", async () => {
    const { service } = await fixture();
    const { grant, credential } = await pair(service);
    const first = buildReviewDelivery({ grant, review: codexReview() });
    const second = buildReviewDelivery({ grant, review: codexReview(4, "response-2") });
    await expect(service.commitReview({ connectionId: grant.connectionId, credential, manifest: first.manifest })).rejects.toThrow();
    for (const chunk of first.chunks) await service.stageChunk({ connectionId: grant.connectionId, credential, chunk });
    const changed = { ...first.chunks[0], rows: second.chunks[0].rows };
    await expect(service.stageChunk({ connectionId: grant.connectionId, credential, chunk: changed })).rejects.toThrow("collision");
    for (const chunk of second.chunks) await service.stageChunk({ connectionId: grant.connectionId, credential, chunk });
    await service.commitReview({ connectionId: grant.connectionId, credential, manifest: first.manifest });
    await expect(service.commitReview({ connectionId: grant.connectionId, credential, manifest: second.manifest })).rejects.toThrow("checkpoint");
    await expect(service.stageChunk({ connectionId: grant.connectionId, credential, chunk: changed })).rejects.toThrow("collision");
    await expect(service.commitReview({ connectionId: grant.connectionId, credential,
      manifest: { ...first.manifest, bytes: first.manifest.bytes + 1 } })).rejects.toThrow("collision");
    expect((await service.privateHistory({ owner, connectionId: grant.connectionId })).responses.rows).toHaveLength(1);
  });

  it("retains absent responses and conflicting variants across partial rescans and never clears quarantine", async () => {
    const { service } = await fixture();
    const { grant, credential } = await pair(service);
    await deliver(service, grant, credential, codexReview());
    let current = await service.getGrant({ connectionId: grant.connectionId, credential });
    await deliver(service, current, credential, codexReview(5, "response-2"));
    expect((await service.privateHistory({ owner, connectionId: grant.connectionId })).responses.rows).toHaveLength(2);
    current = await service.getGrant({ connectionId: grant.connectionId, credential });
    await deliver(service, current, credential, codexReview(8));
    let history = await service.privateHistory({ owner, connectionId: grant.connectionId });
    expect(history.responses.rows).toHaveLength(3);
    expect(history.responses.rows.filter(row => row.status === "conflict")).toHaveLength(2);
    expect(history.responses.totals.every(row => row.value === null)).toBe(true);
    current = await service.getGrant({ connectionId: grant.connectionId, credential });
    await deliver(service, current, credential, codexReview());
    history = await service.privateHistory({ owner, connectionId: grant.connectionId });
    expect(history.responses.rows).toHaveLength(3);
    expect(history.responses.rows.filter(row => row.status === "conflict")).toHaveLength(2);
    current = await service.getGrant({ connectionId: grant.connectionId, credential });
    await deliver(service, current, credential, codexReview(3, "response-1", "2026-10-01T01:05:00.000Z"));
    history = await service.privateHistory({ owner, connectionId: grant.connectionId });
    expect(history.responses.rows).toHaveLength(4);
    expect(history.responses.rows.filter(row => row.status === "conflict")).toHaveLength(3);
    await expect(service.privateHistory({ owner: other, connectionId: grant.connectionId })).rejects.toThrow();
  });

  it("fences staging and commit on disconnect and expiry while preserving already accepted private history", async () => {
    const { service, clock } = await fixture();
    const { grant, credential } = await pair(service);
    await deliver(service, grant, credential, codexReview());
    const current = await service.getGrant({ connectionId: grant.connectionId, credential });
    const pending = buildReviewDelivery({ grant: current, review: codexReview(5, "response-2") });
    await service.stageChunk({ connectionId: grant.connectionId, credential, chunk: pending.chunks[0] });
    clock(Date.parse(grant.expiresAt));
    await expect(service.commitReview({ connectionId: grant.connectionId, credential, manifest: pending.manifest })).rejects.toThrow("expired");
    await service.disconnectOwner({ connectionId: grant.connectionId, owner });
    await expect(service.stageChunk({ connectionId: grant.connectionId, credential, chunk: pending.chunks[0] })).rejects.toThrow();
    await expect(service.commitReview({ connectionId: grant.connectionId, credential, manifest: pending.manifest })).rejects.toThrow();
    expect((await service.privateHistory({ owner, connectionId: grant.connectionId })).responses.rows).toHaveLength(1);
  });
});

describe("durable fixture service authorization", () => {
  it("reconnects immutable sources, fences old unclaimed pairings and rejects changed context", async () => {
    const { service } = await fixture();
    const first = await pair(service);
    const unclaimed = await service.requestPairing({ descriptor, window, verifier: verifier + "a" });
    await service.approvePairing({ pairingId: unclaimed.pairingId, owner,
      expiresAt: first.grant.expiresAt, allowedMetrics: [...CODEX_METRICS] });
    const fresh = await pair(service);
    expect(fresh.grant.connectionId).toBe(first.grant.connectionId);
    expect(fresh.grant.generation).toBeGreaterThan(first.grant.generation);
    await expect(service.claimPairing({ pairingId: unclaimed.pairingId, verifier: verifier + "a" })).rejects.toThrow("changed");
    await expect(service.getGrant({ connectionId: first.grant.connectionId, credential: first.credential })).rejects.toThrow();
    const changed = await service.requestPairing({ descriptor: { ...descriptor, context: "WORK" }, window, verifier });
    await expect(service.approvePairing({ pairingId: changed.pairingId, owner,
      expiresAt: first.grant.expiresAt, allowedMetrics: [...CODEX_METRICS] })).rejects.toThrow("identity changed");
    expect((await service.getGrant({ connectionId: fresh.grant.connectionId, credential: fresh.credential })).generation).toBe(fresh.grant.generation);
  });
  it("requires owner approval, preserves one credential through lost claim ACK and stores no plaintext token", async () => {
    const { service, databasePath } = await fixture();
    const pairing = await service.requestPairing({ descriptor, window, verifier });
    await expect(service.claimPairing({ pairingId: pairing.pairingId, verifier })).rejects.toThrow("approval");
    await service.approvePairing({ pairingId: pairing.pairingId, owner,
      expiresAt: "2026-10-07T00:00:00.000Z", allowedMetrics: ["total_tokens"] });
    const claimed = await service.claimPairing({ pairingId: pairing.pairingId, verifier });
    expect(await service.claimPairing({ pairingId: pairing.pairingId, verifier })).toEqual(claimed);
    await expect(service.claimPairing({ pairingId: pairing.pairingId, verifier: verifier + "x" })).rejects.toThrow();
    expect((await stat(databasePath)).mode & 0o777).toBe(0o600);
    const stored = await readFile(databasePath);
    expect(stored.includes(Buffer.from(verifier))).toBe(false);
    expect(stored.includes(Buffer.from(claimed.credential))).toBe(false);
  });

  it("isolates issuer and subject, expiry and revocation without deleting the connection", async () => {
    const { service, clock } = await fixture();
    const paired = await pair(service);
    await expect(service.disconnectOwner({ connectionId: paired.grant.connectionId, owner: other })).rejects.toThrow();
    expect(await service.listConnections({ owner: other })).toEqual([]);
    expect(await service.listConnections({ owner: { ...owner, issuer: "https://different.invalid" } })).toEqual([]);
    await expect(service.getGrant({ connectionId: paired.grant.connectionId, credential: "wrong" })).rejects.toThrow();
    clock(Date.parse("2026-10-07T00:00:00.000Z"));
    await expect(service.getGrant({ connectionId: paired.grant.connectionId, credential: paired.credential })).rejects.toThrow("expired");
    await service.disconnectOwner({ connectionId: paired.grant.connectionId, owner });
    expect(await service.listConnections({ owner })).toHaveLength(1);
    await expect(service.getGrant({ connectionId: paired.grant.connectionId, credential: paired.credential })).rejects.toThrow();
  });

  it("expires unapproved pairing and cannot approve it for two owners", async () => {
    const { service, clock } = await fixture();
    const paired = await pair(service);
    await expect(service.approvePairing({ pairingId: paired.pairing.pairingId, owner: other,
      expiresAt: "2026-10-07T00:00:00.000Z", allowedMetrics: ["total_tokens"] })).rejects.toThrow();
    const pending = await service.requestPairing({ descriptor: { ...descriptor, sourceId: "another-source" }, window, verifier });
    clock(Date.parse(pending.expiresAt));
    await expect(service.approvePairing({ pairingId: pending.pairingId, owner,
      expiresAt: "2026-10-07T00:00:00.000Z", allowedMetrics: ["total_tokens"] })).rejects.toThrow("expired");
  });
});
