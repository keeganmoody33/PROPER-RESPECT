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
    usageLinkUrl: edit.publish && edit.includeUsageLink ? card.prop.supportingUrl : undefined,
    usageLinkLabel: edit.publish && edit.includeUsageLink ? edit.usageLinkLabel : undefined,
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
    userId, provider: "DEVIN", status: "CONNECTED", accountLabel: "Synthetic account",
    attributionScope: "PERSONAL", connectedAt: capturedAt,
  }));
  const refresh = { autoRefresh: true, connectorId, metricKey: "devin.sessions" };
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
  // Older records may predate identity-save validation. Keep the publication
  // boundary covered without using an invalid current save to build the fixture.
  await t.run(ctx => ctx.db.patch(userId, { displayName: "", bio: "Private draft bio" }));
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

const LOOM_LINK = "https://www.loom.com/share/e5b8c04bca094dd8a5507925ab887002";

test("a saved work-sample link goes on the card only when its review selects it, with the owner's label", async () => {
  const { t, owner, propIds: [a], selection, published, reviewCards } = await fixture(1);
  await t.run(ctx => ctx.db.patch(a, { supportingUrl: LOOM_LINK }));

  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections: [await selection(a)] }));
  expect((await published()).profile.cards[0].usageLink).toBeUndefined();
  expect(defaultReview((await reviewCards())[0])).toMatchObject({ includeUsageLink: false, usageLinkLabel: "SEE_HOW_I_USE_IT" });

  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, {
    selections: [await selection(a, { usageLinkUrl: LOOM_LINK, usageLinkLabel: "TUTORIAL" })],
  }));
  expect((await published()).profile.cards[0].usageLink).toEqual({ url: LOOM_LINK, label: "TUTORIAL" });
  for (const reader of [api.publicProfiles.getByHandleV2, api.publicProfiles.getByHandle]) {
    expect((await t.query(reader, { handle: "owner" }))?.cards[0].usageLink).toEqual({ url: LOOM_LINK, label: "TUTORIAL" });
  }
  // Opening review again keeps the published link and its label.
  const [reviewed] = await reviewCards();
  expect(reviewed.publishedUsageLink).toEqual({ url: LOOM_LINK, label: "TUTORIAL" });
  expect(defaultReview(reviewed)).toMatchObject({ includeUsageLink: true, usageLinkLabel: "TUTORIAL" });

  // A selection without a label gets the default one.
  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections: [await selection(a, { usageLinkUrl: LOOM_LINK })] }));
  expect((await published()).profile.cards[0].usageLink?.label).toBe("SEE_HOW_I_USE_IT");

  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections: [await selection(a)] }));
  expect((await published()).profile.cards[0].usageLink).toBeUndefined();
  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections: [await selection(a, { usageLinkUrl: LOOM_LINK })] }));
  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections: [await selection(a, { publish: false })] }));
  expect((await published()).profile.cards).toEqual([]);
});

test("publishing a work-sample link needs the saved https link and a listed label", async () => {
  const { t, owner, propIds: [a], selection } = await fixture(1);
  await t.run(ctx => ctx.db.patch(a, { supportingUrl: LOOM_LINK }));
  await expect(owner.query(api.onboarding.previewPublication, { selections: [await selection(a, { usageLinkUrl: "https://youtu.be/dQw4w9WgXcQ" })] }))
    .rejects.toThrow("Save the link privately before publishing it.");
  await expect(owner.query(api.onboarding.previewPublication, {
    selections: [await selection(a, { usageLinkUrl: LOOM_LINK, usageLinkLabel: "Watch my <b>thing</b>" as never })],
  })).rejects.toThrow(/Validator error/);
  await t.run(ctx => ctx.db.patch(a, { supportingUrl: "http://example.com/work" }));
  await expect(owner.query(api.onboarding.previewPublication, { selections: [await selection(a, { usageLinkUrl: "http://example.com/work" })] }))
    .rejects.toThrow("Use an https link without embedded credentials.");
  await t.run(ctx => ctx.db.patch(a, { supportingUrl: undefined }));
  await expect(owner.query(api.onboarding.previewPublication, { selections: [await selection(a, { usageLinkUrl: LOOM_LINK })] }))
    .rejects.toThrow("Save the link privately before publishing it.");
});

