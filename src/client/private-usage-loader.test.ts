import { expect, it, vi } from "vitest";
import type { FunctionReturnType } from "convex/server";
import type { ConnectionsAPI } from "./usage-connection-api";
import type { Id } from "../../convex/_generated/dataModel";
import { createPrivateUsageLoader } from "./private-usage-loader";
import type { NumericEvidence } from "../domain/usage-sync";

const sourceId = "source" as Id<"usageSources">;
const row = (response: string, count = "10"): NumericEvidence => ({ kind: "response", thread: "a".repeat(64), response: response.repeat(64),
  at: "2026-10-07T00:00:00.000Z", status: "measured", counts: { input_tokens: count, cached_input_tokens: "0", output_tokens: "0", total_tokens: count, reasoning_output_tokens: "0", cache_write_input_tokens: "0" } });
function fixture() {
  const grant: FunctionReturnType<ConnectionsAPI["list"]>[number] = { ownerSubject: "owner", sourceId, grantId: "grant" as Id<"usageGrants">,
    sequence: 1, state: "active", pairExpiresAt: 0, lastSyncedAt: null,
    scope: { sourceKey: "1".repeat(64), deviceDigest: "2".repeat(64), context: "unclassified", accountIdentity: "unverified", provider: "codex",
      start: "2026-10-01T00:00:00.000Z", end: "2026-10-15T00:00:00.000Z", expiresAt: "2026-10-15T00:00:00.000Z", retainOnDisconnect: true, destination: "https://utmost-mongoose-374.convex.cloud" } };
  const list = vi.fn(async () => [structuredClone(grant)]);
  const evidence = vi.fn(async ({ cursor }: { cursor: string | null }) => ({ page: [row(cursor ? "c" : "b")], isDone: cursor !== null, continueCursor: cursor ? "" : "next" }));
  return { grant, list, evidence, load: createPrivateUsageLoader({ ownerSubject: "owner", list, evidence }) };
}
it("reuses private totals without downloading pages again at the same checkpoint", async () => {
  const f = fixture();
  const first = await f.load(sourceId);
  expect(first.responses.find(row => row.metric === "total_tokens")?.value).toBe("20");
  expect(await f.load(sourceId)).toEqual(first);
  expect(f.evidence).toHaveBeenCalledTimes(2);
  expect(f.list.mock.calls.length).toBeGreaterThanOrEqual(2);
});

it("reads a new checkpoint and keeps conflicting counts quarantined", async () => {
  const f = fixture(); await f.load(sourceId);
  f.grant.sequence++;
  f.evidence.mockImplementation(async ({ cursor }) => ({ page: [row("b", cursor ? "12" : "10")], isDone: cursor !== null, continueCursor: cursor ? "" : "next" }));
  const totals = await f.load(sourceId);
  expect(f.evidence).toHaveBeenCalledTimes(4);
  expect(totals.responses.find(row => row.metric === "total_tokens")).toMatchObject({ value: null, conflict: true });
});

it("never falls back to cached totals after an authorization failure", async () => {
  const f = fixture(); await f.load(sourceId);
  f.list.mockRejectedValueOnce(new Error("Signed out"));
  await expect(f.load(sourceId)).rejects.toThrow("Signed out");
  await f.load(sourceId);
  expect(f.evidence).toHaveBeenCalledTimes(4);
});

it("rejects another owner and an unavailable source before reading any pages", async () => {
  const f = fixture(); await f.load(sourceId);
  f.grant.ownerSubject = "other";
  await expect(f.load(sourceId)).rejects.toThrow("Private source unavailable");
  await expect(f.load("different-source" as Id<"usageSources">)).rejects.toThrow("Private source unavailable");
  expect(f.evidence).toHaveBeenCalledTimes(2);
});

it("does not reuse a revoked source while its retained history is being erased", async () => {
  const f = fixture(); await f.load(sourceId);
  f.grant.state = "revoked";
  await f.load(sourceId);
  f.evidence.mockResolvedValue({ page: [], isDone: true, continueCursor: "" });
  const erased = await f.load(sourceId);
  expect(erased.evidenceVariants).toBe(0);
  expect(erased.responses.find(row => row.metric === "total_tokens")?.value).toBeNull();
  expect(f.evidence).toHaveBeenCalledTimes(5);
});

it("can reuse expired retained history but refreshes after re-pairing", async () => {
  const f = fixture(); f.grant.state = "expired";
  await f.load(sourceId); await f.load(sourceId);
  expect(f.evidence).toHaveBeenCalledTimes(2);
  f.grant.grantId = "new-grant" as Id<"usageGrants">;
  f.grant.state = "active";
  await f.load(sourceId);
  expect(f.evidence).toHaveBeenCalledTimes(4);
});

it("rejects a changing checkpoint during pagination and does not cache partial work", async () => {
  const f = fixture();
  const original = f.evidence.getMockImplementation()!;
  f.evidence.mockImplementationOnce(async args => { f.grant.sequence++; return original(args); });
  await expect(f.load(sourceId)).rejects.toThrow("changed while loading");
  await f.load(sourceId);
  expect(f.evidence).toHaveBeenCalledTimes(4);
});

it("a failed page never produces or caches a partial total", async () => {
  const f = fixture();
  f.evidence.mockImplementationOnce(async () => ({ page: [row("b")], isDone: false, continueCursor: "next" })).mockRejectedValueOnce(new Error("Unavailable"));
  await expect(f.load(sourceId)).rejects.toThrow("Unavailable");
  const recovered = await f.load(sourceId);
  expect(recovered.responses.find(row => row.metric === "total_tokens")?.value).toBe("20");
  expect(f.evidence).toHaveBeenCalledTimes(4);
});

it("stops a repeated pagination cursor instead of fetching forever", async () => {
  const f = fixture(); f.evidence.mockResolvedValue({ page: [row("b")], isDone: false, continueCursor: "same" });
  await expect(f.load(sourceId)).rejects.toThrow("pagination stopped");
  expect(f.evidence).toHaveBeenCalledTimes(2);
});

it("returned totals cannot mutate the private cache", async () => {
  const f = fixture(); const result = await f.load(sourceId);
  result.responses[0].value = "999";
  expect((await f.load(sourceId)).responses[0].value).toBe("20");
});
