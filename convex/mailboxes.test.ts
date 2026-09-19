// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference, type FunctionArgs } from "convex/server";
import { afterEach, expect, test, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { rawSignalSchema } from "../src/domain/discovery";

const modules = import.meta.glob("./**/*.ts");
const finalize = internal.mailboxes.finalizeVerifiedConnection;
const list = api.mailboxes.listAccounts;
const disconnect = api.mailboxes.disconnect;
const startScan = api.mailboxes.startScan;
const needsReauth = internal.mailboxes.markNeedsReauth;
const persist = internal.mailboxDiscovery.persistBatch;
// Only deliberately malformed arguments bypass compile-time shape checking.
const invalidPersist = makeFunctionReference<"mutation">("mailboxDiscovery:persistBatch");
type Provider = FunctionArgs<typeof finalize>["provider"];
type Signal = FunctionArgs<typeof persist>["signals"][number];
type CapturedSignal = Signal & { captureProvenance: NonNullable<Signal["captureProvenance"]> };
const mailScope = "https://www.googleapis.com/auth/gmail.readonly";
const envelope = {
  algorithm: "AES-256-GCM" as const, keyVersion: "test-key-1",
  ciphertext: btoa("synthetic encrypted fixture bytes"), iv: btoa("123456789012"),
};
const observation = {
  kind: "SIGNUP" as const, date: "2025-03-12", excerpt: "Welcome to GitHub.",
  scope: "UNKNOWN" as const, acquisition: "SOURCE_REPORTED" as const,
};
function signal(accountId = "google-personal", recordId = "message-1", provider: Provider = "GOOGLE"): CapturedSignal {
  return {
    sourceType: provider === "GOOGLE" ? "GMAIL" : "MICROSOFT_MAIL",
    sourceRecordId: recordId, vendor: "GitHub", capturedAt: "2026-09-16T00:00:00.000Z",
    payload: observation.excerpt, observations: [observation],
    captureProvenance: {
      version: 1, route: "DIRECT_API", adapter: { id: "mailbox-fixture", version: "1" },
      origin: { issuer: provider, accountId, recordId },
      collector: { kind: "AGENT", id: "test-collector" }, activityActor: { kind: "UNKNOWN" },
    },
  };
}
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => ({
    owner: await ctx.db.insert("users", { handle: "owner", authSubject: "owner", displayName: "Owner", bio: "" }),
    other: await ctx.db.insert("users", { handle: "other", authSubject: "other", displayName: "Other", bio: "" }),
  }));
  const owner = t.withIdentity({ subject: "owner" });
  const other = t.withIdentity({ subject: "other" });
  async function connect(providerAccountId = "google-personal", provider: Provider = "GOOGLE", expectedGeneration = 0) {
    return await t.mutation(finalize, {
      ownerId: ids.owner, provider, providerAccountId, accountLabel: "Mailbox",
      scopes: [provider === "GOOGLE" ? mailScope : "Mail.Read"], credential: envelope, expectedGeneration,
    });
  }
  return { t, owner, other, ids, connect };
}
type Scan = { jobId: Id<"mailboxScanJobs">; generation: number; cursor: string | null };
function batch(accountId: Id<"mailboxAccounts">, scan: Scan, signals: Signal[] = [signal()]) {
  return {
    accountId, jobId: scan.jobId, expectedGeneration: scan.generation,
    expectedCursor: scan.cursor, batchId: "page-1", nextCursor: "cursor-1", complete: false, signals,
  };
}
afterEach(() => vi.useRealTimers());

test("query-scoped atomic persistence rejects another query and replays without inflating progress", async () => {
  const { t, owner, connect } = await fixture();
  const { accountId } = await connect();
  const scan = await owner.mutation(startScan, { accountId, expectedGeneration: 1, mode: "KNOWN_PRODUCTS" });
  const page = { ...batch(accountId, scan), complete: true, readCount: 1, queryKey: scan.queryKey };
  await expect(t.mutation(persist, { ...page, queryKey: "another-query" })).rejects.toThrow("query changed");
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toEqual([]);
  const result = await t.mutation(persist, page);
  expect(await t.mutation(persist, page)).toEqual(result);
  expect(await t.run(ctx => ctx.db.query("mailboxScanContexts").unique())).toMatchObject({ pagesRead: 1, messagesRead: 1, retainedRecords: 1, cursor: "cursor-1" });
  expect((await t.run(ctx => ctx.db.get(accountId)))?.cursor).toBeNull();
});

