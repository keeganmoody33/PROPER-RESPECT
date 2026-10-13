import { load } from "cheerio";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ProductCard } from "../../components/product-card";
import type { PublicProfile } from "../domain/public-profile";

type Card = PublicProfile["cards"][number];
type LinkType = NonNullable<Card["primaryLink"]>["type"];

const storedUrl = "https://example.com/owner-selected";

function publishedCard(type?: LinkType): Card {
  return {
    product: {
      name: "Example Product",
      slug: "example-product",
      domain: "example.com",
      description: "A synthetic published product.",
    },
    status: "ACTIVE",
    headline: "Published relationship.",
    note: "Published note.",
    ...(type ? { primaryLink: { type, url: storedUrl, label: "Visit Example Product" } } : {}),
  };
}

function renderPublished(card: Card, viewerSignedIn = false) {
  const props: ComponentProps<typeof ProductCard> = { card, index: 0, viewerSignedIn };
  return load(renderToStaticMarkup(createElement(ProductCard, props)));
}

test.each(["AFFILIATE", "REFERRAL"] as const)("a stored %s link is disclosed on the published card", (type) => {
  const $ = renderPublished(publishedCard(type));
  const disclosure = type === "AFFILIATE" ? "Affiliate link" : "Referral link";
  expect($(".card-front .card-link-disclosure").text()).toBe(disclosure);
  expect($(".card-back .card-link-disclosure").text()).toBe(disclosure);
  expect($(".card-visit").attr("href")).toBe(storedUrl);
  expect($(".card-visit").attr("rel")).toBe("noopener noreferrer sponsored");
});

test("a card with no such link gets no invented disclosure", () => {
  for (const card of [publishedCard(), publishedCard("CANONICAL"), publishedCard("INVITE")]) {
    const $ = renderPublished(card, true);
    expect($(".card-link-disclosure")).toHaveLength(0);
    expect($(".card-props-action")).toHaveLength(0);
    if (card.primaryLink) expect($(".card-visit").attr("rel")).toBe("noopener noreferrer");
  }
});

test("a signed-out viewer does not get the props action", () => {
  const card = publishedCard("AFFILIATE");
  const signedOut = renderPublished(card, false);
  expect(signedOut(".card-link-disclosure").first().text()).toBe("Affiliate link");
  expect(signedOut(".card-props-action")).toHaveLength(0);

  const signedIn = renderPublished(card, true);
  expect(signedIn(".card-props-action")).toHaveLength(1);
  expect(signedIn(".card-props-action").text()).toBe("Give props");
});
