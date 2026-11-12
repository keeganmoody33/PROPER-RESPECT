import { isHttpUrl } from "./http-url";
import { LINK_LABEL_MAX, PUBLISHED_URL_MAX } from "./published-text-limits";
import { defaultPrimaryLink, type CardLink } from "./review";

export const SHARE_ALL_MAX = 100;

export type ShareAllProp<PropId extends string, Cost> = Readonly<{
  propId: PropId;
  visibility: "PUBLIC" | "PRIVATE" | "DRAFT";
  onPublishedPage: boolean;
  relationshipVersion?: number;
  status: "ACTIVE" | "TESTING" | "ARCHIVED";
  headline: string;
  note: string;
  startedAt?: string;
  startedAtSource?: "AUTHORITATIVE" | "USER_CONFIRMED";
  cost?: Cost;
  product: Readonly<{ name: string; domain: string }>;
  primaryLink?: CardLink;
}>;

export type ShareAllSelection<PropId extends string, Cost> = {
  propId: PropId;
  expectedRelationshipVersion: number;
  publish: true;
  status: ShareAllProp<PropId, Cost>["status"];
  headline: string;
  note: string;
  startedAt?: string;
  startedAtSource?: ShareAllProp<PropId, Cost>["startedAtSource"];
  primaryLink?: CardLink;
  autoRefresh: false;
  cost?: Cost;
  costVisibility: "PRIVATE";
};

export type SkippedShare<PropId extends string> = {
  propId: PropId;
  productName: string;
  reason: "LINK_NEEDS_REVIEW" | "LINK_TOO_LONG";
};

function linkProblem(link: CardLink): SkippedShare<string>["reason"] | null {
  if (!isHttpUrl(link.url) || link.label.length === 0) return "LINK_NEEDS_REVIEW";
  if (link.url.length > PUBLISHED_URL_MAX || link.label.length > LINK_LABEL_MAX) return "LINK_TOO_LONG";
  return null;
}

// Built only from saved values, so preparePublication's "save privately first"
// checks pass. Owner-chosen links are refused, not dropped: a bad saved link
// skips its card by name so the owner can fix it.
export function shareAllSelections<PropId extends string, Cost>(props: readonly ShareAllProp<PropId, Cost>[]) {
  const skipped: SkippedShare<PropId>[] = [];
  const shareable = props.filter(prop => prop.visibility === "PRIVATE" && !prop.onPublishedPage).flatMap(prop => {
    const offered = defaultPrimaryLink(prop.primaryLink, prop.product.domain);
    const problem = offered && linkProblem(offered.link);
    if (problem && offered.source === "SAVED") {
      skipped.push({ propId: prop.propId, productName: prop.product.name, reason: problem });
      return [];
    }
    const selection: ShareAllSelection<PropId, Cost> = {
      propId: prop.propId,
      expectedRelationshipVersion: prop.relationshipVersion ?? 0,
      publish: true,
      status: prop.status,
      headline: prop.headline,
      note: prop.note,
      ...(prop.startedAt !== undefined ? { startedAt: prop.startedAt } : {}),
      ...(prop.startedAtSource !== undefined ? { startedAtSource: prop.startedAtSource } : {}),
      ...(offered && !problem ? { primaryLink: offered.link } : {}),
      autoRefresh: false,
      // Sent with the saved amount so publishing keeps it; PRIVATE keeps it off the card.
      ...(prop.cost !== undefined ? { cost: prop.cost } : {}),
      costVisibility: "PRIVATE",
    };
    return [selection];
  });
  return {
    selections: shareable.slice(0, SHARE_ALL_MAX),
    skipped,
    remainingCount: Math.max(0, shareable.length - SHARE_ALL_MAX),
  };
}
