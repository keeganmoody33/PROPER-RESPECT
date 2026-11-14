import { expect, test } from "vitest";
import { isHttpsUrl, isHttpUrl } from "@/src/domain/http-url";
import { productBrandSnapshotSchema } from "@/src/domain/product-brand";
import { directoryEntry } from "@/src/domain/product-directory";
import { listedUses, productUseLabels } from "@/src/domain/product-uses";
import { activityModuleSchema, publicProfileSchema } from "@/src/domain/public-profile";
import { usageLinkHost, usageLinkLabelText } from "@/src/domain/usage-links";
import { homepageExamples } from "./homepage-examples";

const examples = homepageExamples();
const YEAR_DIGITS = 4;
const DAYS_IN_YEAR = 365;
// The same sample calendar the homepage has shown since 2026-09-21.
const SAMPLE_CONTRIBUTIONS = 859;
const LINE_LIMIT = 60;
const WEEKS = 12;
const DAYS_PER_WEEK = 7;
const DAY_MS = 86_400_000;
const CODING_DAYS = 31;

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
    ["Elicit", "STOPPED", "ARCHIVED", false, "2026"],
    ["Context.dev", "TESTING", "TESTING", false, "2026"],
    ["n8n", "PAUSED", "ARCHIVED", false, "2024"],
    ["Clay", "DAILY", "ACTIVE", false, "2023"],
  ]);
  const fromDirectory = examples.map(({ id }) => {
    const entry = directoryEntry(id)!;
    return { product: { name: entry.name, slug: entry.slug, domain: entry.domain, description: entry.description }, link: { url: entry.website, label: `Open ${entry.name}` }, category: entry.category };
  });
  expect(examples.map(({ card }) => ({ product: { ...card.product, brand: undefined }, link: { ...card.primaryLink, type: undefined } })))
    .toEqual(fromDirectory.map(({ product, link }) => ({ product: { ...product, brand: undefined }, link })));
  expect(examples.every(({ card }) => isHttpUrl(card.primaryLink!.url))).toBe(true);
  expect(fromDirectory.filter(({ category }) => category === "CONSUMER")).toEqual([]);
  expect(examples.map(example => example.id)).not.toEqual(expect.arrayContaining(["notebooklm"]));
  expect(examples.map(example => example.id)).not.toEqual(expect.arrayContaining(["wisprflow"]));
  expect(fromDirectory.filter(({ category }) => category === "SALES").map(({ product }) => product.slug)).toEqual(["clay"]);
});

const CAPABILITY_LIMIT = 28;

test("each example names the part of a card it shows, in a few words no other example uses", () => {
  expect(examples.map(({ id, capability }) => [id, capability])).toEqual([
    ["github", "A year of contributions"],
    ["claude-code", "Coding days"],
    ["firecrawl", "Referral link, disclosed"],
    ["exa", "A demo link on the back"],
    ["cloudflare", "Go-to, with what it costs"],
    ["porkbun", "Running totals"],
    ["spider", "Affiliate link, disclosed"],
    ["docker", "A list of linked work"],
    ["open-places", "Used now and then"],
    ["grok-bot", "Still testing"],
    ["elicit", "Stopped using, and why"],
    ["context-dev", "Testing, week by week"],
    ["n8n", "Paused, and why"],
    ["clay", "Published usage numbers"],
  ]);
  expect(new Set(examples.map(({ capability }) => capability)).size).toBe(examples.length);
  expect(examples.filter(({ capability }) => capability.length > CAPABILITY_LIMIT).map(({ id }) => id)).toEqual([]);
});

test("every headline and note is a short line under the card's limit", () => {
  const tooLong = examples.flatMap(({ card }) => [card.headline, card.note]).filter(text => !text || text.length >= LINE_LIMIT);
  expect(tooLong).toEqual([]);
});

test("each example shows a different part of a card: its link, cost, work sample, published numbers and kind of activity", () => {
  expect(examples.map(({ id, card }) => [id, card.primaryLink?.type, card.cost && `${card.cost.amount} ${card.cost.currency} ${card.cost.cadence} ${card.cost.basis}`,
    card.usageLink && `${usageLinkLabelText(card.usageLink.label)} / ${usageLinkHost(card.usageLink.url)}`, card.measurements?.length, card.activity?.kind])).toEqual([
    ["github", "CANONICAL", undefined, undefined, undefined, "contributionCalendar"],
    ["claude-code", "CANONICAL", undefined, undefined, undefined, "codingActivity"],
    ["firecrawl", "REFERRAL", undefined, undefined, undefined, "timeSeries"],
    ["exa", "CANONICAL", undefined, "Demo / exa.ai", undefined, "timeSeries"],
    ["cloudflare", "CANONICAL", "5 USD MONTHLY OWNER_REPORTED", undefined, undefined, "timeSeries"],
    ["porkbun", "CANONICAL", undefined, undefined, undefined, "headlineMetrics"],
    ["spider", "AFFILIATE", undefined, undefined, undefined, "timeSeries"],
    ["docker", "CANONICAL", undefined, undefined, undefined, "artifactCollection"],
    ["open-places", "CANONICAL", undefined, undefined, undefined, "timeSeries"],
    ["grok-bot", "CANONICAL", undefined, undefined, undefined, "headlineMetrics"],
    ["elicit", "CANONICAL", undefined, undefined, undefined, "timeSeries"],
    ["context-dev", "CANONICAL", undefined, undefined, undefined, "timeSeries"],
    ["n8n", "CANONICAL", undefined, undefined, undefined, "headlineMetrics"],
    ["clay", "CANONICAL", "149 USD MONTHLY OWNER_REPORTED", "See how I use it / clay.com", 3, undefined],
  ]);
  expect(examples.filter(({ card }) => !publicProfileSchema.shape.cards.element.safeParse(card).success).map(({ id }) => id)).toEqual([]);
});