test.each(["manual", "upload"] as const)("mailbox discovery preserves an existing %s product, relationship, primary link and review", async (route) => {
  const { t, owner, connect } = await fixture();
  if (route === "manual") {
    await owner.mutation(api.onboarding.addManualProduct, {
      name: "GitHub", slug: "github", domain: "github.com", description: "My repository host", url: "https://github.com/owner",
    });
  } else {
    const storageId = await t.run(ctx => ctx.storage.store(new Blob(["upload fixture"], { type: "image/png" })));
    // convex-test store() omits the contentType recorded by a real HTTP upload.
    await t.run(ctx => ctx.db.patch(storageId as unknown as Id<"rawEvidence">, { contentType: "image/png" } as never));
    await owner.mutation(api.onboarding.retainUpload, {
      storageId, filename: "github.png", mimeType: "image/png", byteSize: 14, sourceType: "SCREENSHOT", vendor: "GitHub",
    });
  }
  const before = await t.run(async ctx => ({
    product: await ctx.db.query("products").unique(), prop: await ctx.db.query("props").unique(),
    link: await ctx.db.query("links").unique(), draft: await ctx.db.query("draftImports").unique(),
    raw: await ctx.db.query("rawEvidence").collect(), proofs: await ctx.db.query("proofs").collect(),
  }));
  const { accountId } = await connect();
  const scan = await owner.mutation(startScan, { accountId, expectedGeneration: 1 });
  await t.mutation(persist, batch(accountId, scan));
  const card = (await owner.query(api.onboarding.getState, {}))!.cards[0];
  const claim = card.claims.find(c => c.observation.kind === "SIGNUP")!;
  await owner.mutation(api.onboarding.reviewClaim, {
    propId: card.prop._id, rawEvidenceId: claim.rawEvidenceId, observationIndex: claim.observationIndex,
    verdict: "INCOMPLETE", correction: "Signup only.",
  });
  await t.mutation(persist, { ...batch(accountId, scan), batchId: "page-2", expectedCursor: "cursor-1", nextCursor: "cursor-2" });
  const after = await t.run(async ctx => ({
    product: await ctx.db.query("products").unique(), prop: await ctx.db.query("props").unique(),
    link: await ctx.db.query("links").unique(), draft: await ctx.db.query("draftImports").unique(),
    receipts: await ctx.db.query("mailboxBatches").collect(), proofs: await ctx.db.query("proofs").collect(),
  }));
  expect(after.product).toEqual(before.product);
  expect(after.prop).toEqual(before.prop);
  expect(after.link).toEqual(before.link);
  expect(after.draft?._id).toBe(before.draft?._id);
  expect(after.draft?.resultPropId).toBe(before.prop?._id);
  expect(after.receipts).toHaveLength(2);
  expect(after.proofs).toHaveLength(before.proofs.length + 1);
  for (const raw of before.raw) expect(await t.run(ctx => ctx.db.get(raw._id))).toEqual(raw);
  expect((await t.run(ctx => ctx.db.get(accountId)))?.cursor).toBe("cursor-2");
  expect((await owner.query(api.onboarding.getState, {}))!.cards[0].claims.find(c => c.observation.kind === "SIGNUP")?.review?.verdict).toBe("INCOMPLETE");
});

test("mailbox discovery reuses a seedless catalog product by slug without an existing owner draft", async () => {
  const { t, owner, other, connect } = await fixture();
  const otherPropId = await other.mutation(api.onboarding.addManualProduct, {
    name: "GitHub", slug: "github", domain: "github.com", description: "Repository host", url: "https://github.com",
  });
  const product = await t.run(ctx => ctx.db.query("products").unique());
  const { accountId } = await connect();
  const scan = await owner.mutation(startScan, { accountId, expectedGeneration: 1 });
  await t.mutation(persist, batch(accountId, scan));
  expect(await t.run(ctx => ctx.db.query("products").unique())).toEqual(product);
  const ownerProp = (await owner.query(api.onboarding.getState, {}))!.cards[0].prop;
  expect(ownerProp._id).not.toBe(otherPropId);
  expect(ownerProp.productId).toBe(product!._id);
});

