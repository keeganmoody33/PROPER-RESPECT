// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import type { FunctionArgs } from "convex/server";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { publishedCardIndicesForProp } from "./publication";
import { defaultReview, explicitPublicationCards, type ReviewEdit } from "../src/domain/review";

const modules = import.meta.glob("./**/*.ts");
const capturedAt = "2026-09-18T00:00:00.000Z";
type Selection = FunctionArgs<typeof api.onboarding.publishSelected>["selections"][number];
const activity = (value: number) => ({
  kind: "headlineMetrics" as const, attributionScope: "PERSONAL" as const,
  capturedAt, freshness: "FRESH" as const, provenanceLabel: "Synthetic retained activity",
  primary: { label: "Uses", value }, supporting: [],
});

async function fixture(count = 2) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { authSubject: "owner", handle: "owner", displayName: "Owner", bio: "" });
    const otherUserId = await ctx.db.insert("users", { authSubject: "other", handle: "other", displayName: "Other", bio: "" });
    const productId = await ctx.db.insert("products", { name: "Shared Tool", slug: "shared-tool", domain: "shared.example", description: "Synthetic product" });
    const propIds = [];
    for (let index = 0; index < count; index++) {
      propIds.push(await ctx.db.insert("props", {
        userId, productId, visibility: "PRIVATE", status: "ACTIVE", relationshipVersion: 1,
        confirmedAt: capturedAt, headline: `Relationship ${index + 1}`, note: `Approved note ${index + 1}`,
        activity: activity(index + 1),
      }));
    }
    const otherPropId = await ctx.db.insert("props", { userId: otherUserId, productId, visibility: "PRIVATE", status: "ACTIVE", headline: "Other owner's relationship", note: "" });
    return { userId, productId, propIds, otherPropId };
  });
  const owner = t.withIdentity({ subject: "owner" });
  const selection = async (propId: Id<"props">, overrides: Partial<Selection> = {}): Promise<Selection> => {
    const prop = await t.run(ctx => ctx.db.get(propId));
    if (!prop) throw new Error("Test relationship missing");
    return {
      propId, expectedRelationshipVersion: prop.relationshipVersion ?? 0, publish: true,
      status: prop.status, headline: prop.headline, note: prop.note, startedAt: prop.startedAt,
      primaryLink: { type: "CANONICAL", url: "https://shared.example", label: "Visit" },
      autoRefresh: false, ...overrides,
    };
  };
  const published = () => t.run(async ctx => {
    const value = await ctx.db.query("publishedProfiles").withIndex("by_handle", q => q.eq("handle", "owner")).unique();
    if (!value) throw new Error("Test publication missing");
    return value;
  });
  const reviewCards = async () => {
    const state = await owner.query(api.onboarding.getState, { includeClaims: false });
    if (!state) throw new Error("Test account missing");
    return state.cards.flatMap(card => card.product ? [{ ...card, product: card.product }] : []);
  };
  return { t, owner, ...ids, selection, published, reviewCards };
}

async function reviewedPublication(owner: Pick<TestConvex<typeof schema>, "query">, args: { selections: Selection[] }) {
  const preview = await owner.query(api.onboarding.previewPublication, args);
  return { ...args, expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash };
}

function fromReview(cards: Awaited<ReturnType<Awaited<ReturnType<typeof fixture>>["reviewCards"]>>, edits: Record<string, ReviewEdit>): Selection[] {
  return explicitPublicationCards(cards, edits).map(({ card, edit }) => ({
    propId: card.prop._id, expectedRelationshipVersion: card.prop.relationshipVersion ?? 0,
    publish: edit.publish, status: edit.status, headline: edit.headline, note: edit.note,
    startedAt: edit.startedAt || undefined,
    primaryLink: { type: edit.linkType, url: edit.linkUrl, label: edit.linkLabel },
    activity: edit.publish && edit.approveActivity ? card.prop.activity : undefined,
    autoRefresh: false,
  }));
}

