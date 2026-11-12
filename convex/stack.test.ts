// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

type Status = "ACTIVE" | "TESTING" | "ARCHIVED";
type Level = "TRIED_NOT_ADOPTED" | "STOPPED" | "PAUSED" | "OCCASIONAL" | "TESTING" | "WEEKLY" | "DAILY";
type Pick =
  | { kind: "directory"; slug: string; status: Status; level?: Level }
  | { kind: "typed"; name: string; website?: string; status: Status; level?: Level };
type Outcome = "CREATED" | "CONFIRMED_DRAFT" | "UNCHANGED";
type SaveResult = {
  items: { propId: Id<"props">; productName: string; outcome: Outcome }[];
  created: number;
  confirmed: number;
  unchanged: number;
};
const saveSelection = makeFunctionReference<"mutation", { operationId: string; picks: Pick[] }, SaveResult>("stack:saveSelection");
const add = api.onboarding.addManualProduct;

const NOW = new Date("2026-11-12T15:20:00.000Z");
const WINDOW_START = Date.UTC(2026, 10, 12, 15);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

async function fixture() {
  const t = convexTest(schema, modules);
  await t.run(async ctx => {
    for (const subject of ["owner", "other"]) await ctx.db.insert("users", {
      authSubject: subject, handle: subject, displayName: subject, bio: "",
    });
  });
  return { t, owner: t.withIdentity({ subject: "owner" }), other: t.withIdentity({ subject: "other" }) };
}

const dir = (slug: string, status: Status = "ACTIVE"): Pick => ({ kind: "directory", slug, status });
const typed = (name: string, status: Status = "ACTIVE", website?: string): Pick => ({ kind: "typed", name, status, ...(website ? { website } : {}) });

async function everyRow(t: Awaited<ReturnType<typeof fixture>>["t"]) {
  return t.run(async ctx => ({
    props: await ctx.db.query("props").collect(),
    products: await ctx.db.query("products").collect(),
    links: await ctx.db.query("links").collect(),
    events: await ctx.db.query("relationshipEvents").collect(),
    drafts: await ctx.db.query("draftImports").collect(),
    receipts: await ctx.db.query("manualProductIntakes").collect(),
    rateLimits: await ctx.db.query("rateLimits").collect(),
    brandJobs: await ctx.db.query("productBrandJobs").collect(),
  }));
}