test.each(["owner", "slug", "domain"] as const)("mailbox discovery rejects a true existing relationship %s mismatch atomically", async (mismatch) => {
  const { t, owner, ids, connect } = await fixture();
  const propId = await owner.mutation(api.onboarding.addManualProduct, {
    name: "GitHub", slug: "github", domain: "github.com", description: "Repository host", url: "https://github.com",
  });
  await t.run(async ctx => {
    const prop = (await ctx.db.get(propId))!;
    if (mismatch === "owner") await ctx.db.patch(propId, { userId: ids.other });
    else await ctx.db.patch(prop.productId, { [mismatch]: "different" });
  });
  const { accountId } = await connect();
  const scan = await owner.mutation(startScan, { accountId, expectedGeneration: 1 });
  await expect(t.mutation(persist, batch(accountId, scan))).rejects.toThrow("mismatch");
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toEqual([]);
  expect(await t.run(ctx => ctx.db.query("proofs").collect())).toEqual([]);
  expect(await t.run(ctx => ctx.db.query("mailboxBatches").collect())).toEqual([]);
  expect((await t.run(ctx => ctx.db.get(accountId)))?.cursor).toBeNull();
});

test.each(["UPLOAD", "OWNER_TESTIMONY"] as const)("mailbox persistence rejects %s captures without changing evidence or cursors", async route => {
  const { t, owner, connect } = await fixture();
  const { accountId } = await connect();
  const scan = await owner.mutation(startScan, { accountId, expectedGeneration: 1 });
  const candidate = signal("google-personal", "message-2");
  candidate.captureProvenance.route = route;
  expect(rawSignalSchema.safeParse(candidate).success).toBe(true);
  await expect(t.mutation(persist, batch(accountId, scan, [signal(), candidate]))).rejects.toThrow("retrieval route");
  for (const table of ["rawEvidence", "proofs", "draftImports", "mailboxBatches"] as const) {
    expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  }
  expect(await t.run(ctx => ctx.db.get(accountId))).toMatchObject({ cursor: null, status: "CONNECTED" });
  expect(await t.run(ctx => ctx.db.get(scan.jobId))).toMatchObject({ cursor: null, status: "ACTIVE" });
  expect(await t.run(ctx => ctx.db.query("mailboxSecrets").collect())).toHaveLength(1);
});

test("disconnecting one active mailbox rejects its next page while another persists independently and history remains reviewed", async () => {
  const { t, owner, connect } = await fixture();
  const a = await connect();
  const b = await connect("google-work");
  const scanA = await owner.mutation(startScan, { accountId: a.accountId, expectedGeneration: 1 });
  const scanB = await owner.mutation(startScan, { accountId: b.accountId, expectedGeneration: 1 });
  await t.mutation(persist, batch(a.accountId, scanA));
  const card = (await owner.query(api.onboarding.getState, {}))!.cards[0];
  await owner.mutation(api.onboarding.reviewClaim, {
    propId: card.prop._id, rawEvidenceId: card.claims[0].rawEvidenceId, observationIndex: 0,
    verdict: "INCOMPLETE", correction: "Signup only.",
  });
  const original = await t.run(ctx => ctx.db.query("rawEvidence").unique());
  await owner.mutation(disconnect, { accountId: a.accountId, expectedGeneration: 1 });
  await expect(t.mutation(persist, {
    ...batch(a.accountId, scanA), batchId: "page-2", expectedCursor: "cursor-1", nextCursor: "cursor-2",
    signals: [signal("google-personal", "message-2")],
  })).rejects.toThrow("generation");
  await t.mutation(persist, batch(b.accountId, scanB, [signal("google-work")]));
  expect(await t.run(ctx => ctx.db.get(a.accountId))).toMatchObject({ cursor: "cursor-1", status: "DISCONNECTED" });
  expect(await t.run(ctx => ctx.db.get(b.accountId))).toMatchObject({ cursor: "cursor-1", status: "CONNECTED" });
  expect(await t.run(ctx => ctx.db.get(scanA.jobId))).toMatchObject({ status: "CANCELLED" });
  expect(await t.run(ctx => ctx.db.get(scanB.jobId))).toMatchObject({ status: "ACTIVE" });
  const secrets = await t.run(ctx => ctx.db.query("mailboxSecrets").collect());
  expect(secrets.map(s => s.accountId)).toEqual([b.accountId]);
  expect(await t.run(ctx => ctx.db.get(original!._id))).toEqual(original);
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toHaveLength(2);
  expect(await t.run(ctx => ctx.db.query("mailboxBatches").collect())).toHaveLength(2);
  const claims = (await owner.query(api.onboarding.getState, {}))!.cards[0].claims;
  expect(claims.find(c => c.rawEvidenceId === original!._id)?.review?.verdict).toBe("INCOMPLETE");
  expect(claims.find(c => c.rawEvidenceId !== original!._id)?.review).toBeNull();
  expect(await t.run(ctx => ctx.db.query("usageSignals").collect())).toEqual([]);
  expect(await t.query(api.publicProfiles.getByHandle, { handle: "owner" })).toBeNull();
});

