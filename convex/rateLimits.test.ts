// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const limits = [
  ["claimHandle", 10],
  ["addManualProduct", 60],
  ["beginUpload", 30],
  ["publishSelected", 20],
  ["connectGithub", 10],
] as const;
type Operation = typeof limits[number][0];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-29T12:30:00.000Z"));
  vi.stubEnv("CONVEX_SITE_URL", "https://synthetic.convex.site");
  vi.stubEnv("CONNECTOR_ENCRYPTION_KEY", "synthetic-rate-limit-test-only");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function fixture() {
  const fetcher = vi.fn(async () => Response.json({ data: { viewer: {
    login: "synthetic-account", createdAt: "2020-01-01T00:00:00Z",
    contributionsCollection: { contributionCalendar: { totalContributions: 0, weeks: [] } },
  } } }));
  vi.stubGlobal("fetch", fetcher);
  const t = convexTest(schema, modules);
  await t.run(async ctx => {
    for (const subject of ["owner", "other"]) await ctx.db.insert("users", {
      authSubject: subject, handle: subject, displayName: subject, bio: "",
    });
  });
  const owner = t.withIdentity({ subject: "owner" });
  const other = t.withIdentity({ subject: "other" });
  const call = async (operation: Operation, index: number, subject = "owner") => {
    const account = t.withIdentity({ subject });
    switch (operation) {
      case "claimHandle":
        return account.mutation(api.onboarding.claimHandle, { handle: subject, displayName: `${subject} ${index}`, bio: "" });
      case "addManualProduct":
        return account.mutation(api.onboarding.addManualProduct, { name: `Synthetic tool ${index}`, operationId: `add-${index}` });
      case "beginUpload":
        return account.mutation(api.onboarding.beginUpload, { filename: "synthetic.png", mimeType: "image/png", byteSize: 10 });
      case "publishSelected": {
        const preview = await account.query(api.onboarding.previewPublication, { selections: [] });
        return account.mutation(api.onboarding.publishSelected, {
          selections: [], expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash,
        });
      }
      case "connectGithub":
        return account.action(api.connectors.connectGithub, { token: "synthetic-token-never-sent" });
    }
  };
  const state = () => t.run(async ctx => ({
    users: await ctx.db.query("users").collect(),
    props: await ctx.db.query("props").collect(),
    intakes: await ctx.db.query("manualProductIntakes").collect(),
    uploads: await ctx.db.query("uploadTickets").collect(),
    publications: await ctx.db.query("publishedProfiles").collect(),
    connectors: await ctx.db.query("connectorAccounts").collect(),
    secrets: await ctx.db.query("connectorSecrets").collect(),
  }));
  return { t, owner, other, call, state, fetcher };
}

test.each(limits)("%s allows %i writes, rejects the next without side effects, and resets at the next hour", async (operation, limit) => {
  const f = await fixture();
  for (let index = 0; index < limit; index++) await f.call(operation, index);
  const before = await f.state();
  const callsBefore = f.fetcher.mock.calls.length;
  const denied = f.call(operation, limit);
  await expect(denied).rejects.toBeInstanceOf(ConvexError);
  await expect(denied).rejects.toMatchObject({ data: expect.stringMatching(/^Too many .+\. Try again in 30 minutes\.$/) });
  expect(await f.state()).toEqual(before);
  expect(f.fetcher).toHaveBeenCalledTimes(callsBefore);
  if (operation === "connectGithub") expect(callsBefore).toBe(limit);

  // A different owner has an independent allowance for the same operation.
  await f.call(operation, 0, "other");
  vi.setSystemTime(new Date("2026-09-29T12:59:59.999Z"));
  await expect(f.call(operation, limit)).rejects.toMatchObject({ data: expect.stringContaining("Try again in 1 minute.") });
  vi.setSystemTime(new Date("2026-09-29T13:00:00.000Z"));
  for (let index = limit; index < 2 * limit; index++) await f.call(operation, index);
  await expect(f.call(operation, 2 * limit)).rejects.toBeInstanceOf(ConvexError);
});

test("each operation has its own allowance and manual intake receipts still replay at the limit", async () => {
  const f = await fixture();
  for (const [operation, limit] of limits) {
    for (let index = 0; index < limit; index++) await f.call(operation, index);
    await expect(f.call(operation, limit)).rejects.toBeInstanceOf(ConvexError);
  }
  const before = await f.state();
  const replay = { name: "Synthetic tool 0", operationId: "add-0" };
  expect(await f.owner.mutation(api.onboarding.addManualProduct, replay)).toBe(before.intakes[0].propId);
  expect(await f.state()).toEqual(before);
});

test("failed provider calls consume the GitHub allowance before any further provider request", async () => {
  const f = await fixture();
  f.fetcher.mockImplementation(async () => new Response(null, { status: 503 }));
  for (let index = 0; index < 10; index++) {
    await expect(f.call("connectGithub", index)).rejects.toThrow("GitHub activity response unavailable.");
  }
  await expect(f.call("connectGithub", 10)).rejects.toBeInstanceOf(ConvexError);
  expect(f.fetcher).toHaveBeenCalledTimes(10);
});

test("authentication and account setup are required before a provider request", async () => {
  const f = await fixture();
  await expect(f.t.action(api.connectors.connectGithub, { token: "synthetic" })).rejects.toThrow("Authentication required.");
  await expect(f.call("connectGithub", 0, "missing-user")).rejects.toThrow("Complete account setup before continuing.");
  expect(f.fetcher).not.toHaveBeenCalled();
});

test("rejected writes roll back their allowance and a new session shares the owner's limit", async () => {
  const f = await fixture();
  for (let index = 0; index < 10; index++) {
    await expect(f.owner.mutation(api.onboarding.claimHandle, {
      handle: "other", displayName: "owner", bio: "",
    })).rejects.toThrow("That handle is already claimed.");
  }
  for (let index = 0; index < 10; index++) await f.call("claimHandle", index);
  const freshSession = f.t.withIdentity({ subject: "owner", tokenIdentifier: "fresh-session" });
  await expect(freshSession.mutation(api.onboarding.claimHandle, {
    handle: "owner", displayName: "owner", bio: "",
  })).rejects.toBeInstanceOf(ConvexError);
});
