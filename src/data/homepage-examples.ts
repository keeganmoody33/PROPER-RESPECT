import { HOMEPAGE_BRANDS } from "@/src/data/homepage-brands";
import sampleUsage from "@/src/data/homepage-sample-usage.json";
import { directoryEntry } from "@/src/domain/product-directory";
import type { ProductUses } from "@/src/domain/product-uses";
import type { ActivityModule, PublicProfile } from "@/src/domain/public-profile";
import { levelStatus, type RelationshipLevel } from "@/src/domain/relationship-level";

export type HomepageExample = Readonly<{
  id: string;
  card: PublicProfile["cards"][number];
  caveat?: string;
  source?: Readonly<{ href: string; label: string }>;
}>;

const COUNT_PATTERN = "0241062300471250321046203142";
const PATTERN_STRIDE = 11;
const DAYS_PER_WEEK = 7;
const DAYS_IN_PERIOD = 365;
const DAY_MS = 86_400_000;
const MAX_LEVEL = 4;
const SAMPLE = { capturedAt: "2026-09-01T00:00:00.000Z", freshness: "STALE", provenanceLabel: "Illustrative sample, not account data", attributionScope: "PERSONAL" } as const;
const githubPeriod = { start: "2025-09-01", end: "2026-08-31" };
const githubDays = Array.from({ length: DAYS_IN_PERIOD }, (_, index) => {
  const count = Number(COUNT_PATTERN[(index * PATTERN_STRIDE + Math.floor(index / DAYS_PER_WEEK)) % COUNT_PATTERN.length]);
  return { date: new Date(Date.parse(githubPeriod.start) + index * DAY_MS).toISOString().split("T")[0], count, level: Math.min(count, MAX_LEVEL) };
});
const githubActivity: ActivityModule = {
  ...SAMPLE, period: githubPeriod, kind: "contributionCalendar",
  total: githubDays.reduce((sum, day) => sum + day.count, 0), days: githubDays,
};

/** Coding sessions cover August 2026; a weekly series ends with the week of 2026-08-24 unless the product was paused earlier. */
const AUGUST_2026 = { start: "2026-08-01", end: "2026-08-31" };
const CODING_DAYS = 31;
const codingDays = githubDays.slice(-CODING_DAYS).map((day, index) => ({
  ...day, date: new Date(Date.parse(AUGUST_2026.start) + index * DAY_MS).toISOString().split("T")[0],
}));
const WEEKS = 12;
const LAST_WEEK = "2026-08-24";
/** How busy each week was against the product's peak. Each series starts at a different week of it, so no two charts look alike. */
const WEEKLY_SHAPE = [0.55, 0.62, 0.58, 0.71, 0.66, 0.8, 0.74, 0.69, 0.86, 0.93, 0.81, 1] as const;
const SHAPE_STRIDE = 5;
type Metric = Readonly<{ label: string; value: number }>;
type SampleUsage = Readonly<{
  coding: Readonly<Record<string, Readonly<{ label: string; supporting: readonly Metric[] }>>>;
  weekly: Readonly<Record<string, Readonly<{ label: string; peak: number; lastWeek?: string }>>>;
  totals: Readonly<Record<string, Readonly<{ primary: Metric; supporting: readonly Metric[]; period?: Readonly<{ start: string; end: string }> }>>>;
}>;
const SAMPLE_USAGE: SampleUsage = sampleUsage;
const isoDate = (time: number) => new Date(time).toISOString().split("T")[0];

/** A count per period draws as weekly bars, coding as sessions per day; only totals that have no honest series stay totals. */
function sampleActivity(slug: string): ActivityModule {
  const coding = SAMPLE_USAGE.coding[slug];
  if (coding) {
    const sessions = codingDays.reduce((sum, day) => sum + day.count, 0);
    return { ...SAMPLE, period: AUGUST_2026, kind: "codingActivity", primary: { label: coding.label, value: sessions }, supporting: [...coding.supporting], days: codingDays };
  }
  const weekly = SAMPLE_USAGE.weekly[slug];
  if (weekly) {
    const offset = (Object.keys(SAMPLE_USAGE.weekly).indexOf(slug) * SHAPE_STRIDE) % WEEKS;
    const last = Date.parse(weekly.lastWeek ?? LAST_WEEK);
    const points = WEEKLY_SHAPE.map((_, week) => ({
      date: isoDate(last - (WEEKS - 1 - week) * DAYS_PER_WEEK * DAY_MS),
      value: Math.round(weekly.peak * WEEKLY_SHAPE[(week + offset) % WEEKS]),
    }));
    const period = { start: points[0].date, end: isoDate(last + (DAYS_PER_WEEK - 1) * DAY_MS) };
    return { ...SAMPLE, period, kind: "timeSeries", label: weekly.label, unit: "per week", points };
  }
  const { primary, supporting, period = AUGUST_2026 } = SAMPLE_USAGE.totals[slug];
  return { ...SAMPLE, period, kind: "headlineMetrics", primary, supporting: [...supporting] };
}

