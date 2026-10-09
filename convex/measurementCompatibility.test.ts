// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { publicProfileSchema } from "../src/domain/public-profile";
import { publicMeasurementSchema, type PublicMeasurement } from "../src/domain/measurements";

const modules = import.meta.glob("./**/*.ts");
const capturedAt = "2026-10-09T00:00:00.000Z";
const summed: PublicMeasurement = {
  metric: "total_tokens", value: "9007199254740993", unit: "tokens",
  period: { kind: "date", start: "2026-10-01", end: "2026-10-07", timezone: "UTC" },
  scope: "UNKNOWN", coverage: "PARTIAL", temporality: "SNAPSHOT", aggregation: "NON_ADDITIVE",
  capturedAt, status: "measured", identityBasis: "OWNER_SUPPLIED", activityActor: "UNKNOWN",
  sample: "unknown", derivation: "SUMMED_RESPONSES",
};
const reported: PublicMeasurement = { ...summed, metric: "reported_tokens", value: "7", derivation: "SOURCE_REPORTED" };

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { authSubject: "owner", handle: "owner", displayName: "Owner", bio: "" });
    const propIds = [];
    const cards = [];
    for (const [index, measurements] of [[reported, summed], [summed]].entries()) {
      const product = { name: `Tool ${index}`, slug: `tool-${index}`, domain: `tool-${index}.example`, description: "Synthetic tool" };
      const productId = await ctx.db.insert("products", product);
      propIds.push(await ctx.db.insert("props", { userId, productId, visibility: "PUBLIC", status: "ACTIVE", headline: "Saved card", note: "", relationshipVersion: 1 }));
      cards.push({ product, status: "ACTIVE" as const, headline: "Saved card", note: "", primaryLink: { type: "CANONICAL" as const, url: `https://${product.domain}`, label: "Visit" }, measurements });
    }
    const publicationId = await ctx.db.insert("publishedProfiles", {
      handle: "owner", revision: 1, publishedAt: capturedAt, cardPropIds: propIds,
      profile: { handle: "owner", displayName: "Owner", bio: "", cards },
    });
    return { userId, publicationId, propIds };
  });
  const owner = t.withIdentity({ subject: "owner" });
  const stored = () => t.run(ctx => ctx.db.get(ids.publicationId));
  return { t, owner, stored, ...ids };
}

test("legacy public readers omit summed rows without dropping cards, relabeling or changing storage", async () => {
  const f = await fixture(), before = await f.stored();
  // The deployed schema understood only the two earlier derivations.
  const legacyMeasurement = publicMeasurementSchema.refine(row => row.derivation !== "SUMMED_RESPONSES");
  for (const endpoint of [api.publicProfiles.getByHandle, api.publicProfiles.getByHandleV2]) {
    const profile = await f.t.query(endpoint, { handle: "owner" });
    expect(profile?.cards).toHaveLength(2);
    expect(profile?.cards[0].measurements).toEqual([reported]);
    expect(profile?.cards[1]).not.toHaveProperty("measurements");
    for (const card of profile?.cards ?? []) for (const measurement of card.measurements ?? []) expect(legacyMeasurement.safeParse(measurement).success).toBe(true);
  }
  expect(await f.stored()).toEqual(before);
});

test("version two public readers and owner exports retain exact summed rows", async () => {
  const f = await fixture(), before = await f.stored();
  const profile = await f.t.query(api.publicProfiles.getByHandleV2, { handle: "owner", measurementVersion: 2 });
  expect(profile).toEqual(before?.profile);
  expect(publicProfileSchema.parse(profile)).toEqual(profile);
  const exported = await f.owner.query(api.inventory.exportProfile, {});
  expect(exported.publicPage?.profile).toEqual(before?.profile);
  expect(await f.stored()).toEqual(before);
});

test("legacy previews and publication refuse preserved sums instead of approving unseen measurements", async () => {
  const f = await fixture();
  const preview = await f.owner.query(api.onboarding.previewPublication, { selections: [], measurementVersion: 2 });
  const before = await f.stored();
  await expect(f.owner.query(api.onboarding.previewPublication, { selections: [] })).rejects.toThrow("Reload");
  await expect(f.owner.mutation(api.onboarding.publishSelected, {
    selections: [], expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash,
  })).rejects.toThrow("Reload");
  expect(await f.stored()).toEqual(before);
});

test("version two publication preserves the exact approved sums and still rejects a stale preview", async () => {
  const f = await fixture();
  const preview = await f.owner.query(api.onboarding.previewPublication, { selections: [], measurementVersion: 2 });
  const args = { selections: [], measurementVersion: 2 as const, expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash };
  await f.owner.mutation(api.onboarding.publishSelected, args);
  const after = await f.stored();
  expect(after?.profile).toEqual(preview.profile);
  expect(after?.revision).toBe(preview.revision + 1);
  await expect(f.owner.mutation(api.onboarding.publishSelected, args)).rejects.toThrow("publication changed");
  expect(await f.stored()).toEqual(after);
});

test.each([true, false])("legacy callers cannot replace or remove summed cards with publish=%s", async publish => {
  const f = await fixture();
  const selections = f.propIds.map(propId => ({
    propId, publish, expectedRelationshipVersion: 1, status: "ACTIVE" as const,
    headline: "Saved card", note: "", autoRefresh: false,
  }));
  const preview = await f.owner.query(api.onboarding.previewPublication, { selections, measurementVersion: 2 });
  expect(preview.profile.cards.every(card => !card.measurements?.length)).toBe(true);
  const before = await f.stored();
  await expect.soft(f.owner.query(api.onboarding.previewPublication, { selections })).rejects.toThrow("Reload");
  await expect.soft(f.owner.mutation(api.onboarding.publishSelected, {
    selections, expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash,
  })).rejects.toThrow("Reload");
  expect(await f.stored()).toEqual(before);

  // A modern caller can deliberately approve the same visible change.
  await f.owner.mutation(api.onboarding.publishSelected, {
    selections, measurementVersion: 2, expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash,
  });
  expect((await f.stored())?.profile).toEqual(preview.profile);
});

test("legacy remove-all remains available and subsequent ordinary publication needs no opt-in", async () => {
  const f = await fixture();
  const preview = await f.owner.query(api.onboarding.previewPublication, { selections: [], removeAllCards: true });
  expect(preview.profile.cards).toEqual([]);
  await f.owner.mutation(api.onboarding.publishSelected, {
    selections: [], removeAllCards: true, expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash,
  });
  expect((await f.stored())?.profile.cards).toEqual([]);
  const unchanged = await f.owner.query(api.onboarding.previewPublication, { selections: [] });
  await f.owner.mutation(api.onboarding.publishSelected, { selections: [], expectedPublicationRevision: unchanged.revision, expectedPreviewHash: unchanged.previewHash });
});