test("same-provider accounts and Microsoft retain distinct sources, credentials and cursors; owner list excludes private material", async () => {
  const { t, owner, other, connect } = await fixture();
  const accounts = await Promise.all([connect(), connect("google-work"), connect("microsoft-personal", "MICROSOFT")]);
  const scan = await owner.mutation(startScan, { accountId: accounts[0].accountId, expectedGeneration: 1 });
  await t.mutation(persist, batch(accounts[0].accountId, scan));
  const stored = await t.run(async ctx => ({
    sources: await ctx.db.query("evidenceSources").collect(),
    accounts: await ctx.db.query("mailboxAccounts").collect(),
    secrets: await ctx.db.query("mailboxSecrets").collect(),
  }));
  expect(stored.sources.map(s => s.type).sort()).toEqual(["GMAIL", "GMAIL", "MICROSOFT_MAIL"]);
  expect(new Set(stored.accounts.map(a => a.evidenceSourceId)).size).toBe(3);
  expect(new Set(stored.secrets.map(s => s.accountId)).size).toBe(3);
  expect(stored.accounts.find(a => a._id === accounts[0].accountId)?.cursor).toBe("cursor-1");
  expect(stored.accounts.filter(a => a._id !== accounts[0].accountId).map(a => a.cursor)).toEqual([null, null]);
  const visible = await owner.query(list, {});
  expect(visible).toHaveLength(3);
  expect(JSON.stringify(visible)).not.toMatch(/ciphertext|iv|secret|credential|cursor|google-personal|microsoft-personal/);
  expect(await other.query(list, {})).toEqual([]);
});

test("connection seam rejects non-read-only scopes and stale finalization without replacing credentials", async () => {
  const { t, ids, connect } = await fixture();
  await expect(t.mutation(finalize, {
    ownerId: ids.owner, provider: "GOOGLE", providerAccountId: "google-personal", accountLabel: "Mailbox",
    scopes: [mailScope, "https://www.googleapis.com/auth/gmail.modify"], credential: envelope, expectedGeneration: 0,
  })).rejects.toThrow("read-only");
  expect(await t.run(ctx => ctx.db.query("mailboxAccounts").collect())).toHaveLength(0);
  await connect();
  await expect(connect()).rejects.toThrow("generation");
  expect(await t.run(ctx => ctx.db.query("mailboxSecrets").collect())).toHaveLength(1);
});

test("public lifecycle calls require the immutable account owner and current generation", async () => {
  const { t, owner, other, connect } = await fixture();
  const { accountId } = await connect();
  await expect(t.mutation(startScan, { accountId, expectedGeneration: 1 })).rejects.toThrow("Authentication");
  for (const operation of [startScan, disconnect]) {
    await expect(other.mutation(operation, { accountId, expectedGeneration: 1 })).rejects.toThrow("Mailbox unavailable");
    await expect(owner.mutation(operation, { accountId, expectedGeneration: 99 })).rejects.toThrow("generation");
  }
});

