// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const observation = {
  kind: "SIGNUP" as const, date: "2025-03-12",
  excerpt: "Welcome to GitHub.", scope: "UNKNOWN" as const,
  acquisition: "SOURCE_REPORTED" as const,
};
const signal = {
  sourceType: "GMAIL" as const, sourceRecordId: "message-1", vendor: "GitHub",
  capturedAt: "2026-09-16T00:00:00.000Z", payload: observation.excerpt,
  observations: [observation],
};
function input(sourceKey = "google:account-personal") {
  return { handle: "owner", sourceType: "GMAIL" as const, sourceKey, sourceLabel: "Mailbox", signals: [signal] };
}
async function fixture() {
  const t = convexTest(schema, modules);
  await t.run(async ctx => {
    for (const handle of ["owner", "other"]) {
      await ctx.db.insert("users", { handle, authSubject: handle, displayName: handle, bio: "" });
    }
  });
  return t;
}

test("two mailboxes retain separate evidence, even with identical labels and message IDs, and join one private product draft", async () => {
  const t = await fixture();
  await t.mutation(internal.discovery.ingestSignals, input());
  await t.mutation(internal.discovery.ingestSignals, input("google:account-work"));
  const stored = await t.run(async ctx => ({
    sources: await ctx.db.query("evidenceSources").collect(),
    evidence: await ctx.db.query("rawEvidence").collect(),
    drafts: await ctx.db.query("draftImports").collect(),
    props: await ctx.db.query("props").collect(),
    proofs: await ctx.db.query("proofs").collect(),
  }));
  expect(stored.sources).toHaveLength(2);
  expect(stored.evidence).toHaveLength(2);
  expect(new Set(stored.evidence.map(row => row.evidenceSourceId)).size).toBe(2);
  expect(stored.props).toHaveLength(1);
  expect(stored.props[0]).toMatchObject({ visibility: "DRAFT", status: "TESTING" });
  expect(stored.props[0].startedAt).toBeUndefined();
  expect(stored.drafts).toHaveLength(1);
  expect(stored.drafts[0].rawEvidenceIds).toHaveLength(2);
  expect(stored.proofs).toHaveLength(2);
  const owner = t.withIdentity({ subject: "owner" });
  expect((await owner.query(api.onboarding.getState, {}))?.cards[0].claims).toHaveLength(2);
  expect((await t.withIdentity({ subject: "other" }).query(api.onboarding.getState, {}))?.cards).toEqual([]);
  expect(await t.query(api.publicProfiles.getByHandle, { handle: "owner" })).toBeNull();
});

test("re-fetching one message with a new collection time or account label preserves its original evidence and review", async () => {
  const t = await fixture();
  await t.mutation(internal.discovery.ingestSignals, input());
  const owner = t.withIdentity({ subject: "owner" });
  const before = (await owner.query(api.onboarding.getState, {}))!.cards[0];
  await owner.mutation(api.onboarding.reviewClaim, {
    propId: before.prop._id, rawEvidenceId: before.claims[0].rawEvidenceId,
    observationIndex: 0, verdict: "INCOMPLETE", correction: "Signup only.",
  });
  await t.mutation(internal.discovery.ingestSignals, {
    ...input(), sourceLabel: "Renamed account", signals: [{ ...signal, capturedAt: "2026-09-17T00:00:00.000Z" }],
  });
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toHaveLength(1);
  const after = (await owner.query(api.onboarding.getState, {}))!.cards[0];
  expect(after.claims[0].rawEvidenceId).toBe(before.claims[0].rawEvidenceId);
  expect(after.claims[0].review?.verdict).toBe("INCOMPLETE");
  expect((await t.run(ctx => ctx.db.query("rawEvidence").first()))?.capturedAt).toBe(signal.capturedAt);
  await expect(t.mutation(internal.discovery.ingestSignals, {
    ...input(), signals: [{ ...signal, payload: signal.payload + " Changed." }],
  })).rejects.toThrow("collision");
  await expect(t.mutation(internal.discovery.ingestSignals, {
    ...input(), signals: [{ ...signal, vendor: "Notion" }],
  })).rejects.toThrow("collision");
});

test("legacy source replay stays separate and idempotent after account-scoped imports", async () => {
  const t = await fixture();
  const legacy = { handle: "owner", sourceType: "GMAIL" as const, signals: [{ ...signal, sourceRecordId: undefined }] };
  await t.mutation(internal.discovery.ingestSignals, legacy);
  await t.mutation(internal.discovery.ingestSignals, input());
  await t.mutation(internal.discovery.ingestSignals, legacy);
  expect(await t.run(ctx => ctx.db.query("evidenceSources").collect())).toHaveLength(2);
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toHaveLength(2);
});

test("duplicate message IDs within one batch preserve a single original and replay safely", async () => {
  const t = await fixture();
  await t.mutation(internal.discovery.ingestSignals, {
    ...input(), signals: [signal, { ...signal, capturedAt: "2026-09-17T00:00:00.000Z" }],
  });
  expect(await t.run(ctx => ctx.db.query("rawEvidence").collect())).toHaveLength(1);
  await t.mutation(internal.discovery.ingestSignals, input());
  expect(await t.run(ctx => ctx.db.query("proofs").collect())).toHaveLength(1);
  const conflicting = await fixture();
  await expect(conflicting.mutation(internal.discovery.ingestSignals, {
    ...input(), signals: [signal, { ...signal, payload: signal.payload + " Changed." }],
  })).rejects.toThrow("collision");
  expect(await conflicting.run(ctx => ctx.db.query("rawEvidence").collect())).toHaveLength(0);
  expect(await conflicting.run(ctx => ctx.db.query("evidenceSources").collect())).toHaveLength(0);
});

test("account identity is owner-scoped and malformed source identities cannot enter ingestion", async () => {
  const t = await fixture();
  await t.mutation(internal.discovery.ingestSignals, input());
  await t.mutation(internal.discovery.ingestSignals, { ...input(), handle: "other" });
  expect(await t.run(ctx => ctx.db.query("evidenceSources").collect())).toHaveLength(2);
  for (const sourceKey of ["", " ", "a".repeat(513)]) {
    await expect(t.mutation(internal.discovery.ingestSignals, input(sourceKey))).rejects.toThrow("source account key");
  }
  await expect(t.mutation(internal.discovery.ingestSignals, { ...input(), sourceKey: undefined })).rejects.toThrow("source record ID");
  await expect(t.mutation(internal.discovery.ingestSignals, { ...input(), signals: [{ ...signal, sourceType: "MANUAL" }] })).rejects.toThrow("Signal type");
});
