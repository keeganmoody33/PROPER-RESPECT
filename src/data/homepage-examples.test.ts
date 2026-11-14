import { expect, test } from "vitest";
import { isHttpUrl } from "@/src/domain/http-url";
import { productBrandSnapshotSchema } from "@/src/domain/product-brand";
import { directoryEntry } from "@/src/domain/product-directory";
import { listedUses, productUseLabels } from "@/src/domain/product-uses";
import { activityModuleSchema } from "@/src/domain/public-profile";
import { homepageExamples } from "./homepage-examples";

const examples = homepageExamples();
const YEAR_DIGITS = 4;
const DAYS_IN_YEAR = 365;
// The same sample calendar the homepage has shown since 2026-09-21.
const SAMPLE_CONTRIBUTIONS = 859;
const LINE_LIMIT = 60;

test("the homepage shows a go-to-market engineering stack whose names and links come from the directory", () => {
  expect(examples.map(example => [example.card.product.name, example.card.level, example.card.status, example.card.goTo === true, example.card.startedAt?.slice(0, YEAR_DIGITS)])).toEqual([
    ["GitHub", "DAILY", "ACTIVE", true, "2019"],
    ["Claude Code", "DAILY", "ACTIVE", false, "2025"],
    ["Firecrawl", "WEEKLY", "ACTIVE", false, "2025"],
    ["Exa", "WEEKLY", "ACTIVE", false, "2025"],
    ["Cloudflare", "DAILY", "ACTIVE", true, "2020"],
    ["Porkbun", "OCCASIONAL", "ACTIVE", true, "2021"],
    ["Spider", "OCCASIONAL", "ACTIVE", false, "2026"],
    ["Docker", "WEEKLY", "ACTIVE", false, "2020"],
    ["Open Places", "OCCASIONAL", "ACTIVE", false, "2026"],
    ["Grok Bot", "TESTING", "TESTING", false, "2026"],
    ["Elicit", "TESTING", "TESTING", false, "2026"],
    ["Context.dev", "TESTING", "TESTING", false, "2026"],
    ["n8n", "PAUSED", "ARCHIVED", false, "2024"],
    ["Clay", "STOPPED", "ARCHIVED", false, "2022"],
  ]);
  const fromDirectory = examples.map(({ id }) => {
    const entry = directoryEntry(id)!;
    return { product: { name: entry.name, slug: entry.slug, domain: entry.domain, description: entry.description }, link: { type: "CANONICAL", url: entry.website, label: `Open ${entry.name}` }, category: entry.category };
  });
  expect(examples.map(({ card }) => ({ product: { ...card.product, brand: undefined }, link: card.primaryLink })))
    .toEqual(fromDirectory.map(({ product, link }) => ({ product: { ...product, brand: undefined }, link })));
  expect(examples.every(({ card }) => isHttpUrl(card.primaryLink!.url))).toBe(true);
  expect(fromDirectory.filter(({ category }) => category === "CONSUMER")).toEqual([]);
  expect(examples.map(example => example.id)).not.toEqual(expect.arrayContaining(["notebooklm"]));
  expect(examples.map(example => example.id)).not.toEqual(expect.arrayContaining(["wisprflow"]));
  expect(fromDirectory.filter(({ category }) => category === "SALES").map(({ product }) => product.slug)).toEqual(["clay"]);
});

test("every headline and note is a short line under the card's limit", () => {
  const tooLong = examples.flatMap(({ card }) => [card.headline, card.note]).filter(text => !text || text.length >= LINE_LIMIT);
  expect(tooLong).toEqual([]);
});