test.each([
  ["display name", 80, true], ["display name", 81, false],
  ["bio", 500, true], ["bio", 501, false],
] as const)("a stored %s of %i characters can be shared: %s", async (field, length, allowed) => {
  const { t, owner, userId, published } = await fixture(1);
  const text = "x".repeat(length);
  await t.run(ctx => ctx.db.patch(userId, field === "bio" ? { bio: text } : { displayName: text }));
  if (allowed) {
    await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections: [] }));
    expect((await published()).profile[field === "bio" ? "bio" : "displayName"]).toBe(text);
    return;
  }
  const message = field === "bio"
    ? "Shorten your bio to 500 characters or fewer before sharing."
    : "Shorten your display name to 80 characters or fewer before sharing.";
  await expect(owner.query(api.onboarding.previewPublication, { selections: [] })).rejects.toThrow(message);
  await expect(owner.mutation(api.onboarding.publishSelected, { selections: [], expectedPublicationRevision: 0, expectedPreviewHash: "never-approved" }))
    .rejects.toThrow(message);
  expect(await t.run(ctx => ctx.db.query("publishedProfiles").collect())).toEqual([]);
});

test.each([
  ["label", 200, true], ["label", 201, false],
  ["url", 2048, true], ["url", 2049, false],
] as const)("a primary link %s of %i characters publishes: %s", async (field, length, allowed) => {
  const { t, owner, propIds: [a], selection, published } = await fixture(1);
  const base = "https://shared.example/";
  const primaryLink = {
    type: "CANONICAL" as const,
    url: field === "url" ? `${base}${"a".repeat(length - base.length)}` : "https://shared.example",
    label: field === "label" ? "L".repeat(length) : "Visit",
  };
  const selections = [await selection(a, { primaryLink })];
  if (allowed) {
    await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections }));
    expect((await published()).profile.cards[0].primaryLink).toMatchObject({ url: primaryLink.url, label: primaryLink.label });
    return;
  }
  const message = field === "label" ? "Use a link label of 200 characters or fewer." : "Use a link of 2,048 characters or fewer.";
  await expect(owner.query(api.onboarding.previewPublication, { selections })).rejects.toThrow(message);
  await expect(owner.mutation(api.onboarding.publishSelected, { selections, expectedPublicationRevision: 0, expectedPreviewHash: "never-approved" }))
    .rejects.toThrow(message);
  expect(await t.run(ctx => ctx.db.query("publishedProfiles").collect())).toEqual([]);
});

test.each([[2048, true], [2049, false]] as const)("a stored %i-character avatar link is shared: %s", async (length, shared) => {
  const { t, owner, userId, published } = await fixture(1);
  const avatarUrl = `https://img.example/${"a".repeat(length - "https://img.example/".length)}`;
  await t.run(ctx => ctx.db.patch(userId, { avatarUrl }));
  const preview = await owner.query(api.onboarding.previewPublication, { selections: [] });
  expect(preview.profile.avatarUrl).toBe(shared ? avatarUrl : undefined);
  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections: [] }));
  expect((await published()).profile.avatarUrl).toBe(shared ? avatarUrl : undefined);
});

test("a 160-character product name still publishes with its default link label", async () => {
  const { t, owner, published } = await fixture(0);
  const name = "P".repeat(160);
  const propId = await owner.mutation(api.onboarding.addManualProduct, { name, website: "https://long-name.example" });
  const link = await t.run(ctx => ctx.db.query("links").withIndex("by_prop", q => q.eq("propId", propId)).unique());
  if (!link) throw new Error("Test link missing");
  expect(link.label).toBe(`Open ${name}`);
  await t.run(ctx => ctx.db.patch(propId, { visibility: "PRIVATE", status: "ACTIVE", relationshipVersion: 1, confirmedAt: capturedAt }));
  const selections: Selection[] = [{
    propId, expectedRelationshipVersion: 1, publish: true, status: "ACTIVE", headline: "", note: "",
    primaryLink: { type: link.type, url: link.url, label: link.label }, autoRefresh: false,
  }];
  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections }));
  expect((await published()).profile.cards[0]).toMatchObject({ product: { name }, primaryLink: { label: `Open ${name}` } });
});

