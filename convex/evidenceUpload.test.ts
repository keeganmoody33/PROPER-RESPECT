// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

async function fixture() {
  const t = convexTest(schema, modules);
  await t.run(ctx => ctx.db.insert("users", { handle: "owner", authSubject: "owner", displayName: "Owner", bio: "" }));
  const owner = t.withIdentity({ subject: "owner" });
  const content = '{"sessions":[]}';
  const storageId = await t.run(ctx => ctx.storage.store(new Blob([content], { type: "application/json" })));
  // convex-test store() omits contentType; seed the metadata a real upload records.
  await t.run(ctx => ctx.db.patch(storageId as unknown as Id<"rawEvidence">, { contentType: "application/json" } as never));
  const upload = { storageId, filename: "devin-export.json", mimeType: "application/json", byteSize: content.length, sourceType: "SCREENSHOT" as const, vendor: "Devin" };
  return { t, owner, upload };
}

test("JSON uploads retain their real format instead of trusting the legacy screenshot label", async () => {
  const { t, owner, upload } = await fixture();
  const id = await owner.mutation(api.onboarding.retainUpload, upload);
  const raw = await t.run(ctx => ctx.db.get(id));
  expect(raw).toMatchObject({ filename: upload.filename, mimeType: "application/json", storageId: upload.storageId });
  expect(await t.run(ctx => ctx.db.get(raw!.evidenceSourceId))).toMatchObject({ type: "FILE_UPLOAD" });
});

test("an uploaded original is linked to its private product supporting details", async () => {
  const { t, owner, upload } = await fixture();
  const id = await owner.mutation(api.onboarding.retainUpload, upload);
  const prop = await t.run(ctx => ctx.db.query("props").unique());
  expect(prop).toMatchObject({ visibility: "DRAFT" });
  expect(await t.run(ctx => ctx.db.query("proofs").collect())).toEqual([
    expect.objectContaining({ propId: prop!._id, rawEvidenceId: id, type: "FILE_UPLOAD" }),
  ]);
  const context = await owner.query(api.inventory.evidence, { propId: prop!._id, paginationOpts: { numItems: 10, cursor: null } });
  expect(context.page).toHaveLength(1);
  expect(context.page[0]).toMatchObject({ uploadedFile: { filename: upload.filename, mimeType: upload.mimeType, byteSize: upload.byteSize } });
  expect(prop?.activity).toBeUndefined();
  expect(prop?.confirmedAt).toBeUndefined();
});

test("replaying the same upload returns the existing capture without adding evidence or proofs", async () => {
  const { t, owner, upload } = await fixture();
  const first = await owner.mutation(api.onboarding.retainUpload, upload);
  const replay = await owner.mutation(api.onboarding.retainUpload, upload);
  expect(replay).toBe(first);
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toHaveLength(1);
  expect(await t.run(ctx => ctx.db.query("proofs").collect())).toHaveLength(1);
});


test("conflicting replay and another owner cannot relabel an already retained storage object", async () => {
  const { t, owner, upload } = await fixture();
  const id = await owner.mutation(api.onboarding.retainUpload, upload);
  await expect(owner.mutation(api.onboarding.retainUpload, { ...upload, vendor: "GitHub" })).rejects.toThrow("different metadata");
  await t.run(ctx => ctx.db.insert("users", { handle: "other", authSubject: "other", displayName: "Other", bio: "" }));
  await expect(t.withIdentity({ subject: "other" }).mutation(api.onboarding.retainUpload, upload)).rejects.toThrow("unavailable");
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toEqual([await t.run(ctx => ctx.db.get(id))]);
});

test("missing storage, mismatched size, and mismatched stored content type fail before retaining records", async () => {
  const { t, owner, upload } = await fixture();
  await expect(owner.mutation(api.onboarding.retainUpload, { ...upload, byteSize: upload.byteSize + 1 })).rejects.toThrow("metadata");
  await expect(owner.mutation(api.onboarding.retainUpload, { ...upload, mimeType: "text/plain" })).rejects.toThrow("metadata");
  await t.run(ctx => ctx.storage.delete(upload.storageId));
  await expect(owner.mutation(api.onboarding.retainUpload, upload)).rejects.toThrow("metadata");
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toEqual([]);
  expect(await t.run(ctx => ctx.db.query("props").collect())).toEqual([]);
});

test("retaining an original preserves confirmed relationship decisions and prior review", async () => {
  const { t, owner, upload } = await fixture();
  await owner.mutation(api.onboarding.retainUpload, upload);
  const prop = (await t.run(ctx => ctx.db.query("props").unique()))!;
  const draft = (await t.run(ctx => ctx.db.query("draftImports").unique()))!;
  await t.run(async ctx => {
    await ctx.db.patch(prop._id, { visibility: "PUBLIC", status: "ACTIVE", confirmedAt: "2026-09-01T00:00:00.000Z", headline: "My own explanation", note: "Keep my words" });
    await ctx.db.patch(draft._id, { status: "APPROVED" });
  });
  const before = await t.run(ctx => ctx.db.get(prop._id));
  const storageId = await t.run(ctx => ctx.storage.store(new Blob(['{"sessions":[]}'], { type: "application/json" })));
  await t.run(ctx => ctx.db.patch(storageId as unknown as Id<"rawEvidence">, { contentType: "application/json" } as never));
  await owner.mutation(api.onboarding.retainUpload, { ...upload, storageId });
  expect(await t.run(ctx => ctx.db.get(prop._id))).toEqual(before);
  expect(await t.run(ctx => ctx.db.get(draft._id))).toMatchObject({ status: "APPROVED" });
  expect(await t.run(ctx => ctx.db.query("relationshipEvents").collect())).toEqual([]);
});


test("upload metadata cannot introduce usage measurements", async () => {
  const { t, owner, upload } = await fixture();
  await expect(owner.mutation(api.onboarding.retainUpload, {
    ...upload,
    activity: { kind: "contributionCalendar", attributionScope: "PERSONAL", capturedAt: "2026-09-19T00:00:00.000Z", freshness: "FRESH", provenanceLabel: "Unverified uploaded claim", total: 50, days: [] },
  })).rejects.toThrow("cannot add measurements");
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toEqual([]);
});

test("uploaded supporting details require the owning account", async () => {
  const { t, owner, upload } = await fixture();
  await owner.mutation(api.onboarding.retainUpload, upload);
  const prop = (await t.run(ctx => ctx.db.query("props").unique()))!;
  await t.run(ctx => ctx.db.insert("users", { handle: "other", authSubject: "other", displayName: "Other", bio: "" }));
  await expect(t.withIdentity({ subject: "other" }).query(api.inventory.evidence, { propId: prop._id, paginationOpts: { numItems: 10, cursor: null } })).rejects.toThrow();
});
