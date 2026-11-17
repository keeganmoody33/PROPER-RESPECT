// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { makeFunctionReference, type FunctionReturnType } from "convex/server";
import { expect, test, vi } from "vitest";
import schema from "./schema";
import type { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

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
    return { userId, productId, propId };
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

test("the latest primary link stays available after more than 25 publications", async ({ onTestFinished }) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  onTestFinished(() => { vi.useRealTimers(); });
  const { owner, propId } = await fixture();
  const publish = makeFunctionReference<"mutation">("onboarding:publishSelected");
  await owner.mutation(save, { propId, expectedVersion: 0, operationId: "first", status: "ACTIVE", goTo: false, headline: "", note: "" });
  for (let revision = 1; revision <= 26; revision++) {
    // Keep all 26 revisions while respecting R18's 20-publications/hour limit.
    vi.setSystemTime(new Date(Date.UTC(2026, 8, 29, 12 + Math.floor((revision - 1) / 20))));
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
  const sharing: FunctionReturnType<typeof api.onboarding.sharingCards> = await owner.query(makeFunctionReference<"query">("onboarding:sharingCards"), firstPage);
  expect(sharing.page[0].links.find(link => link.isPrimary)?.url).toBe("https://wisprflow.ai/?revision=26");
  await owner.mutation(publish, await reviewedPublication(owner, { selections: [{
    propId, expectedRelationshipVersion: 1, publish: true, status: "ACTIVE", headline: "", note: "",
    primaryLink: { type: "CANONICAL", url: "https://wisprflow.ai/?revision=1", label: "Published link 1" }, autoRefresh: false,
  }] }));
  const rereadSharing: FunctionReturnType<typeof api.onboarding.sharingCards> = await owner.query(makeFunctionReference<"query">("onboarding:sharingCards"), firstPage);
  const rereadInventory: FunctionReturnType<typeof api.inventory.list> = await owner.query(list, firstPage);
  const exact: FunctionReturnType<typeof api.inventory.detail> = await owner.query(makeFunctionReference<"query">("inventory:detail"), { propId });
  for (const links of [rereadSharing.page[0].links, rereadInventory.page[0].links, exact!.links]) {
    expect(links.length).toBeLessThanOrEqual(25);
    expect(links.find(link => link.isPrimary)?.url).toBe("https://wisprflow.ai/?revision=1");
  }
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

const locator = makeFunctionReference<"query">("inventory:locator");
const detail = makeFunctionReference<"query">("inventory:detail");
const related = makeFunctionReference<"query">("inventory:related");

test("the lightweight owner locator reaches later pages and keeps duplicate relationships distinct", async () => {
  const { t, owner, other, propId, userId } = await fixture();
  const later = await t.run(async ctx => {
    for (let i = 0; i < 30; i++) {
      const productId = await ctx.db.insert("products", { name: `Tool ${i}`, slug: `tool-${i}`, domain: `tool-${i}.example`, description: "" });
      await ctx.db.insert("props", { userId, productId, status: "ACTIVE", visibility: "PRIVATE", headline: "", note: "Private note excluded from locator" });
    }
    const original = (await ctx.db.get(propId))!;
    return ctx.db.insert("props", { userId, productId: original.productId, status: "ARCHIVED", visibility: "PRIVATE", headline: "Later relationship", note: "Private history" });
  });
  let cursor: string | null = null;
  const records = [];
  do {
    const result: FunctionReturnType<typeof api.inventory.locator> = await owner.query(locator, { paginationOpts: { numItems: 100, cursor } });
    expect(result.page.length).toBeLessThanOrEqual(25);
    records.push(...result.page);
    cursor = result.isDone ? null : result.continueCursor;
  } while (cursor);
  expect(records).toHaveLength(32);
  expect(records.filter(record => record.name === "Wispr Flow").map(record => record.propId)).toEqual([propId, later]);
  expect(records.every(record => !("note" in record) && !("activity" in record) && !("evidence" in record))).toBe(true);
  expect((await owner.query(detail, { propId: later })).prop.note).toBe("Private history");
  expect((await other.query(locator, firstPage)).page).toEqual([]);
  expect(await other.query(detail, { propId: later })).toBeNull();
  expect(await owner.query(detail, { propId: "not-a-valid-id" })).toBeNull();
  await expect(t.query(locator, firstPage)).rejects.toThrow();
  await expect(other.query(related, { propId, ...firstPage })).rejects.toThrow("unavailable");
  expect((await owner.query(related, { propId, ...firstPage })).page.map((record: { propId: string }) => record.propId)).toEqual([propId, later]);
});

test("direct relationship reload preserves exact duplicate decisions and the public snapshot", async () => {
  const { t, owner, propId, userId } = await fixture();
  const sibling = await t.run(async ctx => {
    const original = (await ctx.db.get(propId))!;
    return ctx.db.insert("props", { userId, productId: original.productId, status: "ARCHIVED", visibility: "PRIVATE", headline: "Sibling", note: "Do not change" });
  });
  const publicBefore = await t.run(ctx => ctx.db.query("publishedProfiles").collect());
  await owner.mutation(save, { propId, expectedVersion: 0, operationId: "focused-save", status: "ACTIVE", goTo: true, headline: "My everyday tool", note: "Why it matters" });
  const fresh = t.withIdentity({ subject: "owner", tokenIdentifier: "another-session" });
  expect((await fresh.query(detail, { propId })).prop).toMatchObject({ status: "ACTIVE", goTo: true, note: "Why it matters", relationshipVersion: 1 });
  expect((await fresh.query(detail, { propId: sibling })).prop).toMatchObject({ status: "ARCHIVED", note: "Do not change" });
  expect(await t.run(ctx => ctx.db.query("publishedProfiles").collect())).toEqual(publicBefore);
});

test("collection shell omits cards and sharing reads bounded pages without misbinding duplicates", async () => {
  const { t, owner, other, userId, productId, propId } = await fixture();
  await t.run(async ctx => {
    for (let index = 0; index < 31; index++) await ctx.db.insert("props", { userId, productId, visibility: "DRAFT", status: "TESTING", headline: `Record ${index}`, note: "" });
  });
  const shell = await owner.query(makeFunctionReference<"query">("onboarding:getState"), {
    includeCards: false, includeClaims: false, includeLegacyCollections: false, includeAccountEvidence: false,
  });
  expect(shell.cards).toEqual([]);
  const sharing = makeFunctionReference<"query">("onboarding:sharingCards");
  const first = await owner.query(sharing, { paginationOpts: { numItems: 100, cursor: null } });
  expect(first.page).toHaveLength(25);
  expect(first.isDone).toBe(false);
  expect(first.page[0].prop._id).toBe(propId);
  const second = await owner.query(sharing, { paginationOpts: { numItems: 25, cursor: first.continueCursor } });
  expect(second.page).toHaveLength(7);
  expect(second.isDone).toBe(true);
  expect(new Set([...first.page, ...second.page].map(card => card.prop._id)).size).toBe(32);
  expect((await other.query(sharing, firstPage)).page).toEqual([]);
});

test("saving each level writes the level, the status it implies and an event, and leaves go-to as chosen", async () => {
  const { t, owner, propId } = await fixture();
  const expected = [
    ["TRIED_NOT_ADOPTED", "ARCHIVED"], ["STOPPED", "ARCHIVED"], ["PAUSED", "ARCHIVED"], ["OCCASIONAL", "ACTIVE"],
    ["TESTING", "TESTING"], ["WEEKLY", "ACTIVE"], ["DAILY", "ACTIVE"],
  ] as const;
  for (const [index, [level, status]] of expected.entries()) {
    await owner.mutation(save, { propId, expectedVersion: index, operationId: `level-${level}`, level, status, goTo: index % 2 === 0, headline: "", note: "" });
    const prop = await t.run(ctx => ctx.db.get(propId));
    expect({ level: prop?.level, status: prop?.status, goTo: prop?.goTo }).toEqual({ level, status, goTo: index % 2 === 0 });
  }
  const events = await owner.query(history, { propId, paginationOpts: { numItems: 20, cursor: null } });
  expect(events.page.map((event: { after: { level?: string; status: string } }) => [event.after.level, event.after.status]).reverse())
    .toEqual(expected.map(pair => [...pair]));
  expect(events.page[0].before).toMatchObject({ level: "WEEKLY", status: "ACTIVE" });
});

test("a card can be Occasionally and go-to, and saving a level never changes go-to", async () => {
  const { t, owner, propId } = await fixture();
  await owner.mutation(save, { propId, expectedVersion: 0, operationId: "go-to", level: "OCCASIONAL", status: "ACTIVE", goTo: true, headline: "", note: "" });
  expect(await t.run(async ctx => {
    const prop = await ctx.db.get(propId);
    return { level: prop?.level, status: prop?.status, goTo: prop?.goTo };
  })).toEqual({ level: "OCCASIONAL", status: "ACTIVE", goTo: true });
  await owner.mutation(save, { propId, expectedVersion: 1, operationId: "daily", level: "DAILY", status: "ACTIVE", goTo: true, headline: "", note: "" });
  expect(await t.run(async ctx => (await ctx.db.get(propId))?.goTo)).toBe(true);
});

test("a level with a status it does not imply is refused and nothing is saved", async () => {
  const { t, owner, propId } = await fixture();
  await expect(owner.mutation(save, { propId, expectedVersion: 0, operationId: "bad", level: "DAILY", status: "ARCHIVED", goTo: false, headline: "", note: "" }))
    .rejects.toThrow("does not match");
  expect(await t.run(async ctx => {
    const prop = await ctx.db.get(propId);
    return { level: prop?.level, status: prop?.status, version: prop?.relationshipVersion, events: (await ctx.db.query("relationshipEvents").collect()).length };
  })).toEqual({ level: undefined, status: "TESTING", version: undefined, events: 0 });
  await expect(owner.mutation(save, { propId, expectedVersion: 0, operationId: "unknown", level: "RETIRED_LEVEL", status: "ACTIVE", goTo: false, headline: "", note: "" }))
    .rejects.toThrow("Validator error");
});

test("a status-only save after a level clears the level, so the two never disagree", async () => {
  const { t, owner, propId } = await fixture();
  await owner.mutation(save, { propId, expectedVersion: 0, operationId: "daily", level: "DAILY", status: "ACTIVE", goTo: false, headline: "", note: "" });
  await owner.mutation(save, { propId, expectedVersion: 1, operationId: "archive", status: "ARCHIVED", goTo: false, headline: "", note: "" });
  expect(await t.run(async ctx => {
    const prop = await ctx.db.get(propId);
    return { level: prop?.level, status: prop?.status };
  })).toEqual({ level: undefined, status: "ARCHIVED" });
});

const exportRelationships = makeFunctionReference<"query">("inventory:exportRelationships");
const historyPage = { paginationOpts: { numItems: 25, cursor: null } };

async function fixtureWithUses() {
  const setup = await fixture();
  await setup.t.run(ctx => ctx.db.patch(setup.productId, { slug: "clay", name: "Clay", domain: "clay.com" }));
  return setup;
}

test("saving what a product does for the owner stores its listed uses in order, in history and in the owner's export", async () => {
  const { t, owner, propId } = await fixtureWithUses();
  const input = { propId, expectedVersion: 0, operationId: "uses", status: "ACTIVE", goTo: false, headline: "", note: "",
    uses: { picks: ["sync-crm", "enrich-leads", "sync-crm"], other: "  score inbound leads " } };
  expect(await owner.mutation(save, input)).toEqual({ version: 1, duplicate: false });
  expect(await owner.mutation(save, input)).toEqual({ version: 1, duplicate: true });
  const stored = { picks: ["enrich-leads", "sync-crm"], other: "score inbound leads" };
  expect((await t.run(ctx => ctx.db.get(propId)))?.uses).toEqual(stored);
  const events = await owner.query(history, { propId, ...historyPage });
  expect(events.page.map((event: { after: { uses?: unknown } }) => event.after.uses)).toEqual([stored]);
  const exported = await owner.query(exportRelationships, firstPage);
  expect(exported.page[0].uses).toEqual(stored);
  expect(exported.page[0].history[0].after.uses).toEqual(stored);
});

test("a use the product doesn't list is refused with a message and nothing is saved", async () => {
  const { t, owner, propId } = await fixtureWithUses();
  await expect(owner.mutation(save, { propId, expectedVersion: 0, operationId: "unlisted", status: "ACTIVE", goTo: false, headline: "", note: "",
    uses: { picks: ["write-features"] } })).rejects.toThrow("Choose from the listed uses.");
  expect(await t.run(async ctx => {
    const prop = await ctx.db.get(propId);
    return { uses: prop?.uses, version: prop?.relationshipVersion, events: (await ctx.db.query("relationshipEvents").collect()).length };
  })).toEqual({ uses: undefined, version: undefined, events: 0 });
});

test("saving with no uses removes the stored ones and keeps them in history", async () => {
  const { t, owner, propId } = await fixtureWithUses();
  const base = { propId, status: "ACTIVE", goTo: false, headline: "", note: "" };
  await owner.mutation(save, { ...base, expectedVersion: 0, operationId: "set", uses: { picks: ["build-lists"] } });
  await owner.mutation(save, { ...base, expectedVersion: 1, operationId: "blank", uses: { picks: [], other: "  " } });
  expect((await t.run(ctx => ctx.db.get(propId)))?.uses).toBeUndefined();
  await owner.mutation(save, { ...base, expectedVersion: 2, operationId: "set-again", uses: { picks: ["find-contacts"] } });
  await owner.mutation(save, { ...base, expectedVersion: 3, operationId: "omitted" });
  expect((await t.run(ctx => ctx.db.get(propId)))?.uses).toBeUndefined();
  const events = await owner.query(history, { propId, ...historyPage });
  expect(events.page.map((event: { before: { uses?: unknown } }) => event.before.uses))
    .toEqual([{ picks: ["find-contacts"] }, undefined, { picks: ["build-lists"] }, undefined]);
});

test("a privately saved use goes out with its card when the owner publishes that card", async () => {
  const { t, owner, propId } = await fixtureWithUses();
  const publish = makeFunctionReference<"mutation">("onboarding:publishSelected");
  await owner.mutation(save, { propId, expectedVersion: 0, operationId: "uses", status: "ACTIVE", goTo: false, headline: "Approved headline", note: "",
    uses: { picks: ["enrich-leads"], other: "score inbound leads" } });
  const selection = { propId, expectedRelationshipVersion: 1, publish: true, status: "ACTIVE", headline: "Approved headline", note: "", primaryLink: { type: "CANONICAL", url: "https://clay.com", label: "Visit" }, autoRefresh: false };
  await owner.mutation(publish, await reviewedPublication(owner, { selections: [selection] }));
  const cards = (await t.run(ctx => ctx.db.query("publishedProfiles").collect()))[0].profile.cards;
  expect(cards.map(card => [card.product.slug, card.headline, card.uses]))
    .toEqual([["clay", "Approved headline", { picks: ["enrich-leads"], other: "score inbound leads" }]]);
});

test("saving who put the owner on a product stores the checked handle, in history and in the owner's export", async () => {
  const { t, owner, propId } = await fixture();
  const input = { propId, expectedVersion: 0, operationId: "credit", status: "ACTIVE", goTo: false, headline: "", note: "",
    credit: { platform: "X", handle: "https://x.com/jack" } };
  expect(await owner.mutation(save, input)).toEqual({ version: 1, duplicate: false });
  expect(await owner.mutation(save, input)).toEqual({ version: 1, duplicate: true });
  const stored = { platform: "X", handle: "jack" };
  expect((await t.run(ctx => ctx.db.get(propId)))?.credit).toEqual(stored);
  const events = await owner.query(history, { propId, ...historyPage });
  expect(events.page.map((event: { after: { credit?: unknown } }) => event.after.credit)).toEqual([stored]);
  const exported = await owner.query(exportRelationships, firstPage);
  expect(exported.page[0].credit).toEqual(stored);
  expect(exported.page[0].history[0].after.credit).toEqual(stored);
});

test("a credit outside its platform's rule is refused with the rule and nothing is saved", async () => {
  const { t, owner, propId } = await fixture();
  await expect(owner.mutation(save, { propId, expectedVersion: 0, operationId: "bad-credit", status: "ACTIVE", goTo: false, headline: "", note: "",
    credit: { platform: "SUBSTACK", handle: "https://janedoe.substack.com/" } }))
    .rejects.toThrow("That link isn't a profile on Substack. Paste their Substack profile link or just the handle.");
  expect(await t.run(async ctx => {
    const prop = await ctx.db.get(propId);
    return { credit: prop?.credit, version: prop?.relationshipVersion, events: (await ctx.db.query("relationshipEvents").collect()).length };
  })).toEqual({ credit: undefined, version: undefined, events: 0 });
});

test("saving a blank handle removes the stored credit and keeps it in history", async () => {
  const { t, owner, propId } = await fixture();
  const base = { propId, status: "ACTIVE", goTo: false, headline: "", note: "" };
  await owner.mutation(save, { ...base, expectedVersion: 0, operationId: "set", credit: { platform: "OTHER", handle: "a teammate", platformName: "Slack" } });
  await owner.mutation(save, { ...base, expectedVersion: 1, operationId: "blank", credit: { platform: "X", handle: "  " } });
  expect((await t.run(ctx => ctx.db.get(propId)))?.credit).toBeUndefined();
  const events = await owner.query(history, { propId, ...historyPage });
  expect(events.page.map((event: { before: { credit?: unknown } }) => event.before.credit))
    .toEqual([{ platform: "OTHER", handle: "a teammate", platformName: "Slack" }, undefined]);
});

// Never used it (walkthrough, B3): a bare record goes, with nothing kept about it; anything evidence, a measurement or
// the page relies on stays.
const removeNeverUsed = makeFunctionReference<"mutation">("inventory:removeNeverUsed");
const saveSelection = makeFunctionReference<"mutation">("stack:saveSelection");
const REFUSAL = "This tool has evidence or a published card attached, so it stays in your collection.";

async function stackPicks(owner: Awaited<ReturnType<typeof fixture>>["owner"], operationId: string, slugs: string[]) {
  const result = await owner.mutation(saveSelection, { operationId, picks: slugs.map(slug => ({ kind: "directory", slug, status: "ACTIVE", level: "WEEKLY" })) });
  return result.items.map((item: { propId: Id<"props"> }) => item.propId) as Id<"props">[];
}

test("Never used it removes a bare stack pick with its link, history and discovery row, and leaves every other record alone", async () => {
  const { t, owner, propId: discovery } = await fixture();
  const [clay, exa] = await stackPicks(owner, "first-picks", ["clay", "exa"]);
  const others = () => t.run(async ctx => ({ exa: await ctx.db.get(exa), discovery: await ctx.db.get(discovery), published: await ctx.db.query("publishedProfiles").collect() }));
  const before = await others();
  expect(await owner.mutation(removeNeverUsed, { propId: clay })).toEqual({ removed: true });
  expect(await t.run(async ctx => ({
    prop: await ctx.db.get(clay),
    links: await ctx.db.query("links").withIndex("by_prop", q => q.eq("propId", clay)).collect(),
    events: await ctx.db.query("relationshipEvents").withIndex("by_prop", q => q.eq("propId", clay)).collect(),
    drafts: (await ctx.db.query("draftImports").collect()).filter(draft => draft.resultPropId === clay),
  }))).toEqual({ prop: null, links: [], events: [], drafts: [] });
  expect(await others()).toEqual(before);
  expect((await owner.query(list, firstPage)).page.map((row: { product: { slug: string } }) => row.product.slug).sort()).toEqual(["exa", "wisprflow"]);
});

test("removing twice is harmless, and picking the tool again later starts a fresh record", async () => {
  const { t, owner } = await fixture();
  const [clay] = await stackPicks(owner, "first-picks", ["clay"]);
  await owner.mutation(removeNeverUsed, { propId: clay });
  expect(await owner.mutation(removeNeverUsed, { propId: clay })).toEqual({ removed: false });
  const [again] = await stackPicks(owner, "second-picks", ["clay"]);
  expect(again).not.toBe(clay);
  expect(await t.run(ctx => ctx.db.get(again))).toMatchObject({ status: "ACTIVE", level: "WEEKLY", visibility: "PRIVATE" });
});

test("Never used it refuses a record with evidence, activity, a measurement or a published card, and removes nothing", async () => {
  const { t, owner, userId, productId, propId } = await fixture();
  const ids = await t.run(async ctx => {
    const sourceId = await ctx.db.insert("evidenceSources", { userId, type: "GMAIL", connectedAt: "2026-11-01" });
    const rawEvidenceId = await ctx.db.insert("rawEvidence", { userId, evidenceSourceId: sourceId, capturedAt: "2026-11-01", payload: "{}", dedupKey: "mail-1" });
    await ctx.db.insert("proofs", { propId, type: "EMAIL_EVIDENCE", rawEvidenceId });
    const plain = { userId, productId, status: "TESTING" as const, headline: "", note: "" };
    const withActivity = await ctx.db.insert("props", { ...plain, visibility: "DRAFT", activity: { kind: "headlineMetrics", attributionScope: "PERSONAL",
      capturedAt: "2026-11-01", freshness: "FRESH", provenanceLabel: "Synthetic", primary: { label: "Sessions", value: 1 }, supporting: [] } });
    const measured = await ctx.db.insert("props", { ...plain, visibility: "DRAFT" });
    await ctx.db.insert("rawEvidence", { userId, evidenceSourceId: sourceId, capturedAt: "2026-11-01", dedupKey: "measurement-1", measurementPropId: measured });
    const published = await ctx.db.insert("props", { ...plain, visibility: "PUBLIC" });
    const onPage = await ctx.db.insert("props", { ...plain, visibility: "PRIVATE" });
    const page = (await ctx.db.query("publishedProfiles").collect())[0];
    await ctx.db.patch(page._id, { cardPropIds: [onPage] });
    return [propId, withActivity, measured, published, onPage];
  });
  await Promise.all(ids.map(id => expect(owner.mutation(removeNeverUsed, { propId: id })).rejects.toThrow(REFUSAL)));
  expect(await t.run(async ctx => (await Promise.all(ids.map(id => ctx.db.get(id)))).every(Boolean))).toBe(true);
});

test("only the owner can remove a record", async () => {
  const { t, other, propId } = await fixture();
  await expect(t.mutation(removeNeverUsed, { propId })).rejects.toThrow();
  await expect(other.mutation(removeNeverUsed, { propId })).rejects.toThrow("unavailable");
  expect(await t.run(ctx => ctx.db.get(propId))).not.toBeNull();
});
