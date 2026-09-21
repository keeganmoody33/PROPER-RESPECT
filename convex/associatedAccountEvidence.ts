import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { AssociatedAccountEvidence } from "../src/domain/product-destination";

const DEFAULT_PROOF_SCAN_LIMIT = 25;
const GITHUB_NEWEST_ATTACHED_PROOF_SCAN_LIMIT = 200;
const GITHUB_ACCOUNT_LABEL = /^(?:https:\/\/)?github\.com\/([^/]+)$/i;

export async function associatedAccountEvidenceForProp(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  propId: Id<"props">,
  productSlug: string,
): Promise<AssociatedAccountEvidence[]> {
  const items: AssociatedAccountEvidence[] = [];
  if (productSlug === "github") {
    const connector = await ctx.db.query("connectorAccounts")
      .withIndex("by_user_provider", q => q.eq("userId", userId).eq("provider", "GITHUB"))
      .unique();
    const label = connector?.status === "CONNECTED"
      ? connector.accountLabel.match(GITHUB_ACCOUNT_LABEL)?.[1]
      : undefined;
    if (label) {
      items.push({
        relationshipOwnerId: userId,
        evidenceOwnerId: userId,
        productSlug,
        accountId: label,
        url: `https://github.com/${label}`,
      });
    }
  }

  const scanLimit = productSlug === "github" ? GITHUB_NEWEST_ATTACHED_PROOF_SCAN_LIMIT : DEFAULT_PROOF_SCAN_LIMIT;
  const proofQuery = ctx.db.query("proofs").withIndex("by_prop", q => q.eq("propId", propId));
  const proofs = productSlug === "github"
    ? await proofQuery.order("desc").take(scanLimit)
    : await proofQuery.take(scanLimit);
  const fromProofs: Array<{ sourceDay: string; captureInstant?: number; accountKey: string; evidence: AssociatedAccountEvidence }> = [];
  for (const proof of proofs) {
    if (!proof.rawEvidenceId) continue;
    const raw = await ctx.db.get(proof.rawEvidenceId);
    if (!raw || raw.deletedAt) continue;
    const source = await ctx.db.get(raw.evidenceSourceId);
    if (!source || source.userId !== userId) continue;
    if (productSlug === "github" && (source.type !== "GITHUB" || raw.captureProvenance?.origin.issuer !== "GITHUB")) continue;
    const captureInstant = raw.retainedArtifact ? undefined : Date.parse(raw.capturedAt);
    const knownInstant = captureInstant !== undefined && Number.isFinite(captureInstant) ? captureInstant : undefined;
    const accountId = raw.captureProvenance?.origin.accountId;
    fromProofs.push({
      sourceDay: raw.retainedArtifact?.sourceCapturedDate
        ?? (knownInstant === undefined ? "" : new Date(knownInstant).toISOString().slice(0, 10)),
      captureInstant: knownInstant,
      accountKey: JSON.stringify([accountId?.toLowerCase() ?? "", raw.detectedUrl?.toLowerCase() ?? "", accountId ?? "", raw.detectedUrl ?? ""]),
      evidence: {
        relationshipOwnerId: userId,
        evidenceOwnerId: raw.userId,
        productSlug,
        accountId: raw.captureProvenance?.origin.accountId,
        url: raw.detectedUrl,
      },
    });
  }
  if (productSlug === "github") {
    fromProofs.sort((left, right) => {
      if (left.sourceDay !== right.sourceDay) return left.sourceDay < right.sourceDay ? 1 : -1;
      const leftSameDayPriority = left.captureInstant ?? -Infinity;
      const rightSameDayPriority = right.captureInstant ?? -Infinity;
      if (leftSameDayPriority !== rightSameDayPriority) return leftSameDayPriority < rightSameDayPriority ? 1 : -1;
      if (left.accountKey === right.accountKey) return 0;
      return left.accountKey < right.accountKey ? -1 : 1;
    });
  }
  for (const entry of fromProofs) items.push(entry.evidence);
  return items;
}
