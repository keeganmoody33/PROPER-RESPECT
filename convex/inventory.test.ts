// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { makeFunctionReference, type FunctionReturnType } from "convex/server";
import { expect, test } from "vitest";
import schema from "./schema";
import type { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const save = makeFunctionReference<"mutation">("inventory:save");
const list = makeFunctionReference<"query">("inventory:list");
const history = makeFunctionReference<"query">("inventory:history");
const evidence = makeFunctionReference<"query">("inventory:evidence");
const selectedActivity = makeFunctionReference<"query">("inventory:selectedActivity");
const firstPage = { paginationOpts: { numItems: 25, cursor: null } };

async function reviewedPublication(owner: Pick<TestConvex<typeof schema>, "query">, args: { selections: unknown[] }) {
  const preview = await owner.query(makeFunctionReference<"query">("onboarding:previewPublication"), args);
  return { ...args, expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash };
}

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { authSubject: "owner", handle: "owner", displayName: "Owner", bio: "" });
    await ctx.db.insert("users", { authSubject: "other", handle: "other", displayName: "Other", bio: "" });
    const productId = await ctx.db.insert("products", { name: "Wispr Flow", slug: "wisprflow", domain: "wisprflow.ai", description: "Dictation" });
    const propId = await ctx.db.insert("props", { userId, productId, visibility: "DRAFT", status: "TESTING", headline: "A discovery", note: "Unreviewed suggestion" });
    await ctx.db.insert("draftImports", { userId, resultPropId: propId, status: "PENDING", suggestedProductSlug: "wisprflow", suggestedProductName: "Wispr Flow", suggestedDomain: "wisprflow.ai", suggestedDescription: "Dictation", suggestedUrl: "https://wisprflow.ai", rawEvidenceIds: [] });
    await ctx.db.insert("publishedProfiles", { handle: "owner", revision: 1, publishedAt: "2026-09-16", profile: { handle: "owner", displayName: "Owner", bio: "", cards: [] } });
    return { userId, propId };
  });
  return { t, ...ids, owner: t.withIdentity({ subject: "owner" }), other: t.withIdentity({ subject: "other" }) };
}

test("private confirmation, explicit go-to and context survive a new authenticated session without publishing", async () => {
  const { t, owner, propId } = await fixture();
  const before = await t.run(ctx => ctx.db.query("publishedProfiles").collect());
  const input = { propId, expectedVersion: 0, operationId: "first-save", status: "ACTIVE", goTo: true, headline: "How I work", note: "Essential even when I use it rarely.", supportingUrl: "https://example.com/work" };
  expect(await owner.mutation(save, input)).toMatchObject({ version: 1, duplicate: false });
  expect(await owner.mutation(save, input)).toMatchObject({ version: 1, duplicate: true });
  expect(await owner.mutation(save, { ...input, clearActivity: false })).toMatchObject({ version: 1, duplicate: true });
  const freshSession = t.withIdentity({ subject: "owner", tokenIdentifier: "new-session" });
  const result = await freshSession.query(list, firstPage);
  expect(result.page[0].prop).toMatchObject({ visibility: "PRIVATE", status: "ACTIVE", goTo: true, relationshipVersion: 1, note: input.note });
  expect(result.page[0].prop.startedAt).toBeUndefined();
  expect(result.page[0].prop.activity).toBeUndefined();
  expect((await freshSession.query(history, { propId, paginationOpts: { numItems: 20, cursor: null } })).page).toHaveLength(1);
  expect(await t.run(ctx => ctx.db.query("publishedProfiles").collect())).toEqual(before);
  expect((await t.run(ctx => ctx.db.query("draftImports").collect()))[0].status).toBe("APPROVED");
});

test("testing, archive and resume preserve earlier decisions and reject stale or conflicting retries", async () => {
  const { owner, propId } = await fixture();
  const base = { propId, headline: "", note: "", goTo: false };
  await owner.mutation(save, { ...base, status: "TESTING", expectedVersion: 0, operationId: "test" });
  await owner.mutation(save, { ...base, status: "ACTIVE", goTo: true, expectedVersion: 1, operationId: "adopt" });
  await owner.mutation(save, { ...base, status: "ARCHIVED", goTo: true, expectedVersion: 2, operationId: "archive" });
  await owner.mutation(save, { ...base, status: "ACTIVE", goTo: true, expectedVersion: 3, operationId: "resume" });
  await expect(owner.mutation(save, { ...base, status: "ARCHIVED", expectedVersion: 2, operationId: "stale" })).rejects.toThrow("changed");
  await expect(owner.mutation(save, { ...base, status: "ARCHIVED", expectedVersion: 3, operationId: "resume" })).rejects.toThrow("different");
  const rows = await owner.query(history, { propId, paginationOpts: { numItems: 20, cursor: null } });
  expect(rows.page.map((event: { after: { status: string } }) => event.after.status)).toEqual(["ACTIVE", "ARCHIVED", "ACTIVE", "TESTING"]);
  expect(rows.page[0].before.status).toBe("ARCHIVED");
  expect(rows.page[0].basis).toBe("OWNER_ASSERTED");
  expect(rows.page[3].before.confirmed).toBe(false);
});

