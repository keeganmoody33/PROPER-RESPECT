// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { createHash } from "node:crypto";
import { lstat, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { convexTest } from "convex-test";
import type { FunctionReturnType } from "convex/server";
import { test, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");
const inputFile = process.env.PROPER_RESPECT_RETAINED_MAILBOX_TEST_INPUT;
type PrivateInput = {
  source: "READ_ONLY_PRODUCTION_SNAPSHOT";
  snapshotSha256: string;
  accounts: Doc<"mailboxAccounts">[];
  sources: Doc<"evidenceSources">[];
  rawEvidence: Doc<"rawEvidence">[];
  unknown: Doc<"mailboxUnknownRecords">[];
  expectedBySlug: Record<string, number>;
};

async function privatePath(path: string) {
  const resolved = await realpath(path);
  let current = dirname(resolved);
  for (;;) {
    try {
      await lstat(join(current, ".git"));
      throw new Error("Retained mailbox verification input must stay outside Git.");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (dirname(current) === current) return resolved;
    current = dirname(current);
  }
}

// Uses a disposable in-memory owner. It never imports into an external deployment.
test.skipIf(!inputFile)("LOCAL_ONLY: retained real mailbox headers produce replay-safe private candidates without network", async () => {
  const path = await privatePath(inputFile!);
  const bytes = await readFile(path);
  if (bytes.length > 8_000_000) throw new Error("Private input exceeds verification bounds.");
  const input = JSON.parse(bytes.toString("utf8")) as PrivateInput;
  const checks: Record<string, boolean> = {};
  function check(name: string, condition: unknown): asserts condition {
    checks[name] = Boolean(condition);
    if (!condition) throw new Error(`Redacted retained-mailbox verification failure: ${name}`);
  }
  check("input_bounds", input.source === "READ_ONLY_PRODUCTION_SNAPSHOT" && input.unknown.length > 0 && input.unknown.length <= 2_000);
  check("pending_only", input.unknown.every(row => row.status === "PENDING"));
  const fetcher = vi.fn(async () => { throw new Error("Network disabled in local retained-mailbox verification."); });
  vi.stubGlobal("fetch", fetcher);
  try {
    const t = convexTest(schema, modules);
    const authSubject = "TEST_ONLY_RETAINED_MAILBOX_OWNER";
    const ownerId = await t.run(ctx => ctx.db.insert("users", {
      authSubject, handle: "test-only-retained-mailbox-owner", displayName: "Synthetic test owner", bio: "",
    }));
    const sourceIds = new Map<string, Id<"evidenceSources">>();
    const accountIds = new Map<string, Id<"mailboxAccounts">>();
    const rawIds = new Map<string, Id<"rawEvidence">>();
    await t.run(async ctx => {
      for (const source of input.sources) {
        sourceIds.set(source._id, await ctx.db.insert("evidenceSources", {
          userId: ownerId, type: source.type, sourceKey: source.sourceKey,
          connectedAt: source.connectedAt, lastSyncedAt: source.lastSyncedAt,
        }));
      }
      for (const account of input.accounts) {
        const sourceId = sourceIds.get(account.evidenceSourceId);
        check("account_source_present", sourceId);
        accountIds.set(account._id, await ctx.db.insert("mailboxAccounts", {
          ownerId, evidenceSourceId: sourceId, provider: account.provider,
          providerAccountId: account.providerAccountId, accountLabel: "Local retained fixture",
          scopes: [], status: "DISCONNECTED", generation: account.generation, cursor: account.cursor,
          maintenanceEnabled: false, connectedAt: account.connectedAt, updatedAt: account.updatedAt,
          lastSyncedAt: account.lastSyncedAt,
        }));
      }
      for (const raw of input.rawEvidence) {
        const sourceId = sourceIds.get(raw.evidenceSourceId);
        check("raw_source_present", sourceId);
        rawIds.set(raw._id, await ctx.db.insert("rawEvidence", {
          evidenceSourceId: sourceId, userId: ownerId, payload: raw.payload,
          observations: raw.observations, captureProvenance: raw.captureProvenance,
          detectedVendor: raw.detectedVendor, detectedUrl: raw.detectedUrl,
          capturedAt: raw.capturedAt, sourceRecordId: raw.sourceRecordId,
          dedupKey: JSON.stringify(["source-v1", sourceId, ["record", raw.sourceRecordId]]),
        }));
      }
      for (const unknown of input.unknown) {
        const accountId = accountIds.get(unknown.accountId);
        const rawId = rawIds.get(unknown.rawEvidenceId);
        check("unknown_dependencies_present", accountId && rawId);
        await ctx.db.insert("mailboxUnknownRecords", {
          ownerId, accountId, rawEvidenceId: rawId, sourceRecordId: unknown.sourceRecordId,
          senderDomain: unknown.senderDomain, status: "PENDING", createdAt: unknown.createdAt,
        });
      }
    });
    const snapshot = () => t.run(async ctx => JSON.stringify(await Promise.all([
      ctx.db.query("rawEvidence").collect(), ctx.db.query("evidenceSources").collect(),
      ctx.db.query("mailboxAccounts").collect(), ctx.db.query("mailboxUnknownRecords").collect(),
      ctx.db.query("mailboxScanContexts").collect(), ctx.db.query("mailboxDiscoveryRuns").collect(),
      ctx.db.query("publishedProfiles").collect(), ctx.db.query("relationshipEvents").collect(),
    ])));
    const original = await snapshot();
    const owner = t.withIdentity({ subject: authSubject });
    async function recheck() {
      let cursor: string | null = null;
      let examined = 0, matched = 0, createdDrafts = 0;
      for (let page = 0; page < 250; page++) {
        const result: FunctionReturnType<typeof api.mailboxDiscovery.recheckRetained> = await owner.mutation(api.mailboxDiscovery.recheckRetained, { paginationOpts: { cursor, numItems: 10 } });
        examined += result.examined; matched += result.matched; createdDrafts += result.createdDrafts;
        if (result.isDone) return { examined, matched, createdDrafts };
        check("continuation_progress", result.continueCursor !== cursor);
        cursor = result.continueCursor;
      }
      throw new Error("Local retained-mailbox pagination exceeded test bounds.");
    }
    const first = await recheck();
    check("all_pending_examined", first.examined === input.unknown.length);
    check("expected_retained_matches", first.matched === Object.values(input.expectedBySlug).reduce((a, b) => a + b, 0));
    check("originals_and_progress_unchanged", original === await snapshot());
    const drafts = await t.run(ctx => ctx.db.query("draftImports").collect());
    check("expected_product_set", JSON.stringify(drafts.map(d => d.suggestedProductSlug).sort()) === JSON.stringify(Object.keys(input.expectedBySlug).sort()));
    for (const draft of drafts) {
      check(`source_links_${draft.suggestedProductSlug}`, draft.rawEvidenceIds.length === input.expectedBySlug[draft.suggestedProductSlug]);
      check("pending_review", draft.status === "PENDING");
    }
    const props = await t.run(ctx => ctx.db.query("props").collect());
    check("unconfirmed_private_candidates", props.length === drafts.length && props.every(p => p.visibility === "DRAFT" && !p.confirmedAt && !p.goTo));
    const beforeReplay = await t.run(async ctx => JSON.stringify([await ctx.db.query("props").collect(), await ctx.db.query("draftImports").collect(), await ctx.db.query("proofs").collect()]));
    const replay = await recheck();
    const afterReplay = await t.run(async ctx => JSON.stringify([await ctx.db.query("props").collect(), await ctx.db.query("draftImports").collect(), await ctx.db.query("proofs").collect()]));
    check("replay_stable", beforeReplay === afterReplay && replay.createdDrafts === 0 && original === await snapshot());
    check("no_network_calls", fetcher.mock.calls.length === 0);
    await writeFile(join(dirname(path), "retained-recheck-local-proof.json"), JSON.stringify({
      checkedAt: new Date().toISOString(), execution: "LOCAL_CONVEX_TEST_ONLY",
      inputSha256: createHash("sha256").update(bytes).digest("hex"), snapshotSha256: input.snapshotSha256,
      first, replay, productCandidates: props.length, checks,
      limitations: ["Synthetic local owner; no production reclassification", "No fresh mailbox reads or brand retrieval", "No personal relationship confirmation or publication"],
    }, null, 2) + "\n", { mode: 0o600 });
  } finally { vi.unstubAllGlobals(); }
}, 60_000);
