// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { MAX_EVIDENCE_UPLOAD_BYTES } from "../src/domain/evidence-upload";

const modules = import.meta.glob("./**/*.ts");
afterEach(() => vi.unstubAllEnvs());

async function fixture() {
  vi.stubEnv("CONVEX_SITE_URL", "https://fixture.convex.site");
  const t = convexTest(schema, modules);
  const userId = await t.run(ctx => ctx.db.insert("users", { handle: "uploader", authSubject: "uploader", displayName: "Uploader", bio: "" }));
  await t.run(ctx => ctx.db.insert("users", { handle: "other", authSubject: "other", displayName: "Other", bio: "" }));
  const owner = t.withIdentity({ subject: "uploader", issuer: "https://auth.example" });
  const other = t.withIdentity({ subject: "other", issuer: "https://auth.example" });
  // convex-test's storage.store omits contentType; browser-unknown MIME exercises
  // the real HTTP router/storage/transaction path without patching the provider emulator.
  const body = '{"sessions":[]}';
  const metadata = { filename: "devin.json", mimeType: "application/octet-stream", byteSize: body.length, vendor: "Devin" };
  const ticket = await owner.mutation(api.onboarding.beginUpload, metadata);
  const path = new URL(ticket.uploadUrl).pathname + new URL(ticket.uploadUrl).search;
  const request = (bytes = body) => ({ method: "POST", headers: { "Content-Type": metadata.mimeType }, body: bytes });
  return { t, owner, other, userId, metadata, ticket, path, request };
}

test("authenticated bytes bind an owner before first retention; identical retries are idempotent", async () => {
  const f = await fixture();
  const uploaded = await f.owner.fetch(f.path, f.request());
  expect(uploaded.status).toBe(200);
  const { storageId } = await uploaded.json() as { storageId: Id<"_storage"> };
  expect(await f.t.run(ctx => ctx.db.query("rawEvidence").collect())).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.get(f.ticket.ticketId))).toMatchObject({ userId: f.userId, storageId });
  await expect(f.other.mutation(api.onboarding.retainUpload, { ...f.metadata, storageId, sourceType: "FILE_UPLOAD" })).rejects.toThrow("unavailable");
  const id = await f.owner.mutation(api.onboarding.retainUpload, { ...f.metadata, storageId, sourceType: "FILE_UPLOAD" });
  const raw = await f.t.run(ctx => ctx.db.get(id));
  expect(raw).toMatchObject({ userId: f.userId, uploadAttribution: { status: "VERIFIED_OWNER_SESSION", userId: f.userId, ticketId: f.ticket.ticketId, tokenIdentifier: "https://auth.example|uploader" }, captureProvenance: { activityActor: { kind: "UNKNOWN" } } });
  expect(raw!.uploadAttribution!.sha256).toMatch(/^[0-9a-f]{64}$/);
  expect((await f.owner.fetch(f.path, f.request())).status).toBe(200);
  expect(await f.owner.mutation(api.onboarding.retainUpload, { ...f.metadata, storageId, sourceType: "FILE_UPLOAD" })).toBe(id);
  expect(await f.t.run(ctx => ctx.db.query("rawEvidence").collect())).toHaveLength(1);
  expect(await f.t.run(ctx => ctx.db.system.query("_storage").collect())).toHaveLength(1);
  expect(await f.t.run(ctx => ctx.db.query("publishedProfiles").collect())).toEqual([]);
  const prop = (await f.t.run(ctx => ctx.db.query("props").unique()))!;
  const evidence = await f.owner.query(api.inventory.evidence, { propId: prop._id, paginationOpts: { cursor: null, numItems: 10 } });
  expect(evidence.page[0].uploadedFile?.attribution).toBe("VERIFIED_OWNER_SESSION");
});

test("anonymous, another owner, another issuer and expired tickets cannot store bytes", async () => {
  const f = await fixture();
  expect((await f.t.fetch(f.path, f.request())).status).toBe(401);
  expect((await f.other.fetch(f.path, f.request())).status).toBe(404);
  const sameSubjectOtherIssuer = f.t.withIdentity({ subject: "uploader", issuer: "https://other.example" });
  expect((await sameSubjectOtherIssuer.fetch(f.path, f.request())).status).toBe(404);
  await f.t.run(ctx => ctx.db.patch(f.ticket.ticketId, { expiresAt: Date.now() - 1 }));
  expect((await f.owner.fetch(f.path, f.request())).status).toBe(404);
  expect(await f.t.run(ctx => ctx.db.system.query("_storage").collect())).toEqual([]);
  await expect(f.t.mutation(api.onboarding.beginUpload, f.metadata)).rejects.toThrow("Authentication required");
  await expect(f.owner.mutation(api.onboarding.generateUploadUrl, {})).rejects.toThrow("Reload");
});

