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

test.each([
  ["a supplied name", { displayName: "N".repeat(200) }, {}],
  ["the identity's name", {}, { name: "N".repeat(200) }],
] as const)("account setup stores at most 80 characters of %s", async (_label, args, identity) => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "long-name-owner", ...identity });
  const id = await owner.mutation(api.onboarding.ensureAccount, args);
  expect((await t.run(ctx => ctx.db.get(id)))?.displayName).toBe("N".repeat(80));
});

test("account setup trims the name and skips a blank one", async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "blank-name-owner", name: "  Identity name  " });
  const id = await owner.mutation(api.onboarding.ensureAccount, { displayName: "   " });
  expect((await t.run(ctx => ctx.db.get(id)))?.displayName).toBe("Identity name");
});

test("account setup never cuts a character in half", async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "emoji-owner" });
  const id = await owner.mutation(api.onboarding.ensureAccount, { displayName: `${"N".repeat(79)}🙂🙂` });
  expect((await t.run(ctx => ctx.db.get(id)))?.displayName).toBe("N".repeat(79));
});

test.each([[2048, true], [2049, false]] as const)("account setup keeps a %i-character avatar link: %s", async (length, kept) => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: `avatar-owner-${length}` });
  const avatarUrl = `https://img.example/${"a".repeat(length - "https://img.example/".length)}`;
  expect(avatarUrl).toHaveLength(length);
  const id = await owner.mutation(api.onboarding.ensureAccount, { avatarUrl });
  expect((await t.run(ctx => ctx.db.get(id)))?.avatarUrl).toBe(kept ? avatarUrl : undefined);
});
