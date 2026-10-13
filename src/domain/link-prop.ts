import { isHttpUrl } from "./http-url";
import type { PublicProfile } from "./public-profile";

export type LinkPropCredit = {
  productName: string;
  productSlug: string;
  disclosure: "Affiliate link" | "Referral link";
  url: string;
  count: number;
};

/** A prop can come only from an affiliate or referral link already stored on the card. */
export function creditFromStoredLink(card: PublicProfile["cards"][number], count = 1): LinkPropCredit | undefined {
  const link = card.primaryLink;
  if (!link || count < 1 || !isHttpUrl(link.url)) return undefined;
  if (link.type !== "AFFILIATE" && link.type !== "REFERRAL") return undefined;
  return {
    productName: card.product.name,
    productSlug: card.product.slug,
    disclosure: link.type === "AFFILIATE" ? "Affiliate link" : "Referral link",
    url: link.url,
    count,
  };
}

export function linkPropText(credit: LinkPropCredit) {
  const noun = credit.count === 1 ? "prop" : "props";
  return `${credit.count} ${noun} given · ${credit.productName} · ${credit.disclosure} · ${credit.url}`;
}
