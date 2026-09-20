import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { AssociatedAccountEvidence } from "../src/domain/product-destination";

export async function associatedAccountEvidenceForProp(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  propId: Id<"props">,
  productSlug: string,
): Promise<AssociatedAccountEvidence[]> {
  const proofs = await ctx.db.query("proofs").withIndex("by_prop", q => q.eq("propId", propId)).take(25);
  const items: AssociatedAccountEvidence[] = [];
  for (const proof of proofs) {
    if (!proof.rawEvidenceId) continue;
    const raw = await ctx.db.get(proof.rawEvidenceId);
    if (!raw || raw.deletedAt) continue;
    const source = await ctx.db.get(raw.evidenceSourceId);
    if (!source || source.userId !== userId) continue;
    if (productSlug === "github" && (source.type !== "GITHUB" || raw.captureProvenance?.origin.issuer !== "GITHUB")) continue;
    items.push({
      relationshipOwnerId: userId,
      evidenceOwnerId: raw.userId,
      productSlug,
      accountId: raw.captureProvenance?.origin.accountId,
      url: raw.detectedUrl,
    });
  }
  if (productSlug === "github") {
    const connector = await ctx.db.query("connectorAccounts")
      .withIndex("by_user_provider", q => q.eq("userId", userId).eq("provider", "GITHUB"))
      .unique();
    const label = connector?.accountLabel.match(/^(?:https:\/\/)?github\.com\/([^/]+)$/i)?.[1];
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
  return items;
}
