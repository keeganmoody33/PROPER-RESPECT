// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, test } from "vitest";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";
import { prepareGitHubActivity, RETAINED_PRODUCT_ADAPTER_VERSION, type RetainedProductArtifact } from "../src/domain/retained-product-evidence";
import { privateCardPrimaryLink } from "../src/domain/product-destination";
import { defaultReview } from "../src/domain/review";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const retain = makeFunctionReference<"mutation">("retainedEvidence:importPacket");
const save = makeFunctionReference<"mutation">("inventory:save");
const list = makeFunctionReference<"query">("inventory:list");
const evidence = makeFunctionReference<"query">("inventory:evidence");
const selectedActivity = makeFunctionReference<"query">("inventory:selectedActivity");
const history = makeFunctionReference<"query">("inventory:history");
const review = makeFunctionReference<"mutation">("onboarding:reviewClaim");
const firstPage = { paginationOpts: { numItems: 25, cursor: null } };

async function packet(total = 7, login = "synthetic-account") {
  const payload = JSON.stringify({ data: { viewer: { login, createdAt: "2020-01-01T00:00:00Z", contributionsCollection: { contributionCalendar: { totalContributions: total, weeks: [{ contributionDays: [{ date: "2025-01-01", contributionCount: total, contributionLevel: "FIRST_QUARTILE" }] }] } } } } });
  const bytes = new TextEncoder().encode(payload);
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
  const artifact: RetainedProductArtifact = { kind: "GITHUB_ACTIVITY", sourceFile: "synthetic.json", sha256, byteLength: bytes.length, sourceCapturedDate: "2025-01-02", sourceCaptureBasis: "RETAINED_SOURCE_DATE", preparedAt: "2025-01-03T00:00:00.000Z", adapterVersion: RETAINED_PRODUCT_ADAPTER_VERSION };
  return prepareGitHubActivity({ payload, artifact });
}
async function fixture() {
  const t = convexTest(schema, modules);
  await t.run(async ctx => {
    for (const subject of ["owner", "other"]) await ctx.db.insert("users", { handle: subject, authSubject: subject, displayName: subject, bio: "" });
    await ctx.db.insert("publishedProfiles", { handle: "owner", revision: 2, publishedAt: "2025-01-01", profile: { handle: "owner", displayName: "owner", bio: "", cards: [] } });
  });
  return { t, owner: t.withIdentity({ subject: "owner" }), other: t.withIdentity({ subject: "other" }) };
}

test("retained original becomes a private candidate, reviewed context and an explicitly saved card across sessions", async () => {
  const { t, owner } = await fixture();
  const input = { packet: await packet() };
  const before = await t.run(ctx => ctx.db.query("publishedProfiles").collect());
  const first = await owner.mutation(retain, input);
  expect(await owner.mutation(retain, input)).toEqual({ ...first, duplicate: true });
  let state = await owner.query(list, firstPage);
  expect(state.page).toHaveLength(1);
  expect(state.page[0].prop).toMatchObject({ status: "TESTING", visibility: "DRAFT" });
  expect(state.page[0].prop.goTo).toBeUndefined();
  expect(state.page[0].prop.activity).toBeUndefined();
  expect((await owner.query(evidence, { propId: first.propId, ...firstPage })).page[0].captureProvenance).toMatchObject({ route: "UPLOAD", activityActor: { kind: "UNKNOWN" } });
  await owner.mutation(review, { propId: first.propId, rawEvidenceId: first.rawEvidenceId, observationIndex: 1, verdict: "INCOMPLETE", correction: "The requested measurement window was not retained." });
  await owner.mutation(save, { propId: first.propId, expectedVersion: 0, operationId: "confirm", status: "ACTIVE", goTo: true, headline: "My work context", note: "Owner statement", activityEvidenceId: first.rawEvidenceId });
  state = await t.withIdentity({ subject: "owner", tokenIdentifier: "fresh-session" }).query(list, firstPage);
  expect(state.page[0].prop).toMatchObject({ visibility: "PRIVATE", status: "ACTIVE", goTo: true, activityEvidenceId: first.rawEvidenceId });
  expect(state.page[0].prop.activity.total).toBe(7);
  expect(state.page[0].prop.activity.period).toBeUndefined();
  expect(state.page[0].prop.startedAt).toBeUndefined();
  expect(await t.run(ctx => ctx.db.query("publishedProfiles").collect())).toEqual(before);
});

