import { HOMEPAGE_BRANDS, HOMEPAGE_SITE_TRAITS } from "@/src/data/homepage-brands";
import type { BrandSiteTraits } from "@/src/domain/brand-site-traits";
import sampleUsage from "@/src/data/homepage-sample-usage.json";
import { directoryEntry } from "@/src/domain/product-directory";
import type { ProductUses } from "@/src/domain/product-uses";
import type { Cost } from "@/src/domain/cost";
import type { PublicMeasurement } from "@/src/domain/measurements";
import type { ActivityModule, PublicProfile } from "@/src/domain/public-profile";
import type { UsageLink } from "@/src/domain/usage-links";
import { levelStatus, type RelationshipLevel } from "@/src/domain/relationship-level";
import type { TablePreviewInput } from "@/src/domain/table-preview";

export type HomepageExample = Readonly<{
  id: string;
  /** Shown in the chooser from the start and cycled by the slideshow; every other example waits behind "More examples". */
  featured: boolean;
  /** The part of a card this example shows, named above it and in the chooser. */
  capability: string;
  card: PublicProfile["cards"][number];
  /** What measuring the product's own site added to its brand. Presentation only, never part of the card's data. */
  site?: BrandSiteTraits;
  caveat?: string;
  source?: Readonly<{ href: string; label: string }>;
  /** What the card's back holds, said on its front. */
  backHint?: string;
  /** A few invented rows of a table the product makes, drawn on the card's front. Presentation only, never part of the card's data. */
  tablePreview?: TablePreviewInput;
  /** The sample series' points each count their own day or week, so its headline adds them up. Presentation only, never part of the card's data. */
  countsPerPeriod?: true;
}>;

const DAYS_PER_WEEK = 7;
const DAYS_IN_PERIOD = 365;
const DAY_MS = 86_400_000;
const SAMPLE = { capturedAt: "2026-09-01T00:00:00.000Z", freshness: "STALE", provenanceLabel: "Illustrative sample, not account data", attributionScope: "PERSONAL" } as const;
const isoDate = (time: number) => new Date(time).toISOString().split("T")[0];

