import { load } from "cheerio";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { SharingPreview } from "../../components/sharing-preview";
import { SearchListingChoiceView } from "../../components/search-listing-choice";
import type { PublicProfile } from "../domain/public-profile";

const card: PublicProfile["cards"][number] = {
  product: { name: "Clay", slug: "clay", domain: "clay.com", description: "Synthetic product" },
  status: "ACTIVE", headline: "Enrichment tables", note: "",
};

function preview(cards: PublicProfile["cards"], options: { current?: boolean; refreshAccounts?: { accountLabel: string }[] } = {}) {
  return load(renderToStaticMarkup(createElement(SharingPreview, {
    profile: { handle: "owner", displayName: "Owner", bio: "", cards }, current: true, busy: false, onPublish: () => {}, ...options,
  })));
}

test("the preview reminds the owner what a work-sample link shows, without promising every visitor can open it", () => {
  const text = preview([{ ...card, usageLink: { url: "https://www.loom.com/share/e5b8c04bca094dd8a5507925ab887002", label: "PROOF_OF_USE" } }]).text();
  expect(text).toContain("open only if their own sharing settings allow it");
  expect(text).toContain("nothing private, like other people’s contact details");
});

test("the visitor's view shows what each product does for the owner before anything is published", () => {
  const $ = preview([{ ...card, uses: { picks: ["sync-crm", "enrich-leads"], other: "score inbound leads" } }]);
  expect($(".card-uses-lead").text()).toBe("I use it to");
  expect($('ul[aria-label="What I use it for"] li').map((_, item) => $(item).text()).get())
    .toEqual(["enrich lead and account lists", "keep my CRM records filled in", "score inbound leads"]);
});

test("the visitor's view shows each card's credit before anything is published, with no report link", () => {
  const $ = preview([{ ...card, credit: { platform: "GITHUB", handle: "keeganmoody33" } }]);
  expect($(".card-credit-line").text()).toBe("Props to @keeganmoody33 · GitHub");
  expect($(".card-credit-line a").attr("href")).toBe("https://github.com/keeganmoody33");
  expect($(".card-credit-report").length).toBe(0);
});

test("the preview says nothing about links when no card has one", () => {
  expect(preview([card]).text()).not.toContain("sharing settings");
});

const githubCard: PublicProfile["cards"][number] = {
  ...card,
  product: { name: "GitHub", slug: "github", domain: "github.com", description: "Code" },
  activity: {
    kind: "contributionCalendar", attributionScope: "PERSONAL", capturedAt: "2026-09-30T12:00:00Z",
    freshness: "STALE", provenanceLabel: "Saved activity from github.com/account-a", total: 17,
    days: [{ date: "2026-09-30", count: 17, level: 4 }],
  },
};

test("daily refresh consent names account B while keeping account A's saved activity attribution", () => {
  const $ = preview([githubCard], { refreshAccounts: [{ accountLabel: "github.com/account-b" }] });
  expect($(".product-card").text()).toContain("Saved activity from github.com/account-a");
  expect($(".sharing-preview > p").text()).toContain("Daily GitHub refresh will read activity from github.com/account-b and update the approved metric on your public card.");
  expect($(".sharing-preview > p").text()).toContain("Reconnecting requires a fresh sharing preview and approval.");
  expect($(".product-card").text()).not.toContain("github.com/account-b");
  expect($(".sharing-preview-confirmation input").prop("checked")).toBe(false);
  expect($(".primary-action").prop("disabled")).toBe(true);
});

test("an invalidated sharing preview shows the warning and disables consent and publication", () => {
  const $ = preview([githubCard], { current: false, refreshAccounts: [{ accountLabel: "github.com/account-b" }] });
  expect($("[role=status]").text()).toContain("Preview again before publishing.");
  expect($(".sharing-preview-confirmation input").prop("disabled")).toBe(true);
  expect($(".primary-action").prop("disabled")).toBe(true);
});

test("older preview responses without refresh-account metadata still render a fixed snapshot", () => {
  const $ = preview([githubCard]);
  expect($(".product-card").text()).toContain("Saved activity from github.com/account-a");
  expect($.text()).not.toContain("Daily GitHub refresh will read activity");
});

test("the preview asks once whether to list the page in search, before the approval, and says the page stays public either way", () => {
  const $ = load(renderToStaticMarkup(createElement(SharingPreview, {
    profile: { handle: "owner", displayName: "Owner", bio: "", cards: [card] }, current: true, busy: false, onPublish: () => {},
    searchListing: createElement(SearchListingChoiceView, { listed: true, saving: false, error: "", onChange: () => {} }),
  })));
  const choice = $(".sharing-preview .search-listing-choice");
  expect(choice.find('[data-slot="field-label"]').text()).toBe("List my page in search");
  expect(choice.text()).toContain("Your page stays public at its link either way.");
  expect(choice.find('[role="switch"]').attr("aria-checked")).toBe("true");
  expect($(".sharing-preview > *").index(choice)).toBeLessThan($(".sharing-preview > *").index($(".sharing-preview-confirmation")));
  ["—", "–", " - "].forEach(dash => expect(choice.text()).not.toContain(dash));
  const off = load(renderToStaticMarkup(createElement(SearchListingChoiceView, { listed: false, saving: false, error: "Too many publication changes.", onChange: () => {} })));
  expect(off('[role="switch"]').attr("aria-checked")).toBe("false");
  expect(off('[role="alert"]').text()).toBe("Too many publication changes.");
});

test("without a search listing answer to ask, the preview shows no switch", () => {
  expect(preview([card])(".search-listing-choice")).toHaveLength(0);
});
