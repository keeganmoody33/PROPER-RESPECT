import { load } from "cheerio";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ProfileLinkProps } from "../../components/profile-link-props";
import { creditFromStoredLink, linkPropText, type LinkPropCredit } from "../domain/link-prop";
import type { PublicProfile } from "../domain/public-profile";

type Card = PublicProfile["cards"][number];
const storedUrl = "https://example.com/owner-selected";

function card(type?: NonNullable<Card["primaryLink"]>["type"]): Card {
  return {
    product: { name: "Example Product", slug: "example-product", domain: "example.com", description: "A synthetic published product." },
    status: "ACTIVE",
    headline: "Published relationship.",
    note: "Published note.",
    ...(type ? { primaryLink: { type, url: storedUrl, label: "Visit Example Product" } } : {}),
  };
}

test("a prop given from a stored affiliate or referral link shows for a signed-in profile only", () => {
  const affiliate = creditFromStoredLink(card("AFFILIATE"));
  const referral = creditFromStoredLink(card("REFERRAL"));
  expect(affiliate).toEqual({ productName: "Example Product", productSlug: "example-product", disclosure: "Affiliate link", url: storedUrl, count: 1 });
  expect(referral).toEqual({ ...affiliate, disclosure: "Referral link" });
  expect(creditFromStoredLink(card("CANONICAL"))).toBeUndefined();
  expect(creditFromStoredLink(card("INVITE"))).toBeUndefined();
  expect(creditFromStoredLink(card())).toBeUndefined();

  const credits = [affiliate as LinkPropCredit];
  const signedIn = load(renderToStaticMarkup(createElement(ProfileLinkProps, { credits, viewerSignedIn: true })));
  expect(signedIn(".link-prop").text()).toBe(linkPropText(credits[0]));
  expect(signedIn(".link-prop").text()).toBe(`1 prop given · Example Product · Affiliate link · ${storedUrl}`);
  expect(signedIn("a")).toHaveLength(0);

  const signedOut = load(renderToStaticMarkup(createElement(ProfileLinkProps, { credits, viewerSignedIn: false })));
  expect(signedOut(".link-prop")).toHaveLength(0);
  expect(signedOut.text()).not.toContain("prop given");
  expect(signedOut.text()).not.toContain(storedUrl);
});