test.each(["label", "url"] as const)("an unchanged public card with an over-limit link %s blocks sharing until it is updated or removed", async field => {
  const { t, owner, propIds: [a, b], selection, published } = await fixture(2);
  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections: [await selection(a), await selection(b)] }));
  // A card published before the caps existed.
  await t.run(async ctx => {
    const row = (await ctx.db.query("publishedProfiles").withIndex("by_handle", q => q.eq("handle", "owner")).unique())!;
    const cards = row.profile.cards.map((card, index) => index !== 0 || !card.primaryLink ? card : {
      ...card, primaryLink: { ...card.primaryLink, ...(field === "label" ? { label: "L".repeat(201) } : { url: `https://shared.example/${"a".repeat(2049)}` }) },
    });
    await ctx.db.patch(row._id, { profile: { ...row.profile, cards } });
  });
  const before = await published();
  const message = "The shared Shared Tool card has a link over the length limit. Include it in this change to update or remove it.";
  await expect(owner.query(api.onboarding.previewPublication, { selections: [await selection(b, { publish: false })] })).rejects.toThrow(message);
  await expect(owner.mutation(api.onboarding.publishSelected, { selections: [], expectedPublicationRevision: before.revision, expectedPreviewHash: "never-approved" })).rejects.toThrow(message);
  expect(await published()).toEqual(before);
  // Including the card, with a link inside the limits, repairs it.
  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections: [await selection(a)] }));
  expect((await published()).profile.cards.map(card => card.primaryLink)).toEqual([
    expect.objectContaining({ label: "Visit" }), expect.objectContaining({ label: "Visit" }),
  ]);
});

test.each(["javascript:alert(1)", "data:text/html,x", "ftp://x.example/file", "https://user:pass@example.com/"])("a primary link to %s is refused before any write", async url => {
  const { t, owner, propIds: [a], selection } = await fixture(1);
  const selections = [await selection(a, { primaryLink: { type: "CANONICAL", url, label: "Visit" } })];
  await expect(owner.query(api.onboarding.previewPublication, { selections })).rejects.toThrow("Use an http or https link without embedded credentials.");
  await expect(owner.mutation(api.onboarding.publishSelected, { selections, expectedPublicationRevision: 0, expectedPreviewHash: "never-approved" }))
    .rejects.toThrow("Use an http or https link without embedded credentials.");
  expect(await t.run(ctx => ctx.db.query("publishedProfiles").collect())).toEqual([]);
});

test.each(["javascript:alert(1)", "data:image/png;base64,AAAA"])("a stored %s avatar link is left off the shared profile", async avatarUrl => {
  const { t, owner, userId, published } = await fixture(1);
  await t.run(ctx => ctx.db.patch(userId, { avatarUrl }));
  expect((await owner.query(api.onboarding.previewPublication, { selections: [] })).profile.avatarUrl).toBeUndefined();
  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections: [] }));
  expect((await published()).profile.avatarUrl).toBeUndefined();
});

