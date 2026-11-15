import { load } from "cheerio";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ProductExample } from "@/components/product-example";
import { ProductCard } from "@/components/product-card";
import { isHttpsUrl, isHttpUrl } from "@/src/domain/http-url";
import { productBrandSnapshotSchema } from "@/src/domain/product-brand";
import { directoryEntry } from "@/src/domain/product-directory";
import { productUseLabels } from "@/src/domain/product-uses";
import { activityModuleSchema, publicProfileSchema } from "@/src/domain/public-profile";
import { usageLinkHost, usageLinkLabelText } from "@/src/domain/usage-links";
import { activityHeadline } from "@/src/domain/activity-headline";
import { noLongerInUse } from "@/src/domain/relationship-level";
import { homepageExamples } from "./homepage-examples";

const examples = homepageExamples();
const YEAR_DIGITS = 4;
const DAYS_IN_YEAR = 365;
// The sample year: weekdays carry the work, weekends are mostly empty, two weeks over the new year are off.
const SAMPLE_CONTRIBUTIONS = 1121;
const LINE_LIMIT = 60;
const DAYS_PER_WEEK = 7;
const DAY_MS = 86_400_000;
const CODING_DAYS = 31;

test("the homepage shows a go-to-market engineering stack whose names and links come from the directory", () => {
  expect(examples.map(example => [example.card.product.name, example.card.level, example.card.status, example.card.goTo === true, example.card.startedAt?.slice(0, YEAR_DIGITS)])).toEqual([
    ["Clay", "DAILY", "ACTIVE", false, "2023"],
    ["GitHub", "DAILY", "ACTIVE", true, "2019"],
    ["Cloudflare", "DAILY", "ACTIVE", true, "2020"],
    // Docker's sample links start in 2024, so its card does too.
    ["Docker", "WEEKLY", "ACTIVE", false, "2024"],
    ["Firecrawl", "WEEKLY", "ACTIVE", false, "2025"],
    ["n8n", "PAUSED", "ARCHIVED", false, "2024"],
    ["Claude Code", "DAILY", "ACTIVE", false, "2025"],
    ["Exa", "WEEKLY", "ACTIVE", false, "2025"],
    ["Porkbun", "OCCASIONAL", "ACTIVE", true, "2021"],
    ["Spider", "OCCASIONAL", "ACTIVE", false, "2026"],
    ["Open Places", "OCCASIONAL", "ACTIVE", false, "2026"],
    ["Grok Bot", "TESTING", "TESTING", false, "2026"],
    ["Elicit", "STOPPED", "ARCHIVED", false, "2026"],
    ["Context.dev", "TESTING", "TESTING", false, "2026"],
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
    ["clay", "One published number"],
    ["github", "A year of contributions"],
    ["cloudflare", "Go-to, with what it costs"],
    ["docker", "A running total"],
    ["firecrawl", "Referral link, disclosed"],
    ["n8n", "Paused, and why"],
    ["claude-code", "Coding days"],
    ["exa", "A demo link on the back"],
    ["porkbun", "Go-to, now and then"],
    ["spider", "Affiliate link, disclosed"],
    ["open-places", "Used now and then"],
    ["grok-bot", "Still testing"],
    ["elicit", "Stopped using, and why"],
    ["context-dev", "Testing, week by week"],
  ]);
  expect(new Set(examples.map(({ capability }) => capability)).size).toBe(examples.length);
  expect(examples.filter(({ capability }) => capability.length > CAPABILITY_LIMIT).map(({ id }) => id)).toEqual([]);
});

test("five examples are featured, first, in the order the chooser shows them; the other nine wait behind More examples", () => {
  expect(examples.map(({ id, featured }) => [id, featured])).toEqual([
    ["clay", true], ["github", true], ["cloudflare", true], ["docker", true], ["firecrawl", true],
    ["n8n", false], ["claude-code", false], ["exa", false], ["porkbun", false], ["spider", false],
    ["open-places", false], ["grok-bot", false], ["elicit", false], ["context-dev", false],
  ]);
});

/** What a card's front draws, which is what a visitor tells examples apart by: two time series can draw different things. */
function frontDrawing({ card }: (typeof examples)[number]): string {
  if (card.measurements?.length) return "numbers";
  const activity = card.activity;
  if (activity?.kind === "timeSeries") return `${activity.unit} bars`;
  return activity?.kind ?? "numbers";
}