test("a mixed batch saves directory and typed picks as private confirmed relationships", async () => {
  const { t, owner } = await fixture();
  const result = await owner.mutation(saveSelection, {
    operationId: "first-save",
    picks: [dir("salesforce", "ACTIVE"), dir("github", "TESTING"), typed("My notebook", "ARCHIVED", "notebook.example.com")],
  });
  expect(result).toEqual({
    items: [
      { propId: expect.any(String), productName: "Salesforce", outcome: "CREATED" },
      { propId: expect.any(String), productName: "GitHub", outcome: "CREATED" },
      { propId: expect.any(String), productName: "My notebook", outcome: "CREATED" },
    ],
    created: 3, confirmed: 0, unchanged: 0,
  });
  const [salesforce, github, notebook] = result.items.map(item => item.propId);
  await t.run(async ctx => {
    const owner = (await ctx.db.query("users").withIndex("by_auth_subject", q => q.eq("authSubject", "owner")).unique())!;
    const product = async (propId: Id<"props">) => ctx.db.get((await ctx.db.get(propId))!.productId);
    expect(await product(salesforce)).toMatchObject({ slug: "salesforce", name: "Salesforce", domain: "salesforce.com", description: "CRM and customer platform." });
    expect(await product(github)).toMatchObject({ slug: "github", name: "GitHub", domain: "github.com" });
    const typedProduct = (await product(notebook))!;
    expect(typedProduct).toMatchObject({ name: "My notebook", domain: "notebook.example.com", description: "" });
    expect(typedProduct.slug).toMatch(/^manual-my-noteb-[0-9a-f]{22}$/);
    for (const [propId, status] of [[salesforce, "ACTIVE"], [github, "TESTING"], [notebook, "ARCHIVED"]] as const) {
      expect(await ctx.db.get(propId)).toMatchObject({
        userId: owner._id, status, visibility: "PRIVATE", relationshipVersion: 1, confirmedAt: NOW.toISOString(),
        goTo: false, headline: "", note: "", ownerEntered: true,
      });
    }
    expect((await ctx.db.query("links").collect()).map(link => [link.propId, link.url, link.type, link.isPrimary])).toEqual([
      [salesforce, "https://salesforce.com", "CANONICAL", true],
      [github, "https://github.com", "CANONICAL", true],
      [notebook, "https://notebook.example.com/", "CANONICAL", true],
    ]);
    expect((await ctx.db.query("relationshipEvents").collect()).map(event => [event.propId, event.version, event.before.confirmed, event.after])).toEqual([
      [salesforce, 1, false, { status: "ACTIVE", goTo: false, headline: "", note: "", confirmed: true }],
      [github, 1, false, { status: "TESTING", goTo: false, headline: "", note: "", confirmed: true }],
      [notebook, 1, false, { status: "ARCHIVED", goTo: false, headline: "", note: "", confirmed: true }],
    ]);
    expect((await ctx.db.query("draftImports").collect()).map(draft => [draft.status, draft.resultPropId, draft.suggestedUrl])).toEqual([
      ["APPROVED", salesforce, "https://salesforce.com"],
      ["APPROVED", github, "https://github.com"],
      ["APPROVED", notebook, "https://notebook.example.com/"],
    ]);
    expect((await ctx.db.query("manualProductIntakes").collect()).map(receipt => [receipt.operationId, receipt.propId])).toEqual([
      ["stack-batch:first-save:salesforce", salesforce],
      ["stack-batch:first-save:github", github],
      [`stack-batch:first-save:${typedProduct.slug}`, notebook],
    ]);
    expect(await ctx.db.query("rateLimits").collect()).toMatchObject([{ userId: owner._id, operation: "saveStack", windowStart: WINDOW_START, count: 3 }]);
    expect(await ctx.db.get(owner._id)).toMatchObject({ onboardingStatus: "REVIEW" });
    expect(await ctx.db.query("productBrandJobs").collect()).toMatchObject([{ canonicalDomain: "github.com", status: "PENDING" }]);
  });
});

test("saving never publishes a card or writes a published profile", async () => {
  const { t, owner } = await fixture();
  await owner.mutation(add, { name: "Notion", operationId: "draft" });
  await owner.mutation(saveSelection, { operationId: "save", picks: [dir("notion"), dir("hubspot"), typed("Studio tool")] });
  await t.run(async ctx => {
    expect((await ctx.db.query("props").collect()).map(prop => prop.visibility)).toEqual(["PRIVATE", "PRIVATE", "PRIVATE"]);
    expect(await ctx.db.query("publishedProfiles").collect()).toEqual([]);
  });
});

test("two owners picking the same directory product share one product row", async () => {
  const { t, owner, other } = await fixture();
  const mine = await owner.mutation(saveSelection, { operationId: "same", picks: [dir("salesforce")] });
  const theirs = await other.mutation(saveSelection, { operationId: "same", picks: [dir("salesforce", "TESTING")] });
  expect(mine.items[0]!.outcome).toBe("CREATED");
  expect(theirs.items[0]!.outcome).toBe("CREATED");
  expect(theirs.items[0]!.propId).not.toBe(mine.items[0]!.propId);
  await t.run(async ctx => {
    const products = await ctx.db.query("products").collect();
    expect(products.map(product => product.slug)).toEqual(["salesforce"]);
    const props = await ctx.db.query("props").collect();
    expect(props.map(prop => [prop.productId, prop.status])).toEqual([[products[0]!._id, "ACTIVE"], [products[0]!._id, "TESTING"]]);
    expect(new Set(props.map(prop => prop.userId)).size).toBe(2);
  });
});