test("sharing preview is owner-only, read-only, and exactly matches the approved projection", async () => {
  const { t, owner, propIds: [a], selection, published } = await fixture(1);
  await t.run(ctx => ctx.db.patch(a, { goTo: true }));
  const selections = [await selection(a, { primaryLink: undefined })];
  await expect(t.query(api.onboarding.previewPublication, { selections })).rejects.toThrow("Authentication");
  const preview = await owner.query(api.onboarding.previewPublication, { selections });
  expect(preview.revision).toBe(0);
  expect(preview.profile.cards[0]).toMatchObject({ goTo: true });
  expect(preview.profile.cards[0].primaryLink).toBeUndefined();
  expect(await t.run(ctx => ctx.db.query("publishedProfiles").collect())).toEqual([]);
  expect(await t.run(ctx => ctx.db.get(a))).toMatchObject({ visibility: "PRIVATE" });
  await owner.mutation(api.onboarding.publishSelected, { selections, expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash });
  expect((await published()).profile).toEqual(preview.profile);
});

test.each(["publish", "remove"] as const)("another authenticated owner cannot %s a relationship through sharing preview or publication", async mode => {
  const { t, owner, propIds: [publicProp, privateProp], otherPropId, selection } = await fixture();
  const other = t.withIdentity({ subject: "other" });
  for (const [account, propId, handle] of [[owner, publicProp, "owner"], [other, otherPropId, "other"]] as const) {
    const selections = [await selection(propId)];
    const preview = await account.query(api.onboarding.previewPublication, { selections });
    await account.mutation(api.onboarding.publishSelected, {
      selections, expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash,
    });
    expect(await t.query(api.publicProfiles.getByHandle, { handle })).toEqual(preview.profile);
  }
  const selections = [await selection(mode === "publish" ? privateProp : publicProp, { publish: mode === "publish" })];
  const ownerPreview = await owner.query(api.onboarding.previewPublication, { selections });
  const state = () => t.run(async ctx => ({
    users: await ctx.db.query("users").collect(),
    props: await ctx.db.query("props").collect(),
    publications: await ctx.db.query("publishedProfiles").collect(),
    sites: await ctx.db.query("sites").collect(),
    links: await ctx.db.query("links").collect(),
    drafts: await ctx.db.query("draftImports").collect(),
    subscriptions: await ctx.db.query("metricSubscriptions").collect(),
  }));
  const before = await state();
  expect(before.props.find(prop => prop._id === privateProp)?.visibility).toBe("PRIVATE");
  expect(before.publications.map(profile => profile.handle).sort()).toEqual(["other", "owner"]);
  await expect(other.query(api.onboarding.previewPublication, { selections })).rejects.toThrow("Cannot publish another user's product.");
  expect(await state()).toEqual(before);
  await expect(other.mutation(api.onboarding.publishSelected, {
    selections, expectedPublicationRevision: ownerPreview.revision, expectedPreviewHash: ownerPreview.previewHash,
  })).rejects.toThrow("Cannot publish another user's product.");
  expect(await state()).toEqual(before);
});

test("another owner's preview hash cannot approve valid owned selections", async () => {
  const { t, owner, propIds: [a], otherPropId, selection } = await fixture(1);
  const other = t.withIdentity({ subject: "other" });
  for (const [account, propId] of [[owner, a], [other, otherPropId]] as const) {
    await account.mutation(api.onboarding.publishSelected, await reviewedPublication(account, { selections: [await selection(propId)] }));
  }
  const ownerPreview = await owner.query(api.onboarding.previewPublication, { selections: [await selection(a)] });
  const selections = [await selection(otherPropId, { primaryLink: { type: "CANONICAL", url: "https://shared.example", label: "Other owner's approved link" } })];
  const otherPreview = await other.query(api.onboarding.previewPublication, { selections });
  expect(otherPreview.revision).toBe(ownerPreview.revision);
  expect(otherPreview.previewHash).not.toBe(ownerPreview.previewHash);
  const state = () => t.run(async ctx => ({
    users: await ctx.db.query("users").collect(),
    props: await ctx.db.query("props").collect(),
    publications: await ctx.db.query("publishedProfiles").collect(),
    sites: await ctx.db.query("sites").collect(),
    links: await ctx.db.query("links").collect(),
    drafts: await ctx.db.query("draftImports").collect(),
    subscriptions: await ctx.db.query("metricSubscriptions").collect(),
  }));
  const before = await state();
  await expect(other.mutation(api.onboarding.publishSelected, {
    selections, expectedPublicationRevision: otherPreview.revision, expectedPreviewHash: ownerPreview.previewHash,
  })).rejects.toThrow("The sharing preview changed.");
  expect(await state()).toEqual(before);
  await other.mutation(api.onboarding.publishSelected, {
    selections, expectedPublicationRevision: otherPreview.revision, expectedPreviewHash: otherPreview.previewHash,
  });
  expect(await t.query(api.publicProfiles.getByHandle, { handle: "other" })).toEqual(otherPreview.profile);
  expect(await t.query(api.publicProfiles.getByHandle, { handle: "owner" })).toEqual(ownerPreview.profile);
});

