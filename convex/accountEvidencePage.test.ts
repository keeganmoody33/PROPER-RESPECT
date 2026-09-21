// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { getState } from "./onboarding";
import { list, accountEvidencePage } from "./inventory";
import type { QueryCtx } from "./_generated/server";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { compareAccountEvidence } from "../src/domain/account-evidence";

const modules = import.meta.glob("./**/*.ts");
async function fixture(count = 205) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { authSubject: "owner", handle: "owner", displayName: "Owner", bio: "" });
    const otherId = await ctx.db.insert("users", { authSubject: "other", handle: "other", displayName: "Other", bio: "" });
    const productId = await ctx.db.insert("products", { slug: "github", name: "GitHub", domain: "github.com", description: "Code" });
    const propId = await ctx.db.insert("props", { userId, productId, visibility: "PRIVATE", status: "ACTIVE", headline: "Saved", note: "Private" });
    const sourceId = await ctx.db.insert("evidenceSources", { userId, type: "GITHUB", connectedAt: "2026-09-21" });
    const rawIds = [];
    for (let i = 0; i < count; i++) {
      const rawId = await ctx.db.insert("rawEvidence", {
        userId, evidenceSourceId: sourceId, dedupKey: `capture-${i}`, payload: "x".repeat(100 * 1024),
        capturedAt: i === 0 ? "2026-09-21T00:00:00Z" : "2020-01-01T00:00:00Z",
        captureProvenance: { version: 1, route: "DIRECT_API", adapter: { id: "synthetic", version: "1" }, origin: { issuer: "GITHUB", accountId: i === 0 ? "newest" : "historical" }, collector: { kind: "SYSTEM" }, activityActor: { kind: "UNKNOWN" } },
      });
      rawIds.push(rawId);
      await ctx.db.insert("proofs", { propId, rawEvidenceId: rawId, type: "API_OAUTH" });
    }
    return { userId, otherId, propId, rawIds };
  });
  return { t, owner: t.withIdentity({ subject: "owner" }), other: t.withIdentity({ subject: "other" }), ...ids };
}

test("bounded retained pages find the newest original beyond 200 attachments without returning payload", async () => {
  const { owner, propId } = await fixture();
  let cursor: string | null = null;
  const candidates = [];
  let count = 0;
  for (;;) {
    const result: FunctionReturnType<typeof api.inventory.accountEvidencePage> = await owner.query(api.inventory.accountEvidencePage, { propId, paginationOpts: { numItems: 1000, cursor } });
    expect(result.page.length).toBeLessThanOrEqual(3);
    expect(JSON.stringify(result)).not.toContain("xxxxxxxxxx");
    count += result.page.length;
    for (const row of result.page) if (row.candidate) candidates.push(row.candidate);
    if (result.isDone) break;
    cursor = result.continueCursor;
  }
  expect(count).toBe(205);
  expect(candidates.sort(compareAccountEvidence)[0].evidence.accountId).toBe("newest");
});

test("current connector wins; revocation, deletion and foreign originals are re-evaluated", async () => {
  const { t, owner, other, userId, otherId, propId, rawIds } = await fixture(2);
  const connectorId = await t.run(ctx => ctx.db.insert("connectorAccounts", { userId, provider: "GITHUB", status: "CONNECTED", accountLabel: "github.com/current", attributionScope: "PERSONAL", connectedAt: "2026-09-21" }));
  const args = { propId, paginationOpts: { numItems: 3, cursor: null } };
  await expect(other.query(api.inventory.accountEvidencePage, args)).rejects.toThrow("unavailable");
  const connected = await owner.query(api.inventory.accountEvidencePage, args);
  expect(connected.isDone).toBe(true);
  expect(connected.page[0].candidate?.evidence.accountId).toBe("current");
  await owner.mutation(api.connectors.revokeConnector, { connectorId });
  await owner.mutation(api.onboarding.deleteEvidence, { evidenceId: rawIds[0] });
  await t.run(ctx => ctx.db.patch(rawIds[1], { userId: otherId }));
  const rejected = await owner.query(api.inventory.accountEvidencePage, args);
  expect(rejected.page.map(row => row.candidate)).toEqual([null, null]);
  await t.run(ctx => ctx.db.patch(rawIds[1], { userId }));
  const restored = await owner.query(api.inventory.accountEvidencePage, args);
  expect(restored.page[0].candidate?.evidence.accountId).toBe("historical");
});


