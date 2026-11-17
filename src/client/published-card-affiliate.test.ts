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

function renderPublished(card: Card) {
  const props: ComponentProps<typeof ProductCard> = { card, index: 0 };
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
    const $ = renderPublished(card);
    expect($(".card-link-disclosure")).toHaveLength(0);
    if (card.primaryLink) expect($(".card-visit").attr("rel")).toBe("noopener noreferrer");
  }
});

test("a card with a disclosed link offers no props action, only its own controls", () => {
  const $ = renderPublished(publishedCard("AFFILIATE"));
  expect($(".card-link-disclosure").first().text()).toBe("Affiliate link");
  expect($("button").toArray().map(button => $(button).text())).toEqual(["Details ↶", "Close details", "How this was measured"]);
});
