// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, expect, test, vi } from "vitest";
import schema from "./schema";
import wisprReceipt from "../docs/verification/fixtures/2026-09-17-context-brands/wisprflow.json";
import githubReceipt from "../docs/verification/fixtures/2026-09-17-context-brands/github.json";
import { productBrandSnapshotSchema } from "../src/domain/product-brand";

const modules = import.meta.glob("./**/*.ts");
const request = makeFunctionReference<"mutation">("productBrands:requestForProp");
const claim = makeFunctionReference<"mutation">("productBrands:claim");
const retain = makeFunctionReference<"mutation">("productBrands:retain");
const get = makeFunctionReference<"query">("productBrands:getForProp");
const history = makeFunctionReference<"query">("productBrands:historyForProp");
const prepare = makeFunctionReference<"mutation">("productBrands:prepareForProps");
const preparation = makeFunctionReference<"query">("productBrands:getPreparationForProps");
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

test("bounded preparation enrolls existing owner cards once and preserves their evidence and choices", async () => {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const { propIds, outsiderPropId } = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { authSubject: "owner", handle: "owner", displayName: "Owner", bio: "" });
    const outsiderId = await ctx.db.insert("users", { authSubject: "outsider", handle: "outsider", displayName: "Other", bio: "" });
    const productId = await ctx.db.insert("products", wisprReceipt.product);
    const prop = { userId, productId, visibility: "PRIVATE" as const, status: "TESTING" as const, headline: "My saved words", note: "Keep my history" };
    return { propIds: [await ctx.db.insert("props", prop), await ctx.db.insert("props", prop)], outsiderPropId: await ctx.db.insert("props", { ...prop, userId: outsiderId }) };
  });
  const unchanged = () => t.run(async ctx => ({ props: await ctx.db.query("props").collect(), products: await ctx.db.query("products").collect(), raw: await ctx.db.query("rawEvidence").collect(), published: await ctx.db.query("publishedProfiles").collect() }));
  const before = await unchanged();
  await expect(t.mutation(prepare, { propIds })).rejects.toThrow("Authentication required");
  await expect(t.query(preparation, { propIds })).rejects.toThrow("Authentication required");
  const owner = t.withIdentity({ subject: "owner" });
  await expect(owner.mutation(prepare, { propIds: [...propIds, outsiderPropId] })).rejects.toThrow("Product unavailable");
  await expect(owner.query(preparation, { propIds: [outsiderPropId] })).rejects.toThrow("Product unavailable");
  await expect(owner.mutation(prepare, { propIds: Array(26).fill(propIds[0]) })).rejects.toThrow("at most 25");
  expect(await t.run(ctx => ctx.db.query("productBrandJobs").collect())).toHaveLength(0);
  expect(await owner.query(preparation, { propIds })).toEqual(propIds.map(propId => ({ propId, status: "NOT_REQUESTED" })));
  expect(await owner.mutation(prepare, { propIds: [...propIds, propIds[0]] })).toEqual({ prepared: 1 });
  await owner.mutation(prepare, { propIds });
  expect(await owner.query(preparation, { propIds })).toEqual(propIds.map(propId => ({ propId, status: "PENDING" })));
  expect(await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toHaveLength(1);
  const job = (await t.run(ctx => ctx.db.query("productBrandJobs").unique()))!;
  await t.mutation(claim, { productId: job.productId, generation: 1 });
  await t.mutation(retain, { productId: job.productId, generation: 1, snapshot: wisprReceipt.snapshot, responseJson: JSON.stringify(wisprReceipt.response) });
  vi.setSystemTime(Date.now() + 60_001);
  await owner.mutation(prepare, { propIds });
  expect(await owner.query(preparation, { propIds })).toEqual(propIds.map(propId => ({ propId, status: "READY" })));
  expect((await t.run(ctx => ctx.db.query("productBrandJobs").unique()))?.generation).toBe(1);
  expect(await unchanged()).toEqual(before);
});