test("capture provenance stays separate from original meaning and never promotes a mailbox observation into human usage", async () => {
  const { t, owner, connect } = await fixture();
  const { accountId } = await connect();
  const scan = await owner.mutation(startScan, { accountId, expectedGeneration: 1 });
  const captured = signal();
  captured.captureProvenance.route = "MCP";
  captured.captureProvenance.activityActor.kind = "AGENT";
  await t.mutation(persist, batch(accountId, scan, [captured]));
  const stored = await t.run(async ctx => ({
    raw: await ctx.db.query("rawEvidence").unique(), prop: await ctx.db.query("props").unique(),
    usage: await ctx.db.query("usageSignals").collect(),
  }));
  expect(stored.raw?.captureProvenance).toEqual(captured.captureProvenance);
  expect(stored.raw?.observations).toEqual([observation]);
  expect(stored.prop).toMatchObject({ visibility: "DRAFT", status: "TESTING" });
  expect(stored.prop?.startedAt).toBeUndefined();
  expect(stored.prop?.activity).toBeUndefined();
  expect(stored.usage).toEqual([]);
  expect(await t.query(api.publicProfiles.getByHandle, { handle: "owner" })).toBeNull();
});

test("mailbox persistence rejects missing or conflicting origin, provider and stable record identity before retaining anything", async () => {
  const { t, owner, connect } = await fixture();
  const { accountId } = await connect();
  const scan = await owner.mutation(startScan, { accountId, expectedGeneration: 1 });
  const original = signal();
  const invalid = [
    { ...original, captureProvenance: undefined },
    { ...original, sourceRecordId: undefined },
    { ...original, sourceType: "MICROSOFT_MAIL" },
    { ...original, captureProvenance: { ...original.captureProvenance, origin: { ...original.captureProvenance.origin, accountId: "google-work" } } },
    { ...original, captureProvenance: { ...original.captureProvenance, origin: { ...original.captureProvenance.origin, issuer: "MICROSOFT" } } },
    { ...original, captureProvenance: { ...original.captureProvenance, origin: { ...original.captureProvenance.origin, recordId: "different-message" } } },
  ];
  for (const candidate of invalid) {
    await expect(t.mutation(invalidPersist, { ...batch(accountId, scan), signals: [candidate] })).rejects.toThrow();
  }
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toHaveLength(0);
  expect((await t.run(ctx => ctx.db.get(accountId)))?.cursor).toBeNull();
});

test("atomic page persistence is replayable, while changed batches and concurrent stale pages cannot advance the cursor", async () => {
  const { t, owner, connect } = await fixture();
  const { accountId } = await connect();
  const scan = await owner.mutation(startScan, { accountId, expectedGeneration: 1 });
  const first = batch(accountId, scan);
  const result = await t.mutation(persist, first);
  expect(await t.mutation(persist, first)).toEqual(result);
  await expect(t.mutation(persist, { ...first, nextCursor: "tampered" })).rejects.toThrow("batch");
  await expect(t.mutation(persist, { ...first, batchId: "page-2", nextCursor: "cursor-2" })).rejects.toThrow("cursor");
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toHaveLength(1);
  expect((await t.run(ctx => ctx.db.get(accountId)))?.cursor).toBe("cursor-1");
  const second = { ...first, batchId: "page-2", expectedCursor: "cursor-1", nextCursor: "cursor-2", signals: [signal("google-personal", "message-2")], complete: true };
  await t.mutation(persist, second);
  expect(await t.mutation(persist, first)).toEqual(result);
  const resumed = await owner.mutation(startScan, { accountId, expectedGeneration: 1 });
  expect(resumed.cursor).toBe("cursor-2");
});

