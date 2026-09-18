// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { makeFunctionReference } from "convex/server";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const link = makeFunctionReference<"mutation">("accountRecovery:linkSeededOwner");
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const targetId = await ctx.db.insert("users", { handle: "keegan", seedKey: "keegan", displayName: "Keegan", bio: "Original" });
    const pendingId = await ctx.db.insert("users", { handle: "pending-test", authSubject: "subject", displayName: "33", bio: "", onboardingStatus: "PROFILE" });
    return { targetId, pendingId };
  });
  return { t, args: { ...ids, expectedSubject: "subject", expectedSeedKey: "keegan", dryRun: false } };
}
test("dry run preserves records; transfer is atomic and repeatable", async () => {
  const { t, args } = await fixture();
  const before = await t.run(ctx => ctx.db.get(args.targetId));
  expect(await t.mutation(link, { ...args, dryRun: true })).toEqual({ status: "ready" });
  expect(await t.run(ctx => ctx.db.get(args.targetId))).toEqual(before);
  expect(await t.mutation(link, args)).toEqual({ status: "linked" });
  expect(await t.run(ctx => ctx.db.get(args.targetId))).toEqual({ ...before, authSubject: "subject" });
  expect((await t.run(ctx => ctx.db.get(args.pendingId)))?.authSubject).toBeUndefined();
  expect(await t.mutation(link, args)).toEqual({ status: "already-linked" });
});
test("rejects wrong identity and already owned target without writes", async () => {
  const { t, args } = await fixture();
  await expect(t.mutation(link, { ...args, expectedSubject: "wrong" })).rejects.toThrow();
  await t.run(ctx => ctx.db.patch(args.targetId, { authSubject: "other-owner" }));
  await expect(t.mutation(link, args)).rejects.toThrow();
  expect((await t.run(ctx => ctx.db.get(args.pendingId)))?.authSubject).toBe("subject");
});
test("refuses to strand pending account evidence", async () => {
  const { t, args } = await fixture();
  await t.run(ctx => ctx.db.insert("sites", { ownerId: args.pendingId, handle: "pending-test", status: "DRAFT" }));
  await expect(t.mutation(link, args)).rejects.toThrow("already owns a site");
  expect((await t.run(ctx => ctx.db.get(args.targetId)))?.authSubject).toBeUndefined();
});
