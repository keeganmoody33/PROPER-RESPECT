// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");
const add = api.onboarding.addManualProduct;
const save = api.inventory.save;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function fixture() {
  const t = convexTest(schema, modules);
  await t.run(async ctx => {
    for (const subject of ["owner", "other"]) await ctx.db.insert("users", {
      authSubject: subject, handle: subject, displayName: subject, bio: "", onboardingStatus: "PUBLISHED",
    });
    await ctx.db.insert("publishedProfiles", {
      handle: "owner", revision: 2, publishedAt: "2026-09-01T00:00:00.000Z",
      profile: { handle: "owner", displayName: "owner", bio: "", cards: [] },
    });
  });
  return { t, owner: t.withIdentity({ subject: "owner" }), other: t.withIdentity({ subject: "other" }) };
}

test("an owner can add an unknown product without a website or telemetry, with their explanation kept private", async () => {
  const { t, owner } = await fixture();
  await expect(t.mutation(add, { name: "My writing tool" })).rejects.toThrow("Authentication required");
  const before = await t.run(ctx => ctx.db.query("publishedProfiles").collect());
  const propId = await owner.mutation(add, { name: "My writing tool", description: "My private explanation", operationId: "one" });
  await t.run(async ctx => {
    const prop = await ctx.db.get(propId as Id<"props">);
    expect(prop).toMatchObject({ visibility: "DRAFT", note: "My private explanation", headline: "", ownerEntered: true });
    expect(prop?.goTo).toBeUndefined();
    expect(prop?.confirmedAt).toBeUndefined();
    expect(prop?.activity).toBeUndefined();
    expect(prop?.startedAt).toBeUndefined();
    const product = await ctx.db.get(prop!.productId);
    expect(product).toMatchObject({ name: "My writing tool", domain: "", description: "" });
    expect(product!.slug).toMatch(/^manual-[a-z0-9-]+$/);
    expect(product!.slug.length).toBeLessThanOrEqual(39);
    expect(await ctx.db.query("links").collect()).toEqual([]);
    expect(await ctx.db.query("rawEvidence").collect()).toEqual([]);
    expect(await ctx.db.query("evidenceSources").collect()).toEqual([]);
    expect(await ctx.db.query("relationshipEvents").collect()).toEqual([]);
    expect(await ctx.db.query("productBrandJobs").collect()).toEqual([]);
    expect(await ctx.db.query("draftImports").collect()).toMatchObject([{ suggestedDomain: "", suggestedUrl: "", suggestedDescription: "", rawEvidenceIds: [] }]);
    expect(await ctx.db.query("users").withIndex("by_auth_subject", q => q.eq("authSubject", "owner")).unique()).toMatchObject({ onboardingStatus: "PUBLISHED" });
    expect(await ctx.db.query("publishedProfiles").collect()).toEqual(before);
  });
});

test("a legacy caller cannot select a canonical product through an arbitrary slug or leak notes into global metadata", async () => {
  const { t, owner } = await fixture();
  const propId = await owner.mutation(add, {
    name: "Different product", slug: "github", domain: "example.com", url: "https://www.example.com/work#section",
    description: "Private workflow", logoUrl: "https://unverified.example/logo.png",
  });
  await t.run(async ctx => {
    const prop = (await ctx.db.get(propId as Id<"props">))!;
    const product = (await ctx.db.get(prop.productId))!;
    expect(product).toMatchObject({ name: "Different product", domain: "example.com", description: "" });
    expect(product.slug).not.toBe("github");
    expect(product.logoUrl).toBeUndefined();
    expect(prop.note).toBe("Private workflow");
    expect(await ctx.db.query("links").collect()).toMatchObject([{ url: "https://www.example.com/work" }]);
  });
});

test("catalog names preserve products that share a domain, and reject conflicting websites", async () => {
  const { t, owner } = await fixture();
  const github = await owner.mutation(add, { name: "GitHub", website: "github.com", operationId: "github" });
  const copilot = await owner.mutation(add, { name: "GitHub Copilot Pro", website: "https://github.com", operationId: "copilot" });
  expect(github).not.toBe(copilot);
  await t.run(async ctx => {
    expect((await ctx.db.query("products").collect()).map(product => product.slug).sort()).toEqual(["github", "github-copilot"]);
    expect(await ctx.db.query("links").withIndex("by_prop", q => q.eq("propId", copilot as Id<"props">)).unique()).toMatchObject({ url: "https://github.com/features/copilot" });
  });
  await expect(owner.mutation(add, { name: "GitHub Copilot", website: "https://notion.so", operationId: "conflict" })).rejects.toThrow("does not match");
  await expect(owner.mutation(add, { name: "Wispr Flow", website: "https://unrelated.example", operationId: "unknown-conflict" })).rejects.toThrow("does not match");
});