test("a second-record collision rolls back the entire page and keeps original reviews and cursor", async () => {
  const { t, owner, connect } = await fixture();
  const { accountId } = await connect();
  const scan = await owner.mutation(startScan, { accountId, expectedGeneration: 1 });
  await t.mutation(persist, batch(accountId, scan));
  const card = (await owner.query(api.onboarding.getState, {}))!.cards[0];
  await owner.mutation(api.onboarding.reviewClaim, {
    propId: card.prop._id, rawEvidenceId: card.claims[0].rawEvidenceId, observationIndex: 0,
    verdict: "INCOMPLETE", correction: "Signup only.",
  });
  await expect(t.mutation(persist, {
    ...batch(accountId, scan), batchId: "page-2", expectedCursor: "cursor-1", nextCursor: "cursor-2",
    signals: [signal("google-personal", "message-new"), { ...signal(), payload: observation.excerpt + " changed" }],
  })).rejects.toThrow("collision");
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toHaveLength(1);
  expect(await t.run(ctx => ctx.db.query("mailboxBatches").collect())).toHaveLength(1);
  expect((await t.run(ctx => ctx.db.get(accountId)))?.cursor).toBe("cursor-1");
  expect((await owner.query(api.onboarding.getState, {}))!.cards[0].claims[0].review?.verdict).toBe("INCOMPLETE");
});

test("disconnect and reconnect invalidate in-flight writes and stale callbacks while keeping evidence and reviews", async () => {
  const { t, owner, connect } = await fixture();
  const { accountId } = await connect();
  const scan = await owner.mutation(startScan, { accountId, expectedGeneration: 1 });
  await t.mutation(persist, batch(accountId, scan));
  await owner.mutation(disconnect, { accountId, expectedGeneration: 1 });
  expect(await t.run(ctx => ctx.db.query("mailboxSecrets").collect())).toHaveLength(0);
  expect((await t.run(ctx => ctx.db.get(accountId)))?.generation).toBe(2);
  await expect(t.mutation(persist, batch(accountId, scan))).rejects.toThrow("generation");
  await expect(connect("google-personal", "GOOGLE", 1)).rejects.toThrow("generation");
  const reconnected = await connect("google-personal", "GOOGLE", 2);
  expect(reconnected).toEqual({ accountId, generation: 3 });
  await expect(t.mutation(persist, batch(accountId, scan))).rejects.toThrow("generation");
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toHaveLength(1);
  expect(await t.run(ctx => ctx.db.query("evidenceSources").collect())).toHaveLength(1);
});

test("needs-reauth rejects stale transitions and invalidates active work", async () => {
  const { t, owner, connect } = await fixture();
  const { accountId } = await connect();
  const scan = await owner.mutation(startScan, { accountId, expectedGeneration: 1 });
  await t.mutation(needsReauth, { accountId, expectedGeneration: 1 });
  await expect(t.mutation(needsReauth, { accountId, expectedGeneration: 1 })).rejects.toThrow("generation");
  await expect(t.mutation(persist, batch(accountId, scan))).rejects.toThrow("generation");
  expect((await owner.query(list, {}))[0].status).toBe("NEEDS_REAUTH");
  expect(await t.run(ctx => ctx.db.query("mailboxSecrets").collect())).toHaveLength(0);
});

test("an active lease blocks overlapping scans; an expired and replaced job cannot write", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-16T01:00:00Z"));
  const { t, owner, connect } = await fixture();
  const { accountId } = await connect();
  const scan = await owner.mutation(startScan, { accountId, expectedGeneration: 1 });
  await expect(owner.mutation(startScan, { accountId, expectedGeneration: 1 })).rejects.toThrow("active");
  vi.advanceTimersByTime(5 * 60 * 1000);
  await expect(t.mutation(persist, batch(accountId, scan))).rejects.toThrow("lease");
  const replacement = await owner.mutation(startScan, { accountId, expectedGeneration: 1 });
  expect(replacement.jobId).not.toBe(scan.jobId);
  await expect(t.mutation(persist, batch(accountId, scan))).rejects.toThrow();
  await t.mutation(persist, batch(accountId, replacement));
});

