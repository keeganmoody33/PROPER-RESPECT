// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

async function fixture() {
  const t = convexTest(schema, modules);
  await t.run(ctx => ctx.db.insert("users", { handle: "owner", authSubject: "owner", displayName: "Owner", bio: "" }));
  const owner = t.withIdentity({ subject: "owner" });
  const content = '{"sessions":[]}';
  const storageId = await t.run(ctx => ctx.storage.store(new Blob([content], { type: "application/json" })));
  // This is the request produced by the old non-CSV browser classifier.
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
});

test("replaying the same upload returns the existing capture without adding evidence or proofs", async () => {
  const { t, owner, upload } = await fixture();
  const first = await owner.mutation(api.onboarding.retainUpload, upload);
  const replay = await owner.mutation(api.onboarding.retainUpload, upload);
  expect(replay).toBe(first);
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toHaveLength(1);
  expect(await t.run(ctx => ctx.db.query("proofs").collect())).toHaveLength(1);
});
