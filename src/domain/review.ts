import type { ActivityModule, CuratedProp } from "./public-profile";
import type { Cost, CostVisibility } from "./cost";
import { canonicalJson } from "./canonical-json";
import { DEFAULT_USAGE_LINK_LABEL, usageLinkUrlSchema, type UsageLink, type UsageLinkLabel } from "./usage-links";

export type ReviewCard = {
  prop: Pick<CuratedProp, "visibility" | "status" | "headline" | "note" | "startedAt" | "activity" | "cost" | "costVisibility"> & {
    relationshipVersion?: number;
    supportingUrl?: string;
  };
  product: { domain: string; slug?: string };
  links: CuratedProp["links"];
  isPublishedAtCurrentHandle?: boolean;
  publishedActivity?: ActivityModule;
  publishedUsageLink?: UsageLink;
  // An active daily GitHub refresh approved for this card (R09).
  refreshApproved?: boolean;
};

export type RefreshConnector = { _id: string; provider: string; status: string; attributionScope: string };

function reviewBasis(card: ReviewCard) {
  return canonicalJson({ version: card.prop.relationshipVersion ?? 0, activity: card.prop.activity,
    isPublishedAtCurrentHandle: card.isPublishedAtCurrentHandle === true, publishedActivity: card.publishedActivity,
    publishedUsageLink: card.publishedUsageLink, refreshApproved: card.refreshApproved === true });
}

/** The saved work-sample link when it can go on the card. */
export function reviewUsageLink(card: ReviewCard) {
  const url = card.prop.supportingUrl;
  return url && usageLinkUrlSchema.safeParse(url).success ? url : null;
}

function refreshesPublishedCalendar(card: ReviewCard) {
  return card.isPublishedAtCurrentHandle === true && card.refreshApproved === true &&
    card.publishedActivity?.kind === "contributionCalendar";
}

/**
 * The activity a publish sends. A refresh updates only the public card of a
 * privately saved relationship, so while it stays on, the newer public calendar
 * is kept rather than the older saved one (R09).
 */
export function reviewActivity(card: ReviewCard, edit: Pick<ReviewEdit, "autoRefresh">) {
  return edit.autoRefresh && refreshesPublishedCalendar(card) ? card.publishedActivity : card.prop.activity;
}

/** The personal GitHub connection a daily refresh would use, when this card may offer one. */
export function githubRefreshConnector<T extends RefreshConnector>(card: ReviewCard, connectors: readonly T[], edit: ReviewEdit) {
  if (card.product.slug !== "github" || !edit.publish || !edit.approveActivity) return undefined;
  const activity = reviewActivity(card, edit);
  if (activity?.kind !== "contributionCalendar" || activity.attributionScope !== "PERSONAL") return undefined;
  // The same connector states the scheduled refresh accepts (convex/connectors.ts).
  return connectors.find(connector => connector.provider === "GITHUB" && connector.attributionScope === "PERSONAL" &&
    (connector.status === "CONNECTED" || connector.status === "ERROR"));
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

// Unpublish all (R15): every relationship of each product that has a
// published card, each with publish: false. An older published card can stand
// for all of a product's relationships, and the server refuses a partial
// selection for it, so the whole product goes together. Handle, name, bio and
// profile links are not cards and stay public.
export function unpublishAllSelections<T extends ReviewCard & { prop: { _id: string } }>(cards: T[], includeVersion: boolean): Array<{
  propId: T["prop"]["_id"]; expectedRelationshipVersion?: number; publish: false;
  status: T["prop"]["status"]; headline: string; note: string; autoRefresh: false;
}> {
  const publishedProducts = new Set(cards.filter(card => card.isPublishedAtCurrentHandle === true)
    .map(card => card.product.slug ?? card.product.domain));
  return cards.filter(card => publishedProducts.has(card.product.slug ?? card.product.domain)).map(card => ({
    propId: card.prop._id,
    ...(includeVersion ? { expectedRelationshipVersion: card.prop.relationshipVersion ?? 0 } : {}),
    publish: false as const,
    status: card.prop.status,
    headline: card.prop.headline,
    note: card.prop.note,
    autoRefresh: false as const,
  }));
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
    approveActivity: refreshesPublishedCalendar(card) || (card.isPublishedAtCurrentHandle === true && Boolean(card.publishedActivity) &&
      canonicalJson(card.prop.activity) === canonicalJson(card.publishedActivity)),
    includeUsageLink: keepsUsageLink,
    usageLinkLabel: (keepsUsageLink ? card.publishedUsageLink!.label : DEFAULT_USAGE_LINK_LABEL) as UsageLinkLabel,
    autoRefresh: refreshesPublishedCalendar(card),
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
