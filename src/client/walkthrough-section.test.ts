import { load } from "cheerio";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Walkthrough } from "../../components/walkthrough";
import type { WalkthroughCard } from "./walkthrough";

// One tool picked in the stack builder: confirmed, Weekly, no line yet, so it waits for an answer.
const waiting: WalkthroughCard = {
  product: { name: "Clay", slug: "clay", domain: "clay.com" },
  prop: { _id: "prop-clay", productId: "product-clay", status: "ACTIVE", level: "WEEKLY", visibility: "PRIVATE", headline: "", note: "",
    confirmedAt: "2026-11-17T12:00:00Z", relationshipVersion: 1, ownerEntered: true, goTo: false },
  isPublishedAtCurrentHandle: false,
};
const section = (props: Parameters<typeof Walkthrough>[0]) => load(renderToStaticMarkup(createElement(Walkthrough, props)));
const START = "Go through your tools one at a time";

test("while later pages of a long collection are still being read, the section is there to land on and says so, with no start yet", () => {
  // "Next: go through your tools" points at #walkthrough, so the target exists before the walk can be offered.
  for (const cards of [[waiting], []]) {
    const $ = section({ cards, collection: "reading" });
    expect($("section#walkthrough h2").text()).toBe("Go through your tools");
    expect($('section#walkthrough [role="status"]').text()).toBe("Reading the rest of your collection…");
    expect($("button").length).toBe(0);
  }
});

test("once the whole collection is read, a waiting tool brings the start and no waiting tool brings nothing", () => {
  const ready = section({ cards: [waiting], collection: "read" });
  expect(ready("section#walkthrough button").text()).toBe(START);
  expect(ready('[role="status"]').length).toBe(0);
  expect(section({ cards: [], collection: "read" })("section").length).toBe(0);
});

test("before the first page arrives there is nothing to show", () => {
  expect(section({ cards: [], collection: "starting" })("section").length).toBe(0);
});