test("preparation failures respect cooldown and an explicit later retry queues one generation", async () => {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const propId = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { authSubject: "owner", handle: "owner", displayName: "Owner", bio: "" });
    const productId = await ctx.db.insert("products", wisprReceipt.product);
    return ctx.db.insert("props", { userId, productId, visibility: "DRAFT", status: "TESTING", headline: "", note: "" });
  });
  const owner = t.withIdentity({ subject: "owner" });
  await owner.mutation(prepare, { propIds: [propId] });
  const job = (await t.run(ctx => ctx.db.query("productBrandJobs").unique()))!;
  await t.mutation(claim, { productId: job.productId, generation: 1 });
  await t.mutation(makeFunctionReference<"mutation">("productBrands:fail"), { productId: job.productId, generation: 1, reason: "RETRIEVAL_FAILED" });
  await owner.mutation(prepare, { propIds: [propId] });
  expect(await owner.query(preparation, { propIds: [propId] })).toEqual([{ propId, status: "FAILED" }]);
  expect((await t.run(ctx => ctx.db.query("productBrandJobs").unique()))?.generation).toBe(1);
  vi.setSystemTime(Date.now() + 60_001);
  await owner.mutation(prepare, { propIds: [propId] });
  expect((await t.run(ctx => ctx.db.query("productBrandJobs").unique()))?.generation).toBe(1);
  await owner.mutation(prepare, { propIds: [propId], retryFailed: true });
  await owner.mutation(prepare, { propIds: [propId], retryFailed: true });
  expect((await t.run(ctx => ctx.db.query("productBrandJobs").unique()))?.generation).toBe(2);
});

test("subproducts cannot enroll or display parent domain branding, including older retained snapshots", async () => {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const propIds = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { authSubject: "owner", handle: "owner", displayName: "Owner", bio: "" });
    const ids = [];
    for (const [slug, name, domain] of [["github-copilot", "GitHub Copilot", "github.com"], ["manual-copilot-existing", "GitHub Copilot", "github.com"], ["devin-desktop", "Devin Desktop", "devin.ai"], ["notebooklm", "NotebookLM", "notebooklm.google.com"], ["manual-notebooklm-existing", "NotebookLM", "notebooklm.google.com"]]) {
      const productId = await ctx.db.insert("products", { slug, name, domain, description: "AI coding" });
      const snapshotId = await ctx.db.insert("productBrandSnapshots", { productId, generation: 1, snapshot: productBrandSnapshotSchema.parse({ ...githubReceipt.snapshot, productSlug: slug, canonicalDomain: domain,
        ...(name === "NotebookLM" ? { logos: [{ url: "https://example.com/google-parent-logo.svg", mode: "unknown", type: "icon" }] } : {}),
      }), responseJson: JSON.stringify(githubReceipt.response) });
      await ctx.db.insert("productBrandJobs", { productId, canonicalDomain: domain, generation: 1, status: "READY", requestedAt: Date.now(), currentSnapshotId: snapshotId });
      ids.push(await ctx.db.insert("props", { userId, productId, visibility: "PRIVATE", status: "TESTING", headline: "", note: "" }));
    }
    return ids;
  });
  const owner = t.withIdentity({ subject: "owner" });
  await owner.mutation(prepare, { propIds });
  for (const propId of propIds) {
    expect(await owner.mutation(request, { propId })).toEqual({ status: "PRODUCT_IDENTITY_REQUIRED" });
    expect(await owner.query(get, { propId })).toMatchObject({ status: "PRODUCT_IDENTITY_REQUIRED", current: null });
  }
  expect(await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toHaveLength(0);
});

test("NotebookLM does not request domain-only enrichment even for its exact catalog subdomain", async () => {
  vi.useFakeTimers();
  vi.stubEnv("CONTEXT_DEV_API_KEY", "synthetic-test-key");
  const t = convexTest(schema, modules);
  const propId = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { authSubject: "owner", handle: "owner", displayName: "Owner", bio: "" });
    const productId = await ctx.db.insert("products", { slug: "notebooklm", name: "NotebookLM", domain: "notebooklm.google.com", description: "Research" });
    return ctx.db.insert("props", { userId, productId, visibility: "PRIVATE", status: "TESTING", headline: "", note: "" });
  });
  const fetcher = vi.fn(async () => Response.json({ status: "ok", brand: { domain: "google.com", logos: [], colors: [] } }));
  vi.stubGlobal("fetch", fetcher);
  const owner = t.withIdentity({ subject: "owner" });
  await owner.mutation(prepare, { propIds: [propId] });
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(await owner.query(get, { propId })).toMatchObject({ status: "PRODUCT_IDENTITY_REQUIRED", current: null });
  expect(fetcher).not.toHaveBeenCalled();
  expect(await t.run(ctx => ctx.db.query("productBrandSnapshots").collect())).toHaveLength(0);
});