test("an unchanged public card with a non-web link blocks sharing until it is updated or removed", async () => {
  const { t, owner, propIds: [a, b], selection, published } = await fixture(2);
  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections: [await selection(a), await selection(b)] }));
  // A card published before the http(s) rule.
  await t.run(async ctx => {
    const row = (await ctx.db.query("publishedProfiles").withIndex("by_handle", q => q.eq("handle", "owner")).unique())!;
    const cards = row.profile.cards.map((card, index) => index !== 0 || !card.primaryLink ? card
      : { ...card, primaryLink: { ...card.primaryLink, url: "javascript:alert(1)" } });
    await ctx.db.patch(row._id, { profile: { ...row.profile, cards } });
  });
  const before = await published();
  const message = "The shared Shared Tool card links somewhere other than a plain http or https address. Include it in this change to update or remove it.";
  await expect(owner.query(api.onboarding.previewPublication, { selections: [await selection(b, { publish: false })] })).rejects.toThrow(message);
  expect(await published()).toEqual(before);
  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections: [await selection(a)] }));
  expect((await published()).profile.cards.map(card => card.primaryLink?.url)).toEqual(["https://shared.example", "https://shared.example"]);
});

test("stored profile links that aren't plain http(s) are left off the shared profile", async () => {
  const { t, owner, userId, published } = await fixture(1);
  await t.run(ctx => ctx.db.patch(userId, {
    profileLinks: [{ label: "Bad", url: "javascript:alert(1)" }, { label: "Website", url: "https://owner.example/" }],
    preferredLinkUrl: "javascript:alert(1)",
  }));
  const preview = await owner.query(api.onboarding.previewPublication, { selections: [] });
  expect(preview.profile.profileLinks).toEqual([{ label: "Website", url: "https://owner.example/" }]);
  expect(preview.profile.preferredLinkUrl).toBeUndefined();
  await owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections: [] }));
  expect(JSON.stringify((await published()).profile)).not.toContain("javascript:");
});

// R09: owner opt-in for the daily GitHub refresh.
const calendar = (total: number, capturedAt: string) => ({ kind: "contributionCalendar" as const, total, days: [],
  attributionScope: "PERSONAL" as const, capturedAt, freshness: "FRESH" as const, provenanceLabel: "Synthetic GitHub calendar" });
async function githubFixture(connector: { status?: "CONNECTED" | "ERROR" | "REVOKED" | "NEEDS_REAUTH"; provider?: "GITHUB" | "DEVIN"; scope?: "PERSONAL" | "ORGANIZATION"; productSlug?: string } = {}) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { authSubject: "owner", handle: "owner", displayName: "Owner", bio: "" });
    const productId = await ctx.db.insert("products", connector.productSlug
      ? { name: "Other tool", slug: connector.productSlug, domain: "other.example", description: "Synthetic" }
      : { name: "GitHub", slug: "github", domain: "github.com", description: "Synthetic" });
    const propId = await ctx.db.insert("props", { userId, productId, visibility: "PRIVATE", status: "ACTIVE", relationshipVersion: 1,
      confirmedAt: capturedAt, headline: "Daily commits", note: "Owner context", activity: calendar(3, "2026-09-20T10:00:00.000Z") });
    const connectorId = await ctx.db.insert("connectorAccounts", { userId, provider: connector.provider ?? "GITHUB", status: connector.status ?? "CONNECTED",
      accountLabel: "github.com/synthetic", githubBinding: { providerAccountId: "U_synthetic", generation: 1 }, attributionScope: connector.scope ?? "PERSONAL", connectedAt: capturedAt });
    return { userId, propId, connectorId };
  });
  const owner = t.withIdentity({ subject: "owner" });
  const selection = (overrides: Partial<Selection> = {}): Selection => ({
    propId: ids.propId, expectedRelationshipVersion: 1, publish: true, status: "ACTIVE", headline: "Daily commits", note: "Owner context",
    primaryLink: { type: "CANONICAL", url: "https://github.com", label: "Open GitHub" }, activity: calendar(3, "2026-09-20T10:00:00.000Z"),
    autoRefresh: true, connectorId: ids.connectorId, metricKey: "github.contributions", ...overrides,
  });
  const publish = async (overrides: Partial<Selection> = {}) =>
    owner.mutation(api.onboarding.publishSelected, await reviewedPublication(owner, { selections: [selection(overrides)] }));
  const subscriptions = () => t.run(ctx => ctx.db.query("metricSubscriptions").collect());
  const publishedCard = () => t.run(async ctx => (await ctx.db.query("publishedProfiles").withIndex("by_handle", q => q.eq("handle", "owner")).unique())?.profile.cards[0]);
  const refreshApproved = async () => (await owner.query(api.onboarding.getState, { includeClaims: false }))?.cards[0].refreshApproved;
  return { t, owner, ...ids, selection, publish, subscriptions, publishedCard, refreshApproved };
}

