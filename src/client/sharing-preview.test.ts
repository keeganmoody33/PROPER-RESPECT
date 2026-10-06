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
