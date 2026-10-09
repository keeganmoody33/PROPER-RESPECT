import { randomBytes } from "node:crypto";
import { createServer, request as httpRequest } from "node:http";
import { mkdtemp, realpath, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, it } from "vitest";
import { CODEX_METRICS, collectorDigest } from "../domain/collector-contract.ts";
import { CollectorService } from "./collector-service.ts";
import { CollectorCompanion } from "./collector-companion.ts";
import { collectCodexRolloutHistory } from "./codex-history-collector.ts";
import { createCollectorFixtureTransport, startCollectorFixtureHttp } from "./collector-fixture-http.ts";
import { startCollectorFixture } from "./collector-fixture.ts";

const owner = { issuer: "https://fixture-auth.invalid", subject: "test-owner" };
const window = { start: "2026-10-01T00:00:00.000Z", end: "2026-10-08T00:00:00.000Z" };
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });

it("restarts both SQLite stores and resumes a real HTTP commit after a lost acknowledgment without another acquisition", async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "collector-http-")));
  const databasePath = join(directory, "receiver/private.sqlite");
  const companionPath = join(directory, "companion/private.sqlite");
  let service = new CollectorService({ databasePath });
  const ownerToken = randomBytes(32).toString("hex");
  const http = await startCollectorFixtureHttp({ service: () => service, owner, ownerToken });
  const transport = createCollectorFixtureTransport({ origin: http.origin });
  let lost = true;
  let companion = new CollectorCompanion({ databasePath: companionPath, transport: { ...transport, commitReview: async request => {
    const receipt = await transport.commitReview(request);
    if (lost) { lost = false; throw new Error("Synthetic lost acknowledgment."); }
    return receipt;
  } } });
  cleanup.push(async () => { companion.close(); service.close(); await http.close(); await rm(directory, { recursive: true, force: true }); });
  const pairing = await service.requestPairing({ descriptor: { provider: "codex", kind: "codex-local-history", sourceId: "synthetic-source", deviceId: "synthetic-device", collectorVersion: "v1", context: "PERSONAL", account: { kind: "UNKNOWN" }, sample: "synthetic" }, window, verifier: ownerToken });
  await service.approvePairing({ pairingId: pairing.pairingId, owner, expiresAt: new Date(Date.now() + 60000).toISOString(), allowedMetrics: [...CODEX_METRICS] });
  const claimed = await service.claimPairing({ pairingId: pairing.pairingId, verifier: ownerToken });
  companion.connect(claimed);
  const file = await readFile(resolve("tests/fixtures/codex-rollouts/sessions/2026/10/02/rollout-fixture-modern.jsonl"), "utf8");
  const review = collectCodexRolloutHistory({ window, signal: new AbortController().signal }, [{ lines: file.trimEnd().split("\n") }]);
  let reads = 0;
  await expect(companion.sync({ connectionId: claimed.grant.connectionId, collect: async () => { reads++; return review; } })).rejects.toThrow();
  expect(companion.checkpoint({ connectionId: claimed.grant.connectionId })).toBeNull();
  expect(companion.pending({ connectionId: claimed.grant.connectionId })).not.toBeNull();
  const accepted = await service.privateHistory({ owner, connectionId: claimed.grant.connectionId });
  expect(accepted.responses.totals.find(row => row.metric === "total_tokens")?.value).toBe("30");
  companion.close(); service.close();
  service = new CollectorService({ databasePath });
  companion = new CollectorCompanion({ databasePath: companionPath, transport });
  const receipt = await companion.sync({ connectionId: claimed.grant.connectionId, collect: async () => { reads++; throw new Error("Should not reacquire."); } });
  expect(reads).toBe(1);
  expect(companion.checkpoint({ connectionId: claimed.grant.connectionId })).toBe(receipt.checkpoint);
  expect(collectorDigest((await service.privateHistory({ owner, connectionId: claimed.grant.connectionId })).responses)).toBe(collectorDigest(accepted.responses));
  await service.disconnectOwner({ owner, connectionId: claimed.grant.connectionId });
  await expect(companion.sync({ connectionId: claimed.grant.connectionId, collect: async () => { reads++; return review; } })).rejects.toThrow();
  expect(reads).toBe(1);
  expect((await service.privateHistory({ owner, connectionId: claimed.grant.connectionId })).responses.totals.find(row => row.metric === "total_tokens")?.value).toBe("30");
});