test("the five featured fronts show go-to, cost and a disclosed referral link between them; two of them are a number alone", () => {
  const featured = examples.filter(example => example.featured);
  expect(featured.map(example => [example.id, frontDrawing(example), example.card.goTo === true, Boolean(example.card.cost), example.card.primaryLink?.type])).toEqual([
    ["clay", "numbers", false, false, "CANONICAL"],
    ["github", "contributionCalendar", true, false, "CANONICAL"],
    ["cloudflare", "per day bars", true, true, "CANONICAL"],
    ["docker", "headlineMetrics", false, false, "CANONICAL"],
    ["firecrawl", "per week bars", false, false, "REFERRAL"],
  ]);
});

test("Clay's and Exa's cards say what is behind Details: Clay's back holds the most, and Exa's holds the demo its label names", () => {
  expect(examples.filter(({ backHint }) => backHint).map(({ id, backHint }) => [id, backHint])).toEqual([["clay", "The period and a work sample inside"], ["exa", "A demo link inside"]]);
});

test("every headline and note is a short line under the card's limit", () => {
  const tooLong = examples.flatMap(({ card }) => [card.headline, card.note]).filter(text => !text || text.length >= LINE_LIMIT);
  expect(tooLong).toEqual([]);
});

test("each example shows a different part of a card: its link, cost, work sample, published numbers and kind of activity", () => {
  expect(examples.map(({ id, card }) => [id, card.primaryLink?.type, card.cost && `${card.cost.amount} ${card.cost.currency} ${card.cost.cadence} ${card.cost.basis}`,
    card.usageLink && `${usageLinkLabelText(card.usageLink.label)} / ${usageLinkHost(card.usageLink.url)}`, card.measurements?.length, card.activity?.kind])).toEqual([
    ["clay", "CANONICAL", undefined, "See how I use it / clay.com", 1, undefined],
    ["github", "CANONICAL", undefined, undefined, undefined, "contributionCalendar"],
    ["cloudflare", "CANONICAL", "5 USD MONTHLY OWNER_REPORTED", undefined, undefined, "timeSeries"],
    ["docker", "CANONICAL", undefined, undefined, undefined, "headlineMetrics"],
    ["firecrawl", "REFERRAL", undefined, undefined, undefined, "timeSeries"],
    ["n8n", "CANONICAL", undefined, undefined, undefined, "timeSeries"],
    ["claude-code", "CANONICAL", undefined, undefined, undefined, "codingActivity"],
    ["exa", "CANONICAL", undefined, "Demo / exa.ai", undefined, "timeSeries"],
    ["porkbun", "CANONICAL", undefined, undefined, undefined, "headlineMetrics"],
    ["spider", "AFFILIATE", undefined, undefined, undefined, "timeSeries"],
    ["open-places", "CANONICAL", undefined, undefined, undefined, "timeSeries"],
    ["grok-bot", "CANONICAL", undefined, undefined, undefined, "headlineMetrics"],
    ["elicit", "CANONICAL", undefined, undefined, undefined, "timeSeries"],
    ["context-dev", "CANONICAL", undefined, undefined, undefined, "timeSeries"],
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

/**
 * clay.com/pricing on 15 Nov 2026 lists Launch at $167/mo billed annually with 30,000 data credits a year, the largest Launch tier at
 * 600,000 a year, and no per-row credit cost. About 410,000 rows a year is past what one plan's price can be shown to cover, so the card states no cost.
 */
test("Clay leads with one number a heavy user earns, about 1.5M rows enriched since 2023, and claims no price or credits it can't back", () => {
  const clay = examples.find(({ id }) => id === "clay")!.card;
  expect(clay.measurements?.map(row => [row.metric, row.value, row.unit, row.period.kind === "date" ? `${row.period.start} to ${row.period.end}` : row.period.kind]))
    .toEqual([["enriched", "1500000", "rows", "2023-01-01 to 2026-08-31"]]);
  expect([clay.startedAt, clay.level, clay.cost, clay.headline]).toEqual(["2023-01-01", "DAILY", undefined, "Contact enrichment for my sales team."]);
  expect(clay.usageLink).toEqual({ url: "https://www.clay.com/templates", label: "SEE_HOW_I_USE_IT" });
  expect(clay.note).toBe("Lists that took a week of spreadsheets take an hour.");
});

test("Clay's card is no tutorial: neither face draws a lead list, a provider waterfall or a match rate", () => {
  const $ = load(renderToStaticMarkup(createElement(ProductExample, { examples })));
  const clay = $('[data-example="clay"]');
  expect([clay.find(".card-front").length, clay.find(".card-back").length]).toEqual([1, 1]);
  expect([clay.find("table").length, clay.text().match(/waterfall|emails found|job change|invented rows|provider/gi)]).toEqual([0, null]);
});

test("every outbound link on every example is https", () => {
  const urls = examples.flatMap(({ card }) => [card.primaryLink?.url, card.usageLink?.url, ...(card.activity?.kind === "artifactCollection" ? card.activity.artifacts.map(({ url }) => url) : [])]).filter(url => url !== undefined);
  expect(urls.filter(url => !isHttpsUrl(url))).toEqual([]);
});

test("a stopped and a paused example each say why in their note", () => {
  expect(examples.filter(({ card }) => card.status === "ARCHIVED").map(({ id, card }) => [id, card.level, card.note])).toEqual([
    ["n8n", "PAUSED", "Paused while my nightly jobs move to plain cron."],
    ["elicit", "STOPPED", "I stopped once my market study was done."],
  ]);
});

test("each sample series is drawn as written, one point a day or a week, and its period covers exactly those points", () => {
  const series = examples.flatMap(({ id, card }) => card.activity?.kind === "timeSeries" ? [{ id, activity: card.activity }] : []);
  expect(series.map(({ id, activity }) => [id, activity.label, activity.unit, activity.points.length, activity.period, activity.points.at(-1)?.value])).toEqual([
    ["cloudflare", "requests", "per day", 31, { start: "2026-08-01", end: "2026-08-31" }, 79400],
    ["firecrawl", "pages scraped", "per week", 12, { start: "2026-06-08", end: "2026-08-30" }, 11000],
    ["n8n", "executions", "per week", 12, { start: "2025-01-13", end: "2025-04-06" }, 0],
    ["exa", "search requests", "per week", 12, { start: "2026-06-08", end: "2026-08-30" }, 3600],
    ["spider", "pages crawled", "per week", 12, { start: "2026-06-08", end: "2026-08-30" }, 31000],
    ["open-places", "places exported", "per week", 12, { start: "2026-06-08", end: "2026-08-30" }, 850],
    ["elicit", "papers screened", "per week", 12, { start: "2026-01-05", end: "2026-03-29" }, 0],
    ["context-dev", "credits used", "per week", 6, { start: "2026-07-20", end: "2026-08-30" }, 220],
  ]);
  const steps = series.map(({ id, activity }) => [id, [...new Set(activity.points.slice(1).map((point, index) => (Date.parse(point.date) - Date.parse(activity.points[index].date)) / DAY_MS))]]);
  expect(steps).toEqual(series.map(({ id, activity }) => [id, [activity.unit === "per day" ? 1 : DAYS_PER_WEEK]]));
});

/** A series' values as shares of its own peak, to two places: its shape, whatever its scale. */
const shape = (values: readonly number[]) => values.map(value => (value / Math.max(...values)).toFixed(2)).join(" ");
const values = (id: string) => {
  const activity = examples.find(example => example.id === id)?.card.activity;
  if (activity?.kind === "timeSeries") return activity.points.map(point => point.value);
  if (activity?.kind === "codingActivity") return (activity.days ?? []).map(day => day.count);
  throw new Error(`${id} draws no series`);
};
const ISO_WEEKEND = new Set([0, 6]);
const weekendShare = (id: string) => {
  const activity = examples.find(example => example.id === id)?.card.activity;
  const days = activity?.kind === "timeSeries" ? activity.points.map(({ date, value }) => ({ date, value }))
    : activity?.kind === "codingActivity" ? (activity.days ?? []).map(({ date, count }) => ({ date, value: count })) : [];
  const mean = (weekend: boolean) => {
    const chosen = days.filter(({ date }) => ISO_WEEKEND.has(new Date(`${date}T00:00:00Z`).getUTCDay()) === weekend);
    return chosen.reduce((sum, { value }) => sum + value, 0) / chosen.length;
  };
  return mean(true) / mean(false);
};
const SERIES_IDS = ["cloudflare", "firecrawl", "n8n", "claude-code", "exa", "spider", "open-places", "elicit", "context-dev"];

test("no two sample charts share a shape, and each shape tells its example's story", () => {
  expect(new Set(SERIES_IDS.map(id => shape(values(id)))).size).toBe(SERIES_IDS.length);
  // Daily: dense, with weekends well below weekdays.
  expect(SERIES_IDS.filter(id => ["cloudflare", "claude-code"].includes(id)).map(id => weekendShare(id) < 0.5)).toEqual([true, true]);
  // Occasional: most weeks empty, a few spikes.
  expect(["spider", "open-places"].map(id => values(id).filter(value => value === 0).length)).toEqual([9, 9]);
  // Weekly: something every week.
  expect(values("exa").every(value => value > 0)).toBe(true);
  // Firecrawl grows; Elicit tails off to nothing; n8n runs steadily, then stops at the pause.
  expect(values("firecrawl").at(-1)! / values("firecrawl")[0]).toBeGreaterThan(5);
  expect(values("elicit").slice(-2)).toEqual([0, 0]);
  expect(values("n8n").slice(-2)).toEqual([0, 0]);
  // Still testing: a short, patchy run.
  expect([values("context-dev").length, values("context-dev").filter(value => value === 0).length]).toEqual([6, 2]);
});

test("running totals cover the years since the owner started, not one month", () => {
  const [docker, porkbun] = ["docker", "porkbun"].map(slug => examples.find(({ id }) => id === slug)!.card);
  expect([docker.startedAt, docker.activity?.period]).toEqual(["2024-01-01", { start: "2024-01-01", end: "2026-08-31" }]);
  expect([porkbun.startedAt, porkbun.activity?.period]).toEqual(["2021-01-01", { start: "2021-03-01", end: "2026-08-31" }]);
});

test("every count a sample states beside its series is counted from that series: active days its days with a session, sessions its sum", () => {
  const coding = examples.flatMap(({ id, card }) => card.activity?.kind === "codingActivity" && card.activity.days ? [{ id, activity: card.activity, days: card.activity.days }] : []);
  expect(coding.map(({ id }) => id)).toEqual(["claude-code"]);
  for (const { id, activity, days } of coding) {
    expect(activity.primary, id).toEqual({ label: "active days", value: days.filter(day => day.count > 0).length });
    expect(activity.supporting.find(({ label }) => label === "Sessions"), id).toEqual({ label: "Sessions", value: days.reduce((sum, day) => sum + day.count, 0) });
  }
});

test("Claude Code leads with the coding days it draws, and its sessions are their sum", () => {
  const activity = examples.find(({ id }) => id === "claude-code")?.card.activity;
  if (activity?.kind !== "codingActivity" || !activity.days) throw new Error("Claude Code sample days missing");
  expect(activity.days).toHaveLength(CODING_DAYS);
  expect(activity.primary).toEqual({ label: "active days", value: activity.days.filter(day => day.count > 0).length });
  expect(activity.supporting[0]).toEqual({ label: "Sessions", value: activity.days.reduce((sum, day) => sum + day.count, 0) });
  expect(activity.period).toEqual({ start: "2026-08-01", end: "2026-08-31" });
});

test("every example says what it is used for in one short plain line, its headline, and adds no list of uses beside it", () => {
  expect(examples.map(({ id, card }) => [id, card.headline])).toEqual([
    ["clay", "Contact enrichment for my sales team."],
    ["github", "Where every project's code lives."],
    ["cloudflare", "DNS, Workers and caching for my projects."],
    ["docker", "Packs scrapers and agents to run anywhere."],
    ["firecrawl", "Turns pages into clean Markdown for my agents."],
    ["n8n", "Scheduled jobs and webhooks."],
    ["claude-code", "Writes and fixes my scrapers and scripts."],
    ["exa", "Search my agents can call."],
    ["porkbun", "Domains for my side projects."],
    ["spider", "Crawls whole sites for my agents."],
    ["open-places", "Local business lists by category and city."],
    ["grok-bot", "Research and outreach chores."],
    ["elicit", "Screening papers for a market study."],
    ["context-dev", "Logos and company details by domain."],
  ]);
  expect(examples.filter(({ card }) => productUseLabels(card.product.slug, card.uses).length).map(({ id }) => id)).toEqual([]);
});

test("every example with a committed brand carries it, matched to its own product", () => {
  expect(examples.filter(({ card }) => card.product.brand).map(({ id }) => id)).toEqual([
    "clay", "github", "cloudflare", "docker", "firecrawl", "n8n", "exa", "porkbun", "spider", "open-places", "elicit", "context-dev",
  ]);
  const mismatched = examples.filter(({ card }) => card.product.brand && (card.product.brand.productSlug !== card.product.slug
    || card.product.brand.canonicalDomain !== card.product.domain || !productBrandSnapshotSchema.safeParse(card.product.brand).success));
  expect(mismatched.map(({ id }) => id)).toEqual([]);
  expect(examples.filter(({ card }) => card.product.logoUrl).map(({ id }) => id)).toEqual([]);
});

test("GitHub's sample contribution calendar covers one year", () => {
  const github = examples.find(({ id }) => id === "github")!;
  const activity = github.card.activity;
  if (activity?.kind !== "contributionCalendar") throw new Error("GitHub sample calendar missing");
  expect(activity.days).toHaveLength(DAYS_IN_YEAR);
  expect(activity.days[0]).toEqual({ date: "2025-09-01", count: 4, level: 2 });
  expect(activity.days.filter(day => day.date >= "2025-12-22" && day.date <= "2026-01-04").map(day => day.count)).toEqual(Array(14).fill(0));
  expect(activity.days.at(-1)?.date).toBe("2026-08-31");
  expect(activity.total).toBe(SAMPLE_CONTRIBUTIONS);
  expect(activity.days.reduce((sum, day) => sum + day.count, 0)).toBe(SAMPLE_CONTRIBUTIONS);
  expect(github.source?.href).toBe("https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference");
});

/** The one big number a card's front leads with, in its tool's own unit, the period it covers, and the tool's own supporting counts. */
function meter({ card, countsPerPeriod }: (typeof examples)[number]) {
  const measured = card.measurements?.[0];
  if (measured) {
    const period = measured.period.kind === "date" ? measured.period : undefined;
    return [Number(measured.value), `${measured.unit} ${measured.metric}`, period?.start, period?.end, []];
  }
  const activity = card.activity!;
  const headline = activityHeadline(activity, noLongerInUse(card), { countsPerPeriod })!;
  const supporting = activity.kind === "headlineMetrics" || activity.kind === "codingActivity" ? activity.supporting.map(({ label }) => label) : [];
  return [headline.value, headline.label, activity.period?.start, activity.period?.end, supporting];
}

test("every card is its tool's own meter: one big number in the tool's unit over a stated period, and at most two counts the tool reports beside it", () => {
  expect(examples.map(example => [example.id, ...meter(example)])).toEqual([
    ["clay", 1_500_000, "rows enriched", "2023-01-01", "2026-08-31", []],
    ["github", 1121, "contributions", "2025-09-01", "2026-08-31", []],
    ["cloudflare", 1_878_700, "requests over 31 days", "2026-08-01", "2026-08-31", []],
    ["docker", 48_200, "image pulls", "2024-01-01", "2026-08-31", []],
    ["firecrawl", 55_200, "pages scraped over 12 weeks", "2026-06-08", "2026-08-30", []],
    ["n8n", 1023, "executions a week at its peak", "2025-01-13", "2025-04-06", []],
    ["claude-code", 24, "active days", "2026-08-01", "2026-08-31", ["Sessions", "Lines changed"]],
    ["exa", 36_900, "search requests over 12 weeks", "2026-06-08", "2026-08-30", []],
    ["porkbun", 23, "domains registered", "2021-03-01", "2026-08-31", []],
    ["spider", 263_000, "pages crawled over 12 weeks", "2026-06-08", "2026-08-30", []],
    ["open-places", 5450, "places exported over 12 weeks", "2026-06-08", "2026-08-30", []],
    ["grok-bot", 38, "tasks handed off", "2026-08-01", "2026-08-31", []],
    ["elicit", 450, "papers screened a week at its peak", "2026-01-05", "2026-03-29", []],
    ["context-dev", 760, "credits used over 6 weeks", "2026-07-20", "2026-08-30", []],
  ]);
  // A card publishes numbers or draws activity, never both, so its front can't show two big numbers.
  expect(examples.filter(({ card }) => card.measurements?.length && card.activity).map(({ id }) => id)).toEqual([]);
  expect(examples.filter(({ card }) => (card.measurements?.length ?? 0) > 1).map(({ id }) => id)).toEqual([]);
});

/** The numbers a front sets large: its lead number, and the tool's own counts beside it. */
const BIG_NUMBER = ".card-front :is(.usage-measurement-stats strong, .card-activity-preview > p:first-child strong)";
const SUPPORTING = ".card-front .activity-preview-metrics dd";

test("each of the fourteen fronts, as the homepage draws it, sets exactly one big number and no more than two supporting counts", () => {
  const counts = examples.map(example => {
    const $ = load(renderToStaticMarkup(createElement(ProductCard, { card: example.card, index: 0, sample: true, expandedActivity: true, countsPerPeriod: example.countsPerPeriod })));
    return [example.id, $(BIG_NUMBER).length, $(SUPPORTING).length <= 2];
  });
  expect(counts).toEqual(examples.map(({ id }) => [id, 1, true]));
});

test("Firecrawl's headline sets its phrase apart as its site does, and every phrase set apart is in its own headline", () => {
  const accents = examples.filter(example => example.headlineAccent).map(example => [example.id, example.headlineAccent, example.card.headline!.includes(example.headlineAccent!)]);
  expect(accents).toEqual([["github", "every project's code", true], ["firecrawl", "clean Markdown", true]]);
});