test("every sample is labelled illustrative, never account data: activity as a stale sample, published numbers as synthetic", () => {
  const labels = new Set(examples.flatMap(({ card }) => card.activity ? [`${card.activity.provenanceLabel} / ${card.activity.freshness}`] : []));
  expect(labels).toEqual(new Set(["Illustrative sample, not account data / STALE"]));
  expect(examples.filter(({ card }) => card.activity && !activityModuleSchema.safeParse(card.activity).success).map(({ id }) => id)).toEqual([]);
  expect(examples.filter(({ card }) => !card.activity && !card.measurements?.length).map(({ id }) => id)).toEqual([]);
  expect(new Set(examples.flatMap(({ card }) => card.measurements ?? []).map(row => row.sample))).toEqual(new Set(["synthetic"]));
});

test("Clay publishes three exact numbers over a stated period, in the spirit of rows enriched since 2023", () => {
  const clay = examples.find(({ id }) => id === "clay")!.card;
  expect(clay.measurements?.map(row => [row.metric, row.value, row.unit, row.period.kind === "date" ? `${row.period.start} to ${row.period.end}` : row.period.kind]))
    .toEqual([
      ["rows_enriched", "2140000", "rows", "2023-03-01 to 2026-08-31"],
      ["tables_built", "86", "tables", "2023-03-01 to 2026-08-31"],
      ["credits_used", "48500", "credits", "2025-09-01 to 2026-08-31"],
    ]);
  expect(clay.cost).toEqual({ amount: 149, currency: "USD", cadence: "MONTHLY", basis: "OWNER_REPORTED", asOf: "2026-09-01" });
  expect(clay.usageLink).toEqual({ url: "https://www.clay.com/templates", label: "SEE_HOW_I_USE_IT" });
  expect(clay.note).toBe("Lists that took a week of spreadsheets take an hour.");
});

test("Docker lists three things as links to public pages, and every outbound link on every example is https", () => {
  const docker = examples.find(({ id }) => id === "docker")!.card.activity;
  if (docker?.kind !== "artifactCollection") throw new Error("Docker artifacts missing");
  expect(docker.total).toBe(docker.artifacts.length);
  expect(docker.artifacts.map(({ title, url }) => [title, url])).toEqual([
    ["Sample Compose apps (awesome-compose)", "https://github.com/docker/awesome-compose"],
    ["Official Postgres image", "https://hub.docker.com/_/postgres"],
    ["Multi-stage build guide", "https://docs.docker.com/build/building/multi-stage/"],
  ]);
  const urls = examples.flatMap(({ card }) => [card.primaryLink?.url, card.usageLink?.url, ...(card.activity?.kind === "artifactCollection" ? card.activity.artifacts.map(({ url }) => url) : [])]).filter(url => url !== undefined);
  expect(urls.filter(url => !isHttpsUrl(url))).toEqual([]);
});

test("a stopped and a paused example each say why in their note", () => {
  expect(examples.filter(({ card }) => card.status === "ARCHIVED").map(({ id, card }) => [id, card.level, card.note])).toEqual([
    ["elicit", "STOPPED", "I stopped once my market study was done."],
    ["n8n", "PAUSED", "Paused while my nightly jobs move to plain cron."],
  ]);
});

test("each weekly sample is twelve consecutive weeks, read per week, and its period covers exactly those weeks", () => {
  const series = examples.flatMap(({ id, card }) => card.activity?.kind === "timeSeries" ? [{ id, activity: card.activity }] : []);
  expect(series.map(({ id, activity }) => [id, activity.label, activity.unit, activity.points.at(-1)?.value])).toEqual([
    ["firecrawl", "pages scraped", "per week", 1100],
    ["exa", "searches run", "per week", 277],
    ["cloudflare", "requests served", "per week", 48360],
    ["spider", "pages crawled", "per week", 8120],
    ["open-places", "businesses exported", "per week", 552],
    ["elicit", "papers screened", "per week", 25],
    ["context-dev", "domains looked up", "per week", 76],
  ]);
  for (const { id, activity } of series) {
    expect(activity.points, id).toHaveLength(WEEKS);
    const gaps = activity.points.slice(1).map((point, index) => (Date.parse(point.date) - Date.parse(activity.points[index].date)) / DAY_MS);
    expect(new Set(gaps), id).toEqual(new Set([DAYS_PER_WEEK]));
    expect(activity.period, id).toEqual({ start: activity.points[0].date, end: new Date(Date.parse(activity.points.at(-1)!.date) + (DAYS_PER_WEEK - 1) * DAY_MS).toISOString().slice(0, 10) });
  }
  expect(series.find(({ id }) => id === "elicit")?.activity.period).toEqual({ start: "2026-01-05", end: "2026-03-29" });
  expect(series.find(({ id }) => id === "firecrawl")?.activity.period).toEqual({ start: "2026-06-08", end: "2026-08-30" });
});

test("Claude Code's sessions are the sum of the days it draws", () => {
  const activity = examples[1].card.activity;
  if (activity?.kind !== "codingActivity" || !activity.days) throw new Error("Claude Code sample days missing");
  expect(activity.days).toHaveLength(CODING_DAYS);
  expect(activity.primary).toEqual({ label: "sessions", value: activity.days.reduce((sum, day) => sum + day.count, 0) });
  expect(activity.period).toEqual({ start: "2026-08-01", end: "2026-08-31" });
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
    ["clay", ["enrich lead and account lists", "find contact details"]],
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