test("a pick of an unconfirmed draft confirms it the way a private save does", async () => {
  const { t, owner } = await fixture();
  const draft = await owner.mutation(add, { name: "GitHub", operationId: "draft", description: "Found in my mail" });
  const result = await owner.mutation(saveSelection, { operationId: "confirm", picks: [dir("github", "ACTIVE")] });
  expect(result).toEqual({ items: [{ propId: draft, productName: "GitHub", outcome: "CONFIRMED_DRAFT" }], created: 0, confirmed: 1, unchanged: 0 });
  await t.run(async ctx => {
    expect(await ctx.db.get(draft)).toMatchObject({
      status: "ACTIVE", visibility: "PRIVATE", relationshipVersion: 1, confirmedAt: NOW.toISOString(), note: "Found in my mail", headline: "",
    });
    const events = await ctx.db.query("relationshipEvents").collect();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      propId: draft, operationId: "stack-batch:confirm:github", version: 1, basis: "OWNER_ASSERTED", recordedAt: NOW.toISOString(),
      before: { status: "TESTING", confirmed: false, goTo: false, headline: "", note: "Found in my mail" },
      after: { status: "ACTIVE", confirmed: true, goTo: false, headline: "", note: "Found in my mail" },
    });
    expect((await ctx.db.query("draftImports").collect()).map(row => [row.status, row.resultPropId])).toEqual([["APPROVED", draft]]);
    expect(await ctx.db.query("props").collect()).toHaveLength(1);
    expect((await ctx.db.query("rateLimits").collect()).map(row => row.operation)).toEqual(["addManualProduct"]);
  });
});

test("a pick of an already confirmed relationship changes nothing", async () => {
  const { t, owner } = await fixture();
  const saved = await owner.mutation(add, { name: "GitHub", operationId: "saved", status: "ACTIVE", description: "Daily" });
  const before = await everyRow(t);
  const result = await owner.mutation(saveSelection, { operationId: "again", picks: [dir("github", "ARCHIVED")] });
  expect(result).toEqual({ items: [{ propId: saved, productName: "GitHub", outcome: "UNCHANGED" }], created: 0, confirmed: 0, unchanged: 1 });
  const after = await everyRow(t);
  expect({ ...after, receipts: [] }).toEqual({ ...before, receipts: [] });
  expect(after.receipts.map(receipt => receipt.operationId)).toEqual(["saved", "stack-batch:again:github"]);
});

test("a double submit returns the first result and writes nothing new", async () => {
  const { t, owner } = await fixture();
  await owner.mutation(add, { name: "Notion", operationId: "draft" });
  const args = { operationId: "retry", picks: [dir("notion", "TESTING"), dir("salesforce"), typed("Studio tool", "ARCHIVED")] };
  const first = await owner.mutation(saveSelection, args);
  expect(first.items.map(item => item.outcome)).toEqual(["CONFIRMED_DRAFT", "CREATED", "CREATED"]);
  const before = await everyRow(t);
  expect(await owner.mutation(saveSelection, args)).toEqual(first);
  expect(await everyRow(t)).toEqual(before);
});

test("an operation reused with different picks is refused", async () => {
  const { t, owner } = await fixture();
  await owner.mutation(saveSelection, { operationId: "used", picks: [dir("salesforce"), dir("hubspot")] });
  const before = await everyRow(t);
  for (const picks of [
    [dir("figma")],
    [dir("salesforce")],
    [dir("salesforce"), dir("hubspot"), dir("figma")],
    [dir("salesforce", "TESTING"), dir("hubspot")],
    [dir("hubspot"), dir("salesforce")],
  ]) {
    await expect(owner.mutation(saveSelection, { operationId: "used", picks })).rejects.toThrow("This save was already used with different picks.");
  }
  expect(await everyRow(t)).toEqual(before);
});

