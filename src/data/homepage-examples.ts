import { directoryEntry } from "@/src/domain/product-directory";
import type { ActivityModule, PublicProfile } from "@/src/domain/public-profile";

type Status = PublicProfile["cards"][number]["status"];

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
const githubPeriod = { start: "2025-09-01", end: "2026-08-31" };
const githubDays = Array.from({ length: DAYS_IN_PERIOD }, (_, index) => {
  const count = Number(COUNT_PATTERN[(index * PATTERN_STRIDE + Math.floor(index / DAYS_PER_WEEK)) % COUNT_PATTERN.length]);
  return { date: new Date(Date.parse(githubPeriod.start) + index * DAY_MS).toISOString().split("T")[0], count, level: Math.min(count, MAX_LEVEL) };
});
const githubActivity: ActivityModule = {
  capturedAt: "2026-09-01T00:00:00.000Z", freshness: "STALE", provenanceLabel: "Illustrative sample, not account data",
  period: githubPeriod, kind: "contributionCalendar", attributionScope: "PERSONAL",
  total: githubDays.reduce((sum, day) => sum + day.count, 0), days: githubDays,
};

type ExampleSource = Readonly<{
  slug: string;
  status: Status;
  since: string;
  headline: string;
  note: string;
  logoUrl?: string;
  activity?: ActivityModule;
  caveat?: string;
  source?: HomepageExample["source"];
}>;

/**
 * A go-to-market engineer's stack as it changes. Only what a card owner would add lives here;
 * every name, domain and link comes from the directory. No usage numbers except GitHub's
 * sample calendar.
 */
const EXAMPLES: readonly ExampleSource[] = [
  {
    slug: "github", status: "ACTIVE", since: "2019", headline: "Where every project's code lives.", logoUrl: "/brand/github/2026-09-21/favicon.svg",
    note: "Contribution counts don't measure quality or hours.", activity: githubActivity,
    caveat: "A captured contribution calendar. Contributions include more than commits; coverage follows the source account and date range.",
    source: { href: "https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference", label: "GitHub contribution definitions" },
  },
  { slug: "claude-code", status: "ACTIVE", since: "2025", headline: "Writes and fixes my scrapers and scripts.", note: "I use it daily on enrichment and agent code." },
  { slug: "firecrawl", status: "ACTIVE", since: "2025", headline: "Turns pages into clean Markdown for my agents.", note: "I pull docs and product pages through it." },
  { slug: "exa", status: "ACTIVE", since: "2025", headline: "Search my agents can call.", note: "I use it to find company pages and recent news." },
  { slug: "cloudflare", status: "ACTIVE", since: "2020", headline: "DNS, Workers and caching for my projects.", note: "Every domain I own points through it." },
  { slug: "porkbun", status: "ACTIVE", since: "2021", headline: "Where every side project's domain starts.", note: "I buy most of my domains here." },
  { slug: "spider", status: "ACTIVE", since: "2026", headline: "Crawls whole sites for my agents.", note: "I run the large crawls on it." },
  { slug: "docker", status: "ACTIVE", since: "2020", headline: "Packs scrapers and agents to run anywhere.", note: "Every long-running job I ship is a container." },
  { slug: "open-places", status: "ACTIVE", since: "2026", headline: "Local business lists by category and city.", note: "I start local prospect lists here." },
  { slug: "grok-bot", status: "TESTING", since: "2026", headline: "An agent with its own cloud computer.", note: "I'm testing it on research and outreach chores." },
  { slug: "elicit", status: "TESTING", since: "2026", headline: "Reading research papers faster.", note: "I'm testing it for pulling claims from papers." },
  { slug: "context-dev", status: "TESTING", since: "2026", headline: "Brand and company data from a domain.", note: "I'm testing it for logos and company details." },
  { slug: "n8n", status: "ACTIVE", since: "2024", headline: "Scheduled jobs and webhooks.", note: "I run my nightly enrichment jobs on it." },
  { slug: "clay", status: "ARCHIVED", since: "2022", headline: "Enrichment tables, before I wrote code.", note: "I moved this work into my own scripts." },
];

export function homepageExamples(): HomepageExample[] {
  return EXAMPLES.map(example => {
    const entry = directoryEntry(example.slug);
    if (!entry) throw new Error(`Homepage example "${example.slug}" is not in the product directory.`);
    return {
      id: entry.slug,
      card: {
        product: { name: entry.name, slug: entry.slug, domain: entry.domain, description: entry.description, ...(example.logoUrl ? { logoUrl: example.logoUrl } : {}) },
        status: example.status, headline: example.headline, note: example.note, startedAt: `${example.since}-01-01`,
        primaryLink: { type: "CANONICAL", url: entry.website, label: `Open ${entry.name}` },
        ...(example.activity ? { activity: example.activity } : {}),
      },
      ...(example.caveat ? { caveat: example.caveat } : {}),
      ...(example.source ? { source: example.source } : {}),
    };
  });
}