test("a previously manual Clay entry can load its verified brand without rewriting owner history", async () => {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const { productId, propId } = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { authSubject: "owner", handle: "owner", displayName: "Owner", bio: "" });
    const productId = await ctx.db.insert("products", { slug: "manual-clay-existing", name: "Clay", domain: "clay.com", description: "" });
    const propId = await ctx.db.insert("props", { userId, productId, visibility: "DRAFT", status: "TESTING", headline: "", note: "Owner explanation" });
    return { productId, propId };
  });
  const before = await t.run(ctx => ctx.db.get(propId));
  const owner = t.withIdentity({ subject: "owner" });
  expect(await owner.mutation(request, { propId })).toMatchObject({ status: "PENDING" });
  expect(await t.mutation(claim, { productId, generation: 1 })).toMatchObject({ productSlug: "manual-clay-existing", canonicalDomain: "clay.com" });
  expect(await t.run(ctx => ctx.db.get(propId))).toEqual(before);
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toEqual([]);
  expect(await t.run(ctx => ctx.db.query("publishedProfiles").collect())).toEqual([]);
  await t.run(ctx => ctx.db.patch(productId, { domain: "clay.com.attacker.example" }));
  expect((await owner.query(get, { propId })).status).toBe("UNVERIFIED_DOMAIN");
  await t.run(ctx => ctx.db.patch(productId, { domain: "clay.com", name: "Different product" }));
  expect((await owner.query(get, { propId })).status).toBe("UNVERIFIED_DOMAIN");
});

test("only an owned, verified canonical product can queue presentation enrichment", async () => {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const { propId, unverifiedPropId } = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { authSubject: "owner", handle: "owner", displayName: "Owner", bio: "" });
    const productId = await ctx.db.insert("products", { slug: "wisprflow", name: "Wispr Flow", domain: "wisprflow.ai", description: "Dictation" });
    const unverifiedId = await ctx.db.insert("products", { slug: "made-up", name: "Unknown", domain: "example.com", description: "" });
    const fields = { userId, visibility: "DRAFT" as const, status: "TESTING" as const, headline: "", note: "" };
    return {
      propId: await ctx.db.insert("props", { ...fields, productId }),
      unverifiedPropId: await ctx.db.insert("props", { ...fields, productId: unverifiedId }),
    };
  });
  await expect(t.mutation(request, { propId })).rejects.toThrow("Authentication required");
  await expect(t.withIdentity({ subject: "other" }).mutation(request, { propId })).rejects.toThrow();
  const owner = t.withIdentity({ subject: "owner" });
  expect(await owner.mutation(request, { propId: unverifiedPropId })).toEqual({ status: "UNVERIFIED_DOMAIN" });
  expect(await owner.mutation(request, { propId })).toMatchObject({ status: "PENDING" });
  expect(await owner.mutation(request, { propId })).toMatchObject({ status: "PENDING" });
  expect(await t.run(ctx => ctx.db.query("productBrandJobs").collect())).toHaveLength(1);
  expect(await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toHaveLength(1);
});

test("publishing a collection with duplicate product relationships queues one brand job", async () => {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const propIds = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { authSubject: "owner", handle: "owner", displayName: "Owner", bio: "" });
    const productId = await ctx.db.insert("products", { slug: "wisprflow", name: "Wispr Flow", domain: "wisprflow.ai", description: "Dictation" });
    const prop = { userId, productId, visibility: "PRIVATE" as const, status: "TESTING" as const, headline: "Private candidate", note: "" };
    return [await ctx.db.insert("props", prop), await ctx.db.insert("props", prop)];
  });
  const owner = t.withIdentity({ subject: "owner" });
  await owner.mutation(makeFunctionReference<"mutation">("onboarding:publishSelected"), { selections: propIds.map(propId => ({
    propId, publish: true, status: "TESTING", headline: "Private candidate", note: "", autoRefresh: false,
    primaryLink: { type: "CANONICAL", url: "https://wisprflow.ai", label: "Visit" },
  })) });
  expect(await t.run(ctx => ctx.db.query("productBrandJobs").collect())).toHaveLength(1);
  const scheduled = await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  expect(scheduled.filter(job => job.name === "productBrands:refresh")).toHaveLength(1);
  const state = await owner.query(makeFunctionReference<"query">("onboarding:getState"), {});
  expect(state.cards).toHaveLength(2);
  expect(state.brandEnrichmentAvailable).toBe(true);
});