test("immutable owner survives handle rename and reassignment without duplicating an existing private product", async () => {
  const { t, owner, other, ids, connect } = await fixture();
  // Exercise the legacy-to-mailbox boundary with a pre-existing draft.
  await t.mutation(internal.discovery.ingestSignals, {
    handle: "owner", sourceType: "GMAIL", sourceKey: "legacy-account",
    signals: [{ ...signal(), captureProvenance: undefined }],
  });
  const originalProp = await t.run(ctx => ctx.db.query("props").unique());
  const { accountId } = await connect();
  const scan = await owner.mutation(startScan, { accountId, expectedGeneration: 1 });
  await t.run(async ctx => {
    // Reproduce actual Task 1 storage, whose relationship/link keys used a
    // mutable handle, while preserving its existing draft.resultPropId.
    if (!originalProp) throw new Error("Historical fixture missing its relationship.");
    await ctx.db.patch(originalProp._id, { seedKey: "owner-github-import" });
    const link = await ctx.db.query("links").withIndex("by_prop", q => q.eq("propId", originalProp._id)).unique();
    if (!link) throw new Error("Historical fixture missing its link.");
    await ctx.db.patch(link._id, { seedKey: "owner-github-import-primary" });
    await ctx.db.patch(ids.owner, { handle: "renamed" });
    await ctx.db.patch(ids.other, { handle: "owner" });
  });
  await t.mutation(persist, batch(accountId, scan));
  const props = await t.run(ctx => ctx.db.query("props").collect());
  expect(props).toHaveLength(1);
  expect(props[0]._id).toBe(originalProp?._id);
  expect(props[0].seedKey).toBe("owner-github-import");
  expect(props[0].userId).toBe(ids.owner);
  expect((await other.query(api.onboarding.getState, {}))?.cards).toEqual([]);
  expect((await owner.query(api.onboarding.getState, {}))?.cards).toHaveLength(1);
  const legacy = (await t.run(ctx => ctx.db.query("rawEvidence").collect())).find(row => !row.captureProvenance);
  expect(legacy?.captureProvenance).toBeUndefined();
});

test("cross-account jobs and oversized captures cannot partially persist", async () => {
  const { t, owner, connect } = await fixture();
  const personal = await connect();
  const work = await connect("google-work");
  const scan = await owner.mutation(startScan, { accountId: personal.accountId, expectedGeneration: 1 });
  await expect(t.mutation(persist, batch(work.accountId, scan))).rejects.toThrow("job");
  await expect(t.mutation(persist, batch(personal.accountId, scan, [{ ...signal(), payload: "x".repeat(65537) }]))).rejects.toThrow("size");
  await expect(t.mutation(persist, batch(personal.accountId, scan, Array.from({ length: 51 }, (_, i) => signal("google-personal", `message-${i}`))))).rejects.toThrow("batch");
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toHaveLength(0);
});

test("Microsoft messages keep source meaning; re-collection preserves first provenance and changed extraction is rejected", async () => {
  const { t, owner, connect } = await fixture();
  const { accountId } = await connect("microsoft-personal", "MICROSOFT");
  const scan = await owner.mutation(startScan, { accountId, expectedGeneration: 1 });
  const captured = signal("microsoft-personal", "message-1", "MICROSOFT");
  await t.mutation(persist, batch(accountId, scan, [captured]));
  const changed: Signal = { ...captured, captureProvenance: { ...captured.captureProvenance, route: "WEBMCP" } };
  await t.mutation(persist, {
    ...batch(accountId, scan, [changed]), batchId: "page-2", expectedCursor: "cursor-1", nextCursor: "cursor-2",
  });
  await expect(t.mutation(persist, {
    ...batch(accountId, scan, [{ ...captured, observations: [{ ...observation, kind: "FIRST_USE" }] }]),
    batchId: "page-3", expectedCursor: "cursor-2", nextCursor: "cursor-3",
  })).rejects.toThrow("collision");
  expect((await t.run(ctx => ctx.db.query("evidenceSources").unique()))?.type).toBe("MICROSOFT_MAIL");
  expect((await t.run(ctx => ctx.db.query("rawEvidence").unique()))?.captureProvenance).toEqual(captured.captureProvenance);
  expect((await t.run(ctx => ctx.db.query("proofs").unique()))?.type).toBe("EMAIL_EVIDENCE");
});
