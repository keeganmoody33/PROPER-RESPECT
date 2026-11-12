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
    slug: "github", status: "ACTIVE", since: "2016", headline: "The work behind the code.", logoUrl: "/brand/github/2026-09-21/favicon.svg",
    note: "Example only. Contribution totals do not measure code quality or hours worked.", activity: githubActivity,
    caveat: "A captured contribution calendar. Contributions include more than commits; coverage follows the source account and date range.",
    source: { href: "https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference", label: "GitHub contribution definitions" },
  },
  { slug: "claude-code", status: "ACTIVE", since: "2025", headline: "Writes and fixes the pipeline scripts.", note: "Example only. Used daily for enrichment and routing code." },
  { slug: "exa", status: "ACTIVE", since: "2025", headline: "Search for account research.", note: "Example only. Finds company pages and news for each target account." },
  { slug: "spider", status: "TESTING", since: "2026", headline: "Crawling company sites.", note: "Example only. Trying it next to the current scraper." },
  { slug: "hubspot", status: "ACTIVE", since: "2021", headline: "Where the pipeline lives.", note: "Example only. The CRM every workflow writes back to." },
  { slug: "apollo", status: "ACTIVE", since: "2023", headline: "Prospect lists and contact data.", note: "Example only. The first stop for new contacts." },
  { slug: "clay", status: "ARCHIVED", since: "2022", headline: "Enrichment tables, before code.", note: "Example only. Used from 2022 to 2025, then moved that work into scripts." },
  { slug: "n8n", status: "TESTING", since: "2026", headline: "Scheduled enrichment jobs.", note: "Example only. Testing it for jobs that run every night." },
  { slug: "gong", status: "ACTIVE", since: "2024", headline: "Calls for deal reviews.", note: "Example only. Recordings the team reviews before each forecast." },
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