test("a sharing approval rejects publication or identity changes after preview without any writes", async () => {
  const { t, owner, userId, propIds: [a, b], selection, published } = await fixture();
  const selections = [await selection(a)];
  const preview = await owner.query(api.onboarding.previewPublication, { selections });
  await t.run(ctx => ctx.db.patch(userId, { bio: "Changed privately after preview" }));
  await expect(owner.mutation(api.onboarding.publishSelected, { selections, expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash })).rejects.toThrow("preview");
  expect(await t.run(ctx => ctx.db.query("publishedProfiles").collect())).toEqual([]);
  const fresh = await owner.query(api.onboarding.previewPublication, { selections });
  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections: [await selection(b)] }));
  const before = await published();
  await expect(owner.mutation(api.onboarding.publishSelected, { selections, expectedPublicationRevision: fresh.revision, expectedPreviewHash: fresh.previewHash })).rejects.toThrow("publication changed");
  expect(await published()).toEqual(before);
  expect(await t.run(ctx => ctx.db.get(a))).toMatchObject({ visibility: "PRIVATE" });
});

test("editing A privately then publishing only reviewed B preserves A's exact same-product snapshot", async () => {
  const { t, owner, propIds: [a, b], selection, published, reviewCards } = await fixture();
  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections: [await selection(a), await selection(b, { activity: activity(2) })] }));
  const before = await published();
  expect(before.cardPropIds).toEqual([a, b]);
  const approvedA = before.profile.cards[0];
  await owner.mutation(api.inventory.save, {
    propId: a, expectedVersion: 1, operationId: "private-a-20260918", status: "ARCHIVED",
    headline: "A's later private headline", note: "A's later private note", goTo: true,
  });
  const cards = await reviewCards();
  const cardA = cards.find(card => card.prop._id === a)!;
  const cardB = cards.find(card => card.prop._id === b)!;
  expect(cardA.prop.activity).toEqual(activity(1));
  expect(cardA.publishedActivity).toBeUndefined();
  expect(defaultReview(cardA).approveActivity).toBe(false);
  expect(cardB.publishedActivity).toEqual(activity(2));
  const selections = fromReview(cards, { [b]: { ...defaultReview(cardB), linkLabel: "Reconfirmed B" } });
  expect(selections.map(item => item.propId)).toEqual([b]);
  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections }));
  const after = await published();
  expect(after.cardPropIds).toEqual([a, b]);
  expect(after.profile.cards[0]).toEqual(approvedA);
  expect(after.profile.cards[0].activity).toBeUndefined();
  expect(after.profile.cards[1]).toMatchObject({ headline: "Relationship 2", activity: activity(2), primaryLink: { label: "Reconfirmed B" } });
  expect(await t.run(ctx => ctx.db.get(a))).toMatchObject({ relationshipVersion: 2, status: "ARCHIVED", note: "A's later private note" });
  const publicProfile = await t.query(api.publicProfiles.getByHandle, { handle: "owner" });
  expect(publicProfile).toEqual(after.profile);
  expect(JSON.stringify(publicProfile)).not.toContain(a);
  expect(JSON.stringify(publicProfile)).not.toContain(b);
  expect(publicProfile).not.toHaveProperty("cardPropIds");
});

