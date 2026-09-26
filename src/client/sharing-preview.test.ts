import { load } from "cheerio";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { SharingPreview } from "../../components/onboarding-client";
import type { PublicProfile } from "../domain/public-profile";

const card: PublicProfile["cards"][number] = {
  product: { name: "Clay", slug: "clay", domain: "clay.com", description: "Synthetic product" },
  status: "ACTIVE", headline: "Enrichment tables", note: "",
};

function preview(cards: PublicProfile["cards"]) {
  return load(renderToStaticMarkup(createElement(SharingPreview, {
    profile: { handle: "owner", displayName: "Owner", bio: "", cards }, current: true, busy: false, onPublish: () => {},
  })));
}

test("the preview warns about videos without promising that every visitor can play them", () => {
  const text = preview([{ ...card, demo: { provider: "LOOM", id: "e5b8c04bca094dd8a5507925ab887002" } }]).text();
  expect(text).toContain("each plays only if its own sharing settings let anyone watch");
  expect(text).toContain("nothing private, like other people’s contact details");
  expect(text).not.toMatch(/anyone with the link can play/i);
});

test("the preview says nothing about videos when no card has one", () => {
  expect(preview([card]).text()).not.toContain("sharing settings");
});