test.each([false, true])("an expired brand job can be retried once without replacing valid in-flight work (claimed: %s)", async (claimed) => {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const { propId, productId } = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { authSubject: "owner", handle: "owner", displayName: "Owner", bio: "" });
    const productId = await ctx.db.insert("products", { slug: "wisprflow", name: "Wispr Flow", domain: "wisprflow.ai", description: "Dictation" });
    const propId = await ctx.db.insert("props", { userId, productId, visibility: "DRAFT", status: "TESTING", headline: "", note: "" });
    return { propId, productId };
  });
  const owner = t.withIdentity({ subject: "owner" });
  await owner.mutation(request, { propId });
  if (claimed) await t.mutation(claim, { productId, generation: 1 });
  await owner.mutation(request, { propId });
  expect((await t.run(ctx => ctx.db.query("productBrandJobs").unique()))?.generation).toBe(1);
  vi.setSystemTime(Date.now() + 180_001);
  await owner.mutation(request, { propId });
  await owner.mutation(request, { propId });
  expect((await t.run(ctx => ctx.db.query("productBrandJobs").unique()))?.generation).toBe(2);
  expect(await t.mutation(claim, { productId, generation: 1 })).toBeNull();
  expect(await t.mutation(claim, { productId, generation: 2 })).not.toBeNull();
});

test.each([wisprReceipt, githubReceipt])("real retained $product.name brand survives persistence and private/public projection without modifying evidence", async (receipt) => {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const originalCard = { product: receipt.product, status: "TESTING", headline: "Test relationship for presentation projection", note: "", primaryLink: { type: "CANONICAL", url: `https://${receipt.product.domain}`, label: "Visit product" } } as const;
  const profile = { handle: "owner", displayName: "Owner", bio: "", cards: [originalCard] };
  const { productId, propId } = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { authSubject: "owner", handle: "owner", displayName: "Owner", bio: "" });
    const productId = await ctx.db.insert("products", receipt.product);
    const propId = await ctx.db.insert("props", { userId, productId, visibility: "PUBLIC", status: "TESTING", headline: originalCard.headline, note: "" });
    await ctx.db.insert("publishedProfiles", { handle: "owner", revision: 1, publishedAt: "2026-09-17T00:00:00.000Z", profile });
    return { productId, propId };
  });
  const owner = t.withIdentity({ subject: "owner" });
  await owner.mutation(request, { propId });
  await t.mutation(claim, { productId, generation: 1 });
  await t.mutation(retain, { productId, generation: 1, snapshot: receipt.snapshot, responseJson: JSON.stringify(receipt.response) });
  const privateState = await owner.query(makeFunctionReference<"query">("onboarding:getState"), {});
  expect(privateState.cards[0].product.brand).toEqual(receipt.snapshot);
  const publicRead = makeFunctionReference<"query">("publicProfiles:getByHandle");
  const displayed = await t.query(publicRead, { handle: "owner" });
  expect(displayed.cards[0].product.brand).toEqual(receipt.snapshot);
  expect(await t.query(publicRead, { handle: "owner" })).toEqual(displayed);
  const { brand: displayedBrand, ...productWithoutBrand } = displayed.cards[0].product;
  expect(displayedBrand).toBeDefined();
  expect({ ...displayed.cards[0], product: productWithoutBrand }).toEqual(originalCard);
  expect(await t.run(async ctx => (await ctx.db.query("publishedProfiles").first())?.profile)).toEqual(profile);
  for (const table of ["rawEvidence", "usageSignals", "claimReviews", "proofs", "evidenceSources"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
});

