import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { AssociatedAccountEvidence } from "../src/domain/product-destination";

const DEFAULT_PROOF_SCAN_LIMIT = 25;
/** Newest-attached proofs on the card. GitHub destinations then rank those by capturedAt, not attachment time. */
const GITHUB_PROOF_SCAN_LIMIT = 200;
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

  const scanLimit = productSlug === "github" ? GITHUB_PROOF_SCAN_LIMIT : DEFAULT_PROOF_SCAN_LIMIT;
  const proofQuery = ctx.db.query("proofs").withIndex("by_prop", q => q.eq("propId", propId));
  const proofs = productSlug === "github"
    ? await proofQuery.order("desc").take(scanLimit)
    : await proofQuery.take(scanLimit);
  const fromProofs: Array<{ capturedAt: string; evidence: AssociatedAccountEvidence }> = [];
  for (const proof of proofs) {
    if (!proof.rawEvidenceId) continue;
    const raw = await ctx.db.get(proof.rawEvidenceId);
    if (!raw || raw.deletedAt) continue;
    const source = await ctx.db.get(raw.evidenceSourceId);
    if (!source || source.userId !== userId) continue;
    if (productSlug === "github" && (source.type !== "GITHUB" || raw.captureProvenance?.origin.issuer !== "GITHUB")) continue;
    fromProofs.push({
      capturedAt: raw.capturedAt,
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
      if (left.capturedAt === right.capturedAt) return 0;
      return left.capturedAt < right.capturedAt ? 1 : -1;
    });
  }
  for (const entry of fromProofs) items.push(entry.evidence);
  return items;
}