it("rejects remote destinations and unauthenticated or cross-origin fixture changes without leaking credentials", async () => {
  for (const origin of ["https://127.0.0.1:1234", "http://localhost:1234", "http://example.com:1234", "http://127.0.0.1:1234/extra", "http://u:p@127.0.0.1:1234", "http://[2001:db8::1]:1234", "http://[::ffff:127.0.0.1]:1234"]) expect(() => createCollectorFixtureTransport({ origin })).toThrow();
  const directory = await realpath(await mkdtemp(join(tmpdir(), "collector-boundary-")));
  const service = new CollectorService({ databasePath: join(directory, "receiver/private.sqlite") });
  const ownerToken = randomBytes(32).toString("hex"); let changes = 0;
  const http = await startCollectorFixtureHttp({ service: () => service, owner, ownerToken, action: async () => { changes++; return {}; } });
  cleanup.push(async () => { service.close(); await http.close(); await rm(directory, { recursive: true, force: true }); });
  const rejectedHeaders: Record<string, string>[] = [{ "content-type": "application/json" }, { "content-type": "application/json", authorization: `Bearer ${ownerToken}`, origin: "https://untrusted.invalid" }];
  for (const headers of rejectedHeaders) {
    const response = await fetch(`${http.origin}/fixture/connect`, { method: "POST", headers, body: "{}" });
    expect(response.status).toBe(400); expect(await response.text()).not.toContain(ownerToken);
  }
  const valid = await fetch(`${http.origin}/fixture/connect`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${ownerToken}`, origin: http.origin }, body: "{}" });
  expect(valid.status).toBe(200); expect(changes).toBe(1);
});

it("serves IPv6 loopback ::1 with the same Host, Origin and size checks and never binds non-loopback", async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "collector-ipv6-")));
  const service = new CollectorService({ databasePath: join(directory, "receiver/private.sqlite") });
  const ownerToken = randomBytes(32).toString("hex");
  const http = await startCollectorFixtureHttp({ service: () => service, owner, ownerToken, state: async () => ({ loopback: "ipv6" }) });
  cleanup.push(async () => { service.close(); await http.close(); await rm(directory, { recursive: true, force: true }); });
  expect(http.boundHosts).toEqual(["127.0.0.1", "::1"]);
  expect(http.ipv6Origin).toMatch(/^http:\/\/\[::1\]:\d+$/);
  if (!http.ipv6Origin) throw new Error("IPv6 origin missing.");
  expect(() => createCollectorFixtureTransport({ origin: http.ipv6Origin })).not.toThrow();
  const accepted = await fetch(`${http.ipv6Origin}/fixture/state`, { headers: { authorization: `Bearer ${ownerToken}`, origin: http.ipv6Origin } });
  expect(accepted.status).toBe(200);
  expect(await accepted.json()).toEqual({ loopback: "ipv6" });
  const crossed = await fetch(`${http.ipv6Origin}/fixture/connect`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${ownerToken}`, origin: http.origin }, body: "{}" });
  expect(crossed.status).toBe(400);
  const port = Number(new URL(http.ipv6Origin).port);
  const spoofed = await new Promise<number>(resolve => {
    const req = httpRequest({ host: "::1", port, family: 6, method: "POST", path: "/fixture/connect", headers: { host: `192.168.0.1:${port}`, "content-type": "application/json", authorization: `Bearer ${ownerToken}`, origin: http.ipv6Origin } }, response => { resolve(response.statusCode ?? 0); response.resume(); });
    req.end("{}");
  });
  expect(spoofed).toBe(400);
});