test("more than 100 picks, no picks, or a malformed operation are refused before anything is written", async () => {
  const { t, owner } = await fixture();
  const picks = Array.from({ length: 101 }, (_, index) => typed(`Tool ${index}`));
  await expect(owner.mutation(saveSelection, { operationId: "big", picks })).rejects.toThrow("Save at most 100 products at a time.");
  await expect(owner.mutation(saveSelection, { operationId: "empty", picks: [] })).rejects.toThrow("Pick at least one product to save.");
  for (const operationId of [" ", "a:b", "x".repeat(129)]) {
    await expect(owner.mutation(saveSelection, { operationId, picks: [dir("salesforce")] })).rejects.toThrow("Invalid save operation.");
  }
  const rows = await everyRow(t);
  expect(Object.values(rows).every(table => table.length === 0)).toBe(true);
});

test("a product picked twice in one request is refused", async () => {
  const { t, owner } = await fixture();
  await expect(owner.mutation(saveSelection, { operationId: "twice", picks: [dir("salesforce"), dir("salesforce", "TESTING")] }))
    .rejects.toThrow("Salesforce is picked twice. Keep one.");
  await expect(owner.mutation(saveSelection, { operationId: "twice", picks: [dir("github"), typed("GitHub")] }))
    .rejects.toThrow("GitHub is picked twice. Keep one.");
  await expect(owner.mutation(saveSelection, { operationId: "twice", picks: [typed("Studio", "ACTIVE", "studio.example"), typed("studio", "TESTING", "https://studio.example/")] }))
    .rejects.toThrow("Studio is picked twice. Keep one.");
  const rows = await everyRow(t);
  expect(Object.values(rows).every(table => table.length === 0)).toBe(true);
});

test("typed picks with one name are one product per website domain, so equivalent spellings are picked twice", async () => {
  const { t, owner } = await fixture();
  await expect(owner.mutation(saveSelection, { operationId: "respelled", picks: [typed("Portal", "ACTIVE", "https://www.payroll.example/"), typed("portal", "TESTING", "payroll.example")] }))
    .rejects.toThrow("Portal is picked twice. Keep one.");
  await expect(owner.mutation(saveSelection, { operationId: "bare", picks: [typed("Portal"), typed("Portal", "TESTING")] }))
    .rejects.toThrow("Portal is picked twice. Keep one.");
  expect(Object.values(await everyRow(t)).every(table => table.length === 0)).toBe(true);

  const saved = await owner.mutation(saveSelection, { operationId: "two-portals", picks: [typed("Portal", "ACTIVE", "payroll.example"), typed("Portal", "TESTING", "expenses.example")] });
  expect(saved).toEqual({
    items: [
      { propId: expect.any(String), productName: "Portal", outcome: "CREATED" },
      { propId: expect.any(String), productName: "Portal", outcome: "CREATED" },
    ],
    created: saved.items.length, confirmed: 0, unchanged: 0,
  });
  const rows = await everyRow(t);
  expect(rows.products.map(product => product.domain)).toEqual(["payroll.example", "expenses.example"]);
  expect(rows.links.map(link => link.url)).toEqual(["https://payroll.example/", "https://expenses.example/"]);
});

test("a typed directory-only name with another website saves as the owner's product with that link", async () => {
  const { t, owner } = await fixture();
  await owner.mutation(saveSelection, { operationId: "own-slack", picks: [typed("Slack", "ACTIVE", "https://other.example")] });
  const rows = await everyRow(t);
  expect(rows.products.map(({ name, domain }) => ({ name, domain }))).toEqual([{ name: "Slack", domain: "other.example" }]);
  expect(rows.products[0]?.slug.startsWith("manual-slack-")).toBe(true);
  expect(rows.links.map(link => link.url)).toEqual(["https://other.example/"]);
});

