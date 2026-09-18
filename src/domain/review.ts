import type { ActivityModule, CuratedProp } from "./public-profile";
import type { Cost, CostVisibility } from "./cost";
import { canonicalJson } from "./canonical-json";

export type ReviewCard = {
  prop: Pick<CuratedProp, "visibility" | "status" | "headline" | "note" | "startedAt" | "activity" | "cost" | "costVisibility"> & { relationshipVersion?: number };
  product: { domain: string };
  links: CuratedProp["links"];
  publishedActivity?: ActivityModule;
};

function reviewBasis(card: ReviewCard) {
  return canonicalJson({ version: card.prop.relationshipVersion ?? 0, activity: card.prop.activity, publishedActivity: card.publishedActivity });
}

export function isCurrentReview(card: ReviewCard, edit: ReviewEdit) {
  return edit.basis === reviewBasis(card);
}

// Only an explicitly edited publication row may replace an approved snapshot.
export function explicitPublicationReview(card: ReviewCard, edit?: ReviewEdit, requirePrivateSave = true) {
  if (!edit) return undefined;
  if (!isCurrentReview(card, edit)) throw new Error("This card changed after publication review. Review its current saved version before publishing.");
  if (requirePrivateSave && edit.publish && card.prop.visibility === "DRAFT") throw new Error("Confirm and save this discovery privately before publishing it.");
  return edit;
}

export function explicitPublicationCards<T extends ReviewCard & { prop: { _id: string } }>(
  cards: T[], edits: Record<string, ReviewEdit>, requirePrivateSave = true,
) {
  return cards.flatMap(card => {
    const edit = explicitPublicationReview(card, edits[card.prop._id], requirePrivateSave);
    return edit ? [{ card, edit }] : [];
  });
}

// Opening review must not promote a proposed relationship or change the owner's link.
export function defaultReview(card: ReviewCard) {
  const primary = card.links.find(link => link.isPrimary);
  return {
    basis: reviewBasis(card),
    publish: card.prop.visibility === "PUBLIC",
    status: card.prop.status,
    headline: card.prop.headline,
    note: card.prop.note,
    startedAt: card.prop.startedAt ?? "",
    linkUrl: primary?.url ?? (card.product.domain ? `https://${card.product.domain}` : ""),
    linkType: primary?.type ?? "CANONICAL" as const,
    linkLabel: primary?.label ?? "Open product",
    approveActivity: card.prop.visibility === "PUBLIC" && Boolean(card.publishedActivity) &&
      canonicalJson(card.prop.activity) === canonicalJson(card.publishedActivity),
    autoRefresh: false,
    costAmount: card.prop.cost?.amount.toString() ?? "",
    costCurrency: card.prop.cost?.currency ?? "USD",
    costCadence: card.prop.cost?.cadence ?? "MONTHLY" as Cost["cadence"],
    costBasis: card.prop.cost?.basis ?? "OWNER_REPORTED" as Cost["basis"],
    costAsOf: card.prop.cost?.asOf ?? "",
    costPeriodStart: card.prop.cost?.period?.start ?? "",
    costPeriodEnd: card.prop.cost?.period?.end ?? "",
    costVisibility: card.prop.costVisibility ?? "PRIVATE" as CostVisibility,
  };
}

export type ReviewEdit = ReturnType<typeof defaultReview>;
