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

test("the preview reminds the owner what a work-sample link shows, without promising every visitor can open it", () => {
  const text = preview([{ ...card, usageLink: { url: "https://www.loom.com/share/e5b8c04bca094dd8a5507925ab887002", label: "PROOF_OF_USE" } }]).text();
  expect(text).toContain("open only if their own sharing settings allow it");
  expect(text).toContain("nothing private, like other people’s contact details");
});

test("the preview says nothing about links when no card has one", () => {
  expect(preview([card]).text()).not.toContain("sharing settings");
});
