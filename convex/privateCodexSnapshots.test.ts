// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, test } from "vitest";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const keep = makeFunctionReference<"mutation">("privateCodexSnapshots:keep");
const read = makeFunctionReference<"query">("privateCodexSnapshots:read");
const start = "2026-10-01T00:00:00.000Z";
const end = "2026-10-08T00:00:00.000Z";
const exactTotal = "9007199254740993";
const row = {
  kind: "response" as const,
  thread: "a".repeat(64),
  response: "b".repeat(64),
  at: "2026-10-02T00:00:00.000Z",
  status: "measured" as const,
  counts: {
    input_tokens: exactTotal,
    cached_input_tokens: "0",
    output_tokens: "0",
    reasoning_output_tokens: "0",
    total_tokens: exactTotal,
    cache_write_input_tokens: null,
  },
};

test("a retained private Codex usage snapshot stays private and the owner can keep it", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("users", { authSubject: "owner", handle: "owner", displayName: "Owner", bio: "" });
    await ctx.db.insert("users", { authSubject: "other", handle: "other", displayName: "Other", bio: "" });
  });
  const owner = t.withIdentity({ subject: "owner" });
  const other = t.withIdentity({ subject: "other" });
  const args = {
    sourceKey: "c".repeat(64),
    context: "personal" as const,
    capturedAt: "2026-10-09T00:00:00.000Z",
    start,
    end,
    rows: [row],
  };
  const first = await owner.mutation(keep, args);
  expect(first).toMatchObject({ visibility: "private", replayed: false });
  expect(await owner.mutation(keep, args)).toEqual({ ...first, replayed: true });
  const saved = await owner.query(read, { snapshotId: first.snapshotId });
  expect(saved).toMatchObject({
    visibility: "private",
    format: "codex-history-window-v1",
    totalTokens: exactTotal,
    start,
    end,
  });
  await expect(other.query(read, { snapshotId: first.snapshotId })).rejects.toThrow(/unavailable/i);
  const published = await t.run(async (ctx) => ctx.db.query("publishedProfiles").collect());
  expect(published).toEqual([]);
  expect(JSON.stringify(published)).not.toContain(exactTotal);
});