test("reopening and publishing a withheld activity through actual getState and review defaults keeps it withheld", async () => {
  const { owner, propIds: [a, b], selection, published, reviewCards } = await fixture();
  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections: [await selection(a), await selection(b, { activity: activity(2) })] }));
  const cards = await reviewCards();
  const cardA = cards.find(card => card.prop._id === a)!;
  const selections = fromReview(cards, { [a]: { ...defaultReview(cardA), linkLabel: "Review without activity consent" } });
  expect(selections[0].activity).toBeUndefined();
  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections }));
  const after = await published();
  const aIndex = after.cardPropIds!.indexOf(a);
  expect(after.profile.cards[aIndex].activity).toBeUndefined();
  expect((await reviewCards()).find(card => card.prop._id === a)?.prop.activity).toEqual(activity(1));
  expect(after.profile.cards[after.cardPropIds!.indexOf(b)].activity).toEqual(activity(2));
});

test("removing a selected relationship preserves the other same-product card and its approved activity", async () => {
  const { t, owner, propIds: [a, b], selection, published } = await fixture();
  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections: [await selection(a, { activity: activity(1) }), await selection(b)] }));
  const before = await published();
  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections: [await selection(b, { publish: false })] }));
  const after = await published();
  expect(after.cardPropIds).toEqual([a]);
  expect(after.profile.cards).toEqual([before.profile.cards[0]]);
  expect(await t.run(ctx => ctx.db.get(b))).toMatchObject({ visibility: "PRIVATE", relationshipVersion: 1, activity: activity(2) });
  expect(await t.run(ctx => ctx.db.get(a))).toMatchObject({ visibility: "PUBLIC" });
});

test.each(["withheld", "fixed", "removed"] as const)("a %s public snapshot revokes earlier refresh consent only for the selected relationship", async mode => {
  const { t, owner, userId, propIds: [a, b], selection, published } = await fixture();
  const connectorId = await t.run(ctx => ctx.db.insert("connectorAccounts", {
    userId, provider: "GITHUB", status: "CONNECTED", accountLabel: "Synthetic account",
    attributionScope: "PERSONAL", connectedAt: capturedAt,
  }));
  const refresh = { autoRefresh: true, connectorId, metricKey: "github.contributions" };
  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections: [
    await selection(a, { ...refresh, activity: activity(1) }),
    await selection(b, { ...refresh, activity: activity(2) }),
  ] }));
  const subscriptions = await t.run(ctx => ctx.db.query("metricSubscriptions").collect());
  const selectedSubscription = subscriptions.find(item => item.propId === a)!;
  const omittedSubscription = subscriptions.find(item => item.propId === b)!;
  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections: [await selection(a, {
    ...refresh,
    publish: mode !== "removed",
    autoRefresh: mode !== "fixed",
    activity: mode === "fixed" ? activity(1) : undefined,
  })] }));
  const beforeLateRefresh = await published();
  const privateBefore = await t.run(ctx => ctx.db.get(a));
  expect(await t.run(ctx => ctx.db.get(selectedSubscription._id))).toMatchObject({ revokedAt: expect.any(String) });
  expect(await t.run(ctx => ctx.db.get(omittedSubscription._id))).toEqual(omittedSubscription);
  await expect(t.mutation(internal.connectors.applyRefresh, {
    subscriptionId: selectedSubscription._id, activity: activity(99), value: 99,
  })).rejects.toThrow("Refresh exceeds the approved metric or scope.");
  expect(await published()).toEqual(beforeLateRefresh);
  expect(await t.run(ctx => ctx.db.get(a))).toEqual(privateBefore);
  expect(await t.run(ctx => ctx.db.query("usageSignals").collect())).toEqual([]);
  const selectedCard = beforeLateRefresh.profile.cards.find((_, index) => beforeLateRefresh.cardPropIds?.[index] === a);
  if (mode === "fixed") expect(selectedCard?.activity).toEqual(activity(1));
  else expect(selectedCard?.activity).toBeUndefined();

  // The omitted relationship keeps the legacy refresh permission it already had.
  await t.mutation(internal.connectors.applyRefresh, {
    subscriptionId: omittedSubscription._id, activity: activity(3), value: 3,
  });
  const afterOmittedRefresh = await published();
  expect(afterOmittedRefresh.profile.cards.find((_, index) => afterOmittedRefresh.cardPropIds?.[index] === b)?.activity).toEqual(activity(3));
  expect(afterOmittedRefresh.profile.cards.find((_, index) => afterOmittedRefresh.cardPropIds?.[index] === a)).toEqual(selectedCard);
});