test("a verified catalog website resolves its canonical identity without accepting caller metadata", async () => {
  const { t, owner } = await fixture();
  const propId = await owner.mutation(add, { name: "My dictation app", website: "https://flowvoice.ai", description: "Private explanation" });
  await t.run(async ctx => {
    const prop = (await ctx.db.get(propId as Id<"props">))!;
    expect(await ctx.db.get(prop.productId)).toMatchObject({ name: "Wispr Flow", slug: "wisprflow", domain: "wisprflow.ai", description: "Voice dictation for writing across apps." });
    expect(prop.note).toBe("Private explanation");
    expect(await ctx.db.query("productBrandJobs").collect()).toMatchObject([{ canonicalDomain: "wisprflow.ai", status: "PENDING" }]);
    expect(await ctx.db.query("productWatches").collect()).toEqual([]);
  });
});

test("a specific catalog product website cannot silently reuse an existing parent-company relationship", async () => {
  const { t, owner } = await fixture();
  const github = await owner.mutation(add, { name: "GitHub", operationId: "github", description: "Existing explanation" });
  await owner.mutation(save, {
    propId: github, expectedVersion: 0, operationId: "github-save", status: "ACTIVE", goTo: true,
    headline: "My existing GitHub relationship", note: "Existing confirmed explanation",
  });
  const before = await t.run(ctx => ctx.db.get(github));
  const copilot = await owner.mutation(add, {
    name: "Copilot", website: "https://github.com/features/copilot", operationId: "copilot-url",
    description: "My separate Copilot explanation",
  });
  const desktop = await owner.mutation(add, {
    name: "Desktop coding app", website: "https://devin.ai/download", operationId: "desktop-url",
  });
  expect(copilot).not.toBe(github);
  await t.run(async ctx => {
    const prop = (await ctx.db.get(copilot))!;
    expect(prop).toMatchObject({ note: "My separate Copilot explanation", visibility: "DRAFT", ownerEntered: true });
    expect(prop.confirmedAt).toBeUndefined();
    expect(await ctx.db.get(prop.productId)).toMatchObject({ slug: "github-copilot", name: "GitHub Copilot" });
    expect(await ctx.db.query("links").withIndex("by_prop", q => q.eq("propId", copilot)).unique()).toMatchObject({ url: "https://github.com/features/copilot" });
    expect(await ctx.db.get(github)).toEqual(before);
    const desktopProp = (await ctx.db.get(desktop))!;
    expect(await ctx.db.get(desktopProp.productId)).toMatchObject({ slug: "devin-desktop" });
    expect(await ctx.db.query("rawEvidence").collect()).toEqual([]);
  });
});

test("an explicit named product cannot be combined with another catalog product's specific website", async () => {
  const { t, owner } = await fixture();
  await expect(owner.mutation(add, { name: "GitHub", website: "https://github.com/features/copilot" })).rejects.toThrow("does not match");
  await expect(owner.mutation(add, { name: "Devin", website: "https://devin.ai/download" })).rejects.toThrow("does not match");
  expect(await t.run(ctx => ctx.db.query("manualProductIntakes").collect())).toEqual([]);
});

test("ambiguous websites remain owner-entered products instead of being merged into a known parent", async () => {
  const { t, owner } = await fixture();
  const github = await owner.mutation(add, { name: "GitHub", operationId: "parent" });
  for (const [name, website] of [
    ["My experimental tool", "https://github.com/features/spark"],
    ["An assistant", "https://copilot.github.com"],
    ["A hosted app", "https://example.github.io"],
  ]) {
    const added = await owner.mutation(add, { name, website, description: "Owner's explanation" });
    expect(added).not.toBe(github);
    await t.run(async ctx => {
      const prop = (await ctx.db.get(added))!;
      const product = (await ctx.db.get(prop.productId))!;
      expect(product.name).toBe(name);
      expect(product.slug).toMatch(/^manual-/);
      expect(prop.note).toBe("Owner's explanation");
      expect(await ctx.db.query("links").withIndex("by_prop", q => q.eq("propId", added)).unique()).toMatchObject({ url: new URL(website).href });
    });
  }
  // Only the explicitly named catalog parent is eligible for brand enrichment.
  expect(await t.run(ctx => ctx.db.query("productBrandJobs").collect())).toHaveLength(1);
});

