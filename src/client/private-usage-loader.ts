import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Id } from "../../convex/_generated/dataModel";
import type { ConnectionsAPI } from "./usage-connection-api";
import { privateUsageTotals, type NumericEvidence } from "../domain/usage-sync";
import { canonicalJson } from "../domain/canonical-json";

export type PrivateUsageLoader = ReturnType<typeof createPrivateUsageLoader>;
export function createPrivateUsageLoader(input: {
  ownerSubject: string;
  list: () => Promise<FunctionReturnType<ConnectionsAPI["list"]>>;
  evidence: (args: FunctionArgs<ConnectionsAPI["evidence"]>) => Promise<FunctionReturnType<ConnectionsAPI["evidence"]>>;
}) {
  const cache = new Map<Id<"usageSources">, { checkpoint: string; totals: ReturnType<typeof privateUsageTotals> }>();
  const checkpoint = async (sourceId: Id<"usageSources">) => {
    const grants = (await input.list()).filter(grant => grant.ownerSubject === input.ownerSubject && grant.sourceId === sourceId);
    if (!grants.length) throw new Error("Private source unavailable.");
    return { key: canonicalJson(grants.sort((a, b) => a.grantId.localeCompare(b.grantId))),
      // Erasure requires revocation. An expired grant still retains its immutable
      // evidence, while revoked sources must be read afresh during deletion.
      reusable: grants.some(grant => grant.state === "active" || grant.state === "expired") };
  };
  return async (sourceId: Id<"usageSources">) => {
    try {
      const before = await checkpoint(sourceId), saved = cache.get(sourceId);
      if (before.reusable && saved?.checkpoint === before.key) return structuredClone(saved.totals);
      cache.delete(sourceId);
      const rows: NumericEvidence[] = [];
      let cursor: string | null = null;
      const seen = new Set<string>();
      for (;;) {
        const page = await input.evidence({ sourceId, cursor });
        rows.push(...page.page);
        if (page.isDone) break;
        if (!page.continueCursor || seen.has(page.continueCursor)) throw new Error("Private history pagination stopped.");
        seen.add(page.continueCursor);
        cursor = page.continueCursor;
      }
      const after = await checkpoint(sourceId);
      if (before.key !== after.key) throw new Error("Private history changed while loading. Try again.");
      const totals = privateUsageTotals(rows);
      if (after.reusable) {
        if (cache.size >= 4) cache.delete(cache.keys().next().value!);
        cache.set(sourceId, { checkpoint: after.key, totals });
      }
      return structuredClone(totals);
    } catch (error) {
      cache.clear();
      throw error;
    }
  };
}