type ExampleSource = Readonly<{
  slug: string;
  level: RelationshipLevel;
  goTo?: true;
  since: string;
  headline: string;
  note: string;
  uses: readonly string[];
  /** GitHub keeps its contribution calendar; every other example reads homepage-sample-usage.json. */
  activity?: ActivityModule;
  caveat?: string;
  source?: HomepageExample["source"];
}>;

/**
 * A go-to-market engineer's stack as it changes. Only what a card owner would add lives here;
 * every name, domain and link comes from the directory, and every brand from HOMEPAGE_BRANDS.
 * Every number is an illustrative sample, labelled so on the card.
 */
const EXAMPLES: readonly ExampleSource[] = [
  {
    slug: "github", level: "DAILY", goTo: true, since: "2019", headline: "Where every project's code lives.",
    note: "Contribution counts don't measure quality or hours.", uses: ["host-code", "review-pull-requests", "run-ci"], activity: githubActivity,
    caveat: "A captured contribution calendar. Contributions include more than commits; coverage follows the source account and date range.",
    source: { href: "https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference", label: "GitHub contribution definitions" },
  },
  {
    slug: "claude-code", level: "DAILY", since: "2025", headline: "Writes and fixes my scrapers and scripts.", note: "I use it daily on enrichment and agent code.",
    uses: ["write-features", "fix-bugs", "automate-chores"],
  },
  {
    slug: "firecrawl", level: "WEEKLY", since: "2025", headline: "Turns pages into clean Markdown for my agents.", note: "I pull docs and product pages through it.",
    uses: ["scrape-pages", "crawl-sites"],
  },
  {
    slug: "exa", level: "WEEKLY", since: "2025", headline: "Search my agents can call.", note: "I use it to find company pages and recent news.",
    uses: ["search-for-agents", "find-companies"],
  },
  {
    slug: "cloudflare", level: "DAILY", goTo: true, since: "2020", headline: "DNS, Workers and caching for my projects.", note: "Every domain I own points through it.",
    uses: ["manage-dns", "run-workers", "cache-and-protect"],
  },
  {
    slug: "porkbun", level: "OCCASIONAL", goTo: true, since: "2021", headline: "Where every side project's domain starts.", note: "I buy most of my domains here.",
    uses: ["register-domains", "manage-dns"],
  },
  {
    slug: "spider", level: "OCCASIONAL", since: "2026", headline: "Crawls whole sites for my agents.", note: "I run the large crawls on it.",
    uses: ["crawl-sites", "feed-agents"],
  },
  {
    slug: "docker", level: "WEEKLY", since: "2020", headline: "Packs scrapers and agents to run anywhere.", note: "Every long-running job I ship is a container.",
    uses: ["run-local-services", "package-apps"],
  },
  {
    slug: "open-places", level: "OCCASIONAL", since: "2026", headline: "Local business lists by category and city.", note: "I start local prospect lists here.",
    uses: ["build-business-lists", "target-by-area"],
  },
  {
    slug: "grok-bot", level: "TESTING", since: "2026", headline: "An agent with its own cloud computer.", note: "I'm testing it on research and outreach chores.",
    uses: ["delegate-tasks", "research-topics"],
  },
  {
    slug: "elicit", level: "TESTING", since: "2026", headline: "Reading research papers faster.", note: "I'm testing it for pulling claims from papers.",
    uses: ["find-papers", "extract-study-data"],
  },
  {
    slug: "context-dev", level: "TESTING", since: "2026", headline: "Brand and company data from a domain.", note: "I'm testing it for logos and company details.",
    uses: ["pull-brand-data", "enrich-companies"],
  },
  {
    slug: "n8n", level: "PAUSED", since: "2024", headline: "Scheduled jobs and webhooks.", note: "I ran my nightly enrichment jobs on it.",
    uses: ["schedule-jobs", "move-data"],
  },
  {
    slug: "clay", level: "STOPPED", since: "2022", headline: "Enrichment tables, before I wrote code.", note: "I moved this work into my own scripts.",
    uses: ["enrich-leads", "build-lists"],
  },
];

export function homepageExamples(): HomepageExample[] {
  return EXAMPLES.map(example => {
    const entry = directoryEntry(example.slug);
    if (!entry) throw new Error(`Homepage example "${example.slug}" is not in the product directory.`);
    const brand = HOMEPAGE_BRANDS[entry.slug];
    const uses: ProductUses = { picks: [...example.uses] };
    return {
      id: entry.slug,
      card: {
        product: { name: entry.name, slug: entry.slug, domain: entry.domain, description: entry.description, ...(brand ? { brand } : {}) },
        status: levelStatus(example.level), level: example.level, ...(example.goTo ? { goTo: true } : {}), headline: example.headline, note: example.note, startedAt: `${example.since}-01-01`,
        uses, primaryLink: { type: "CANONICAL", url: entry.website, label: `Open ${entry.name}` }, activity: example.activity ?? sampleActivity(entry.slug),
      },
      ...(example.caveat ? { caveat: example.caveat } : {}),
      ...(example.source ? { source: example.source } : {}),
    };
  });
}
