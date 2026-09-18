// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const persist = internal.mailboxDiscovery.persistBatch;
const startScan = api.mailboxes.startScan;
type Signal = FunctionArgs<typeof persist>["signals"][number];
const credential = {
  algorithm: "AES-256-GCM" as const, keyVersion: "test-key-1",
  ciphertext: btoa("synthetic encrypted fixture bytes"), iv: btoa("123456789012"),
};

function capture(accountId = "google-personal"): Signal {
  return {
    sourceType: "GMAIL", sourceRecordId: "message-1", capturedAt: "2026-09-16T00:00:00.000Z",
    payload: "From: GitHub <notifications@github.com>\nSubject: Your account", observations: [],
    captureProvenance: {
      version: 1, route: "DIRECT_API", adapter: { id: "mailbox-fixture", version: "1" },
      origin: { issuer: "GOOGLE", accountId, recordId: "message-1" },
      collector: { kind: "AGENT", id: "test-collector" }, activityActor: { kind: "UNKNOWN" },
    },
  };
}
function recognized(accountId = "google-personal"): Signal {
  return { ...capture(accountId), vendor: "GitHub", url: "https://github.com", capturedAt: "2026-09-18T00:00:00.000Z" };
}
function page(accountId: Id<"mailboxAccounts">, scan: FunctionReturnType<typeof startScan>, signals: Signal[]): FunctionArgs<typeof persist> {
  return { accountId, jobId: scan.jobId, expectedGeneration: scan.generation, queryKey: scan.queryKey,
    expectedCursor: scan.cursor, nextCursor: "next-page", batchId: "page-1", complete: true, readCount: signals.length, signals };
}
async function fixture() {
  const t = convexTest(schema, modules);
  const ownerId = await t.run(ctx => ctx.db.insert("users", { handle: "owner", authSubject: "owner", displayName: "Owner", bio: "" }));
  const otherId = await t.run(ctx => ctx.db.insert("users", { handle: "other", authSubject: "other", displayName: "Other", bio: "" }));
  const owner = t.withIdentity({ subject: "owner" });
  async function connect(providerAccountId = "google-personal", userId = ownerId) {
    return await t.mutation(internal.mailboxes.finalizeVerifiedConnection, {
      ownerId: userId, provider: "GOOGLE", providerAccountId, accountLabel: "Mailbox",
      scopes: ["https://www.googleapis.com/auth/gmail.readonly"], credential, expectedGeneration: 0,
    });
  }
  const { accountId } = await connect();
  const history = await owner.mutation(startScan, { accountId, expectedGeneration: 1, mode: "HISTORY" });
  // Simulate a header retained before this sender acquired a catalog match.
  await t.mutation(persist, { ...page(accountId, history, [capture()]), unknown: [{ sourceRecordId: "message-1", senderDomain: "github.com" }] });
  const original = (await t.run(ctx => ctx.db.query("rawEvidence").unique()))!;
  const unmatched = (await t.run(ctx => ctx.db.query("mailboxUnknownRecords").unique()))!;
  return { t, owner, ownerId, otherId, connect, accountId, history, original, unmatched };
}