test("a checked GitHub publish creates one active subscription that getState reports as approved", async () => {
  const f = await githubFixture();
  expect(await f.refreshApproved()).toBe(false);
  await f.publish();
  const subscriptions = await f.subscriptions();
  expect(subscriptions).toEqual([expect.objectContaining({ propId: f.propId, connectorId: f.connectorId,
    metricKey: "github.contributions", attributionScope: "PERSONAL" })]);
  expect(subscriptions[0].revokedAt).toBeUndefined();
  expect(await f.refreshApproved()).toBe(true);
});

test("republishing a refreshed, privately saved card with the box checked keeps its subscription and newest calendar", async () => {
  const f = await githubFixture({ status: "ERROR" });
  await f.publish();
  const [subscription] = await f.subscriptions();
  // What completeGithubRefresh writes for a versioned relationship: the public card only.
  const refreshed = calendar(9, "2026-09-27T10:00:00.000Z");
  await f.t.run(async ctx => {
    const published = (await ctx.db.query("publishedProfiles").withIndex("by_handle", q => q.eq("handle", "owner")).unique())!;
    await ctx.db.patch(published._id, { revision: published.revision + 1, profile: { ...published.profile,
      cards: published.profile.cards.map(card => ({ ...card, activity: refreshed })) } });
  });
  await f.publish({ activity: refreshed });
  const after = await f.subscriptions();
  expect(after.map(item => item._id)).toEqual([subscription._id]);
  expect(after[0].revokedAt).toBeUndefined();
  expect((await f.publishedCard())?.activity).toEqual(refreshed);
  expect((await f.t.run(ctx => ctx.db.get(f.propId)))?.activity).toEqual(calendar(3, "2026-09-20T10:00:00.000Z"));
});

test("the published calendar can only be carried forward while the refresh stays checked", async () => {
  const f = await githubFixture();
  await f.publish();
  const refreshed = calendar(9, "2026-09-27T10:00:00.000Z");
  await f.t.run(async ctx => {
    const published = (await ctx.db.query("publishedProfiles").withIndex("by_handle", q => q.eq("handle", "owner")).unique())!;
    await ctx.db.patch(published._id, { profile: { ...published.profile, cards: published.profile.cards.map(card => ({ ...card, activity: refreshed })) } });
  });
  await expect(f.publish({ activity: refreshed, autoRefresh: false })).rejects.toThrow("Publish only the supporting activity already saved on this relationship.");
  // An activity that was never published is never accepted, even with refresh on.
  await expect(f.publish({ activity: calendar(99, "2026-09-28T10:00:00.000Z") })).rejects.toThrow("Publish only the supporting activity already saved on this relationship.");
});

test("an unchecked republish revokes the refresh", async () => {
  const f = await githubFixture();
  await f.publish();
  await f.publish({ autoRefresh: false, connectorId: undefined, metricKey: undefined });
  expect(await f.subscriptions()).toEqual([expect.objectContaining({ revokedAt: expect.any(String) })]);
  expect(await f.refreshApproved()).toBe(false);
});

for (const [label, connector, overrides] of [
  ["an unsupported metric", {}, { metricKey: "unknown.metric" }],
  ["a Devin connector for the GitHub metric", { provider: "DEVIN" as const }, {}],
  ["a GitHub connector that needs reauthorization", { status: "NEEDS_REAUTH" as const }, {}],
  ["an organization-scoped GitHub connector", { scope: "ORGANIZATION" as const }, {}],
  ["a relationship whose product is not GitHub", { productSlug: "other-tool" }, {}],
  ["a checked refresh without its connector", {}, { connectorId: undefined }],
  ["a checked refresh without its metric", {}, { metricKey: undefined }],
] as const) test(`refresh is refused for ${label}`, async () => {
  const f = await githubFixture(connector);
  await expect(f.owner.query(api.onboarding.previewPublication, { selections: [f.selection(overrides)] })).rejects.toThrow("refresh");
  expect(await f.subscriptions()).toEqual([]);
});

