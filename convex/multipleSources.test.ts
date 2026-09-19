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

async function existingRelationships(count = 1) {
  const t = await fixture();
  const ids = await t.run(async ctx => {
    const user = (await ctx.db.query("users").withIndex("by_handle", q => q.eq("handle", "owner")).unique())!;
    const productId = await ctx.db.insert("products", {
      name: "GitHub", slug: "github", domain: "github.com", description: "Code collaboration",
    });
    const propIds = [];
    for (let index = 0; index < count; index++) {
      propIds.push(await ctx.db.insert("props", {
        userId: user._id, productId, status: "ARCHIVED", visibility: "PRIVATE",
        headline: `Saved relationship ${index}`, note: "Owner explanation",
        goTo: true, confirmedAt: "2026-09-18T00:00:00.000Z", relationshipVersion: 2,
      }));
    }
    return { userId: user._id, productId, propIds };
  });
  return { t, ...ids };
}

test("discovery reuses the sole existing relationship without changing decisions, links, or publication", async () => {
  const { t, propIds: [propId] } = await existingRelationships();
  const owner = t.withIdentity({ subject: "owner" });
  const prop = (await t.run(ctx => ctx.db.get(propId)))!;
  await owner.mutation(api.onboarding.publishSelected, { selections: [{
    propId, expectedRelationshipVersion: 2, publish: true, status: prop.status,
    headline: prop.headline, note: prop.note, autoRefresh: false,
  }] });
  const before = await t.run(async ctx => ({
    prop: await ctx.db.get(propId), links: await ctx.db.query("links").collect(),
    published: await ctx.db.query("publishedProfiles").collect(),
  }));
  expect(await t.mutation(internal.discovery.ingestSignals, input())).toMatchObject({ createdDrafts: [], ambiguousProducts: [] });
  await t.mutation(internal.discovery.ingestSignals, input("google:account-work"));
  await t.mutation(internal.discovery.ingestSignals, input());
  await t.run(async ctx => {
    expect(await ctx.db.query("props").collect()).toEqual([before.prop]);
    expect(await ctx.db.query("links").collect()).toEqual(before.links);
    expect(await ctx.db.query("publishedProfiles").collect()).toEqual(before.published);
    expect(await ctx.db.query("relationshipEvents").collect()).toEqual([]);
    const draft = (await ctx.db.query("draftImports").unique())!;
    expect(draft).toMatchObject({ status: "PENDING", resultPropId: propId });
    expect(draft.rawEvidenceIds).toHaveLength(2);
    expect(await ctx.db.query("proofs").collect()).toHaveLength(2);
  });
});

test("ambiguous relationships retain separate pending evidence without selecting, modifying, or creating a relationship", async () => {
  const { t, userId, propIds } = await existingRelationships(2);
  // Even an import seed key does not override competing owner relationships.
  await t.run(ctx => ctx.db.patch(propIds[0], { seedKey: JSON.stringify(["owner-import-v1", userId, "github"]) }));
  const before = await t.run(ctx => ctx.db.query("props").collect());
  for (const sourceKey of ["google:account-personal", "google:account-work", "google:account-personal"]) {
    expect(await t.mutation(internal.discovery.ingestSignals, input(sourceKey))).toMatchObject({
      createdDrafts: [], ambiguousProducts: [{ productSlug: "github", reason: "MULTIPLE_OWNER_RELATIONSHIPS" }],
    });
  }
  await t.run(async ctx => {
    expect(await ctx.db.query("props").collect()).toEqual(before);
    const draft = (await ctx.db.query("draftImports").unique())!;
    expect(draft.status).toBe("PENDING");
    expect(draft.resultPropId).toBeUndefined();
    expect(draft.rawEvidenceIds).toHaveLength(2);
    expect(await ctx.db.query("rawEvidence").collect()).toHaveLength(2);
    expect(await ctx.db.query("proofs").collect()).toEqual([]);
    expect(await ctx.db.query("links").collect()).toEqual([]);
    expect(await ctx.db.query("publishedProfiles").collect()).toEqual([]);
  });
});

test("an explicit valid draft mapping wins over ambiguous sibling relationships", async () => {
  const { t, userId, propIds } = await existingRelationships(2);
  await t.run(ctx => ctx.db.insert("draftImports", {
    userId, status: "APPROVED", suggestedProductSlug: "github", suggestedProductName: "GitHub",
    suggestedDomain: "github.com", suggestedDescription: "Code collaboration", suggestedUrl: "https://github.com",
    rawEvidenceIds: [], resultPropId: propIds[1],
  }));
  const before = await t.run(ctx => ctx.db.query("props").collect());
  expect(await t.mutation(internal.discovery.ingestSignals, input())).toMatchObject({ createdDrafts: [], ambiguousProducts: [] });
  await t.run(async ctx => {
    expect(await ctx.db.query("props").collect()).toEqual(before);
    expect(await ctx.db.query("proofs").collect()).toMatchObject([{ propId: propIds[1] }]);
    expect(await ctx.db.query("draftImports").unique()).toMatchObject({ status: "APPROVED", resultPropId: propIds[1] });
  });
});

test("existing relationships cannot absorb another owner's discovery or a distinct same-domain product", async () => {
  const { t, propIds: [githubId] } = await existingRelationships();
  const before = await t.run(ctx => ctx.db.get(githubId));
  await t.mutation(internal.discovery.ingestSignals, { ...input(), handle: "other" });
  await t.mutation(internal.discovery.ingestSignals, {
    ...input(), signals: [{ ...signal, vendor: "GitHub Copilot Pro", payload: "Copilot receipt", observations: [] }],
  });
  await t.run(async ctx => {
    expect(await ctx.db.get(githubId)).toEqual(before);
    const props = await ctx.db.query("props").collect();
    expect(props).toHaveLength(3);
    const products = await ctx.db.query("products").collect();
    expect(products.map(product => product.slug).sort()).toEqual(["github", "github-copilot"]);
    const other = (await ctx.db.query("users").withIndex("by_handle", q => q.eq("handle", "other")).unique())!;
    const otherProp = props.find(prop => prop.userId === other._id)!;
    expect((await ctx.db.get(otherProp.productId))!.slug).toBe("github");
    const copilot = products.find(product => product.slug === "github-copilot")!;
    expect(props.find(prop => prop.productId === copilot._id)!.userId).toBe(before!.userId);
  });
});
