// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, test, vi } from "vitest";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const state = makeFunctionReference<"query">("onboarding:getState");

test("adding Wispr schedules separate official-source and brand checks without usage or recurring consent", async () => {
  vi.useFakeTimers();
  try {
    const t = convexTest(schema, modules);
    await t.run(ctx => ctx.db.insert("users", { handle: "owner", authSubject: "owner", displayName: "Owner", bio: "" }));
    const propId = await t.withIdentity({ subject: "owner" }).mutation(makeFunctionReference<"mutation">("onboarding:addManualProduct"), {
      name: "Wispr Flow", slug: "wisprflow", domain: "wisprflow.ai", description: "Dictation", url: "https://wisprflow.ai",
    });
    await t.run(async ctx => {
      expect(await ctx.db.get(propId)).toMatchObject({ visibility: "DRAFT", status: "TESTING" });
      const sources = await ctx.db.query("productSources").collect();
      expect(sources).toHaveLength(5);
      expect(sources.every(source => !source.enabled)).toBe(true);
      expect(await ctx.db.query("productWatches").collect()).toEqual([]);
      expect(await ctx.db.query("rawEvidence").collect()).toEqual([]);
      expect(await ctx.db.query("publishedProfiles").collect()).toEqual([]);
      const scheduled = await ctx.db.system.query("_scheduled_functions").collect();
      expect(scheduled).toHaveLength(6);
      expect(scheduled.filter(job => job.name === "productKnowledge:refreshSource")).toHaveLength(5);
      expect(scheduled.filter(job => job.name === "productBrands:refresh")).toHaveLength(1);
      for (const job of scheduled) await ctx.scheduler.cancel(job._id);
    });
  } finally {
    vi.useRealTimers();
  }
});

test("an older claim's current verdict survives unrelated review volume", async () => {
  const t = convexTest(schema, modules);
  await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { handle: "owner", authSubject: "owner", displayName: "Owner", bio: "" });
    const productId = await ctx.db.insert("products", { name: "Example", slug: "example", domain: "example.com", description: "" });
    const propId = await ctx.db.insert("props", { userId, productId, status: "TESTING", visibility: "DRAFT", headline: "", note: "" });
    const evidenceSourceId = await ctx.db.insert("evidenceSources", { userId, type: "MANUAL", connectedAt: "2026-09-16T00:00:00.000Z" });
    const observation = { kind: "SIGNUP" as const, date: "2026-01-01", excerpt: "Example account opened.", scope: "PERSONAL" as const, acquisition: "USER_SUPPLIED" as const };
    const rawEvidenceId = await ctx.db.insert("rawEvidence", { userId, evidenceSourceId, payload: observation.excerpt, observations: [observation, observation], capturedAt: "2026-09-16T00:00:00.000Z", dedupKey: "fixture" });
    await ctx.db.insert("proofs", { propId, rawEvidenceId, type: "NOTE" });
    await ctx.db.insert("claimReviews", { userId, propId, rawEvidenceId, observationIndex: 0, verdict: "CORRECT", reviewedAt: "2026-09-15T00:00:00.000Z" });
    for (let i = 0; i < 1001; i++) {
      await ctx.db.insert("claimReviews", { userId, propId, rawEvidenceId, observationIndex: 1, verdict: "UNKNOWN", reviewedAt: "2026-09-16T00:00:00.000Z" });
    }
  });
  const result = await t.withIdentity({ subject: "owner" }).query(state, {});
  expect(result.cards[0].claims[0].review?.verdict).toBe("CORRECT");
  const withoutClaims = await t.withIdentity({ subject: "owner" }).query(state, { includeClaims: false });
  expect(withoutClaims).toEqual({ ...result, cards: result.cards.map((card: Record<string, unknown>) => ({ ...card, claims: [] })) });
});
