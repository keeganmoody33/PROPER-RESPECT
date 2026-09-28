/// <reference types="vite/client" />
// R16: Gmail is open only to the testers listed in MAILBOX_GOOGLE_TEST_EMAILS.
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
const modules = import.meta.glob("./**/*.ts");
const refusal = "Gmail discovery is open only to invited testers right now.";

beforeEach(() => {
  vi.stubEnv("MAILBOX_GOOGLE_CLIENT_ID", "client");
  vi.stubEnv("MAILBOX_GOOGLE_CLIENT_SECRET", "client-secret");
  vi.stubEnv("MAILBOX_APPLICATION_ORIGIN", "https://props.example.test");
  vi.stubEnv("MAILBOX_ENCRYPTION_ACTIVE_VERSION", "v1");
  vi.stubEnv("MAILBOX_ENCRYPTION_KEYS", JSON.stringify({ v1: Buffer.alloc(32, 3).toString("base64") }));
});
afterEach(() => { vi.unstubAllEnvs(); });

async function setup() {
  const t = convexTest(schema, modules);
  await t.run(ctx => ctx.db.insert("users", { handle: "owner", authSubject: "owner", displayName: "Owner", bio: "" }));
  await t.run(ctx => ctx.db.insert("users", { handle: "stranger", authSubject: "stranger", displayName: "Stranger", bio: "" }));
  return {
    t,
    tester: t.withIdentity({ subject: "owner", email: "Owner@Example.com" }),
    stranger: t.withIdentity({ subject: "stranger", email: "stranger@example.com" }),
  };
}
const pendingStates = (t: Awaited<ReturnType<typeof setup>>["t"]) => t.run(ctx => ctx.db.query("mailboxOAuthStates").collect());

test("a listed tester can start a Gmail connection and sees the option", async () => {
  vi.stubEnv("MAILBOX_GOOGLE_TEST_EMAILS", "owner@example.com, tester@example.com");
  const { t, tester } = await setup();
  const result = await tester.action(api.mailboxGoogle.start, {});
  expect(new URL(result.url).hostname).toBe("accounts.google.com");
  expect(await pendingStates(t)).toHaveLength(1);
  expect((await tester.query(api.onboarding.getState, {}))?.mailboxAvailable).toBe(true);
});

test("someone not on the list is refused before any authorization starts", async () => {
  vi.stubEnv("MAILBOX_GOOGLE_TEST_EMAILS", "owner@example.com");
  const { t, stranger } = await setup();
  await expect(stranger.action(api.mailboxGoogle.start, {})).rejects.toThrow(refusal);
  expect(await pendingStates(t)).toEqual([]);
  expect((await stranger.query(api.onboarding.getState, {}))?.mailboxAvailable).toBe(false);
});

test("with the list unset or empty, nobody can start Gmail", async () => {
  const { t, tester } = await setup();
  await expect(tester.action(api.mailboxGoogle.start, {})).rejects.toThrow(refusal);
  expect((await tester.query(api.onboarding.getState, {}))?.mailboxAvailable).toBe(false);
  vi.stubEnv("MAILBOX_GOOGLE_TEST_EMAILS", "  ");
  await expect(tester.action(api.mailboxGoogle.start, {})).rejects.toThrow(refusal);
  expect((await tester.query(api.onboarding.getState, {}))?.mailboxAvailable).toBe(false);
  expect(await pendingStates(t)).toEqual([]);
});