test("later evidence attaches without overwriting saved decisions, approved metrics or review history", async () => {
  const { t, owner } = await fixture();
  const first = await owner.mutation(retain, { packet: await packet() });
  await owner.mutation(save, { propId: first.propId, expectedVersion: 0, operationId: "save", status: "ARCHIVED", goTo: true, headline: "Earlier tool", note: "Kept for reference", activityEvidenceId: first.rawEvidenceId });
  const later = await owner.mutation(retain, { packet: await packet(9) });
  expect(later.propId).toBe(first.propId);
  await owner.mutation(retain, { packet: await packet(9) });
  const state = await owner.query(list, firstPage);
  expect(state.page).toHaveLength(1);
  expect(state.page[0].prop).toMatchObject({ status: "ARCHIVED", goTo: true, note: "Kept for reference", relationshipVersion: 1 });
  expect(state.page[0].prop.activity.total).toBe(7);
  expect((await owner.query(evidence, { propId: first.propId, ...firstPage })).page).toHaveLength(2);
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toHaveLength(2);
  expect(await t.run(ctx => ctx.db.query("relationshipEvents").collect())).toHaveLength(1);
});

test("intake verifies original bytes and keeps owners and accepted supporting sources isolated", async () => {
  const { t, owner, other } = await fixture();
  const original = await packet();
  await expect(t.mutation(retain, { packet: original })).rejects.toThrow();
  await expect(owner.mutation(retain, { packet: { ...original, signal: { ...original.signal, payload: original.signal.payload.replace('"synthetic-account"', '"spoofed-account"') } } })).rejects.toThrow();
  const a = await owner.mutation(retain, { packet: original });
  const b = await other.mutation(retain, { packet: original });
  expect(a.rawEvidenceId).not.toBe(b.rawEvidenceId);
  expect(a.propId).not.toBe(b.propId);
  await expect(owner.mutation(save, { propId: a.propId, expectedVersion: 0, operationId: "cross-owner", status: "ACTIVE", goTo: false, headline: "", note: "", activityEvidenceId: b.rawEvidenceId })).rejects.toThrow("unavailable");
  const before = await t.run(ctx => ctx.db.get(a.rawEvidenceId));
  const repeated = prepareGitHubActivity({ payload: original.signal.payload, artifact: { ...original.artifact, preparedAt: "2025-01-04T00:00:00.000Z" } });
  expect((await owner.mutation(retain, { packet: repeated })).duplicate).toBe(true);
  expect(await t.run(ctx => ctx.db.get(a.rawEvidenceId))).toEqual(before);
});

test("a selected older snapshot stays inspectable and can be detached idempotently without deleting evidence or publishing", async () => {
  const { t, owner, other } = await fixture();
  const inputPacket = await packet();
  const original = await owner.mutation(retain, { packet: inputPacket });
  const base = { propId: original.propId, status: "ACTIVE", goTo: true, headline: "Synthetic saved tool", note: "Synthetic owner context" };
  await owner.mutation(save, { ...base, expectedVersion: 0, operationId: "attach", activityEvidenceId: original.rawEvidenceId });
  for (let total = 20; total < 32; total++) await owner.mutation(retain, { packet: await packet(total) });
  const newest = await owner.query(evidence, { propId: original.propId, paginationOpts: { numItems: 500, cursor: null } });
  expect(newest.page).toHaveLength(10);
  expect(newest.isDone).toBe(false);
  expect(newest.page.some((entry: { id: string }) => entry.id === original.rawEvidenceId)).toBe(false);
  expect(await owner.query(selectedActivity, { propId: original.propId })).toMatchObject({ id: original.rawEvidenceId, originalText: inputPacket.signal.payload, suggestedActivity: { total: 7 } });

  const retainedBefore = await t.run(async ctx => ({ raw: await ctx.db.query("rawEvidence").collect(), proofs: await ctx.db.query("proofs").collect(), public: await ctx.db.query("publishedProfiles").collect() }));
  const detach = { ...base, expectedVersion: 1, operationId: "detach", clearActivity: true };
  await expect(owner.mutation(save, { ...detach, activityEvidenceId: original.rawEvidenceId })).rejects.toThrow("not both");
  await expect(other.mutation(save, detach)).rejects.toThrow("unavailable");
  expect(await owner.mutation(save, detach)).toMatchObject({ version: 2, duplicate: false });
  expect(await owner.mutation(save, detach)).toMatchObject({ version: 2, duplicate: true });
  await expect(owner.mutation(save, { ...detach, clearActivity: false })).rejects.toThrow("different decisions");
  const saved = await t.run(ctx => ctx.db.get(original.propId as Id<"props">));
  expect(saved).toMatchObject({ relationshipVersion: 2, goTo: true, status: "ACTIVE", visibility: "PRIVATE" });
  expect(saved?.activity).toBeUndefined();
  expect(saved?.activityEvidenceId).toBeUndefined();
  expect(await owner.query(selectedActivity, { propId: original.propId })).toBeNull();
  const events = await owner.query(history, { propId: original.propId, ...firstPage });
  expect(events.page).toHaveLength(2);
  expect(events.page[0].before.activityEvidenceId).toBe(original.rawEvidenceId);
  expect(events.page[0].after.activityEvidenceId).toBeUndefined();
  expect(events.page[1].after.activityEvidenceId).toBe(original.rawEvidenceId);
  expect(await t.run(async ctx => ({ raw: await ctx.db.query("rawEvidence").collect(), proofs: await ctx.db.query("proofs").collect(), public: await ctx.db.query("publishedProfiles").collect() }))).toEqual(retainedBefore);
  await owner.mutation(save, { ...base, expectedVersion: 2, operationId: "reattach", activityEvidenceId: original.rawEvidenceId });
  expect((await owner.query(selectedActivity, { propId: original.propId })).id).toBe(original.rawEvidenceId);
});