test("an unknown slug or an unsafe website fails the whole batch", async () => {
  const { t, owner } = await fixture();
  await expect(owner.mutation(saveSelection, { operationId: "unknown", picks: [dir("salesforce"), typed("Studio tool"), dir("not-in-the-directory")] }))
    .rejects.toThrow("not-in-the-directory is not in the directory. Search for it again.");
  for (const website of ["javascript:alert(1)", "data:text/html,x", "ftp://example.com", "https://user:pass@example.com"]) {
    await expect(owner.mutation(saveSelection, { operationId: "unsafe", picks: [dir("salesforce"), typed("Unsafe tool", "ACTIVE", website)] })).rejects.toThrow();
  }
  const rows = await everyRow(t);
  expect(Object.values(rows).every(table => table.length === 0)).toBe(true);
  const saved = await owner.mutation(saveSelection, { operationId: "safe", picks: [typed("Safe tool", "ACTIVE", "https://safe.example")] });
  expect(saved.created).toBe(1);
  expect(await t.run(ctx => ctx.db.query("links").collect())).toMatchObject([{ url: "https://safe.example/" }]);
});

test("the hourly allowance counts created relationships and refuses a batch that would exceed it", async () => {
  const { t, owner } = await fixture();
  const userId = await t.run(async ctx => {
    const user = (await ctx.db.query("users").withIndex("by_auth_subject", q => q.eq("authSubject", "owner")).unique())!;
    await ctx.db.insert("rateLimits", { userId: user._id, operation: "saveStack", windowStart: WINDOW_START, count: 140 });
    return user._id;
  });
  const eleven = Array.from({ length: 11 }, (_, index) => typed(`Tool ${index}`));
  await expect(owner.mutation(saveSelection, { operationId: "over", picks: eleven })).rejects.toThrow("Too many saved products. Try again in 40 minutes.");
  const refused = await everyRow(t);
  expect([refused.props, refused.products, refused.receipts]).toEqual([[], [], []]);
  expect(refused.rateLimits).toMatchObject([{ userId, operation: "saveStack", count: 140 }]);

  const ten = await owner.mutation(saveSelection, { operationId: "fits", picks: eleven.slice(0, 10) });
  expect(ten.created).toBe(10);
  const unchanged = await owner.mutation(saveSelection, { operationId: "nothing-new", picks: eleven.slice(0, 10) });
  expect([unchanged.created, unchanged.unchanged]).toEqual([0, 10]);
  expect(await owner.mutation(saveSelection, { operationId: "fits", picks: eleven.slice(0, 10) })).toEqual(ten);
  expect(await t.run(ctx => ctx.db.query("rateLimits").collect())).toMatchObject([{ operation: "saveStack", count: 150 }]);
  await expect(owner.mutation(saveSelection, { operationId: "one-more", picks: [typed("Tool 11")] })).rejects.toThrow("Too many saved products.");
  await expect(owner.mutation(add, { name: "Single add", operationId: "single" })).resolves.toEqual(expect.any(String));
});

test("a listed directory pick schedules no brand or source work", async () => {
  const { t, owner } = await fixture();
  await owner.mutation(saveSelection, { operationId: "listed", picks: [dir("salesforce"), dir("hubspot", "TESTING")] });
  await t.run(async ctx => {
    expect(await ctx.db.query("productBrandJobs").collect()).toEqual([]);
    expect(await ctx.db.query("productSources").collect()).toEqual([]);
    expect(await ctx.db.system.query("_scheduled_functions").collect()).toEqual([]);
  });
});

