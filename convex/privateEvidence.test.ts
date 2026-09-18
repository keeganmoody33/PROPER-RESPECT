// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, test } from "vitest";
import schema from "./schema";
import { claimVerdicts } from "../src/domain/evidence-claims";
import { privateEvidenceIdentity } from "../src/domain/private-evidence";
const modules = import.meta.glob("./**/*.ts");
const submit = makeFunctionReference<"mutation">("privateEvidence:submit");
const list = makeFunctionReference<"query">("privateEvidence:listForProp");
const history = makeFunctionReference<"query">("privateEvidence:history");
const review = makeFunctionReference<"mutation">("onboarding:reviewClaim");
const usage = { kind: "USAGE", metric: "Words dictated", value: 12345, unit: "words", excerpt: "Words dictated: 12,345", scope: "UNKNOWN", acquisition: "USER_SUPPLIED" } as const;
const paginationOpts = { numItems: 20, cursor: null };
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { handle: "owner", authSubject: "owner", displayName: "Owner", bio: "" });
    await ctx.db.insert("users", { handle: "other", authSubject: "other", displayName: "Other", bio: "" });
    const productId = await ctx.db.insert("products", { name: "Wispr Flow", slug: "wispr-flow", domain: "wisprflow.ai", description: "Dictation" });
    const propId = await ctx.db.insert("props", { userId, productId, visibility: "PUBLIC", status: "ACTIVE", headline: "My tool", note: "", startedAt: "2025-01-01", costVisibility: "PRIVATE", cost: { amount: 10, currency: "USD", cadence: "MONTHLY", basis: "RECEIPT", asOf: "2026-09-16" } });
    const otherPropId = await ctx.db.insert("props", { userId, productId, visibility: "DRAFT", status: "TESTING", headline: "Second", note: "" });
    await ctx.db.insert("draftImports", { userId, resultPropId: propId, status: "APPROVED", suggestedProductSlug: "wispr-flow", suggestedProductName: "Wispr Flow", suggestedDomain: "wisprflow.ai", suggestedDescription: "Dictation", suggestedUrl: "https://wisprflow.ai", rawEvidenceIds: [] });
    await ctx.db.insert("publishedProfiles", { handle: "owner", revision: 1, publishedAt: "2026-09-16", profile: { handle: "owner", displayName: "Owner", bio: "", cards: [] } });
    return { userId, propId, otherPropId };
  });
  return { t, owner: t.withIdentity({ subject: "owner" }), other: t.withIdentity({ subject: "other" }), ...ids };
}
test("later owner text on an approved public card is private, idempotent and retains unknown dates", async () => {
  const { t, owner, propId } = await fixture();
  const before = await t.run(async ctx => ({ prop: await ctx.db.get(propId), profiles: await ctx.db.query("publishedProfiles").collect() }));
  const input = { propId, payload: usage.excerpt, sourceUrl: "https://docs.wisprflow.ai", observations: [usage] };
  const first = await owner.mutation(submit, input);
  expect(await owner.mutation(submit, input)).toEqual({ ...first, duplicate: true });
  const rows = await owner.query(list, { propId, paginationOpts });
  expect(rows.page[0].raw.payload).toBe(usage.excerpt);
  expect(rows.page[0].raw.observations).toEqual([usage]);
  expect(rows.page[0].source.provider).toBe("OWNER_SELECTED_TEXT");
  expect(rows.page[0].raw.capturedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
  const after = await t.run(async ctx => ({ prop: await ctx.db.get(propId), profiles: await ctx.db.query("publishedProfiles").collect(), signals: await ctx.db.query("usageSignals").collect(), evidence: await ctx.db.query("rawEvidence").collect() }));
  expect(after.prop).toEqual(before.prop);
  expect(after.profiles).toEqual(before.profiles);
  expect(after.signals).toEqual([]);
  expect(after.evidence).toHaveLength(1);
});
test("anonymous, wrong owner and wrong card cannot read or review originals", async () => {
  const { t, owner, other, propId, otherPropId } = await fixture();
  const input = { propId, payload: usage.excerpt, observations: [usage] };
  await expect(t.mutation(submit, input)).rejects.toThrow();
  await expect(other.mutation(submit, input)).rejects.toThrow("Evidence unavailable");
  const { rawEvidenceId } = await owner.mutation(submit, input);
  await expect(t.query(list, { propId, paginationOpts })).rejects.toThrow();
  await expect(other.query(list, { propId, paginationOpts })).rejects.toThrow("Evidence unavailable");
  const claim = { propId, rawEvidenceId, observationIndex: 0 };
  await expect(other.query(history, { ...claim, paginationOpts })).rejects.toThrow();
  await expect(owner.query(history, { ...claim, propId: otherPropId, paginationOpts })).rejects.toThrow();
  await expect(owner.mutation(review, { ...claim, propId: otherPropId, verdict: "CORRECT" })).rejects.toThrow();
});
test("all verdicts append, paginate and preserve the original", async () => {
  const { owner, propId } = await fixture();
  const { rawEvidenceId } = await owner.mutation(submit, { propId, payload: usage.excerpt, observations: [usage] });
  const claim = { propId, rawEvidenceId, observationIndex: 0 };
  for (const verdict of claimVerdicts) await owner.mutation(review, { ...claim, verdict, correction: `Owner says ${verdict}` });
  const first = await owner.query(history, { ...claim, paginationOpts: { numItems: 2, cursor: null } });
  const second = await owner.query(history, { ...claim, paginationOpts: { numItems: 2, cursor: first.continueCursor } });
  expect([...first.page, ...second.page].map(row => row.verdict)).toEqual([...claimVerdicts].reverse());
  const rows = await owner.query(list, { propId, paginationOpts });
  expect(rows.page[0].claims[0].review.verdict).toBe("UNKNOWN");
  expect(rows.page[0].raw.observations).toEqual([usage]);
});
test("bad inputs and hash collisions fail without replacing originals", async () => {
  const { t, owner, userId, propId } = await fixture();
  const input = { propId, payload: usage.excerpt, observations: [usage] };
  for (const patch of [{ value: NaN }, { value: -1 }, { date: "2026-02-30" }, { periodStart: "2026-09-16", periodEnd: "2026-09-15" }, { excerpt: "fabricated" }, { acquisition: "SOURCE_REPORTED" }, { unsupported: true }]) await expect(owner.mutation(submit, { ...input, observations: [{ ...usage, ...patch }] })).rejects.toThrow();
  await expect(owner.mutation(submit, { ...input, sourceUrl: "https://me:password@example.com" })).rejects.toThrow();
  const contentHash = privateEvidenceIdentity({ payload: usage.excerpt, observations: [usage] });
  await t.run(async ctx => {
    const evidenceSourceId = await ctx.db.insert("evidenceSources", { userId, type: "MANUAL", connectedAt: "2026-09-16" });
    await ctx.db.insert("rawEvidence", { userId, evidenceSourceId, payload: "Different original", capturedAt: "2026-09-16", contentHash, dedupKey: `owner-evidence:${userId}:${propId}:${contentHash}` });
  });
  await expect(owner.mutation(submit, input)).rejects.toThrow("collision");
  expect((await t.run(ctx => ctx.db.query("rawEvidence").collect()))[0].payload).toBe("Different original");
});

test.each(["manual-first", "private-first"] as const)("manual imports preserve their source identity with private intake (%s)", async order => {
  const { t, owner, propId } = await fixture();
  const ingest = makeFunctionReference<"mutation">("discovery:ingestSignals");
  const manualInput = (payload: string, capturedAt: string) => ({
    handle: "owner", sourceType: "MANUAL", sourceLabel: "Selected manual import",
    signals: [{ sourceType: "MANUAL", vendor: "Wispr Flow", payload, capturedAt }],
  });
  const firstPayload = "Manual import original one";
  const secondPayload = "Manual import original two";
  const addPrivate = () => owner.mutation(submit, { propId, payload: usage.excerpt, observations: [usage] });
  let privateResult;
  if (order === "private-first") privateResult = await addPrivate();
  await t.mutation(ingest, manualInput(firstPayload, "2026-09-16T01:00:00.000Z"));
  if (order === "manual-first") privateResult = await addPrivate();
  await t.mutation(ingest, manualInput(secondPayload, "2026-09-16T02:00:00.000Z"));
  const state = await t.run(async ctx => ({ sources: await ctx.db.query("evidenceSources").collect(), raws: await ctx.db.query("rawEvidence").collect() }));
  const privateRaw = state.raws.find(raw => raw._id === privateResult!.rawEvidenceId)!;
  const privateSource = state.sources.find(source => source._id === privateRaw.evidenceSourceId)!;
  const firstRaw = state.raws.find(raw => raw.payload === firstPayload)!;
  const secondRaw = state.raws.find(raw => raw.payload === secondPayload)!;
  expect(state.sources).toHaveLength(2);
  expect(state.raws).toHaveLength(3);
  expect(privateSource.provider).toBe("OWNER_SELECTED_TEXT");
  expect(privateRaw.payload).toBe(usage.excerpt);
  expect(privateRaw.observations).toEqual([usage]);
  expect(firstRaw.evidenceSourceId).toBe(secondRaw.evidenceSourceId);
  expect(firstRaw.evidenceSourceId).not.toBe(privateRaw.evidenceSourceId);
  expect(state.sources.find(source => source._id === firstRaw.evidenceSourceId)).toMatchObject({ type: "MANUAL", label: "Selected manual import" });
  expect(state.sources.find(source => source._id === firstRaw.evidenceSourceId)?.provider).toBeUndefined();
});
