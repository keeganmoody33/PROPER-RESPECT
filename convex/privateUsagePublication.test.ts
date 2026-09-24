// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import type { FunctionArgs } from "convex/server";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { publicProfileSchema } from "../src/domain/public-profile";
import { projectVisiblePublicProfile } from "../src/domain/visible-public-profile";
import { privateUsageCardSchema, projectPrivateUsage } from "../src/domain/private-usage-card";
import { buildUsageCostReport } from "../src/domain/usage-cost-report";
import usageFixture from "../tests/fixtures/usage-cost/priced-synthetic.json";
import nativeFixture from "../tests/fixtures/claude-native/private-card-synthetic.json";

const modules = import.meta.glob("./**/*.ts");
const capturedAt = "2026-09-24T00:00:00.000Z";
const exactCount = "900719925474099312345678901234";
const syntheticCapture = structuredClone(usageFixture);
syntheticCapture.bundles[0].counts.input = exactCount;
syntheticCapture.bundles[0].sourceCostUsd = "0.000000000001";
const privateUsage = privateUsageCardSchema.parse(
  projectPrivateUsage(buildUsageCostReport([JSON.stringify(syntheticCapture)])).tools[0],
);
const nativeUsage = projectPrivateUsage(buildUsageCostReport([JSON.stringify(nativeFixture)])).tools[0];
const activity = {
  kind: "headlineMetrics" as const, attributionScope: "PERSONAL" as const,
  capturedAt, freshness: "FRESH" as const, provenanceLabel: "Synthetic supporting snapshot",
  primary: { label: "Uses", value: 7 }, supporting: [],
};

async function fixture() {
  const t = convexTest(schema, modules);
  const propId = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { authSubject: "usage-owner", handle: "usage-owner", displayName: "Synthetic owner", bio: "" });
    await ctx.db.insert("users", { authSubject: "usage-other", handle: "usage-other", displayName: "Synthetic other", bio: "" });
    const productId = await ctx.db.insert("products", { name: "Claude Code", slug: "claude-code", domain: "claude.com", description: "Synthetic relationship" });
    return ctx.db.insert("props", { userId, productId, visibility: "PRIVATE", status: "ACTIVE", relationshipVersion: 1,
      confirmedAt: capturedAt, headline: "Owner-selected relationship", note: "Synthetic note", activity });
  });
  const owner = t.withIdentity({ subject: "usage-owner" });
  const other = t.withIdentity({ subject: "usage-other" });
  const selection = { propId, expectedRelationshipVersion: 1, publish: true, status: "ACTIVE" as const,
    headline: "Owner-selected relationship", note: "Synthetic note", autoRefresh: false, activity };
  const preview = await owner.query(api.onboarding.previewPublication, { selections: [selection] });
  const publishArgs = { selections: [selection], expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash };
  await owner.mutation(api.onboarding.publishSelected, publishArgs);
  const saveArgs = { propId, operationId: "synthetic-private-usage-attempt", expectedVersion: 1,
    status: "ACTIVE" as const, goTo: false, headline: selection.headline, note: selection.note };
  const state = () => t.run(async ctx => ({
    props: await ctx.db.query("props").collect(), publications: await ctx.db.query("publishedProfiles").collect(),
    events: await ctx.db.query("relationshipEvents").collect(), subscriptions: await ctx.db.query("metricSubscriptions").collect(),
  }));
  return { t, owner, other, selection, publishArgs, saveArgs, state };
}

test.each([privateUsage, nativeUsage])("private usage cannot enter save or publication arguments and failed attempts preserve approved activity: %#", async (attachment) => {
  const { t, owner, selection, publishArgs, saveArgs, state } = await fixture();
  const before = await state();
  expect(privateUsage.rows[0].counts[0].value).toBe(exactCount);
  expect(privateUsage.rows[0].sourceEstimateUsd).toBe("0.000000000001");
  expect(before.publications[0].profile.cards[0].activity).toEqual(activity);
  for (const field of ["activity", "privateUsage"] as const) {
    const saveAttempt = { ...saveArgs, [field]: attachment } as unknown as FunctionArgs<typeof api.inventory.save>;
    await expect(owner.mutation(api.inventory.save, saveAttempt)).rejects.toThrow();
    expect(await state()).toEqual(before);
    const invalidSelection = { ...selection, [field]: attachment } as unknown as typeof selection;
    await expect(owner.query(api.onboarding.previewPublication, { selections: [invalidSelection] })).rejects.toThrow();
    await expect(owner.mutation(api.onboarding.publishSelected, { ...publishArgs, selections: [invalidSelection] })).rejects.toThrow();
    expect(await state()).toEqual(before);
  }
  const published = await t.query(api.publicProfiles.getByHandleV2, { handle: "usage-owner" });
  expect(published?.cards[0].activity).toEqual(activity);
  expect(JSON.stringify(published)).not.toContain("private-usage-card-v1");
  expect(JSON.stringify(published)).not.toContain(exactCount);
});

test("another owner cannot save, preview or republish the existing relationship", async () => {
  const { other, selection, publishArgs, saveArgs, state } = await fixture();
  const before = await state();
  await expect(other.mutation(api.inventory.save, saveArgs)).rejects.toThrow("Relationship unavailable.");
  await expect(other.query(api.onboarding.previewPublication, { selections: [selection] })).rejects.toThrow("Cannot publish another user's product.");
  await expect(other.mutation(api.onboarding.publishSelected, publishArgs)).rejects.toThrow("Cannot publish another user's product.");
  expect(await state()).toEqual(before);
});

test("public schema and visible projection exclude attached private fields and reject private activity", async () => {
  const { t } = await fixture();
  const published = await t.query(api.publicProfiles.getByHandleV2, { handle: "usage-owner" });
  if (!published) throw new Error("Synthetic publication missing");
  const valid = publicProfileSchema.parse(published);
  const attached = { ...valid, privateUsage, cards: valid.cards.map(card => ({ ...card, privateUsage })) };
  expect(publicProfileSchema.parse(attached)).toEqual(valid);
  expect(projectVisiblePublicProfile(attached)).toEqual(projectVisiblePublicProfile(valid));
  const visible = JSON.stringify(projectVisiblePublicProfile(attached));
  expect(visible).not.toContain("private-usage-card-v1");
  expect(visible).not.toContain(exactCount);
  expect(publicProfileSchema.safeParse({ ...valid, cards: [{ ...valid.cards[0], activity: privateUsage }] }).success).toBe(false);
});