test("another owner's save neither sees nor changes the first owner's relationships", async () => {
  const { t, owner, other } = await fixture();
  const draft = await owner.mutation(add, { name: "GitHub", operationId: "draft" });
  const mine = await owner.mutation(saveSelection, { operationId: "shared-id", picks: [dir("salesforce")] });
  const before = await t.run(async ctx => ({ draft: await ctx.db.get(draft), saved: await ctx.db.get(mine.items[0]!.propId) }));
  const theirs = await other.mutation(saveSelection, { operationId: "shared-id", picks: [dir("salesforce", "ARCHIVED"), dir("github", "ACTIVE")] });
  expect(theirs.items.map(item => item.outcome)).toEqual(["CREATED", "CREATED"]);
  expect(theirs.items.map(item => item.propId)).not.toContain(draft);
  expect(theirs.items.map(item => item.propId)).not.toContain(mine.items[0]!.propId);
  expect(await t.run(async ctx => ({ draft: await ctx.db.get(draft), saved: await ctx.db.get(mine.items[0]!.propId) }))).toEqual(before);
  const listed = await other.query(api.inventory.list, { paginationOpts: { numItems: 25, cursor: null } });
  expect(listed.page.map(item => item.prop._id).sort()).toEqual(theirs.items.map(item => item.propId).sort());
});

test("an unauthenticated caller saves nothing", async () => {
  const { t } = await fixture();
  await expect(t.mutation(saveSelection, { operationId: "anon", picks: [dir("salesforce")] })).rejects.toThrow("Authentication required");
  expect(await t.run(ctx => ctx.db.query("props").collect())).toEqual([]);
});

test("a single add whose id looks like a batch item does not block a later batch", async () => {
  const { t, owner } = await fixture();
  const single = await owner.mutation(add, { name: "GitHub", operationId: "save:github" });
  const batch = await owner.mutation(saveSelection, { operationId: "save", picks: [dir("github", "TESTING")] });
  expect(batch).toEqual({ items: [{ propId: single, productName: "GitHub", outcome: "CONFIRMED_DRAFT" }], created: 0, confirmed: 1, unchanged: 0 });
  expect(await owner.mutation(saveSelection, { operationId: "save", picks: [dir("github", "TESTING")] })).toEqual(batch);
  expect(await owner.mutation(add, { name: "GitHub", operationId: "save:github" })).toBe(single);
  const rows = await everyRow(t);
  expect(rows.receipts.map(receipt => [receipt.operationId, receipt.propId])).toEqual([
    ["save:github", single],
    ["stack-batch:save:github", single],
  ]);
  expect(rows.props).toMatchObject([{ _id: single, status: "TESTING", visibility: "PRIVATE", relationshipVersion: 1 }]);
});

test("a batch item receipt does not block a later single add with the same-looking id", async () => {
  const { t, owner } = await fixture();
  const batch = await owner.mutation(saveSelection, { operationId: "save", picks: [dir("github", "ACTIVE")] });
  const propId = batch.items[0]!.propId;
  expect(await owner.mutation(add, { name: "GitHub", operationId: "save:github" })).toBe(propId);
  expect(await owner.mutation(saveSelection, { operationId: "save", picks: [dir("github", "ACTIVE")] })).toEqual(batch);
  const rows = await everyRow(t);
  expect(rows.receipts.map(receipt => [receipt.operationId, receipt.propId])).toEqual([
    ["stack-batch:save:github", propId],
    ["save:github", propId],
  ]);
  expect(rows.props).toMatchObject([{ _id: propId, status: "ACTIVE", visibility: "PRIVATE", relationshipVersion: 1 }]);
});

test("a single add cannot write into the batch receipt key space", async () => {
  const { t, owner } = await fixture();
  await expect(owner.mutation(add, { name: "GitHub", operationId: "stack-batch:save:github" })).rejects.toThrow("Invalid add-product operation.");
  await expect(owner.mutation(add, { name: "GitHub", operationId: "stack-batch:" })).rejects.toThrow("Invalid add-product operation.");
  const rows = await everyRow(t);
  expect(Object.values(rows).every(table => table.length === 0)).toBe(true);
});