test("anonymous and other owners cannot read, save or inspect relationship history", async () => {
  const { t, owner, other, propId } = await fixture();
  const input = { propId, expectedVersion: 0, operationId: "save", status: "ACTIVE", goTo: false, headline: "", note: "" };
  await expect(t.mutation(save, input)).rejects.toThrow();
  await expect(other.mutation(save, input)).rejects.toThrow("unavailable");
  await expect(t.query(list, firstPage)).rejects.toThrow();
  expect((await other.query(list, firstPage)).page).toEqual([]);
  await expect(t.query(evidence, { propId, ...firstPage })).rejects.toThrow();
  await expect(other.query(evidence, { propId, ...firstPage })).rejects.toThrow("unavailable");
  await expect(t.query(selectedActivity, { propId })).rejects.toThrow();
  await expect(other.query(selectedActivity, { propId })).rejects.toThrow("unavailable");
  await owner.mutation(save, input);
  await expect(other.query(history, { propId, paginationOpts: { numItems: 20, cursor: null } })).rejects.toThrow("unavailable");
  await expect(owner.mutation(save, { ...input, expectedVersion: 1, operationId: "url", supportingUrl: "javascript:alert(1)" })).rejects.toThrow();
  await expect(owner.mutation(save, { ...input, expectedVersion: 1, operationId: "date", startedAt: "2026-02-30" })).rejects.toThrow();
});

test("publishing other selected cards cannot erase a privately saved relationship", async () => {
  const { t, owner, propId } = await fixture();
  await owner.mutation(save, { propId, expectedVersion: 0, operationId: "save", status: "ACTIVE", goTo: true, headline: "My saved context", note: "Private explanation" });
  const before = await t.run(ctx => ctx.db.get(propId));
  await owner.mutation(makeFunctionReference<"mutation">("onboarding:publishSelected"), await reviewedPublication(owner, { selections: [{
    propId, publish: false, status: "TESTING", headline: "Stale edit", note: "Stale note",
    primaryLink: { type: "CANONICAL", url: "https://wisprflow.ai", label: "Visit" }, autoRefresh: false,
  }] }));
  expect(await t.run(ctx => ctx.db.get(propId))).toEqual(before);
  expect((await t.run(ctx => ctx.db.query("draftImports").collect()))[0].status).toBe("APPROVED");
});

test("private edits to a published card stay private when another publication omits it", async () => {
  const { t, owner, propId } = await fixture();
  const publish = makeFunctionReference<"mutation">("onboarding:publishSelected");
  await owner.mutation(save, { propId, expectedVersion: 0, operationId: "first", status: "ACTIVE", goTo: false, headline: "Approved headline", note: "Approved public note" });
  const selection = { propId, expectedRelationshipVersion: 1, publish: true, status: "ACTIVE", headline: "Approved headline", note: "Approved public note", primaryLink: { type: "CANONICAL", url: "https://wisprflow.ai", label: "Visit" }, autoRefresh: false };
  const approval = await reviewedPublication(owner, { selections: [selection] });
  await owner.mutation(publish, approval);
  const before = (await t.run(ctx => ctx.db.query("publishedProfiles").collect()))[0].profile.cards;
  await owner.mutation(save, { propId, expectedVersion: 1, operationId: "private-edit", status: "ARCHIVED", goTo: true, headline: "Private headline", note: "Private note" });
  await expect(owner.mutation(publish, approval)).rejects.toThrow("changed");
  await owner.mutation(publish, await reviewedPublication(owner, { selections: [] }));
  expect((await t.run(ctx => ctx.db.query("publishedProfiles").collect()))[0].profile.cards).toEqual(before);
  expect(await t.run(ctx => ctx.db.get(propId))).toMatchObject({ note: "Private note", status: "ARCHIVED", relationshipVersion: 2 });
});

test("the latest primary link stays available after more than 25 publications", async () => {
  const { owner, propId } = await fixture();
  const publish = makeFunctionReference<"mutation">("onboarding:publishSelected");
  await owner.mutation(save, { propId, expectedVersion: 0, operationId: "first", status: "ACTIVE", goTo: false, headline: "", note: "" });
  for (let revision = 1; revision <= 26; revision++) {
    await owner.mutation(publish, await reviewedPublication(owner, { selections: [{
      propId, expectedRelationshipVersion: 1, publish: true, status: "ACTIVE", headline: "", note: "",
      primaryLink: { type: "CANONICAL", url: `https://wisprflow.ai/?revision=${revision}`, label: `Published link ${revision}` }, autoRefresh: false,
    }] }));
  }
  const inventory: FunctionReturnType<typeof api.inventory.list> = await owner.query(list, firstPage);
  const card = inventory.page[0];
  expect(card.links).toHaveLength(25);
  expect(card.links[0]).toMatchObject({ url: "https://wisprflow.ai/?revision=26", label: "Published link 26", isPrimary: true });
  expect(card.links.find(link => link.isPrimary)?.url).toBe("https://wisprflow.ai/?revision=26");
});