test("current collection paths never join raw evidence; an account page joins at most three originals", async () => {
  const { t, owner, propId, userId, rawIds } = await fixture(205);
  await t.run(async ctx => {
    const original = (await ctx.db.get(propId))!;
    for (let i = 1; i < 25; i++) {
      const extra = await ctx.db.insert("props", { userId, productId: original.productId, visibility: "PRIVATE", status: "ACTIVE", headline: "Saved", note: "" });
      for (const rawEvidenceId of rawIds.slice(0, 3)) await ctx.db.insert("proofs", { propId: extra, rawEvidenceId, type: "API_OAUTH" });
    }
  });
  const tables = new Set<string>();
  let rawReads = 0;
  for (const stage of ["state", "list", "account"]) await owner.run(async ctx => {
    const db = new Proxy(ctx.db, {
      get(target, key, receiver) {
        const value = Reflect.get(target, key, receiver);
        if (key === "query") return (table: string) => { tables.add(table); return value.call(target, table); };
        if (key === "get") return async (id: string) => {
          const doc = await value.call(target, id);
          if (doc?.dedupKey?.startsWith("capture-")) rawReads++;
          return doc;
        };
        return value;
      },
    });
    const measured = { ...ctx, db };
    if (stage === "state") {
    const stateHandler = getState as unknown as { _handler: (ctx: QueryCtx, args: FunctionArgs<typeof api.onboarding.getState>) => Promise<FunctionReturnType<typeof api.onboarding.getState>> };
    const state = await stateHandler._handler(measured, { includeClaims: false, includeLegacyCollections: false, includeAccountEvidence: false });
    expect(state?.cards[0].prop.headline).toBe("Saved");
    expect(state?.cards).toHaveLength(25);
    expect(tables.has("rawEvidence")).toBe(false);
    expect(tables.has("draftImports")).toBe(false);
    expect(rawReads).toBe(0);
    } else if (stage === "list") {
    const listHandler = list as unknown as { _handler: (ctx: QueryCtx, args: FunctionArgs<typeof api.inventory.list>) => Promise<FunctionReturnType<typeof api.inventory.list>> };
    const page = await listHandler._handler(measured, { paginationOpts: { numItems: 25, cursor: null }, includeAccountEvidence: false });
    expect(page.page[0].prop.headline).toBe("Saved");
    expect(page.page).toHaveLength(25);
    expect(rawReads).toBe(0);
    } else {
    const accountHandler = accountEvidencePage as unknown as { _handler: (ctx: QueryCtx, args: FunctionArgs<typeof api.inventory.accountEvidencePage>) => Promise<FunctionReturnType<typeof api.inventory.accountEvidencePage>> };
    const lookup = await accountHandler._handler(measured, { propId, paginationOpts: { numItems: 1000, cursor: null } });
    expect(lookup.page).toHaveLength(3);
    expect(rawReads).toBe(3);
    expect(lookup.page[0].candidate?.evidence.accountId).toBe("historical");
    }
  });
});

test("invalid connected account falls back; wrong source owner, type and issuer are excluded", async () => {
  const { t, owner, propId, userId, otherId, rawIds } = await fixture(1);
  await t.run(ctx => ctx.db.insert("connectorAccounts", { userId, provider: "GITHUB", status: "CONNECTED", accountLabel: "github.com/features", attributionScope: "PERSONAL", connectedAt: "2026-09-21" }));
  const args = { propId, paginationOpts: { numItems: 3, cursor: null } };
  const fallback = await owner.query(api.inventory.accountEvidencePage, args);
  expect(fallback.page[0].connected).toBe(false);
  expect(fallback.page[0].candidate?.evidence.accountId).toBe("newest");
  const raw = await t.run(ctx => ctx.db.get(rawIds[0]));
  for (const patch of [{ userId: otherId }, { userId, type: "MANUAL" as const }]) {
    await t.run(ctx => ctx.db.patch(raw!.evidenceSourceId, patch));
    expect((await owner.query(api.inventory.accountEvidencePage, args)).page[0].candidate).toBeNull();
  }
  await t.run(async ctx => {
    await ctx.db.patch(raw!.evidenceSourceId, { userId, type: "GITHUB" });
    await ctx.db.patch(rawIds[0], { captureProvenance: { ...raw!.captureProvenance!, origin: { issuer: "MANUAL", accountId: "forged" } } });
  });
  expect((await owner.query(api.inventory.accountEvidencePage, args)).page[0].candidate).toBeNull();
  await expect(owner.query(api.inventory.accountEvidencePage, { propId, paginationOpts: { numItems: 0, cursor: null } })).rejects.toThrow("Invalid page size");
});