test("operation receipts are owner-bound, reject changed details, and make legacy retries idempotent", async () => {
  const { t, owner, other } = await fixture();
  const input = { name: "Personal studio tool", description: "Owner explanation", operationId: "same-operation" };
  const first = await owner.mutation(add, input);
  expect(await owner.mutation(add, input)).toBe(first);
  await expect(owner.mutation(add, { ...input, description: "Changed explanation" })).rejects.toThrow("different details");
  const otherProp = await other.mutation(add, input);
  expect(otherProp).not.toBe(first);
  await t.run(async ctx => {
    const a = (await ctx.db.get(first as Id<"props">))!;
    const b = (await ctx.db.get(otherProp as Id<"props">))!;
    expect(a.userId).not.toBe(b.userId);
    expect(a.productId).not.toBe(b.productId);
    expect(await ctx.db.query("manualProductIntakes").collect()).toHaveLength(2);
  });
  const legacy = { name: "Legacy product", website: "example.org", description: "" };
  expect(await owner.mutation(add, legacy)).toBe(await owner.mutation(add, legacy));
});

test("adding the same product again preserves saved decisions, explanations, history, and public state", async () => {
  const { t, owner } = await fixture();
  const first = await owner.mutation(add, { name: "GitHub", operationId: "initial", description: "Original draft" });
  await owner.mutation(save, {
    propId: first, expectedVersion: 0, operationId: "owner-save", status: "ARCHIVED", goTo: true,
    headline: "Earlier work", note: "My reason for stopping", startedAt: "2021-01-01",
  });
  const before = await t.run(async ctx => ({
    prop: await ctx.db.get(first as Id<"props">), history: await ctx.db.query("relationshipEvents").collect(),
    public: await ctx.db.query("publishedProfiles").collect(),
  }));
  expect(await owner.mutation(add, { name: "GitHub Inc", website: "github.com", operationId: "new-attempt", description: "Must not replace saved explanation" })).toBe(first);
  await t.run(async ctx => {
    expect(await ctx.db.query("props").collect()).toHaveLength(1);
    expect(await ctx.db.query("draftImports").collect()).toHaveLength(1);
    expect({ prop: await ctx.db.get(first as Id<"props">), history: await ctx.db.query("relationshipEvents").collect(), public: await ctx.db.query("publishedProfiles").collect() }).toEqual(before);
  });
});

test("conflicting stored canonical identities fail closed, and unknown products sharing a website remain distinct", async () => {
  const { t, owner } = await fixture();
  await t.run(ctx => ctx.db.insert("products", { name: "Wrong product", slug: "github", domain: "wrong.example", description: "" }));
  await expect(owner.mutation(add, { name: "GitHub" })).rejects.toThrow("stored product identity conflicts");
  const a = await owner.mutation(add, { name: "Studio One", website: "studio.example.com" });
  const b = await owner.mutation(add, { name: "Studio Two", website: "studio.example.com" });
  expect(a).not.toBe(b);
  expect(await owner.mutation(add, { name: "studio one", website: "https://studio.example.com", description: "A retry must preserve the original draft" })).toBe(a);
  expect(await t.run(ctx => ctx.db.query("props").collect())).toHaveLength(2);
});

test("unsafe websites and malformed operation inputs are rejected before any intake record is written", async () => {
  const { t, owner } = await fixture();
  for (const website of ["javascript:alert(1)", "ftp://example.com", "https://user:password@example.com", "http://localhost", "http://127.0.0.1", "https://example.com:8443"]) {
    await expect(owner.mutation(add, { name: "Unknown tool", website })).rejects.toThrow();
  }
  await expect(owner.mutation(add, { name: " " })).rejects.toThrow("product name");
  await expect(owner.mutation(add, { name: "Tool", operationId: " " })).rejects.toThrow("Invalid add-product");
  await expect(owner.mutation(add, { name: "Tool", description: "x".repeat(4001) })).rejects.toThrow("4,000");
  expect(await t.run(ctx => ctx.db.query("manualProductIntakes").collect())).toEqual([]);
  expect(await t.run(ctx => ctx.db.query("products").collect())).toEqual([]);
});