test("clearing optional context removes current fields and preserves their earlier values in history", async () => {
  const { t, owner, propId } = await fixture();
  const base = { propId, status: "ACTIVE", goTo: false, headline: "", note: "" };
  await owner.mutation(save, { ...base, expectedVersion: 0, operationId: "dated", startedAt: "2020-01-01", supportingUrl: "https://example.com/work" });
  await owner.mutation(save, { ...base, expectedVersion: 1, operationId: "clear" });
  const prop = await t.run(ctx => ctx.db.get(propId));
  expect(prop?.startedAt).toBeUndefined();
  expect(prop?.startedAtSource).toBeUndefined();
  expect(prop?.supportingUrl).toBeUndefined();
  const events = await owner.query(history, { propId, paginationOpts: { numItems: 20, cursor: null } });
  expect(events.page[0].before).toMatchObject({ startedAt: "2020-01-01", supportingUrl: "https://example.com/work" });
  expect(events.page[0].after.startedAt).toBeUndefined();
});

test("inventory reads stay bounded with long histories and many proofs, while all pages remain reachable", async () => {
  const t = convexTest({ schema, modules, transactionLimits: { documentsRead: 200 } });
  const propId = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { authSubject: "owner", handle: "owner", displayName: "Owner", bio: "" });
    const productId = await ctx.db.insert("products", { name: "Synthetic product", slug: "synthetic", domain: "example.com", description: "Synthetic bounded-query fixture" });
    const sourceId = await ctx.db.insert("evidenceSources", { userId, type: "MANUAL", connectedAt: "2026-09-18T12:00:00.000Z" });
    const propIds = [];
    for (let card = 0; card < 26; card++) {
      const id = await ctx.db.insert("props", { userId, productId, visibility: "PRIVATE", status: "ACTIVE", headline: "", note: "" });
      propIds.push(id);
      for (let version = 1; version <= 105; version++) {
        const before = { status: version === 105 ? "TESTING" as const : "ARCHIVED" as const, confirmed: true, goTo: false, headline: "", note: "" };
        await ctx.db.insert("relationshipEvents", { userId, propId: id, operationId: `synthetic-${version}`, requestJson: "{}", version, recordedAt: "2026-09-18T12:00:00.000Z", basis: "OWNER_ASSERTED", before, after: { ...before, status: "ACTIVE" } });
      }
    }
    for (let index = 0; index < 35; index++) {
      const rawEvidenceId = await ctx.db.insert("rawEvidence", { userId, evidenceSourceId: sourceId, capturedAt: "2026-09-18T12:00:00.000Z", dedupKey: `synthetic-${index}`, payload: `Synthetic retained source ${index}` });
      await ctx.db.insert("proofs", { propId: propIds[0], type: "NOTE", rawEvidenceId, label: "Synthetic proof" });
    }
    return propIds[0];
  });
  const owner = t.withIdentity({ subject: "owner" });
  const first = await owner.query(list, { paginationOpts: { numItems: 500, cursor: null } });
  expect(first.page).toHaveLength(25);
  expect(first.isDone).toBe(false);
  expect(first.page.every((card: { previousStatuses: string[]; evidence?: unknown }) => card.previousStatuses.join() === "TESTING" && !("evidence" in card))).toBe(true);
  const next = await owner.query(list, { paginationOpts: { numItems: 25, cursor: first.continueCursor } });
  expect(next.page).toHaveLength(1);
  expect(next.isDone).toBe(true);
  expect(new Set([...first.page, ...next.page].map(card => card.prop._id)).size).toBe(26);

  const evidenceIds: string[] = [];
  let cursor: string | null = null;
  for (;;) {
    const result: FunctionReturnType<typeof api.inventory.evidence> = await owner.query(evidence, { propId, paginationOpts: { numItems: 500, cursor } });
    expect(result.page.length).toBeLessThanOrEqual(10);
    evidenceIds.push(...result.page.map((entry: { id: string }) => entry.id));
    if (result.isDone) break;
    expect(result.continueCursor).not.toBe(cursor);
    cursor = result.continueCursor;
  }
  expect(evidenceIds).toHaveLength(35);
  expect(new Set(evidenceIds).size).toBe(35);

  const versions: number[] = [];
  cursor = null;
  for (;;) {
    const result: FunctionReturnType<typeof api.inventory.history> = await owner.query(history, { propId, paginationOpts: { numItems: 500, cursor } });
    expect(result.page.length).toBeLessThanOrEqual(25);
    versions.push(...result.page.map((event: { version: number }) => event.version));
    if (result.isDone) break;
    cursor = result.continueCursor;
  }
  expect(versions).toEqual(Array.from({ length: 105 }, (_, index) => 105 - index));
});
