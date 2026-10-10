import { execFileSync } from "node:child_process";
import { chmod, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ConvexError } from "convex/values";
import { afterEach, expect, test } from "vitest";
import { createCompanionState, loadCompanionState, saveCompanionState, type CompanionState } from "./codex-companion";
import { watchCompanion } from "./codex-sync-loop";
import { deviceDigest, devicePublicKey } from "../domain/device-proof";
import { packetId, type UsagePacket } from "../domain/usage-sync";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
const now = Date.parse("2026-10-07T00:00:00.000Z");
async function fixture() {
  execFileSync(process.execPath, ["scripts/build-codex-reader.mjs"]);
  const root = await realpath(await mkdtemp("/tmp/pr-watch-")); roots.push(root); await chmod(root, 0o700);
  await writeFile(join(root, "rollout-one.jsonl"), `${JSON.stringify({ type: "session_meta", payload: { id: "fixture-thread" } })}\n`);
  const initial = createCompanionState(root);
  const scope = { sourceKey: initial.sourceKey, deviceDigest: deviceDigest(devicePublicKey(initial.privateKey)), context: "personal", accountIdentity: "unverified", provider: "codex",
    start: "2026-10-01T00:00:00.000Z", end: "2026-10-08T00:00:00.000Z", expiresAt: "2026-10-08T00:00:00.000Z", retainOnDisconnect: true,
    destination: "https://utmost-mongoose-374.convex.cloud" } as const;
  const packet: UsagePacket = { version: "proper-respect-codex-sync-v1", sourceKey: initial.sourceKey, sequence: 1, start: scope.start, end: scope.end, coverage: "partial", rows: [] };
  const path = join(root, "state.json");
  await saveCompanionState(path, { ...initial, grantId: "fixture-grant", scope, pending: [packet] });
  return { path, scope, packet, load: () => loadCompanionState(path), save: (state: CompanionState) => saveCompanionState(path, state) };
}

test("receiver outages retain the disk outbox and foreground recurrence recovers", async () => {
  const f = await fixture(), controller = new AbortController();
  let retries = 0, sequence = 0, sent = 0, paused = 0;
  await watchCompanion({ ...f, signal: controller.signal, now: () => now,
    transport: () => ({ status: async () => { if (retries < 2) throw new Error("receiver offline"); return { scope: f.scope, sequence }; },
      send: async packet => { sent++; sequence = packet.sequence; return { sequence, packetId: packetId(packet) }; } }),
    onPaused: () => { paused++; }, onSynced: () => controller.abort(),
    wait: async () => { if (!controller.signal.aborted) { expect(sent).toBe(0); expect((await f.load()).pending).toEqual([f.packet]); retries++; } },
  });
  expect(paused).toBe(2); expect(sent).toBeGreaterThan(0);
  expect((await f.load()).pending).toEqual([]);
});

test.each(["CODEX_ACCESS_UNAVAILABLE", "CODEX_DEVICE_PROOF_INVALID"])("explicit %s stops recurrence and preserves the outbox", async code => {
  const f = await fixture(); let paused = 0, sends = 0;
  await expect(watchCompanion({ ...f, signal: new AbortController().signal, now: () => now,
    transport: () => ({ status: async () => { throw new ConvexError({ code }); }, send: async packet => { sends++; return { sequence: packet.sequence, packetId: packetId(packet) }; } }),
    onPaused: () => { paused++; }, onSynced: () => { throw new Error("Unexpected sync"); }, wait: async () => { throw new Error("Unexpected retry"); },
  })).rejects.toBeInstanceOf(ConvexError);
  expect(sends).toBe(0); expect(paused).toBe(0); expect((await f.load()).pending).toEqual([f.packet]);
});

test("an offline retry stops at local grant expiry without sending queued history", async () => {
  const f = await fixture(); let clock = now, sends = 0;
  await expect(watchCompanion({ ...f, signal: new AbortController().signal, now: () => clock,
    transport: () => ({ status: async () => { throw new Error("offline"); }, send: async packet => { sends++; return { sequence: packet.sequence, packetId: packetId(packet) }; } }),
    onPaused: () => undefined, onSynced: () => undefined, wait: async () => { clock = Date.parse(f.scope.expiresAt); },
  })).rejects.toThrow("expired");
  expect(sends).toBe(0); expect((await f.load()).pending).toEqual([f.packet]);
});
