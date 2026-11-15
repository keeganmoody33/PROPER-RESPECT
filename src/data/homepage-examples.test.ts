import { load } from "cheerio";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ProductExample } from "@/components/product-example";
import { isHttpsUrl, isHttpUrl } from "@/src/domain/http-url";
import { productBrandSnapshotSchema } from "@/src/domain/product-brand";
import { directoryEntry } from "@/src/domain/product-directory";
import { listedUses, productUseLabels } from "@/src/domain/product-uses";
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
const CLAY_MEASUREMENTS = 3;

test("each example names the part of a card it shows, in a few words no other example uses", () => {
  expect(examples.map(({ id, capability }) => [id, capability])).toEqual([
    ["clay", "Published usage numbers"],
    ["github", "A year of contributions"],
    ["cloudflare", "Go-to, with what it costs"],
    ["docker", "A list of linked work"],
    ["firecrawl", "Referral link, disclosed"],
    ["n8n", "Paused, and why"],
    ["claude-code", "Coding days"],
    ["exa", "A demo link on the back"],
    ["porkbun", "Running totals"],
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

test("the five featured fronts each draw something different, and between them show go-to, cost and a disclosed referral link", () => {
  const featured = examples.filter(example => example.featured);
  expect(featured.map(example => [example.id, frontDrawing(example), example.card.goTo === true, Boolean(example.card.cost), example.card.primaryLink?.type])).toEqual([
    ["clay", "numbers", false, true, "CANONICAL"],
    ["github", "contributionCalendar", true, false, "CANONICAL"],
    ["cloudflare", "per day bars", true, true, "CANONICAL"],
    ["docker", "artifactCollection", false, false, "CANONICAL"],
    ["firecrawl", "per week bars", false, false, "REFERRAL"],
  ]);
});

test("Clay's and Exa's cards say what is behind Details: Clay's back holds the most, and Exa's holds the demo its label names", () => {
  expect(examples.filter(({ backHint }) => backHint).map(({ id, backHint }) => [id, backHint])).toEqual([["clay", "Periods, sources and a work sample inside"], ["exa", "A demo link inside"]]);
});

test("every headline and note is a short line under the card's limit", () => {
  const tooLong = examples.flatMap(({ card }) => [card.headline, card.note]).filter(text => !text || text.length >= LINE_LIMIT);
  expect(tooLong).toEqual([]);
});

test("each example shows a different part of a card: its link, cost, work sample, published numbers and kind of activity", () => {
  expect(examples.map(({ id, card }) => [id, card.primaryLink?.type, card.cost && `${card.cost.amount} ${card.cost.currency} ${card.cost.cadence} ${card.cost.basis}`,
    card.usageLink && `${usageLinkLabelText(card.usageLink.label)} / ${usageLinkHost(card.usageLink.url)}`, card.measurements?.length, card.activity?.kind])).toEqual([
    ["clay", "CANONICAL", "167 USD MONTHLY OWNER_REPORTED", "See how I use it / clay.com", CLAY_MEASUREMENTS, undefined],
    ["github", "CANONICAL", undefined, undefined, undefined, "contributionCalendar"],
    ["cloudflare", "CANONICAL", "5 USD MONTHLY OWNER_REPORTED", undefined, undefined, "timeSeries"],
    ["docker", "CANONICAL", undefined, undefined, undefined, "artifactCollection"],
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
 * Clay's Launch plan as clay.com/pricing showed it on 14 Nov 2026, billed annually: 180,000 actions a year ($54/mo) and
 * 30,000 data credits a year ($113/mo), $167/mo together.
 */
const CLAY_LAUNCH = { monthlyUsd: 167, actionsUsd: 54, dataCreditsUsd: 113, dataCreditsPerYear: 30_000 } as const;
const SAMPLE_YEAR = "2025-09-01 to 2026-08-31";

test("Clay's three numbers and its price fit one plan over one stated year: a daily user's rows, tables and data credits on Launch", () => {
  const clay = examples.find(({ id }) => id === "clay")!.card;
  expect(clay.measurements?.map(row => [row.metric, row.value, row.unit, row.period.kind === "date" ? `${row.period.start} to ${row.period.end}` : row.period.kind]))
    .toEqual([
      ["enriched", "11800", "rows", SAMPLE_YEAR],
      ["built", "52", "tables", SAMPLE_YEAR],
      ["used", "27600", "data_credits", SAMPLE_YEAR],
    ]);
  expect(clay.cost).toEqual({ amount: CLAY_LAUNCH.monthlyUsd, currency: "USD", cadence: "MONTHLY", basis: "OWNER_REPORTED", asOf: "2026-09-01", period: { start: "2025-09-01", end: "2026-08-31" } });
  expect(CLAY_LAUNCH.actionsUsd + CLAY_LAUNCH.dataCreditsUsd).toBe(CLAY_LAUNCH.monthlyUsd);
  expect(clay.usageLink).toEqual({ url: "https://www.clay.com/templates", label: "SEE_HOW_I_USE_IT" });
  expect(clay.note).toBe("Lists that took a week of spreadsheets take an hour.");
  const [rows, tables, credits] = clay.measurements!.map(row => Number(row.value));
  // A found address costs at least a data credit, the year's credits fit the plan's, and a daily user builds about a table a week.
  expect(credits).toBeGreaterThanOrEqual(rows);
  expect(credits).toBeLessThanOrEqual(CLAY_LAUNCH.dataCreditsPerYear);
  expect(tables).toBeGreaterThanOrEqual(26);
});

test("Clay's card is no tutorial: neither face draws a lead list, a provider waterfall or a match rate", () => {
  const $ = load(renderToStaticMarkup(createElement(ProductExample, { examples })));
  const clay = $('[data-example="clay"]');
  expect([clay.find(".card-front").length, clay.find(".card-back").length]).toEqual([1, 1]);
  expect([clay.find("table").length, clay.text().match(/waterfall|emails found|job change|invented rows|provider/gi)]).toEqual([0, null]);
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
    ["n8n", "PAUSED", "Paused while my nightly jobs move to plain cron."],
    ["elicit", "STOPPED", "I stopped once my market study was done."],
  ]);
});

test("each sample series is drawn as written, one point a day or a week, and its period covers exactly those points", () => {
  const series = examples.flatMap(({ id, card }) => card.activity?.kind === "timeSeries" ? [{ id, activity: card.activity }] : []);
  expect(series.map(({ id, activity }) => [id, activity.label, activity.unit, activity.points.length, activity.period, activity.points.at(-1)?.value])).toEqual([
    ["cloudflare", "requests served", "per day", 31, { start: "2026-08-01", end: "2026-08-31" }, 7940],
    ["firecrawl", "pages scraped", "per week", 12, { start: "2026-06-08", end: "2026-08-30" }, 1100],
    ["n8n", "workflow runs", "per week", 12, { start: "2025-01-13", end: "2025-04-06" }, 0],
    ["exa", "searches run", "per week", 12, { start: "2026-06-08", end: "2026-08-30" }, 360],
    ["spider", "pages crawled", "per week", 12, { start: "2026-06-08", end: "2026-08-30" }, 3100],
    ["open-places", "businesses exported", "per week", 12, { start: "2026-06-08", end: "2026-08-30" }, 85],
    ["elicit", "papers screened", "per week", 12, { start: "2026-01-05", end: "2026-03-29" }, 0],
    ["context-dev", "domains looked up", "per week", 6, { start: "2026-07-20", end: "2026-08-30" }, 22],
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
  const porkbun = examples.find(({ id }) => id === "porkbun")!.card;
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

test("every example says what it is used for, in two or three of its product's own listed uses", () => {
  expect(examples.map(({ id, card }) => [id, productUseLabels(id, card.uses)])).toEqual([
    ["clay", ["enrich lead and account lists", "find contact details"]],
    ["github", ["host my code and its history", "review and merge pull requests", "run tests and deploys on every push"]],
    ["cloudflare", ["run DNS for my domains", "run code at the edge with Workers", "cache and protect my sites"]],
    ["docker", ["run databases and services locally", "package apps to run anywhere"]],
    ["firecrawl", ["turn web pages into Markdown", "crawl whole sites"]],
    ["n8n", ["run jobs on a schedule", "move data between systems"]],
    ["claude-code", ["build features from a description", "find and fix bugs", "automate repetitive engineering work"]],
    ["exa", ["give my agents web search", "find companies and people that fit a description"]],
    ["porkbun", ["register and renew domains", "manage DNS records"]],
    ["spider", ["crawl sites quickly at volume", "feed web data to my agents"]],
    ["open-places", ["build lists of local businesses", "find businesses in one area or category"]],
    ["grok-bot", ["hand off tasks to an agent", "research a topic for me"]],
    ["elicit", ["find papers on a question", "pull data out of studies into a table"]],
    ["context-dev", ["pull a company's logo, colors and fonts", "look up company details by domain"]],
  ]);
  expect(examples.filter(({ id, card }) => listedUses(id, card.uses)?.picks.length !== card.uses?.picks.length).map(({ id }) => id)).toEqual([]);
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

test("each example's card leads with a number that means something: a period's total, or the peak of one paused or stopped, never a zero", () => {
  expect(examples.flatMap(({ id, card, countsPerPeriod }) => {
    const headline = card.activity && activityHeadline(card.activity, noLongerInUse(card), { countsPerPeriod });
    return headline ? [[id, headline.value, headline.label]] : [];
  })).toEqual([
    ["github", 1121, "contributions"],
    ["cloudflare", 187870, "requests served over 31 days"],
    ["docker", 3, "linked works"],
    ["firecrawl", 5520, "pages scraped over 12 weeks"],
    ["n8n", 341, "workflow runs a week at its peak"],
    ["claude-code", 24, "active days"],
    ["exa", 3690, "searches run over 12 weeks"],
    ["porkbun", 23, "domains registered"],
    ["spider", 26300, "pages crawled over 12 weeks"],
    ["open-places", 545, "businesses exported over 12 weeks"],
    ["grok-bot", 12, "tasks handed off"],
    ["elicit", 45, "papers screened a week at its peak"],
    ["context-dev", 76, "domains looked up over 6 weeks"],
  ]);
});

test("Firecrawl's headline sets its phrase apart as its site does, and every phrase set apart is in its own headline", () => {
  const accents = examples.filter(example => example.headlineAccent).map(example => [example.id, example.headlineAccent, example.card.headline!.includes(example.headlineAccent!)]);
  expect(accents).toEqual([["github", "every project's code", true], ["firecrawl", "clean Markdown", true]]);
});
