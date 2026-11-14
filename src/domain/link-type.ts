export type LinkType = "CANONICAL" | "AFFILIATE" | "REFERRAL" | "INVITE";
export type LinkDisclosure = "Affiliate link" | "Referral link";

const DISCLOSURES = { AFFILIATE: "Affiliate link", REFERRAL: "Referral link" } as const satisfies Partial<Record<LinkType, LinkDisclosure>>;
// CANONICAL covers a product page or the owner's own account page, so it is not called an official site.
const LINK_TYPE_LABELS: Readonly<Record<LinkType, string>> = { CANONICAL: "Direct link", INVITE: "Invite link", ...DISCLOSURES };

export function linkTypeLabel(type: LinkType): string {
  return LINK_TYPE_LABELS[type];
}

export function linkDisclosure(type: LinkType): LinkDisclosure | undefined {
  return type === "AFFILIATE" || type === "REFERRAL" ? DISCLOSURES[type] : undefined;
}
