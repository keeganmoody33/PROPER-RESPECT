// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const profile = { handle: "owner", displayName: "Owner", bio: "", cards: [] };

test("an owner records display and distinction, and a signed-out visitor sees only the count and stored label", async () => {
  const t = convexTest(schema, modules);
  const accountId = await t.run(async ctx => {
    const ownerId = await ctx.db.insert("users", {
      handle: "owner", authSubject: "owner", displayName: "Owner", bio: "",
    });
    const evidenceSourceId = await ctx.db.insert("evidenceSources", {
      userId: ownerId, type: "GMAIL", connectedAt: "2026-01-01T00:00:00.000Z",
    });
    const id = await ctx.db.insert("mailboxAccounts", {
      ownerId, provider: "GOOGLE", providerAccountId: "google-1", evidenceSourceId,
      accountLabel: "ada@acme.example", scopes: [], status: "DISCONNECTED", generation: 2, cursor: null,
      connectedAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z",
    });
    await ctx.db.insert("rawEvidence", {
      evidenceSourceId, userId: ownerId, capturedAt: "2026-04-01T00:00:00.000Z", dedupKey: "kept",
      payload: "secret message from ada@acme.example",
    });
    await ctx.db.insert("rawEvidence", {
      evidenceSourceId, userId: ownerId, capturedAt: "2026-07-01T00:00:00.000Z", dedupKey: "late",
      payload: "after disconnect ada@secret.example",
    });
    await ctx.db.insert("publishedProfiles", {
      handle: "owner", revision: 1, publishedAt: "2026-06-02T00:00:00.000Z", profile,
    });
    return id;
  });
  const owner = t.withIdentity({ subject: "owner" });
  const choose = api.publicProfiles.setRetainedAggregateDisplay;
  const shown = api.publicProfiles.getRetainedMailboxAggregate;

  await owner.mutation(choose, { accountId, display: "public" });
  const unlabeled = await t.query(shown, { handle: "owner" });
  expect(unlabeled).toEqual([
    { accountId, recording: "stopped", label: "Retained source", retainedCount: 1 },
  ]);
  expect(JSON.stringify(unlabeled)).not.toContain("@");
  expect(JSON.stringify(unlabeled)).not.toContain("acme");

  await owner.mutation(choose, { accountId, display: "public", distinction: "former-employer" });
  const former = await t.query(shown, { handle: "owner" });
  expect(former).toEqual([
    { accountId, recording: "stopped", label: "Former employer", retainedCount: 1 },
  ]);
  expect(JSON.stringify(former)).not.toContain("ada@acme.example");
  expect(JSON.stringify(former)).not.toContain("secret");

  await owner.mutation(choose, { accountId, display: "public", distinction: "personal" });
  expect(await t.query(shown, { handle: "owner" })).toMatchObject([
    { label: "Personal", recording: "stopped", retainedCount: 1 },
  ]);
  expect(await owner.query(api.mailboxes.listAccounts, {})).toMatchObject([
    { retainedAggregateDisplay: "public", accountDistinction: "personal" },
  ]);

  await owner.mutation(choose, { accountId, display: "private", distinction: "personal" });
  expect(await t.query(shown, { handle: "owner" })).toEqual([]);
});
