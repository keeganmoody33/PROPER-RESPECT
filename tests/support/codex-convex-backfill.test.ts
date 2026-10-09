/// <reference types="vite/client" />
import { execFileSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { approveUsage, disconnectUsage, listUsage, usageEvidence, type ConnectionsAPI } from "../../src/client/usage-connection-api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { createCompanionState, loadCompanionState, saveCompanionState, syncCompanion } from "../../src/local/codex-companion";
import { deviceDigest, devicePublicKey } from "../../src/domain/device-proof";
import { signDeviceMessage } from "../../src/local/device-signature";
import { digest, packetId, privateUsageTotals, type GrantScope, type UsagePacket } from "../../src/domain/usage-sync";

const exchange = makeFunctionReference<"mutation", FunctionArgs<ConnectionsAPI["exchange"]>, FunctionReturnType<ConnectionsAPI["exchange"]>>("usageConnections:exchange");
const status = makeFunctionReference<"query", FunctionArgs<ConnectionsAPI["status"]>, FunctionReturnType<ConnectionsAPI["status"]>>("usageConnections:status");
const ingest = makeFunctionReference<"mutation", FunctionArgs<ConnectionsAPI["ingest"]>, FunctionReturnType<ConnectionsAPI["ingest"]>>("usageConnections:ingest");
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

test("multi-page multi-window native backfill, lost update ACK, disk restart and receiver revocation", async () => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-07T12:00:00.000Z"));
  vi.stubEnv("CONVEX_CLOUD_URL", "https://utmost-mongoose-374.convex.cloud");
  execFileSync(process.execPath, ["scripts/build-codex-reader.mjs"]);
  const root = await realpath(await mkdtemp("/tmp/pr-backfill-")); await chmod(root, 0o700);
  try {
    const directory = join(root, "history"), archive = join(directory, "archived_sessions");
    await mkdir(archive, { recursive: true });
    const rollout = (id: number, at: string, tokens = 1) => [
      JSON.stringify({ type: "session_meta", payload: { id: "synthetic-thread", cwd: "/PRIVATE_SOURCE_PATH", instructions: "PRIVATE_PROMPT" } }),
      JSON.stringify({ type: "response_item", payload: { code: "PRIVATE_CODE", credential: "PRIVATE_CREDENTIAL" } }),
      JSON.stringify({ type: "token_usage_record", timestamp: at, payload: { thread_id: "synthetic-thread", response_id: `response-${id}`,
        usage: { input_tokens: tokens, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: tokens } } }),
    ].join("\n") + "\n";
    await Promise.all(Array.from({ length: 65 }, (_, i) => writeFile(join(directory, `rollout-${i}.jsonl`), rollout(i, i < 33 ? "2026-09-22T00:00:00.000Z" : "2026-10-02T00:00:00.000Z"))));
    await writeFile(join(archive, "rollout-copy.jsonl"), rollout(0, "2026-09-22T00:00:00.000Z"));
    const path = join(root, "state.json"), initial = createCompanionState(directory);
    const scope: GrantScope = { sourceKey: initial.sourceKey, deviceDigest: deviceDigest(devicePublicKey(initial.privateKey)), context: "work", provider: "codex", accountIdentity: "unverified",
      start: "2026-09-21T00:00:00.000Z", end: "2026-10-14T00:00:00.000Z", expiresAt: "2026-10-14T00:00:00.000Z", retainOnDisconnect: true,
      destination: "https://utmost-mongoose-374.convex.cloud" };
    const t = convexTest(schema, import.meta.glob("../../convex/**/*.ts")), owner = t.withIdentity({ subject: "backfill-owner" });
    await t.run(ctx => ctx.db.insert("users", { authSubject: "backfill-owner", handle: "backfill-owner", displayName: "Synthetic backfill owner", bio: "" }));
    const code = "a".repeat(64), grantId = await owner.mutation(approveUsage, { scopeJson: JSON.stringify(scope), codeDigest: digest(code) });
    const paired = await t.mutation(exchange, { code, publicKeyJson: JSON.stringify(devicePublicKey(initial.privateKey)), ...signDeviceMessage(initial.privateKey, { operation: "pair", code }) });
    await saveCompanionState(path, { ...initial, grantId: paired.grantId, scope, sequence: paired.sequence });
    let loseAck = false;
    const outbound: UsagePacket[] = [];
    const transport = {
      status: () => t.query(status, { grantId, ...signDeviceMessage(initial.privateKey, { operation: "status", grantId }) }),
      send: async (packet: UsagePacket) => {
        outbound.push(packet);
        const ack = await t.mutation(ingest, { grantId, packetJson: JSON.stringify(packet), ...signDeviceMessage(initial.privateKey, { operation: "ingest", grantId, packetId: packetId(packet) }) });
        if (loseAck) { loseAck = false; throw new Error("lost update acknowledgment"); }
        return ack;
      },
    };
    const sync = async () => syncCompanion({ state: await loadCompanionState(path), save: state => saveCompanionState(path, state), transport, signal: new AbortController().signal });
    const read = async () => {
      const [grant] = await owner.query(listUsage, {});
      return (await owner.query(usageEvidence, { sourceId: grant.sourceId, cursor: null })).page;
    };
    await sync();
    expect((await read()).length).toBe(65);
    expect(privateUsageTotals(await read()).responses.find(row => row.metric === "total_tokens")?.value).toBe("65");
    expect(new Set(outbound.map(packet => packet.start)).size).toBe(3);
    const acceptedSequence = (await loadCompanionState(path)).sequence;
    await sync(); expect((await loadCompanionState(path)).sequence).toBe(acceptedSequence);
    await writeFile(join(directory, "rollout-new.jsonl"), rollout(65, "2026-10-07T01:00:00.000Z", 5));
    loseAck = true; await expect(sync()).rejects.toThrow("lost update acknowledgment");
    expect((await loadCompanionState(path)).pending.length).toBeGreaterThan(0);
    await sync();
    expect((await loadCompanionState(path)).pending).toEqual([]);
    expect((await read()).length).toBe(66);
    expect(privateUsageTotals(await read()).responses.find(row => row.metric === "total_tokens")?.value).toBe("70");
    await owner.mutation(disconnectUsage, { grantId });
    const sentBeforeRevocation = outbound.length;
    await expect(sync()).rejects.toThrow("Connection unavailable");
    expect(outbound.length).toBe(sentBeforeRevocation); expect((await read()).length).toBe(66);
    expect(JSON.stringify(outbound)).not.toMatch(/PRIVATE_|credential|instructions|prompt|response-\d|rollout-/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