it("keeps IPv4 loopback up when ::1 is occupied or unavailable", async () => {
  const blocker = createServer();
  await new Promise<void>((resolve, reject) => {
    blocker.once("error", reject);
    blocker.listen({ port: 0, host: "::1", ipv6Only: true }, resolve);
  });
  const blocked = blocker.address();
  if (!blocked || typeof blocked === "string") throw new Error("IPv6 blocker did not bind ::1.");
  cleanup.push(async () => { await new Promise<void>((resolve, reject) => blocker.close(error => error ? reject(error) : resolve())); });
  const directory = await realpath(await mkdtemp(join(tmpdir(), "collector-ipv4-only-")));
  const service = new CollectorService({ databasePath: join(directory, "receiver/private.sqlite") });
  const ownerToken = randomBytes(32).toString("hex");
  const http = await startCollectorFixtureHttp({
    service: () => service, owner, ownerToken, port: blocked.port, state: async () => ({ loopback: "ipv4-only" }),
  });
  cleanup.push(async () => { service.close(); await http.close(); await rm(directory, { recursive: true, force: true }); });
  expect(http.boundHosts).toEqual(["127.0.0.1"]);
  expect(http.ipv6Origin).toBeUndefined();
  expect(http.origin).toBe(`http://127.0.0.1:${blocked.port}`);
  const accepted = await fetch(`${http.origin}/fixture/state`, { headers: { authorization: `Bearer ${ownerToken}`, origin: http.origin } });
  expect(accepted.status).toBe(200);
  expect(await accepted.json()).toEqual({ loopback: "ipv4-only" });
});

it("runs the actual native fixture connection, updates and process reopen with private retention for both adapters", async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "collector-runtime-")));
  let runtime = await startCollectorFixture({ directory, repository: resolve(".") });
  cleanup.push(async () => { await runtime.close(); await rm(directory, { recursive: true, force: true }); });
  const bootstrap = await fetch(runtime.origin);
  const cookie = bootstrap.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("Fixture owner cookie missing.");
  const post = async (path: string, body: unknown) => {
    const response = await fetch(`${runtime.origin}${path}`, { method: "POST", headers: { "content-type": "application/json", cookie, origin: runtime.origin }, body: JSON.stringify(body) });
    expect(response.status).toBe(200); return response.json();
  };
  const pairing = await post("/fixture/connect", { provider: "codex", context: "PERSONAL" });
  const claimed = await post("/fixture/approve", { pairingId: pairing.pairingId });
  expect((await runtime.state()).connections[0].metrics.modernTotalTokens).toBeNull();
  await post("/fixture/sync", claimed);
  const first = (await runtime.state()).connections[0];
  expect(first.metrics.modernTotalTokens).toBe("30"); expect(first.metrics.legacyObservedIncrease).toBe("20");
  expect(first.receiptCount).toBe(1);
  await post("/fixture/sync", claimed);
  expect((await runtime.state()).connections[0].metrics.modernTotalTokens).toBe("30");
  expect((await runtime.state()).connections[0].receiptCount).toBe(1);
  await runtime.tick();
  expect((await runtime.state()).connections[0].receiptCount).toBe(1);
  await post("/fixture/update", claimed);
  expect((await runtime.state()).connections[0].metrics.modernTotalTokens).toBe("70");
  expect((await runtime.state()).connections[0].receiptCount).toBe(2);
  await post("/fixture/restart", {});
  await post("/fixture/sync", claimed);
  expect((await runtime.state()).persistence.restartVerified).toBe(true);
  await post("/fixture/disconnect", claimed);
  const retained = (await runtime.state()).connections[0];
  expect(retained.status).toBe("REVOKED"); expect(retained.metrics.modernTotalTokens).toBe("70");
  const cursor = await post("/fixture/connect", { provider: "cursor", context: "WORK" });
  const cursorClaim = await post("/fixture/approve", { pairingId: cursor.pairingId });
  await post("/fixture/sync", cursorClaim);
  const cursorView = (await runtime.state()).connections.find(row => row.provider === "cursor");
  expect(cursorView?.metrics).toMatchObject({ cursorTokens: "100", cursorRequests: "2", cursorSourceCostUsd: "0.0125" });
  await runtime.close(); runtime = await startCollectorFixture({ directory, repository: resolve(".") });
  await runtime.tick();
  const reopened = await runtime.state();
  expect(reopened.connections.find(row => row.provider === "codex")?.status).toBe("REVOKED");
  expect(reopened.connections.find(row => row.provider === "cursor")?.metrics.cursorTokens).toBe("100");
}, 30_000);