test.each(["empty", "removal"] as const)("an invalid profile identity rejects an %s sharing change before preview or publication writes", async mode => {
  const { t, owner, userId, propIds: [a, b], selection } = await fixture();
  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections: [await selection(a), await selection(b)] }));
  await owner.mutation(api.onboarding.claimHandle, { handle: "owner", displayName: "   ", bio: "Private draft bio" });
  const selections = mode === "empty" ? [] : [await selection(a, { publish: false })];
  const state = () => t.run(async ctx => ({
    user: await ctx.db.get(userId),
    props: await ctx.db.query("props").collect(),
    publication: await ctx.db.query("publishedProfiles").collect(),
    sites: await ctx.db.query("sites").collect(),
    links: await ctx.db.query("links").collect(),
    drafts: await ctx.db.query("draftImports").collect(),
    subscriptions: await ctx.db.query("metricSubscriptions").collect(),
  }));
  const before = await state();
  await expect(owner.query(api.onboarding.previewPublication, { selections })).rejects.toThrow("displayName");
  expect(await state()).toEqual(before);
  await expect(owner.mutation(api.onboarding.publishSelected, { expectedPublicationRevision: 0, expectedPreviewHash: "invalid-input-never-approved", selections })).rejects.toThrow("displayName");
  expect(await state()).toEqual(before);
});

test("a stale removal rejects without changing either public card or the latest private decisions", async () => {
  const { t, owner, propIds: [a, b], selection, published } = await fixture();
  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections: [await selection(a), await selection(b)] }));
  const staleRemoval = await selection(a, { publish: false });
  const removalApproval = await reviewedPublication(owner, { selections: [staleRemoval] });
  await owner.mutation(api.inventory.save, { propId: a, expectedVersion: 1, operationId: "private-before-removal-20260918", status: "ACTIVE", headline: "New private headline", note: "New private note", goTo: false });
  const before = await published();
  const privateBefore = await t.run(ctx => ctx.db.get(a));
  await expect(owner.mutation(api.onboarding.publishSelected, removalApproval)).rejects.toThrow("changed");
  expect(await published()).toEqual(before);
  expect(await t.run(ctx => ctx.db.get(a))).toEqual(privateBefore);
});

test("legacy unique relationships resolve safely and acquire private identity metadata on republish", async () => {
  const { t, owner, propIds: [a], otherPropId, selection, published, reviewCards } = await fixture(1);
  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections: [await selection(a, { activity: activity(1) })] }));
  const before = await published();
  await t.run(ctx => ctx.db.patch(before._id, { cardPropIds: undefined }));
  expect((await reviewCards())[0].publishedActivity).toEqual(activity(1));
  expect(await t.run(async ctx => publishedCardIndicesForProp(ctx, (await ctx.db.get(before._id))!, (await ctx.db.get(a))!))).toEqual([0]);
  expect(await t.run(async ctx => publishedCardIndicesForProp(ctx, (await ctx.db.get(before._id))!, (await ctx.db.get(otherPropId))!))).toEqual([]);
  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections: [await selection(a)] }));
  expect((await published()).cardPropIds).toEqual([a]);
});