test("private GitHub destination uses owned account evidence and keeps the product website unpublished", async () => {
  const { t, owner, other } = await fixture();
  const owned = await owner.mutation(retain, { packet: await packet(7, "owner-account") });
  const outsider = await other.mutation(retain, { packet: await packet(7, "other-account") });
  const listed = await owner.query(list, firstPage);
  const card = listed.page[0];
  expect(card.links.find((link: { isPrimary: boolean }) => link.isPrimary)?.url).toBe("https://github.com");
  expect(privateCardPrimaryLink({
    product: card.product, links: card.links, associatedEvidence: card.associatedAccountEvidence,
  })).toMatchObject({ url: "https://github.com/owner-account", label: "Check out GitHub" });
  expect(JSON.stringify(await t.run(ctx => ctx.db.query("publishedProfiles").collect()))).not.toContain("owner-account");

  await t.run(async ctx => {
    await ctx.db.insert("proofs", {
      propId: owned.propId as Id<"props">, type: "GITHUB_REPO", label: "Cross-owner proof",
      rawEvidenceId: outsider.rawEvidenceId as Id<"rawEvidence">,
    });
  });
  const afterForgery = await owner.query(list, firstPage);
  expect(privateCardPrimaryLink({
    product: afterForgery.page[0].product, links: afterForgery.page[0].links,
    associatedEvidence: afterForgery.page[0].associatedAccountEvidence,
  })?.url).toBe("https://github.com/owner-account");

  await owner.mutation(save, {
    propId: owned.propId, expectedVersion: 0, operationId: "confirm-github",
    status: "ACTIVE", goTo: false, headline: "Private GitHub relationship", note: "Owner statement",
  });
  const state = await owner.query(api.onboarding.getState, { includeClaims: false });
  const reviewCard = state?.cards.find(entry => entry.prop._id === owned.propId);
  if (!reviewCard?.product) throw new Error("GitHub review card unavailable");
  expect(defaultReview({ ...reviewCard, product: reviewCard.product }).linkUrl).toBe("https://github.com");
  const preview = await owner.query(api.onboarding.previewPublication, {
    selections: [{
      propId: owned.propId, expectedRelationshipVersion: 1, publish: true,
      status: "ACTIVE", headline: "Private GitHub relationship", note: "Owner statement",
      primaryLink: { type: "CANONICAL", url: "https://github.com", label: "Check out GitHub" },
      autoRefresh: false,
    }],
  });
  expect(preview.profile.cards[0].primaryLink?.url).toBe("https://github.com");
  expect(JSON.stringify(preview.profile)).not.toContain("owner-account");
  await owner.mutation(api.onboarding.publishSelected, {
    selections: [{
      propId: owned.propId, expectedRelationshipVersion: 1, publish: true,
      status: "ACTIVE", headline: "Private GitHub relationship", note: "Owner statement",
      primaryLink: { type: "CANONICAL", url: "https://github.com", label: "Check out GitHub" },
      autoRefresh: false,
    }],
    expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash,
  });
  const published = await t.run(ctx => ctx.db.query("publishedProfiles").withIndex("by_handle", q => q.eq("handle", "owner")).unique());
  expect(published?.profile.cards[0].primaryLink?.url).toBe("https://github.com");
  expect(JSON.stringify(published?.profile)).not.toContain("owner-account");
  const privateAfterPublish = await owner.query(list, firstPage);
  expect(privateCardPrimaryLink({
    product: privateAfterPublish.page[0].product, links: privateAfterPublish.page[0].links,
    associatedEvidence: privateAfterPublish.page[0].associatedAccountEvidence,
  })?.url).toBe("https://github.com/owner-account");
});