/** A fixed pseudo-random number in [0, 1) for a seed (mulberry32), so the sample calendar is the same on every build. */
function unitNoise(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** GitHub's own bands: none, then a few, some, many and the most in a day. */
const LEVEL_FLOORS = [1, 3, 6, 9] as const;
const contributionLevel = (count: number) => LEVEL_FLOORS.filter(floor => count >= floor).length;

const githubPeriod = { start: "2025-09-01", end: "2026-08-31" };
const HOLIDAY = { start: "2025-12-22", end: "2026-01-04" };
const WEEKEND_ACTIVE_SHARE = 0.25;
const WEEKDAY_IDLE_SHARE = 0.1;
const WEEKDAY_BASE = 6;
/** A year that gets busier: weekdays carry the work, weekends are mostly empty, and two weeks over the new year are off. */
const githubDays = Array.from({ length: DAYS_IN_PERIOD }, (_, index) => {
  const time = Date.parse(githubPeriod.start) + index * DAY_MS;
  const date = isoDate(time), weekday = new Date(time).getUTCDay() % 6 !== 0;
  const [chance, size] = [unitNoise(index * 2), unitNoise(index * 2 + 1)];
  const off = date >= HOLIDAY.start && date <= HOLIDAY.end;
  const count = off ? 0 : weekday
    ? (chance < WEEKDAY_IDLE_SHARE ? 0 : 1 + Math.floor(size * WEEKDAY_BASE * (1 + index / DAYS_IN_PERIOD)))
    : (chance < WEEKEND_ACTIVE_SHARE ? 1 + Math.floor(size * 3) : 0);
  return { date, count, level: contributionLevel(count) };
});
const githubActivity: ActivityModule = {
  ...SAMPLE, period: githubPeriod, kind: "contributionCalendar",
  total: githubDays.reduce((sum, day) => sum + day.count, 0), days: githubDays,
};

type Metric = Readonly<{ label: string; value: number }>;
type SampleUsage = Readonly<{
  coding: Readonly<Record<string, Readonly<{ label: string; start: string; sessions: readonly number[]; supporting: readonly Metric[] }>>>;
  /** One value per day or per week from start, written by hand to match the example's level and story. */
  series: Readonly<Record<string, Readonly<{ label: string; unit: string; start: string; values: readonly number[] }>>>;
  totals: Readonly<Record<string, Readonly<{ primary: Metric; supporting: readonly Metric[]; period?: Readonly<{ start: string; end: string }> }>>>;
}>;
const SAMPLE_USAGE: SampleUsage = sampleUsage;
const AUGUST_2026 = { start: "2026-08-01", end: "2026-08-31" };
const STEP_DAYS: Readonly<Record<string, number>> = { "per day": 1, "per week": DAYS_PER_WEEK };

/** Coding draws sessions per day and a series draws its own values; only totals that have no honest series stay totals. */
function sampleActivity(slug: string): ActivityModule | undefined {
  const coding = SAMPLE_USAGE.coding[slug];
  if (coding) {
    const days = coding.sessions.map((count, index) => ({ date: isoDate(Date.parse(coding.start) + index * DAY_MS), count, level: contributionLevel(count) }));
    // Counted from the days drawn beside them, so the numbers and the chart can't disagree.
    const sessions = days.reduce((sum, day) => sum + day.count, 0);
    const activeDays = days.filter(day => day.count > 0).length;
    // The card is about coding days, so it leads with them; the sessions those days held come next.
    return { ...SAMPLE, period: { start: days[0].date, end: days.at(-1)!.date }, kind: "codingActivity", primary: { label: "active days", value: activeDays },
      supporting: [{ label: "Sessions", value: sessions }, ...coding.supporting], days };
  }
  const series = SAMPLE_USAGE.series[slug];
  if (series) {
    const step = STEP_DAYS[series.unit];
    if (!step) throw new Error(`Sample series "${slug}" has unit "${series.unit}", which isn't per day or per week.`);
    const points = series.values.map((value, index) => ({ date: isoDate(Date.parse(series.start) + index * step * DAY_MS), value }));
    const period = { start: points[0].date, end: isoDate(Date.parse(points.at(-1)!.date) + (step - 1) * DAY_MS) };
    return { ...SAMPLE, period, kind: "timeSeries", label: series.label, unit: series.unit, points };
  }
  const totals = SAMPLE_USAGE.totals[slug];
  if (!totals) return undefined;
  const { primary, supporting, period = AUGUST_2026 } = totals;
  return { ...SAMPLE, period, kind: "headlineMetrics", primary, supporting: [...supporting] };
}

/** Each work with the owner's line about it, which the back shows under its link. */
const dockerArtifacts = [
  { title: "Sample Compose apps (awesome-compose)", url: "https://github.com/docker/awesome-compose", label: "Compose stacks I start new services from" },
  { title: "Official Postgres image", url: "https://hub.docker.com/_/postgres", label: "The database every scraper writes to" },
  { title: "Multi-stage build guide", url: "https://docs.docker.com/build/building/multi-stage/", label: "How I keep agent images small" },
];
const dockerActivity: ActivityModule = {
  ...SAMPLE, period: { start: "2024-01-01", end: "2026-08-31" }, kind: "artifactCollection", total: dockerArtifacts.length, artifacts: dockerArtifacts,
};
/** Owner-reported monthly prices: Cloudflare's Workers Paid plan. */
const CLOUDFLARE_MONTHLY_USD = 5;
/**
 * Clay's Launch plan as clay.com/pricing showed it on 14 Nov 2026, billed annually: $54/mo for 180,000 actions a year and
 * $113/mo for 30,000 data credits a year. The sample's year of use stays inside both.
 */
const CLAY_LAUNCH_MONTHLY_USD = 167;
const SAMPLE_YEAR = { start: "2025-09-01", end: "2026-08-31" } as const;

/**
 * A Clay table the way clay.com draws its own: a lead list from a signal, an address found by a waterfall of providers,
 * and one AI column. Invented companies on reserved .example domains, and generic provider names: no real company, person or vendor.
 */
const filled = (text: string) => ({ text, state: "filled" as const });
const CLAY_TABLE: TablePreviewInput = {
  caption: "Lead list · from a job-change signal · invented sample rows",
  // A phone-wide card leaves out which provider found the address, so the address and the AI column stay in view.
  columns: ["Company", { label: "Work email", enriched: true }, { label: "Found by", enriched: true, droppable: true }, { label: "AI: signal", enriched: true }],
  rows: [
    [{ text: "Nimbus" }, filled("ana@nimbus.example"), filled("Provider A"), filled("Hiring SDRs")],
    [{ text: "Heron" }, filled("li@heron.example"), filled("Provider B"), filled("Series B")],
    [{ text: "Quillon" }, { text: "Finding…", state: "pending", fillsIn: filled("mo@quillon.example") },
      { text: "Running", state: "pending", fillsIn: filled("2nd provider") }, { text: "Running", state: "pending", fillsIn: filled("New VP Sales") }],
    [{ text: "Tessel" }, filled("raj@tessel.example"), filled("Provider A"), filled("No signal")],
    [{ text: "Marrow" }, { text: "No match", state: "empty" }, { text: "No provider", state: "empty" }, filled("Series A")],
  ],
};

/** Exact numbers an owner chose to publish. "synthetic" is the schema's word for a sample that is not anyone's account. Each metric is a verb, since its unit already names what was counted. */
const CLAY_MEASURED = {
  capturedAt: SAMPLE.capturedAt, status: "measured", identityBasis: "OWNER_SUPPLIED", activityActor: "UNKNOWN", sample: "synthetic", derivation: "SOURCE_REPORTED",
  scope: "WORKSPACE", coverage: "COMPLETE", temporality: "CUMULATIVE", aggregation: "NON_ADDITIVE",
} as const;
const CLAY_YEAR = { kind: "date", ...SAMPLE_YEAR, timezone: "UTC" } as const;
/** A daily user's year on Launch: about 45 rows a working day, a table a week, and data credits inside the plan's 30,000. */
const clayMeasurements: PublicMeasurement[] = [
  { ...CLAY_MEASURED, metric: "enriched", value: "11800", unit: "rows", period: CLAY_YEAR },
  { ...CLAY_MEASURED, metric: "built", value: "52", unit: "tables", period: CLAY_YEAR },
  { ...CLAY_MEASURED, metric: "used", value: "27600", unit: "data_credits", period: CLAY_YEAR },
];

type ExampleSource = Readonly<{
  slug: string;
  /** One of the five the chooser shows first; the rest wait behind "More examples". Featured examples come first. */
  featured?: true;
  capability: string;
  level: RelationshipLevel;
  goTo?: true;
  since: string;
  headline: string;
  note: string;
  uses: readonly string[];
  /** GitHub keeps its contribution calendar and Docker lists its links; every other example reads homepage-sample-usage.json. */
  activity?: ActivityModule;
  /** A paid link, sent to the product's own site: a real card would carry the owner's own code. */
  linkType?: "AFFILIATE" | "REFERRAL";
  cost?: Cost;
  usageLink?: UsageLink;
  measurements?: PublicMeasurement[];
  caveat?: string;
  source?: HomepageExample["source"];
  backHint?: string;
  tablePreview?: TablePreviewInput;
}>;

/**
 * A go-to-market engineer's stack as it changes. Only what a card owner would add lives here;
 * every name, domain and link comes from the directory, and every brand from HOMEPAGE_BRANDS.
 * Every number is an illustrative sample, labelled so on the card.
 */
const EXAMPLES: readonly ExampleSource[] = [
  {
    slug: "clay", featured: true, capability: "Published usage numbers", level: "DAILY", since: "2023", headline: "My lead lists, enriched.", note: "Lists that took a week of spreadsheets take an hour.",
    uses: ["enrich-leads", "find-contacts"], measurements: clayMeasurements,
    cost: { amount: CLAY_LAUNCH_MONTHLY_USD, currency: "USD", cadence: "MONTHLY", basis: "OWNER_REPORTED", asOf: "2026-09-01", period: SAMPLE_YEAR },
    usageLink: { url: "https://www.clay.com/templates", label: "SEE_HOW_I_USE_IT" },
    caveat: "Its work-sample link opens Clay's public templates.", backHint: "Periods, sources and a work sample inside", tablePreview: CLAY_TABLE,
  },
  {
    slug: "github", featured: true, capability: "A year of contributions", level: "DAILY", goTo: true, since: "2019", headline: "Where every project's code lives.",
    note: "Contribution counts don't measure quality or hours.", uses: ["host-code", "review-pull-requests", "run-ci"], activity: githubActivity,
    caveat: "A captured contribution calendar. Contributions include more than commits; coverage follows the source account and date range.",
    source: { href: "https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference", label: "GitHub contribution definitions" },
  },
  {
    slug: "cloudflare", featured: true, capability: "Go-to, with what it costs", level: "DAILY", goTo: true, since: "2020", headline: "DNS, Workers and caching for my projects.", note: "Every domain I own points through it.",
    uses: ["manage-dns", "run-workers", "cache-and-protect"],
    cost: { amount: CLOUDFLARE_MONTHLY_USD, currency: "USD", cadence: "MONTHLY", basis: "OWNER_REPORTED", asOf: "2026-09-01" },
  },
  {
    slug: "docker", featured: true, capability: "A list of linked work", level: "WEEKLY", since: "2024", headline: "Packs scrapers and agents to run anywhere.", note: "Every long-running job I ship is a container.",
    uses: ["run-local-services", "package-apps"], activity: dockerActivity,
    caveat: "The listed links go to public Docker pages, standing in for an owner's own repositories and images.",
  },
  {
    slug: "firecrawl", featured: true, capability: "Referral link, disclosed", level: "WEEKLY", since: "2025", headline: "Turns pages into clean Markdown for my agents.", note: "I pull docs and product pages through it.",
    uses: ["scrape-pages", "crawl-sites"], linkType: "REFERRAL",
    caveat: "A real card's referral link carries its owner's code. This sample's goes to Firecrawl's home page and credits nobody.",
  },
  {
    slug: "n8n", capability: "Paused, and why", level: "PAUSED", since: "2024", headline: "Scheduled jobs and webhooks.", note: "Paused while my nightly jobs move to plain cron.",
    uses: ["schedule-jobs", "move-data"],
  },
  {
    slug: "claude-code", capability: "Coding days", level: "DAILY", since: "2025", headline: "Writes and fixes my scrapers and scripts.", note: "I use it daily on enrichment and agent code.",
    uses: ["write-features", "fix-bugs", "automate-chores"],
  },
  {
    slug: "exa", capability: "A demo link on the back", level: "WEEKLY", since: "2025", headline: "Search my agents can call.", note: "I use it to find company pages and recent news.",
    uses: ["search-for-agents", "find-companies"], usageLink: { url: "https://exa.ai/search", label: "DEMO" },
    caveat: "The demo link goes to Exa's own public search page, standing in for an owner's recording.", backHint: "A demo link inside",
  },
  {
    slug: "porkbun", capability: "Running totals", level: "OCCASIONAL", goTo: true, since: "2021", headline: "Where every side project's domain starts.", note: "I buy most of my domains here.",
    uses: ["register-domains", "manage-dns"],
  },
  {
    slug: "spider", capability: "Affiliate link, disclosed", level: "OCCASIONAL", since: "2026", headline: "Crawls whole sites for my agents.", note: "I run the large crawls on it.",
    uses: ["crawl-sites", "feed-agents"], linkType: "AFFILIATE",
    caveat: "A real card's affiliate link carries its owner's code. This sample's goes to Spider's home page and credits nobody.",
  },
  {
    slug: "open-places", capability: "Used now and then", level: "OCCASIONAL", since: "2026", headline: "Local business lists by category and city.", note: "I start local prospect lists here.",
    uses: ["build-business-lists", "target-by-area"],
  },
  {
    slug: "grok-bot", capability: "Still testing", level: "TESTING", since: "2026", headline: "An agent with its own cloud computer.", note: "I'm testing it on research and outreach chores.",
    uses: ["delegate-tasks", "research-topics"],
  },
  {
    slug: "elicit", capability: "Stopped using, and why", level: "STOPPED", since: "2026", headline: "Reading research papers faster.", note: "I stopped once my market study was done.",
    uses: ["find-papers", "extract-study-data"],
  },
  {
    slug: "context-dev", capability: "Testing, week by week", level: "TESTING", since: "2026", headline: "Brand and company data from a domain.", note: "I'm testing it for logos and company details.",
    uses: ["pull-brand-data", "enrich-companies"],
  },
];

export function homepageExamples(): HomepageExample[] {
  return EXAMPLES.map(example => {
    const entry = directoryEntry(example.slug);
    if (!entry) throw new Error(`Homepage example "${example.slug}" is not in the product directory.`);
    const brand = HOMEPAGE_BRANDS[entry.slug], site = HOMEPAGE_SITE_TRAITS[entry.slug];
    const uses: ProductUses = { picks: [...example.uses] };
    const activity = example.activity ?? sampleActivity(entry.slug);
    return {
      id: entry.slug,
      featured: example.featured === true,
      capability: example.capability,
      card: {
        product: { name: entry.name, slug: entry.slug, domain: entry.domain, description: entry.description, ...(brand ? { brand } : {}) },
        status: levelStatus(example.level), level: example.level, ...(example.goTo ? { goTo: true } : {}), headline: example.headline, note: example.note, startedAt: `${example.since}-01-01`,
        uses, primaryLink: { type: example.linkType ?? "CANONICAL", url: entry.website, label: `Open ${entry.name}` },
        ...(activity ? { activity } : {}),
        ...(example.measurements ? { measurements: example.measurements } : {}),
        ...(example.cost ? { cost: example.cost } : {}),
        ...(example.usageLink ? { usageLink: example.usageLink } : {}),
      },
      ...(site ? { site } : {}),
      ...(example.caveat ? { caveat: example.caveat } : {}),
      ...(example.backHint ? { backHint: example.backHint } : {}),
      ...(example.tablePreview ? { tablePreview: example.tablePreview } : {}),
      ...(example.source ? { source: example.source } : {}),
      // Every hand-written sample series counts what happened in each of its days or weeks.
      ...(SAMPLE_USAGE.series[entry.slug] && !example.activity ? { countsPerPeriod: true as const } : {}),
    };
  });
}
