// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { convexTest } from "convex-test";
import { test, vi } from "vitest";
import { z } from "zod";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { readRetainedProductEvidencePacket } from "../src/server/retained-product-evidence";
import type { RetainedProductEvidencePacket } from "../src/domain/retained-product-evidence";

const modules = import.meta.glob("./**/*.ts");
const firstPage = { paginationOpts: { numItems: 25, cursor: null } };
const packetDirectory = process.env.PROPER_RESPECT_RETAINED_PACKET_DIRECTORY;
const receiptDirectory = process.env.PROPER_RESPECT_LOCAL_EVIDENCE_RECEIPT_DIRECTORY;
const sourceReferenceSchema = z.object({
  kind: z.enum(["WISPR_INSIGHTS", "WISPR_OWNER_REVIEW", "GITHUB_ACTIVITY"]),
  path: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/),
  sourcePath: z.string(), sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
});
const preparationReceiptSchema = z.object({ execution: z.literal("FILE_PREPARATION_ONLY"), files: z.array(sourceReferenceSchema).length(3) });
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => [key, canonical(item)]));
  return value;
}
const equal = (left: unknown, right: unknown) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));

async function boundedBytes(path: string, maximum: number) {
  const metadata = await stat(path);
  if (!metadata.isFile() || metadata.size <= 0 || metadata.size > maximum) throw new Error("Local verification file bounds failed.");
  const bytes = await readFile(path);
  if (bytes.length > maximum) throw new Error("Local verification file bounds failed.");
  return bytes;
}
async function outsideGit(path: string) {
  let current = await realpath(path);
  for (;;) {
    try {
      await lstat(join(current, ".git"));
      throw new Error("Private verification receipts must stay outside Git.");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

// Optional private-input test: ordinary test runs skip it. All authenticated
// identities, verdicts, relationship choices and publication fixtures below are
// explicitly synthetic. Never use these choices as the real owner's decisions.
test.skipIf(!packetDirectory)("LOCAL_CONVEX_TEST_WITH_REAL_RETAINED_ORIGINALS: intake, review, save, replay and fresh synthetic session", async () => {
  const recordedAt = new Date().toISOString();
  const checks: Record<string, boolean> = {};
  const references: z.infer<typeof sourceReferenceSchema>[] = [];
  let phase = "load-private-packets";
  let passed = false;
  function check(name: string, condition: unknown): asserts condition {
    checks[name] = Boolean(condition);
    if (!condition) throw new Error(`Redacted local verification failure: ${name}`);
  }
  async function rejected(name: string, operation: () => Promise<unknown>) {
    let wasRejected = false;
    try { await operation(); } catch { wasRejected = true; }
    check(name, wasRejected);
  }
  const blockedFetch = vi.fn(async () => { throw new Error("Network disabled in local retained-evidence verification."); });
  vi.stubGlobal("fetch", blockedFetch);
  vi.useFakeTimers();
  try {
    const directory = await realpath(packetDirectory!);
    const receiptNames = (await readdir(directory)).filter(name => /^preparation-receipt-.*\.json$/.test(name));
    check("one_preparation_receipt", receiptNames.length === 1);
    const preparation = preparationReceiptSchema.parse(JSON.parse((await boundedBytes(join(directory, receiptNames[0]), 256_000)).toString("utf8")));
    const packets: RetainedProductEvidencePacket[] = [];
    for (const reference of preparation.files) {
      check("packet_reference_stays_in_selected_directory", await realpath(dirname(reference.path)) === directory);
      const path = join(directory, basename(reference.path));
      check(`packet_hash_${reference.kind}`, hash(await boundedBytes(path, 256_000)) === reference.sha256);
      const packet = await readRetainedProductEvidencePacket(path);
      check(`original_hash_before_${reference.kind}`, hash(await boundedBytes(reference.sourcePath, 64_000)) === reference.sourceSha256);
      check(`artifact_identity_${reference.kind}`, packet.artifact.kind === reference.kind && packet.artifact.sha256 === reference.sourceSha256);
      references.push(reference);
      packets.push(packet);
    }
    check("three_distinct_accepted_source_kinds", new Set(packets.map(packet => packet.artifact.kind)).size === 3);

    phase = "create-synthetic-local-identities";
    const t = convexTest(schema, modules);
    const ownerSubject = "TEST_ONLY_RETAINED_EVIDENCE_OWNER";
    const otherSubject = "TEST_ONLY_RETAINED_EVIDENCE_OTHER";
    const ownerId = await t.run(async ctx => {
      const id = await ctx.db.insert("users", { handle: "synthetic-retained-owner", authSubject: ownerSubject, displayName: "TEST ONLY retained evidence owner", bio: "Synthetic local fixture; no actual owner decisions." });
      await ctx.db.insert("users", { handle: "synthetic-retained-other", authSubject: otherSubject, displayName: "TEST ONLY other owner", bio: "Synthetic local fixture." });
      await ctx.db.insert("publishedProfiles", {
        handle: "synthetic-retained-owner", revision: 1, publishedAt: "2025-01-01T00:00:00.000Z",
        profile: { handle: "synthetic-retained-owner", displayName: "TEST ONLY publication fixture", bio: "Unchanged synthetic projection", cards: [] },
      });
      return id;
    });
    const owner = t.withIdentity({ subject: ownerSubject, tokenIdentifier: "TEST_ONLY_SESSION_ONE" });
    const other = t.withIdentity({ subject: otherSubject, tokenIdentifier: "TEST_ONLY_OTHER_SESSION" });
    const publicBefore = await t.run(ctx => ctx.db.query("publishedProfiles").collect());
    const tableNames = ["products", "props", "evidenceSources", "rawEvidence", "proofs", "draftImports", "claimReviews", "relationshipEvents", "publishedProfiles", "connectorAccounts", "usageSignals", "metricSubscriptions"] as const;
    const counts = () => t.run(async ctx => Object.fromEntries(await Promise.all(tableNames.map(async table => [table, (await ctx.db.query(table).collect()).length]))));
    await rejected("unauthenticated_intake_rejected", () => t.mutation(api.retainedEvidence.importPacket, { packet: packets[0] }));
    await rejected("unauthenticated_inventory_rejected", () => t.query(api.inventory.list, firstPage));

    phase = "import-retained-native-and-owner-review";
    const imported: { packet: RetainedProductEvidencePacket; propId: Id<"props">; rawEvidenceId: Id<"rawEvidence"> }[] = [];
    for (const packet of packets) {
      const result = await owner.mutation(api.retainedEvidence.importPacket, { packet });
      check(`first_import_${packet.artifact.kind}`, !result.duplicate && result.propId !== null);
      imported.push({ packet, propId: result.propId!, rawEvidenceId: result.rawEvidenceId });
    }
    const wispr = imported.find(entry => entry.packet.artifact.kind === "WISPR_INSIGHTS");
    const review = imported.find(entry => entry.packet.artifact.kind === "WISPR_OWNER_REVIEW");
    const github = imported.find(entry => entry.packet.artifact.kind === "GITHUB_ACTIVITY");
    check("all_accepted_originals_imported", wispr && review && github);
    check("owner_review_attaches_to_same_wispr_relationship", review.propId === wispr.propId && review.rawEvidenceId !== wispr.rawEvidenceId && github.propId !== wispr.propId);
    const expectedImportCounts = { products: 2, props: 2, evidenceSources: 3, rawEvidence: 3, proofs: 3, draftImports: 2, claimReviews: 0, relationshipEvents: 0, publishedProfiles: 1, connectorAccounts: 0, usageSignals: 0, metricSubscriptions: 0 };
    check("exact_initial_counts_two_cards_three_separate_originals", equal(await counts(), expectedImportCounts));
    const initialInventory = await owner.query(api.inventory.list, firstPage);
    check("private_discoveries_without_selected_activity", initialInventory.isDone && initialInventory.page.length === 2 && initialInventory.page.every(card => card.prop.userId === ownerId && card.prop.visibility === "DRAFT" && card.prop.status === "TESTING" && card.prop.activity === undefined && card.prop.goTo === undefined));
    check("other_identity_sees_no_private_cards", (await other.query(api.inventory.list, firstPage)).page.length === 0);

    for (const entry of imported) {
      const { raw, source, proof } = await t.run(async ctx => {
        const raw = await ctx.db.get(entry.rawEvidenceId);
        return { raw, source: raw && await ctx.db.get(raw.evidenceSourceId), proof: await ctx.db.query("proofs").withIndex("by_propId_and_rawEvidenceId", q => q.eq("propId", entry.propId).eq("rawEvidenceId", entry.rawEvidenceId)).unique() };
      });
      const kind = entry.packet.artifact.kind;
      check(`source_owner_and_proof_${kind}`, raw && source && proof && raw.userId === ownerId && source.userId === ownerId && source.sourceKey === entry.packet.sourceKey && source.type === entry.packet.sourceType);
      check(`original_and_observations_preserved_${kind}`, raw.payload === entry.packet.signal.payload && equal(raw.observations, entry.packet.signal.observations));
      check(`provenance_preserved_${kind}`, equal(raw.captureProvenance, entry.packet.signal.captureProvenance) && raw.captureProvenance?.activityActor.kind === "UNKNOWN");
      check(`source_date_and_preparation_preserved_${kind}`, equal(raw.retainedArtifact, entry.packet.artifact) && raw.capturedAt === entry.packet.artifact.preparedAt && raw.retainedArtifact?.sourceCapturedDate === entry.packet.artifact.sourceCapturedDate);
      check(`suggestion_and_limits_preserved_${kind}`, equal(raw.suggestedActivity, entry.packet.activity) && equal(raw.limitations, entry.packet.limitations));
    }
    const wisprEvidence = await owner.query(api.inventory.evidence, { propId: wispr.propId, ...firstPage });
    check("wispr_evidence_page_complete", wisprEvidence.isDone);
    const retainedReview = wisprEvidence.page.find(entry => entry.id === review.rawEvidenceId);
    check("separate_owner_answer_without_invented_usage_observations", retainedReview?.ownerStatement === (JSON.parse(review.packet.signal.payload) as { answer: string }).answer && retainedReview?.observationCount === 0 && retainedReview.sourceType === "MANUAL" && retainedReview.captureProvenance?.route === "OWNER_TESTIMONY");

    phase = "exact-import-replay";
    const rawBeforeReplay = await t.run(ctx => ctx.db.query("rawEvidence").collect());
    for (const entry of imported) {
      const result = await owner.mutation(api.retainedEvidence.importPacket, { packet: entry.packet });
      check(`exact_replay_identity_${entry.packet.artifact.kind}`, result.duplicate && result.rawEvidenceId === entry.rawEvidenceId && result.propId === entry.propId);
    }
    check("exact_replay_counts_unchanged", equal(await counts(), expectedImportCounts));
    check("replay_preserves_original_rows", equal(await t.run(ctx => ctx.db.query("rawEvidence").collect()), rawBeforeReplay));

    phase = "synthetic-review-and-save";
    const testNote = "TEST_ONLY synthetic local choice. This does not represent the actual owner's relationship, endorsement, or publication decision.";
    for (const entry of [wispr, github]) {
      const observationIndex = entry.packet.signal.observations.findIndex(observation => observation.kind === "USAGE");
      check(`usage_observation_available_${entry.packet.artifact.kind}`, observationIndex >= 0);
      await owner.mutation(api.onboarding.reviewClaim, { propId: entry.propId, rawEvidenceId: entry.rawEvidenceId, observationIndex, verdict: "UNKNOWN", correction: testNote });
    }
    await rejected("owner_review_has_no_fabricated_claim_to_review", () => owner.mutation(api.onboarding.reviewClaim, { propId: review.propId, rawEvidenceId: review.rawEvidenceId, observationIndex: 0, verdict: "UNKNOWN" }));
    const initialWisprSave = { propId: wispr.propId, expectedVersion: 0, operationId: "TEST_ONLY_WISPR_FIRST_SAVE", status: "TESTING" as const, goTo: false, headline: "TEST_ONLY synthetic Wispr relationship", note: testNote, activityEvidenceId: wispr.rawEvidenceId };
    await rejected("other_identity_cannot_save_relationship", () => other.mutation(api.inventory.save, initialWisprSave));
    await rejected("other_identity_cannot_review_claim", () => other.mutation(api.onboarding.reviewClaim, { propId: wispr.propId, rawEvidenceId: wispr.rawEvidenceId, observationIndex: 0, verdict: "UNKNOWN" }));
    await rejected("unrelated_product_cannot_supply_activity", () => owner.mutation(api.inventory.save, { ...initialWisprSave, operationId: "TEST_ONLY_WRONG_PRODUCT", activityEvidenceId: github.rawEvidenceId }));
    check("first_synthetic_save", (await owner.mutation(api.inventory.save, initialWisprSave)).version === 1);
    check("identical_save_is_idempotent", (await owner.mutation(api.inventory.save, initialWisprSave)).duplicate);
    await owner.mutation(api.inventory.save, { ...initialWisprSave, expectedVersion: 1, operationId: "TEST_ONLY_WISPR_GOTO", status: "ACTIVE", goTo: true });
    await owner.mutation(api.inventory.save, { propId: github.propId, expectedVersion: 0, operationId: "TEST_ONLY_GITHUB_SAVE", status: "TESTING", goTo: false, headline: "TEST_ONLY synthetic GitHub relationship", note: testNote, activityEvidenceId: github.rawEvidenceId });
    const expectedSavedCounts = { ...expectedImportCounts, claimReviews: 2, relationshipEvents: 3 };
    check("exact_saved_counts_two_test_reviews_three_test_events", equal(await counts(), expectedSavedCounts));

    phase = "fresh-synthetic-session-and-post-save-replay";
    const fresh = t.withIdentity({ subject: ownerSubject, tokenIdentifier: "TEST_ONLY_NEW_AUTHENTICATED_SESSION" });
    const saved = await fresh.query(api.inventory.list, firstPage);
    for (const entry of [wispr, github]) {
      const card = saved.page.find(item => item.prop._id === entry.propId);
      check(`save_reload_${entry.packet.artifact.kind}`, card && card.prop.visibility === "PRIVATE" && card.prop.note === testNote && card.prop.activityEvidenceId === entry.rawEvidenceId && equal(card.prop.activity, entry.packet.activity));
      check(`activity_snapshot_limits_${entry.packet.artifact.kind}`, card.prop.activity?.freshness === "STALE" && card.prop.activity.period === undefined && card.prop.startedAt === undefined && card.prop.activity.capturedAt === entry.packet.artifact.preparedAt);
      const history = await fresh.query(api.inventory.history, { propId: entry.propId, paginationOpts: { numItems: 20, cursor: null } });
      check(`synthetic_history_${entry.packet.artifact.kind}`, history.page.length === (entry === wispr ? 2 : 1) && history.page.every(event => event.userId === ownerId && event.after.note === testNote && event.operationId.startsWith("TEST_ONLY_")));
      const selected = await fresh.query(api.inventory.selectedActivity, { propId: entry.propId });
      check(`selected_original_inspectable_${entry.packet.artifact.kind}`, selected?.id === entry.rawEvidenceId && selected.originalText === entry.packet.signal.payload);
    }
    const savedWispr = saved.page.find(card => card.prop._id === wispr.propId);
    check("explicit_test_only_go_to_and_history_reload", savedWispr?.prop.status === "ACTIVE" && savedWispr.prop.goTo === true && savedWispr.previousStatuses.includes("TESTING"));
    const state = await fresh.query(api.onboarding.getState, {});
    check("synthetic_claim_reviews_reload", state && state.cards.flatMap(card => card.claims).filter(claim => claim.review?.correction === testNote && claim.review.verdict === "UNKNOWN").length === 2);
    for (const entry of imported) await fresh.mutation(api.retainedEvidence.importPacket, { packet: entry.packet });
    check("post_save_replay_counts_unchanged", equal(await counts(), expectedSavedCounts));
    check("post_save_replay_does_not_reopen_decisions", equal(await fresh.query(api.inventory.list, firstPage), saved));
    check("published_profiles_unchanged", equal(await t.run(ctx => ctx.db.query("publishedProfiles").collect()), publicBefore));
    check("still_no_other_owner_private_cards", (await other.query(api.inventory.list, firstPage)).page.length === 0);
    passed = true;
  } catch {
    // Never print Convex/Zod errors or assertion diffs containing private inputs.
    checks[`${phase}_completed`] = false;
  } finally {
    for (const reference of references) {
      try { checks[`original_hash_after_${reference.kind}`] = hash(await boundedBytes(reference.sourcePath, 64_000)) === reference.sourceSha256; }
      catch { checks[`original_hash_after_${reference.kind}`] = false; }
    }
    checks.no_network_request_attempted = blockedFetch.mock.calls.length === 0;
    passed = passed && Object.values(checks).every(Boolean);
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    if (receiptDirectory) {
      const directory = await realpath(receiptDirectory);
      await outsideGit(directory);
      const testPath = resolve("convex/retainedEvidence.local.test.ts");
      const path = join(directory, `local-convex-verification-${recordedAt.replaceAll(":", "-")}.json`);
      await writeFile(path, JSON.stringify({
        execution: "LOCAL_CONVEX_TEST_WITH_REAL_RETAINED_ORIGINALS", hostedProof: false,
        recordedAt, result: passed ? "PASS" : "FAIL", checks,
        test: { path: testPath, sha256: hash(await readFile(testPath)) },
        references,
      }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    }
  }
  if (!passed) throw new Error(`Redacted local retained-evidence verification failed during ${phase}. No private values are printed.`);
}, 30_000);
