import { isHttpUrl } from "./http-url";
import { linkDisclosure, type LinkDisclosure } from "./link-type";
import type { PublicProfile } from "./public-profile";

export type LinkPropCredit = {
  productName: string;
  productSlug: string;
  disclosure: LinkDisclosure;
  url: string;
  count: number;
};

/** A prop can come only from an affiliate or referral link already stored on the card. */
export function creditFromStoredLink(card: PublicProfile["cards"][number], count = 1): LinkPropCredit | undefined {
  const link = card.primaryLink;
  if (!link || count < 1 || !isHttpUrl(link.url)) return undefined;
  const disclosure = linkDisclosure(link.type);
  if (!disclosure) return undefined;
  return {
    productName: card.product.name,
    productSlug: card.product.slug,
    disclosure,
    url: link.url,
    count,
  };
}

export function linkPropText(credit: LinkPropCredit) {
  const noun = credit.count === 1 ? "prop" : "props";
  return `${credit.count} ${noun} given · ${credit.productName} · ${credit.disclosure} · ${credit.url}`;
}