test("retention replays exactly once, preserves refresh history, and never changes personal evidence or publication", async () => {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const { productId, propId } = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { authSubject: "owner", handle: "owner", displayName: "Owner", bio: "" });
    const productId = await ctx.db.insert("products", { slug: "wisprflow", name: "Wispr Flow", domain: "wisprflow.ai", description: "Dictation" });
    const propId = await ctx.db.insert("props", { userId, productId, visibility: "DRAFT", status: "TESTING", headline: "Private candidate", note: "" });
    await ctx.db.insert("publishedProfiles", { handle: "owner", revision: 1, profile: { handle: "owner", displayName: "Owner", bio: "", cards: [] }, publishedAt: "2026-09-17T00:00:00.000Z" });
    return { productId, propId };
  });
  const owner = t.withIdentity({ subject: "owner" });
  const unchangedState = () => t.run(async ctx => ({
    products: await ctx.db.query("products").collect(), props: await ctx.db.query("props").collect(),
    evidence: await ctx.db.query("rawEvidence").collect(), usage: await ctx.db.query("usageSignals").collect(),
    review: await ctx.db.query("claimReviews").collect(), published: await ctx.db.query("publishedProfiles").collect(),
  }));
  const before = await unchangedState();
  await owner.mutation(request, { propId });
  const identity = await t.mutation(claim, { productId, generation: 1 });
  expect(identity).toMatchObject({ productSlug: "wisprflow", canonicalDomain: "wisprflow.ai" });
  expect(await t.mutation(claim, { productId, generation: 1 })).toBeNull();
  const responseJson = JSON.stringify({ brand: { domain: "wisprflow.ai", colors: [] } });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(responseJson));
  const responseHash = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, "0")).join("");
  const snapshot = { schemaVersion: 1, provider: "context.dev", adapterVersion: "context-brand-v1", productSlug: "wisprflow", canonicalDomain: "wisprflow.ai", retrievalId: "test-retrieval-one", retrievedAt: new Date().toISOString(), partial: false, logos: [], colors: [], fonts: [], receipts: [{ endpoint: "brand", status: "ok", httpStatus: 200 }], responseHash };
  const args = { productId, generation: 1, snapshot, responseJson };
  const id = await t.mutation(retain, args);
  expect(await t.mutation(retain, args)).toBe(id);
  expect(await owner.query(history, { propId })).toHaveLength(1);
  await expect(t.mutation(retain, { ...args, snapshot: { ...snapshot, partial: true } })).rejects.toThrow("collision");
  await expect(t.mutation(retain, { ...args, snapshot: { ...snapshot, retrievalId: "bad-domain", canonicalDomain: "other.example" } })).rejects.toThrow();
  await expect(t.mutation(retain, { ...args, snapshot: { ...snapshot, retrievalId: "bad-hash" }, responseJson: "{}" })).rejects.toThrow("hash");
  vi.setSystemTime(Date.now() + 60_001);
  await owner.mutation(request, { propId, refresh: true });
  await t.mutation(claim, { productId, generation: 2 });
  const next = { ...snapshot, retrievalId: "test-retrieval-two", retrievedAt: new Date().toISOString() };
  const nextId = await t.mutation(retain, { ...args, generation: 2, snapshot: next });
  expect(nextId).not.toBe(id);
  const state = await owner.query(get, { propId });
  expect(state.current).toEqual(next);
  expect(await owner.query(history, { propId })).toHaveLength(2);
  expect(await unchangedState()).toEqual(before);
  // A late completion from an older job may be retained, but is never selected.
  await t.mutation(retain, { ...args, snapshot: { ...snapshot, retrievalId: "test-late-retrieval" } });
  expect((await owner.query(get, { propId })).current).toEqual(next);
  await t.run(ctx => ctx.db.patch(productId, { domain: "unverified.example" }));
  expect((await owner.query(get, { propId })).current).toBeNull();
});

test("provider action retains a normalized snapshot and optional endpoint failures leave an honest usable brand", async () => {
  vi.useFakeTimers();
  vi.stubEnv("CONTEXT_DEV_API_KEY", "synthetic-test-key");
  const t = convexTest(schema, modules);
  const { productId, propId } = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { authSubject: "owner", handle: "owner", displayName: "Owner", bio: "" });
    const productId = await ctx.db.insert("products", { slug: "github", name: "GitHub", domain: "github.com", description: "Code" });
    const propId = await ctx.db.insert("props", { userId, productId, visibility: "DRAFT", status: "TESTING", headline: "", note: "" });
    return { productId, propId };
  });
  const owner = t.withIdentity({ subject: "owner" });
  const fetcher = vi.fn(async (url: string | URL | Request) => String(url).includes("/brand/retrieve")
    ? Response.json({ status: "ok", code: 200, brand: { domain: "github.com", logos: [{ url: "https://example.com/brand.png", type: "icon", mode: "dark" }], colors: [] }, request_id: "synthetic-brand-id", key_metadata: { credits_remaining: 123 } })
    : Response.json({ message: "synthetic optional endpoint unavailable" }, { status: 503 }));
  vi.stubGlobal("fetch", fetcher);
  await owner.mutation(request, { propId });
  const refresh = makeFunctionReference<"action">("productBrands:refresh");
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  const state = await owner.query(get, { propId });
  expect(state.status).toBe("READY");
  expect(state.current).toMatchObject({ provider: "context.dev", canonicalDomain: "github.com", productSlug: "github", partial: true, fonts: [] });
  expect(fetcher).toHaveBeenCalledTimes(3);
  await t.action(refresh, { productId, generation: 1 });
  expect(fetcher).toHaveBeenCalledTimes(3);
  const records = await t.run(ctx => ctx.db.query("productBrandSnapshots").collect());
  expect(records).toHaveLength(1);
  expect(records[0].responseJson).not.toContain("synthetic-test-key");
  expect(records[0].responseJson).not.toContain("credits_remaining");
  vi.setSystemTime(Date.now() + 60_001);
  await owner.mutation(request, { propId, refresh: true });
  fetcher.mockImplementation(async () => Response.json({}, { status: 401 }));
  await t.action(refresh, { productId, generation: 2 });
  expect((await owner.query(get, { propId })).status).toBe("FAILED");
  expect((await owner.query(get, { propId })).current).toEqual(state.current);
});