test.each(["PENDING", "DISMISSED", "LINKED"] as const)("later catalog recognition preserves a %s unmatched original and advances/replays its page", async status => {
  const { t, owner, ownerId, accountId, history, original, unmatched } = await fixture();
  if (status === "LINKED") {
    const propId = await t.run(async ctx => {
      const productId = await ctx.db.insert("products", { name: "Owner's choice", slug: "chosen", domain: "chosen.example", description: "" });
      return await ctx.db.insert("props", { userId: ownerId, productId, status: "TESTING", visibility: "DRAFT", headline: "", note: "" });
    });
    await owner.mutation(api.inventory.save, { propId, operationId: "prior-choice", expectedVersion: 0,
      status: "ARCHIVED", goTo: true, headline: "My prior decision", note: "Keep my private testimony." });
    await owner.mutation(api.mailboxDiscovery.reviewUnknown, { id: unmatched._id, decision: "LINKED", propId });
  } else if (status === "DISMISSED") {
    await owner.mutation(api.mailboxDiscovery.reviewUnknown, { id: unmatched._id, decision: "DISMISSED" });
  }
  const before = await t.run(async ctx => ({
    review: await ctx.db.get(unmatched._id), props: await ctx.db.query("props").collect(),
    proofs: await ctx.db.query("proofs").collect(), events: await ctx.db.query("relationshipEvents").collect(),
    history: await ctx.db.get(history.contextId!),
  }));
  const scan = await owner.mutation(startScan, { accountId, expectedGeneration: 1, mode: "KNOWN_PRODUCTS" });
  const next = { ...page(accountId, scan, [recognized()]), complete: false };
  const result = await t.mutation(persist, next);
  expect(result).toMatchObject({ ingestedSignals: 1, proposals: 1 });
  expect(result.createdDrafts).toHaveLength(1);
  const contextAfter = await t.run(ctx => ctx.db.get(scan.contextId!));
  const jobAfter = await t.run(ctx => ctx.db.get(scan.jobId));
  expect(contextAfter).toMatchObject({ cursor: "next-page", pagesRead: 1, messagesRead: 1, retainedRecords: 0 });
  expect(jobAfter).toMatchObject({ cursor: "next-page", status: "ACTIVE" });
  expect(await t.mutation(persist, next)).toEqual(result);
  expect(await t.run(ctx => ctx.db.get(scan.contextId!))).toEqual(contextAfter);
  expect(await t.run(ctx => ctx.db.get(scan.jobId))).toEqual(jobAfter);
  await expect(t.mutation(persist, { ...next, signals: [{ ...recognized(), vendor: "Notion" }] })).rejects.toThrow("batch identity collision");
  // A later page can encounter the same record too; neither path adds a capture.
  expect(await t.mutation(persist, { ...next, batchId: "page-2", expectedCursor: "next-page", nextCursor: null, complete: true }))
    .toMatchObject({ proposals: 1, createdDrafts: [] });
  expect(await t.run(ctx => ctx.db.get(scan.contextId!))).toMatchObject({ cursor: null, pagesRead: 2, messagesRead: 2, retainedRecords: 0 });
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toEqual([original]);
  expect(await t.run(ctx => ctx.db.get(unmatched._id))).toEqual(before.review);
  expect(await t.run(ctx => ctx.db.get(history.contextId!))).toEqual(before.history);
  for (const prop of before.props) expect(await t.run(ctx => ctx.db.get(prop._id))).toEqual(prop);
  for (const proof of before.proofs) expect(await t.run(ctx => ctx.db.get(proof._id))).toEqual(proof);
  expect(await t.run(ctx => ctx.db.query("relationshipEvents").collect())).toEqual(before.events);
  const draft = (await t.run(ctx => ctx.db.query("draftImports").unique()))!;
  expect(draft).toMatchObject({ status: "PENDING", suggestedProductSlug: "github", rawEvidenceIds: [original._id] });
  const prop = (await t.run(ctx => ctx.db.get(draft.resultPropId!)))!;
  expect(prop).toMatchObject({ status: "TESTING", visibility: "DRAFT" });
  expect(prop.confirmedAt).toBeUndefined();
  expect(prop.startedAt).toBeUndefined();
  const proofs = await t.run(ctx => ctx.db.query("proofs").collect());
  expect(proofs).toHaveLength(before.proofs.length + 1);
  expect(proofs.find(proof => proof.propId === prop._id)).toMatchObject({ rawEvidenceId: original._id, label: "GitHub", url: "https://github.com" });
  for (const table of ["usageSignals", "claimReviews", "publishedProfiles"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
});

test.each(["payload", "observations", "actor", "origin"] as const)("catalog recognition cannot bypass the original %s collision guard", async changed => {
  const { t, owner, accountId, original, unmatched } = await fixture();
  const scan = await owner.mutation(startScan, { accountId, expectedGeneration: 1, mode: "KNOWN_PRODUCTS" });
  const signal = recognized();
  if (changed === "payload") signal.payload += " Changed extraction.";
  if (changed === "observations") signal.observations = [{ kind: "SIGNUP", date: "2026-09-16", excerpt: "Your account", scope: "UNKNOWN", acquisition: "SOURCE_REPORTED" }];
  if (changed === "actor") signal.captureProvenance!.activityActor = { kind: "HUMAN", id: "new-attribution" };
  if (changed === "origin") signal.captureProvenance!.origin.artifactRef = "changed-artifact";
  const contextBefore = await t.run(ctx => ctx.db.get(scan.contextId!));
  await expect(t.mutation(persist, page(accountId, scan, [signal]))).rejects.toThrow("Evidence identity collision");
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toEqual([original]);
  expect(await t.run(ctx => ctx.db.get(unmatched._id))).toEqual(unmatched);
  expect(await t.run(ctx => ctx.db.get(scan.contextId!))).toEqual(contextBefore);
  expect(await t.run(ctx => ctx.db.query("draftImports").collect())).toEqual([]);
  expect(await t.run(ctx => ctx.db.query("mailboxBatches").collect())).toHaveLength(1);
});

test("catalog recognition remains scoped to the provider account, owner and active generation", async () => {
  const { t, owner, otherId, connect, accountId, original, unmatched } = await fixture();
  const scan = await owner.mutation(startScan, { accountId, expectedGeneration: 1, mode: "KNOWN_PRODUCTS" });
  const { accountId: otherAccount } = await connect("google-work");
  const otherScan = await owner.mutation(startScan, { accountId: otherAccount, expectedGeneration: 1, mode: "KNOWN_PRODUCTS" });
  await expect(t.mutation(persist, page(otherAccount, otherScan, [recognized()]))).rejects.toThrow("matching provider, account, record identity");
  await t.mutation(persist, page(otherAccount, otherScan, [recognized("google-work")]));
  const second = (await t.run(ctx => ctx.db.query("rawEvidence").collect())).find(raw => raw._id !== original._id)!;
  expect(second.evidenceSourceId).not.toBe(original.evidenceSourceId);
  expect(second.detectedVendor).toBe("GitHub");
  const { accountId: otherOwnerAccount } = await connect("google-personal", otherId);
  const otherOwnerScan = await t.withIdentity({ subject: "other" }).mutation(startScan, { accountId: otherOwnerAccount, expectedGeneration: 1, mode: "KNOWN_PRODUCTS" });
  await t.mutation(persist, page(otherOwnerAccount, otherOwnerScan, [recognized()]));
  const third = (await t.run(ctx => ctx.db.query("rawEvidence").collect())).find(raw => raw.userId === otherId)!;
  expect(third.evidenceSourceId).not.toBe(original.evidenceSourceId);
  expect(third.detectedVendor).toBe("GitHub");
  await owner.mutation(api.mailboxes.disconnect, { accountId, expectedGeneration: 1 });
  await expect(t.mutation(persist, page(accountId, scan, [recognized()]))).rejects.toThrow("generation");
  expect(await t.run(ctx => ctx.db.get(original._id))).toEqual(original);
  expect(await t.run(ctx => ctx.db.get(unmatched._id))).toEqual(unmatched);
  expect(await t.run(ctx => ctx.db.get(scan.contextId!))).toMatchObject({ cursor: null, pagesRead: 0, retainedRecords: 0 });
  const drafts = await t.run(ctx => ctx.db.query("draftImports").collect());
  expect(drafts.flatMap(draft => draft.rawEvidenceIds)).not.toContain(original._id);
});