test("ambiguous legacy same-product subsets fail closed; unrelated publication preserves them; explicit full selection repairs identity", async () => {
  const { t, owner, userId, propIds: [a, b], selection, published, reviewCards } = await fixture();
  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections: [await selection(a, { activity: activity(1) }), await selection(b, { activity: activity(2) })] }));
  const initial = await published();
  await t.run(ctx => ctx.db.patch(initial._id, { cardPropIds: undefined }));
  const before = await published();
  expect((await reviewCards()).map(card => card.publishedActivity)).toEqual([undefined, undefined]);
  expect(await t.run(async ctx => publishedCardIndicesForProp(ctx, (await ctx.db.get(before._id))!, (await ctx.db.get(a))!))).toEqual([]);
  await expect(owner.mutation(api.onboarding.publishSelected, { expectedPublicationRevision: 0, expectedPreviewHash: "invalid-input-never-approved", selections: [await selection(a)] })).rejects.toThrow("Select all of its relationships together");
  await expect(owner.mutation(api.onboarding.publishSelected, { expectedPublicationRevision: 0, expectedPreviewHash: "invalid-input-never-approved", selections: [await selection(a, { publish: false })] })).rejects.toThrow("Select all of its relationships together");
  expect(await published()).toEqual(before);
  expect(await t.run(ctx => ctx.db.get(a))).toMatchObject({ visibility: "PUBLIC" });
  const c = await t.run(async ctx => {
    const productId = await ctx.db.insert("products", { name: "Other Tool", slug: "other-tool", domain: "other.example", description: "Synthetic unrelated product" });
    return ctx.db.insert("props", { userId, productId, visibility: "PRIVATE", status: "ACTIVE", headline: "Unrelated relationship", note: "" });
  });
  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections: [await selection(c)] }));
  const unrelated = await published();
  expect(unrelated.profile.cards.slice(0, 2)).toEqual(before.profile.cards);
  expect(unrelated.cardPropIds).toEqual([null, null, c]);
  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections: [await selection(a, { activity: activity(1) }), await selection(b, { publish: false })] }));
  const resolved = await published();
  expect(resolved.cardPropIds).toEqual([c, a]);
  expect(resolved.profile.cards[0]).toEqual(unrelated.profile.cards[2]);
  expect(resolved.profile.cards[1].activity).toEqual(activity(1));
  expect(await t.run(ctx => ctx.db.get(b))).toMatchObject({ visibility: "PRIVATE" });
  expect(await t.run(async ctx => publishedCardIndicesForProp(ctx, resolved, (await ctx.db.get(a))!))).toEqual([1]);
});

test("getState preserves legacy evidence metadata when claim details are disabled", async () => {
  const { t, owner, userId, propIds: [a] } = await fixture(1);
  const evidenceId = await t.run(async ctx => {
    const evidenceSourceId = await ctx.db.insert("evidenceSources", { userId, type: "MANUAL", label: "Owner evidence", connectedAt: capturedAt });
    const rawEvidenceId = await ctx.db.insert("rawEvidence", {
      evidenceSourceId, userId, capturedAt, dedupKey: "publication-evidence-20260918", payload: "Private retained words",
      observations: [{ kind: "USAGE", metric: "Uses", value: 1, unit: "uses", excerpt: "Private retained words", scope: "PERSONAL", acquisition: "USER_SUPPLIED" }],
    });
    await ctx.db.insert("proofs", { propId: a, type: "NOTE", rawEvidenceId });
    return rawEvidenceId;
  });
  const light = await owner.query(api.onboarding.getState, { includeClaims: false });
  expect(light?.evidence.map(item => item._id)).toEqual([evidenceId]);
  expect(light?.cards[0].claims).toEqual([]);
  const legacy = await owner.query(api.onboarding.getState, {});
  expect(legacy?.evidence.map(item => item._id)).toEqual([evidenceId]);
  expect(legacy?.cards[0].claims).toHaveLength(1);
  expect(legacy?.cards[0].claims[0].observation.excerpt).toBe("Private retained words");
  const collection = await owner.query(api.onboarding.getState, { includeClaims: false, includeLegacyCollections: false });
  expect(collection?.cards[0].prop._id).toBe(a);
  expect(collection?.evidence).toEqual([]);
  expect(collection?.drafts).toEqual([]);
});