test("a stale republish with the refresh on cannot roll back a newer public calendar", async () => {
  const f = await githubFixture();
  await f.publish();
  const refreshed = calendar(9, "2026-09-27T10:00:00.000Z");
  await f.t.run(async ctx => {
    const published = (await ctx.db.query("publishedProfiles").withIndex("by_handle", q => q.eq("handle", "owner")).unique())!;
    await ctx.db.patch(published._id, { revision: published.revision + 1, profile: { ...published.profile,
      cards: published.profile.cards.map(card => ({ ...card, activity: refreshed })) } });
  });
  // An older review tab still holds the saved calendar and the checked box.
  await expect(f.publish()).rejects.toThrow("This card's public GitHub calendar refreshed since you reviewed it.");
  expect((await f.publishedCard())?.activity).toEqual(refreshed);
  expect((await f.subscriptions()).map(item => item.revokedAt)).toEqual([undefined]);
});

for (const changedAccount of [true, false]) test(`a preview cannot approve a ${changedAccount ? "replacement account" : "new credential generation"} without review`, async () => {
  const f = await githubFixture();
  const selections = [f.selection()];
  const preview = await f.owner.query(api.onboarding.previewPublication, { selections });
  expect(preview.refreshAccounts).toEqual([{ connectorId: f.connectorId, accountLabel: "github.com/synthetic",
    providerAccountId: "U_synthetic", generation: 1 }]);
  await f.t.run(ctx => ctx.db.patch(f.connectorId, {
    accountLabel: changedAccount ? "github.com/replacement" : "github.com/synthetic",
    githubBinding: { providerAccountId: changedAccount ? "U_replacement" : "U_synthetic", generation: 2 },
  }));
  await expect(f.owner.mutation(api.onboarding.publishSelected, { selections,
    expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash })).rejects.toThrow("sharing preview changed");
  expect(await f.subscriptions()).toEqual([]);
  await f.publish();
  expect((await f.subscriptions())[0].githubBinding).toEqual({ providerAccountId: changedAccount ? "U_replacement" : "U_synthetic", generation: 2 });
});

test("legacy GitHub connections require reconnect before granting refresh but can publish a fixed snapshot", async () => {
  const f = await githubFixture();
  await f.t.run(ctx => ctx.db.patch(f.connectorId, { githubBinding: undefined }));
  await expect(f.publish()).rejects.toThrow("Reconnect GitHub");
  await f.publish({ autoRefresh: false });
  expect(await f.subscriptions()).toEqual([]);
  expect((await f.publishedCard())?.activity?.kind).toBe("contributionCalendar");
});

test("replacement approval creates a new grant without rewriting the old grant's account or generation", async () => {
  const f = await githubFixture();
  await f.publish();
  const [old] = await f.subscriptions();
  await f.t.run(async ctx => {
    await ctx.db.patch(f.connectorId, { githubBinding: { providerAccountId: "U_replacement", generation: 2 } });
    await ctx.db.patch(old._id, { revokedAt: "2026-10-01T00:00:00.000Z" });
  });
  await f.publish();
  const grants = await f.subscriptions();
  expect(grants).toHaveLength(2);
  expect(grants.find(grant => grant._id === old._id)).toMatchObject({ githubBinding: old.githubBinding, revokedAt: "2026-10-01T00:00:00.000Z" });
  expect(grants.find(grant => grant._id !== old._id)).toMatchObject({ githubBinding: { providerAccountId: "U_replacement", generation: 2 } });
  expect(await f.refreshApproved()).toBe(true);
});
