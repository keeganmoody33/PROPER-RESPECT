// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

test("owner bootstrap retries reuse the committed owner after a lost response", async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "test-owner", name: "Test owner" });
  const first = await owner.mutation(api.onboarding.ensureAccount, {});
  const before = await t.run(ctx => ctx.db.get(first));
  const retry = await owner.mutation(api.onboarding.ensureAccount, { displayName: "Retry" });
  expect(retry).toBe(first);
  expect(await t.run(ctx => ctx.db.get(first))).toEqual(before);
  expect(await t.run(ctx => ctx.db.query("users").collect())).toHaveLength(1);
  expect((await owner.query(api.onboarding.getState, {}))?.user._id).toBe(first);
  expect(await owner.query(api.mailboxes.listAccounts, {})).toEqual([]);
});

test("a denied bootstrap leaves no owner and a later authenticated retry succeeds", async () => {
  const t = convexTest(schema, modules);
  await expect(t.mutation(api.onboarding.ensureAccount, {})).rejects.toThrow("Authentication required.");
  await expect(t.query(api.onboarding.getState, {})).rejects.toThrow("Authentication required.");
  expect(await t.run(ctx => ctx.db.query("users").collect())).toHaveLength(0);
  const owner = t.withIdentity({ subject: "test-owner" });
  const id = await owner.mutation(api.onboarding.ensureAccount, {});
  expect(await owner.mutation(api.onboarding.ensureAccount, {})).toBe(id);
  expect(await t.run(ctx => ctx.db.query("users").collect())).toHaveLength(1);
});

test("matching email labels cannot merge distinct authenticated owners", async () => {
  const t = convexTest(schema, modules);
  const a = t.withIdentity({ subject: "owner-a", email: "shared@example.test" });
  const b = t.withIdentity({ subject: "owner-b", email: "shared@example.test" });
  const aId = await a.mutation(api.onboarding.ensureAccount, {});
  const bId = await b.mutation(api.onboarding.ensureAccount, {});
  expect(aId).not.toBe(bId);
  expect((await a.query(api.onboarding.getState, {}))?.user._id).toBe(aId);
  expect((await b.query(api.onboarding.getState, {}))?.user._id).toBe(bId);
});