test("foreign metadata, oversized/truncated bodies and conflicting retries cannot rebind a ticket", async () => {
  const f = await fixture();
  expect((await f.owner.fetch(f.path, { ...f.request(), headers: { "Content-Type": "image/png" } })).status).toBe(400);
  expect((await f.owner.fetch(f.path, f.request("short"))).status).toBe(400);
  expect((await f.owner.fetch(f.path, f.request("x".repeat(f.metadata.byteSize + 1)))).status).toBe(413);
  await expect(f.owner.mutation(api.onboarding.beginUpload, { ...f.metadata, byteSize: MAX_EVIDENCE_UPLOAD_BYTES + 1 })).rejects.toThrow("19 MiB");
  const result = await f.owner.fetch(f.path, f.request());
  expect(result.status).toBe(200);
  const { storageId } = await result.json() as { storageId: Id<"_storage"> };
  const before = await f.t.run(ctx => ctx.db.get(f.ticket.ticketId));
  expect((await f.owner.fetch(f.path, f.request("x".repeat(f.metadata.byteSize)))).status).toBe(409);
  await expect(f.owner.mutation(api.onboarding.retainUpload, { ...f.metadata, storageId, filename: "other.json", sourceType: "FILE_UPLOAD" })).rejects.toThrow("metadata");
  expect(await f.t.run(ctx => ctx.db.get(f.ticket.ticketId))).toEqual(before);
  expect(await f.t.run(ctx => ctx.db.query("rawEvidence").collect())).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.system.query("_storage").collect())).toHaveLength(1);
});

test("interleaved identical finalization cannot rebind the original or duplicate its proof", async () => {
  const f = await fixture();
  const first = await f.owner.fetch(f.path, f.request());
  expect(first.status).toBe(200);
  const { storageId } = await first.json() as { storageId: Id<"_storage"> };
  const bound = (await f.t.run(ctx => ctx.db.get(f.ticket.ticketId)))!;
  // convex-test cannot concurrently store blobs (Write outside of transaction).
  // Exercise the serialized commit of a second in-flight request instead.
  const lateStorageId = await f.t.run(ctx => ctx.storage.store(new Blob([f.request().body])));
  expect(await f.owner.mutation(internal.onboarding.bindUploadedFile, { ticketId: f.ticket.ticketId, storageId: lateStorageId, sha256: bound.sha256! })).toBe(storageId);
  const args = { ...f.metadata, storageId, sourceType: "FILE_UPLOAD" as const };
  const id = await f.owner.mutation(api.onboarding.retainUpload, args);
  expect(await f.owner.mutation(api.onboarding.retainUpload, args)).toBe(id);
  expect(await f.t.run(ctx => ctx.db.query("proofs").collect())).toHaveLength(1);
  expect((await f.t.run(ctx => ctx.db.get(f.ticket.ticketId)))?.storageId).toBe(storageId);
});

test("legacy retained files stay explicitly unverified without rewriting or backfilling attribution", async () => {
  const f = await fixture();
  const sourceId = await f.t.run(ctx => ctx.db.insert("evidenceSources", { userId: f.userId, type: "FILE_UPLOAD", connectedAt: "2026-09-01T00:00:00Z" }));
  const storageId = await f.t.run(ctx => ctx.storage.store(new Blob([f.request().body])));
  const id = await f.t.run(ctx => ctx.db.insert("rawEvidence", { userId: f.userId, evidenceSourceId: sourceId, storageId, filename: f.metadata.filename, mimeType: f.metadata.mimeType, byteSize: f.metadata.byteSize, detectedVendor: f.metadata.vendor, capturedAt: "2026-09-01T00:00:00Z", dedupKey: "legacy" }));
  const before = await f.t.run(ctx => ctx.db.get(id));
  const state = await f.owner.query(api.onboarding.getState, {});
  expect(state!.evidence.find(item => item._id === id)?.uploadAttribution).toBe("UNVERIFIED_LEGACY");
  await expect(f.other.mutation(api.onboarding.retainUpload, { ...f.metadata, storageId, sourceType: "FILE_UPLOAD" })).rejects.toThrow("unavailable");
  expect(await f.t.run(ctx => ctx.db.get(id))).toEqual(before);
});

test("deleted evidence cannot be resurrected by replaying its upload ticket", async () => {
  const f = await fixture();
  const { storageId } = await (await f.owner.fetch(f.path, f.request())).json() as { storageId: Id<"_storage"> };
  const id = await f.owner.mutation(api.onboarding.retainUpload, { ...f.metadata, storageId, sourceType: "FILE_UPLOAD" });
  await f.owner.mutation(api.onboarding.deleteEvidence, { evidenceId: id });
  expect((await f.owner.fetch(f.path, f.request())).status).toBe(404);
  expect((await f.t.run(ctx => ctx.db.get(id)))?.deletedAt).toBeDefined();
});

test("expiry between byte receipt and first retention fails closed", async () => {
  const f = await fixture();
  const { storageId } = await (await f.owner.fetch(f.path, f.request())).json() as { storageId: Id<"_storage"> };
  await f.t.run(ctx => ctx.db.patch(f.ticket.ticketId, { expiresAt: Date.now() - 1 }));
  await expect(f.owner.mutation(api.onboarding.retainUpload, { ...f.metadata, storageId, sourceType: "FILE_UPLOAD" })).rejects.toThrow("expired");
  expect(await f.t.run(ctx => ctx.db.query("rawEvidence").collect())).toEqual([]);
});

test("unbound legacy storage cannot be promoted to verified ownership even by an authenticated owner", async () => {
  const f = await fixture();
  const storageId = await f.t.run(ctx => ctx.storage.store(new Blob([f.request().body])));
  await expect(f.owner.mutation(api.onboarding.retainUpload, { ...f.metadata, storageId, sourceType: "FILE_UPLOAD" })).rejects.toThrow("authenticated upload");
  expect(await f.t.run(ctx => ctx.db.query("rawEvidence").collect())).toEqual([]);
});
