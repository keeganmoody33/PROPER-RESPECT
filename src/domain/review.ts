import type { ActivityModule, CuratedProp } from "./public-profile";
import type { Cost, CostVisibility } from "./cost";
import { canonicalJson } from "./canonical-json";
import { DEFAULT_USAGE_LINK_LABEL, usageLinkUrlSchema, type UsageLink, type UsageLinkLabel } from "./usage-links";

export type ReviewCard = {
  prop: Pick<CuratedProp, "visibility" | "status" | "headline" | "note" | "startedAt" | "activity" | "cost" | "costVisibility"> & {
    relationshipVersion?: number;
    supportingUrl?: string;
  };
  product: { domain: string };
  links: CuratedProp["links"];
  isPublishedAtCurrentHandle?: boolean;
  publishedActivity?: ActivityModule;
  publishedUsageLink?: UsageLink;
};

function reviewBasis(card: ReviewCard) {
  return canonicalJson({ version: card.prop.relationshipVersion ?? 0, activity: card.prop.activity,
    isPublishedAtCurrentHandle: card.isPublishedAtCurrentHandle === true, publishedActivity: card.publishedActivity,
    publishedUsageLink: card.publishedUsageLink });
}

/** The saved work-sample link when it can go on the card. */
export function reviewUsageLink(card: ReviewCard) {
  const url = card.prop.supportingUrl;
  return url && usageLinkUrlSchema.safeParse(url).success ? url : null;
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

export function setReviewCostVisibility<T extends ReviewCard & { prop: { _id: string } }>(
  cards: T[], current: Record<string, ReviewEdit>, visibility: CostVisibility,
) {
  const next = { ...current };
  for (const card of cards) {
    const prior = current[card.prop._id];
    if (prior && !isCurrentReview(card, prior)) continue;
    if (!prior && card.isPublishedAtCurrentHandle !== true) continue;
    const edit = prior ?? defaultReview(card);
    next[card.prop._id] = { ...edit, costVisibility: visibility };
  }
  return next;
}

// Opening review must not promote a proposed relationship or change the owner's link.
export function defaultReview(card: ReviewCard) {
  const primary = card.links.find(link => link.isPrimary);
  // The link goes public only by choice: kept when this card already shows
  // this same link, off otherwise.
  const keepsUsageLink = card.isPublishedAtCurrentHandle === true && card.publishedUsageLink !== undefined &&
    card.publishedUsageLink.url === card.prop.supportingUrl;
  return {
    basis: reviewBasis(card),
    publish: card.isPublishedAtCurrentHandle === true,
    status: card.prop.status,
    headline: card.prop.headline,
    note: card.prop.note,
    startedAt: card.prop.startedAt ?? "",
    linkUrl: primary?.url ?? (card.product.domain ? `https://${card.product.domain}` : ""),
    linkType: primary?.type ?? "CANONICAL" as const,
    linkLabel: primary?.label ?? "Open product",
    approveActivity: card.isPublishedAtCurrentHandle === true && Boolean(card.publishedActivity) &&
      canonicalJson(card.prop.activity) === canonicalJson(card.publishedActivity),
    includeUsageLink: keepsUsageLink,
    usageLinkLabel: (keepsUsageLink ? card.publishedUsageLink!.label : DEFAULT_USAGE_LINK_LABEL) as UsageLinkLabel,
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