test("level picks save the level with the status it implies, and status-only picks keep working", async () => {
  const { t, owner } = await fixture();
  const result = await owner.mutation(saveSelection, { operationId: "levels", picks: [
    { ...dir("github", "ACTIVE"), level: "DAILY" },
    { ...typed("Studio tool", "ARCHIVED"), level: "TRIED_NOT_ADOPTED" },
    dir("salesforce", "TESTING"),
  ] });
  expect(result.created).toBe(3);
  const rows = await everyRow(t);
  expect(rows.props.map(prop => [prop.status, prop.level, prop.goTo])).toEqual([
    ["ACTIVE", "DAILY", false], ["ARCHIVED", "TRIED_NOT_ADOPTED", false], ["TESTING", undefined, false],
  ]);
  expect(rows.events.map(event => [event.after.status, event.after.level])).toEqual([
    ["ACTIVE", "DAILY"], ["ARCHIVED", "TRIED_NOT_ADOPTED"], ["TESTING", undefined],
  ]);
});

test("a level pick confirming a draft writes the level and leaves go-to alone", async () => {
  const { t, owner } = await fixture();
  const draft = await owner.mutation(add, { name: "GitHub", operationId: "draft" });
  await owner.mutation(saveSelection, { operationId: "confirm", picks: [{ ...dir("github", "ARCHIVED"), level: "PAUSED" }] });
  expect(await t.run(async ctx => {
    const prop = await ctx.db.get(draft);
    return { status: prop?.status, level: prop?.level, goTo: prop?.goTo };
  })).toEqual({ status: "ARCHIVED", level: "PAUSED", goTo: undefined });
});

test("a pick whose status disagrees with its level is refused and nothing is saved", async () => {
  const { t, owner } = await fixture();
  await expect(owner.mutation(saveSelection, { operationId: "bad", picks: [
    dir("salesforce"), { ...dir("github", "ARCHIVED"), level: "DAILY" },
  ] })).rejects.toThrow("does not match");
  const rows = await everyRow(t);
  expect(Object.values(rows).every(table => table.length === 0)).toBe(true);
});

test("an operation reused with different levels is refused", async () => {
  const { t, owner } = await fixture();
  await owner.mutation(saveSelection, { operationId: "used", picks: [{ ...dir("github"), level: "WEEKLY" }] });
  const before = await everyRow(t);
  await expect(owner.mutation(saveSelection, { operationId: "used", picks: [{ ...dir("github"), level: "DAILY" }] }))
    .rejects.toThrow("This save was already used with different picks.");
  expect(await everyRow(t)).toEqual(before);
});

test("no write path leaves a level beside a status it does not imply", async () => {
  const { t, owner } = await fixture();
  const save = makeFunctionReference<"mutation">("inventory:save");
  const draft = await owner.mutation(add, { name: "Notion", operationId: "draft" });
  await owner.mutation(saveSelection, { operationId: "batch", picks: [
    { ...dir("notion", "ACTIVE"), level: "DAILY" }, { ...dir("github", "TESTING"), level: "TESTING" }, dir("salesforce", "ARCHIVED"),
  ] });
  await owner.mutation(save, { propId: draft, expectedVersion: 1, operationId: "archive", status: "ARCHIVED", goTo: true, headline: "", note: "" });
  await owner.mutation(save, { propId: draft, expectedVersion: 2, operationId: "stopped", status: "ARCHIVED", level: "STOPPED", goTo: true, headline: "", note: "" });
  const implied = { TRIED_NOT_ADOPTED: "ARCHIVED", STOPPED: "ARCHIVED", PAUSED: "ARCHIVED", OCCASIONAL: "ACTIVE", TESTING: "TESTING", WEEKLY: "ACTIVE", DAILY: "ACTIVE" };
  const rows = await everyRow(t);
  const states = [...rows.props, ...rows.events.flatMap(event => [event.before, event.after])];
  expect(states.filter(state => state.level !== undefined && implied[state.level] !== state.status)).toEqual([]);
  expect(rows.props.map(prop => [prop.level, prop.status])).toEqual([["STOPPED", "ARCHIVED"], ["TESTING", "TESTING"], [undefined, "ARCHIVED"]]);
});
