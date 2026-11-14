/**
 * What an owner can say a product does for them. Each label finishes the sentence "I use it to …".
 *
 * Written by hand on 2026-11-13 for the GTM-engineering starter set and the homepage examples.
 * A product that isn't listed here offers only the owner's own words.
 *
 * An id is stored with the owner's card and published with it, so an id never changes meaning and is
 * never reused. To retire a choice, delete it: cards that picked it stop showing it.
 */
export type UseOption = Readonly<{ id: string; label: string }>;

export const USE_OPTIONS: Readonly<Record<string, readonly UseOption[]>> = {
  "claude-code": [
    { id: "write-features", label: "build features from a description" },
    { id: "fix-bugs", label: "find and fix bugs" },
    { id: "review-code", label: "review code before it merges" },
    { id: "learn-codebase", label: "find my way around a codebase" },
    { id: "automate-chores", label: "automate repetitive engineering work" },
  ],
  cursor: [
    { id: "write-features", label: "build features with AI in my editor" },
    { id: "edit-across-files", label: "make one change across many files" },
    { id: "fix-bugs", label: "find and fix bugs" },
    { id: "learn-codebase", label: "ask questions about a codebase" },
  ],
  github: [
    { id: "host-code", label: "host my code and its history" },
    { id: "review-pull-requests", label: "review and merge pull requests" },
    { id: "run-ci", label: "run tests and deploys on every push" },
    { id: "track-issues", label: "track bugs and planned work" },
    { id: "publish-open-source", label: "publish open-source work" },
  ],
  clay: [
    { id: "enrich-leads", label: "enrich lead and account lists" },
    { id: "build-lists", label: "build target account lists" },
    { id: "find-contacts", label: "find contact details" },
    { id: "personalize-outreach", label: "write personalized outreach at scale" },
    { id: "sync-crm", label: "keep my CRM records filled in" },
  ],
  exa: [
    { id: "search-for-agents", label: "give my agents web search" },
    { id: "find-companies", label: "find companies and people that fit a description" },
    { id: "research-topics", label: "research a topic from live sources" },
    { id: "fetch-page-contents", label: "pull the contents of pages I find" },
  ],
  firecrawl: [
    { id: "scrape-pages", label: "turn web pages into Markdown" },
    { id: "crawl-sites", label: "crawl whole sites" },
    { id: "extract-fields", label: "pull structured fields out of pages" },
    { id: "search-web", label: "search the web and read the results" },
  ],
  spider: [
    { id: "crawl-sites", label: "crawl sites quickly at volume" },
    { id: "scrape-pages", label: "turn web pages into clean text" },
    { id: "feed-agents", label: "feed web data to my agents" },
  ],
  n8n: [
    { id: "connect-apps", label: "connect my apps without custom code" },
    { id: "schedule-jobs", label: "run jobs on a schedule" },
    { id: "run-ai-workflows", label: "chain AI steps into a workflow" },
    { id: "move-data", label: "move data between systems" },
  ],
  cloudflare: [
    { id: "manage-dns", label: "run DNS for my domains" },
    { id: "run-workers", label: "run code at the edge with Workers" },
    { id: "cache-and-protect", label: "cache and protect my sites" },
    { id: "store-files", label: "store files and data" },
    { id: "host-sites", label: "host sites and apps" },
  ],
  vercel: [
    { id: "deploy-frontends", label: "deploy my web apps" },
    { id: "preview-changes", label: "preview every change before it ships" },
    { id: "run-functions", label: "run backend functions" },
    { id: "manage-domains", label: "connect my domains" },
  ],
  supabase: [
    { id: "host-postgres", label: "run my Postgres database" },
    { id: "handle-auth", label: "handle sign-in for my apps" },
    { id: "store-files", label: "store user files" },
    { id: "serve-realtime", label: "push live updates to clients" },
  ],
  posthog: [
    { id: "track-product-usage", label: "see how people use my product" },
    { id: "watch-sessions", label: "watch session replays" },
    { id: "flag-features", label: "roll features out behind flags" },
    { id: "run-experiments", label: "run A/B tests" },
  ],
  porkbun: [
    { id: "register-domains", label: "register and renew domains" },
    { id: "manage-dns", label: "manage DNS records" },
    { id: "forward-email", label: "forward email on my domains" },
  ],
  docker: [
    { id: "run-local-services", label: "run databases and services locally" },
    { id: "package-apps", label: "package apps to run anywhere" },
    { id: "match-production", label: "keep my machine matching production" },
    { id: "run-ci-builds", label: "build and test in CI" },
  ],
  "open-places": [
    { id: "build-business-lists", label: "build lists of local businesses" },
    { id: "source-map-data", label: "get business data from open maps" },
    { id: "target-by-area", label: "find businesses in one area or category" },
  ],
  "grok-bot": [
    { id: "delegate-tasks", label: "hand off tasks to an agent" },
    { id: "research-topics", label: "research a topic for me" },
    { id: "run-code", label: "run code on its own computer" },
  ],
  elicit: [
    { id: "find-papers", label: "find papers on a question" },
    { id: "summarize-papers", label: "summarize what papers found" },
    { id: "extract-study-data", label: "pull data out of studies into a table" },
    { id: "review-literature", label: "review the literature on a topic" },
  ],
  "context-dev": [
    { id: "pull-brand-data", label: "pull a company's logo, colors and fonts" },
    { id: "scrape-pages", label: "turn web pages into clean text" },
    { id: "enrich-companies", label: "look up company details by domain" },
  ],
};