test("every example carries a sample chart labelled as illustrative, never as account data", () => {
  expect(examples.map(({ id, card }) => [id, card.activity?.kind])).toEqual([
    ["github", "contributionCalendar"],
    ["claude-code", "codingActivity"],
    ["firecrawl", "headlineMetrics"],
    ["exa", "headlineMetrics"],
    ["cloudflare", "headlineMetrics"],
    ["porkbun", "headlineMetrics"],
    ["spider", "headlineMetrics"],
    ["docker", "headlineMetrics"],
    ["open-places", "headlineMetrics"],
    ["grok-bot", "headlineMetrics"],
    ["elicit", "headlineMetrics"],
    ["context-dev", "headlineMetrics"],
    ["n8n", "headlineMetrics"],
    ["clay", "headlineMetrics"],
  ]);
  const labels = new Set(examples.map(({ card }) => `${card.activity?.provenanceLabel} / ${card.activity?.freshness}`));
  expect(labels).toEqual(new Set(["Illustrative sample, not account data / STALE"]));
  expect(examples.filter(({ card }) => !activityModuleSchema.safeParse(card.activity).success).map(({ id }) => id)).toEqual([]);
});

test("every example says what it is used for, in two or three of its product's own listed uses", () => {
  expect(examples.map(({ id, card }) => [id, productUseLabels(id, card.uses)])).toEqual([
    ["github", ["host my code and its history", "review and merge pull requests", "run tests and deploys on every push"]],
    ["claude-code", ["build features from a description", "find and fix bugs", "automate repetitive engineering work"]],
    ["firecrawl", ["turn web pages into Markdown", "crawl whole sites"]],
    ["exa", ["give my agents web search", "find companies and people that fit a description"]],
    ["cloudflare", ["run DNS for my domains", "run code at the edge with Workers", "cache and protect my sites"]],
    ["porkbun", ["register and renew domains", "manage DNS records"]],
    ["spider", ["crawl sites quickly at volume", "feed web data to my agents"]],
    ["docker", ["run databases and services locally", "package apps to run anywhere"]],
    ["open-places", ["build lists of local businesses", "find businesses in one area or category"]],
    ["grok-bot", ["hand off tasks to an agent", "research a topic for me"]],
    ["elicit", ["find papers on a question", "pull data out of studies into a table"]],
    ["context-dev", ["pull a company's logo, colors and fonts", "look up company details by domain"]],
    ["n8n", ["run jobs on a schedule", "move data between systems"]],
    ["clay", ["enrich lead and account lists", "build target account lists"]],
  ]);
  expect(examples.filter(({ id, card }) => listedUses(id, card.uses)?.picks.length !== card.uses?.picks.length).map(({ id }) => id)).toEqual([]);
});

test("every example with a committed brand carries it, matched to its own product", () => {
  expect(examples.filter(({ card }) => card.product.brand).map(({ id }) => id)).toEqual([
    "github", "firecrawl", "exa", "cloudflare", "porkbun", "spider", "docker", "open-places", "elicit", "context-dev", "n8n", "clay",
  ]);
  const mismatched = examples.filter(({ card }) => card.product.brand && (card.product.brand.productSlug !== card.product.slug
    || card.product.brand.canonicalDomain !== card.product.domain || !productBrandSnapshotSchema.safeParse(card.product.brand).success));
  expect(mismatched.map(({ id }) => id)).toEqual([]);
  expect(examples.filter(({ card }) => card.product.logoUrl).map(({ id }) => id)).toEqual([]);
});

test("GitHub's sample contribution calendar covers one year", () => {
  const activity = examples[0].card.activity;
  if (activity?.kind !== "contributionCalendar") throw new Error("GitHub sample calendar missing");
  expect(activity.days).toHaveLength(DAYS_IN_YEAR);
  expect(activity.days[0]).toEqual({ date: "2025-09-01", count: 0, level: 0 });
  expect(activity.days.at(-1)?.date).toBe("2026-08-31");
  expect(activity.total).toBe(SAMPLE_CONTRIBUTIONS);
  expect(activity.days.reduce((sum, day) => sum + day.count, 0)).toBe(SAMPLE_CONTRIBUTIONS);
  expect(examples[0].source?.href).toBe("https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference");
});