test("missing GitHub account evidence and owner-selected custom links keep their destinations", async () => {
  const { t, owner } = await fixture();
  const missing = await t.run(async ctx => {
    const user = await ctx.db.query("users").withIndex("by_auth_subject", q => q.eq("authSubject", "owner")).unique();
    if (!user) throw new Error("Owner missing");
    const productId = await ctx.db.insert("products", { name: "GitHub", slug: "github", domain: "github.com", description: "Code" });
    const propId = await ctx.db.insert("props", { userId: user._id, productId, visibility: "PRIVATE", status: "ACTIVE", headline: "", note: "" });
    await ctx.db.insert("links", { propId, type: "CANONICAL", url: "https://github.com", label: "Check out GitHub", isPrimary: true });
    return propId;
  });
  const listed = await owner.query(list, firstPage);
  const card = listed.page.find((entry: { prop: { _id: string } }) => entry.prop._id === missing);
  if (!card) throw new Error("Missing-evidence GitHub card unavailable");
  expect(privateCardPrimaryLink({
    product: card.product, links: card.links, associatedEvidence: card.associatedAccountEvidence,
  })?.url).toBe("https://github.com");

  const custom = await owner.mutation(retain, { packet: await packet(7, "custom-account") });
  await t.run(async ctx => {
    const links = await ctx.db.query("links").withIndex("by_prop", q => q.eq("propId", custom.propId as Id<"props">)).collect();
    const primary = links.find(link => link.isPrimary);
    if (!primary) throw new Error("Primary link missing");
    await ctx.db.patch(primary._id, { url: "https://github.com/custom-account/selected-work", label: "Selected work sample" });
  });
  const afterCustom = (await owner.query(list, firstPage)).page.find((entry: { prop: { _id: string } }) => entry.prop._id === custom.propId);
  if (!afterCustom) throw new Error("Custom-link GitHub card unavailable");
  expect(privateCardPrimaryLink({
    product: afterCustom.product, links: afterCustom.links, associatedEvidence: afterCustom.associatedAccountEvidence,
  })).toMatchObject({ url: "https://github.com/custom-account/selected-work", label: "Selected work sample" });
});

test("a connected GitHub account label supplies a private destination without publishing", async () => {
  const { t, owner } = await fixture();
  await t.run(async ctx => {
    const user = await ctx.db.query("users").withIndex("by_auth_subject", q => q.eq("authSubject", "owner")).unique();
    if (!user) throw new Error("Owner missing");
    const productId = await ctx.db.insert("products", { name: "GitHub", slug: "github", domain: "github.com", description: "Code" });
    const propId = await ctx.db.insert("props", { userId: user._id, productId, visibility: "PRIVATE", status: "ACTIVE", headline: "", note: "" });
    await ctx.db.insert("links", { propId, type: "CANONICAL", url: "https://github.com", label: "Check out GitHub", isPrimary: true });
    await ctx.db.insert("connectorAccounts", {
      userId: user._id, provider: "GITHUB", status: "CONNECTED",
      accountLabel: "github.com/connector-account", attributionScope: "PERSONAL",
      connectedAt: "2026-09-18T00:00:00.000Z",
    });
  });
  const card = (await owner.query(list, firstPage)).page[0];
  expect(privateCardPrimaryLink({
    product: card.product, links: card.links, associatedEvidence: card.associatedAccountEvidence,
  })?.url).toBe("https://github.com/connector-account");
  expect(JSON.stringify(await t.run(ctx => ctx.db.query("publishedProfiles").collect()))).not.toContain("connector-account");
});
