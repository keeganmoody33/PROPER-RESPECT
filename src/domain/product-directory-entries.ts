export type DirectoryCategory =
  | "AI"
  | "SALES"
  | "MARKETING"
  | "ENGINEERING"
  | "DATA"
  | "DESIGN"
  | "PRODUCTIVITY"
  | "COMMUNICATION"
  | "CREATOR"
  | "CONSUMER";

export type DirectoryEntry = Readonly<{
  slug: string;
  name: string;
  domain: string;
  /** The public primary link a new card gets. */
  website: string;
  description: string;
  /** Extra names for search, and for the evidence name matcher. */
  aliases: readonly string[];
  category: DirectoryCategory;
  /**
   * Present only when this identity may classify private evidence. Its domains
   * join the Gmail sender query. Without it, an entry is pickable and searchable only.
   */
  evidence?: Readonly<{ domains: readonly string[]; canonicalUrl?: string }>;
}>;

export const DIRECTORY_ENTRIES: readonly DirectoryEntry[] = [
  // Exact product identities already retained with publisher artwork in
  // public/product-assets/2026-09-24-product-icons.json. Parent domains do not
  // establish usage of these specific products.
  {
    slug: "claude-code", name: "Claude Code", domain: "claude.com",
    website: "https://code.claude.com/docs/en/monitoring-usage",
    description: "AI-assisted software development.", aliases: ["claude code"], category: "AI",
    evidence: { domains: [], canonicalUrl: "https://code.claude.com/docs/en/monitoring-usage" },
  },
  {
    slug: "codex", name: "Codex", domain: "openai.com",
    website: "https://developers.openai.com/codex/app-server/",
    description: "AI-assisted software development.", aliases: ["codex"], category: "AI",
    evidence: { domains: [], canonicalUrl: "https://developers.openai.com/codex/app-server/" },
  },
  // Official product identity verified at https://www.clay.com on 2026-09-18.
  {
    slug: "clay", name: "Clay", domain: "clay.com", website: "https://clay.com",
    description: "Data enrichment and go-to-market workflows.", aliases: ["clay"], category: "SALES",
    evidence: { domains: ["clay.com"] },
  },
  {
    slug: "github", name: "GitHub", domain: "github.com", website: "https://github.com",
    description: "The home base for code, collaboration, and shipped work.",
    aliases: ["github", "github inc"], category: "ENGINEERING",
    evidence: { domains: ["github.com", "github.io"] },
  },
  {
    slug: "github-copilot", name: "GitHub Copilot", domain: "github.com",
    website: "https://github.com/features/copilot",
    description: "GitHub's AI coding assistant.",
    aliases: ["github copilot", "github copilot pro", "github copilot pro+", "github copilot pro plus"], category: "AI",
    evidence: { domains: [], canonicalUrl: "https://github.com/features/copilot" },
  },
  {
    slug: "wisprflow", name: "Wispr Flow", domain: "wisprflow.ai", website: "https://wisprflow.ai",
    description: "Voice dictation for writing across apps.",
    aliases: ["wisprflow", "wispr flow", "wispr"], category: "PRODUCTIVITY",
    evidence: { domains: ["wisprflow.ai", "flowvoice.ai"] },
  },
  {
    slug: "notebooklm", name: "NotebookLM", domain: "notebooklm.google.com", website: "https://notebooklm.google.com",
    description: "Research and synthesis over supplied sources.",
    aliases: ["notebooklm", "notebook lm", "google notebooklm"], category: "AI",
    evidence: { domains: ["notebooklm.google.com", "notebooklm.google"] },
  },
  {
    slug: "notion", name: "Notion", domain: "notion.so", website: "https://notion.so",
    description: "Docs, wikis, and databases in one connected workspace.",
    aliases: ["notion", "notion labs", "notion labs inc"], category: "PRODUCTIVITY",
    evidence: { domains: ["notion.so", "notion.site", "notion.com"] },
  },
  {
    slug: "devin", name: "Devin", domain: "devin.ai", website: "https://devin.ai",
    description: "Autonomous software engineering activity.",
    aliases: ["devin", "devin cloud", "cognition devin"], category: "AI",
    evidence: { domains: ["devin.ai", "app.devin.ai"] },
  },
  {
    slug: "devin-desktop", name: "Devin Desktop", domain: "devin.ai", website: "https://devin.ai/download",
    description: "Desktop coding activity in the Devin product family.",
    aliases: ["devin desktop"], category: "AI",
    evidence: { domains: [], canonicalUrl: "https://devin.ai/download" },
  },
  {
    slug: "windsurf", name: "Windsurf", domain: "windsurf.com", website: "https://windsurf.com",
    description: "AI-assisted coding activity across editor workflows.",
    aliases: ["windsurf", "codeium"], category: "AI",
    evidence: { domains: ["windsurf.com", "codeium.com"] },
  },
  {
    slug: "greptile", name: "Greptile", domain: "greptile.com", website: "https://greptile.com",
    description: "AI code review activity and bugs caught.", aliases: ["greptile"], category: "ENGINEERING",
    evidence: { domains: ["greptile.com"] },
  },
  // Package names and homepages verified against the installed package manifests.
  {
    slug: "clerk", name: "Clerk", domain: "clerk.com", website: "https://clerk.com",
    description: "Application authentication.", aliases: ["clerk", "@clerk/nextjs"], category: "ENGINEERING",
    evidence: { domains: ["clerk.com"] },
  },
  {
    slug: "convex", name: "Convex", domain: "convex.dev", website: "https://convex.dev",
    description: "Application database and backend functions.", aliases: ["convex"], category: "ENGINEERING",
    evidence: { domains: ["convex.dev"] },
  },
  {
    slug: "nextjs", name: "Next.js", domain: "nextjs.org", website: "https://nextjs.org",
    description: "React application framework.", aliases: ["next", "next.js", "nextjs"], category: "ENGINEERING",
    evidence: { domains: ["nextjs.org"] },
  },
  {
    slug: "react", name: "React", domain: "react.dev", website: "https://react.dev",
    description: "User interface library.", aliases: ["react", "react-dom"], category: "ENGINEERING",
    evidence: { domains: ["react.dev"] },
  },
  {
    slug: "zod", name: "Zod", domain: "zod.dev", website: "https://zod.dev",
    description: "Runtime schema parsing and validation.", aliases: ["zod"], category: "ENGINEERING",
    evidence: { domains: ["zod.dev"] },
  },
  {
    slug: "typescript", name: "TypeScript", domain: "typescriptlang.org", website: "https://typescriptlang.org",
    description: "Static type checking for JavaScript.", aliases: ["typescript"], category: "ENGINEERING",
    evidence: { domains: ["typescriptlang.org"] },
  },
  // Public identities verified 2026-09-19; sources and limits are recorded in
  // docs/verification/2026-09-19-catalog-identities.md. These are not usage claims.
  {
    slug: "cursor", name: "Cursor", domain: "cursor.com", website: "https://cursor.com",
    description: "AI-assisted software development.", aliases: ["cursor"], category: "AI",
    evidence: { domains: ["cursor.com"] },
  },
  {
    slug: "cloudflare", name: "Cloudflare", domain: "cloudflare.com", website: "https://cloudflare.com",
    description: "Connectivity, security, and application infrastructure platform.",
    aliases: ["cloudflare"], category: "ENGINEERING",
    evidence: { domains: ["cloudflare.com"] },
  },
  {
    slug: "searchable", name: "Searchable", domain: "searchable.com", website: "https://searchable.com",
    description: "AI search visibility and analytics.", aliases: ["searchable"], category: "MARKETING",
    evidence: { domains: ["searchable.com"] },
  },
  {
    slug: "smartlead", name: "Smartlead", domain: "smartlead.ai", website: "https://smartlead.ai",
    description: "Outbound email and sales workflows.", aliases: ["smartlead"], category: "SALES",
    evidence: { domains: ["smartlead.ai"] },
  },
  {
    slug: "findymail", name: "Findymail", domain: "findymail.com", website: "https://findymail.com",
    description: "Business contact finding and email verification.", aliases: ["findymail"], category: "SALES",
    evidence: { domains: ["findymail.com"] },
  },
  {
    slug: "hunter", name: "Hunter", domain: "hunter.io", website: "https://hunter.io",
    description: "Email finding, verification, and outreach.", aliases: ["hunter"], category: "SALES",
    evidence: { domains: ["hunter.io"] },
  },
  {
    slug: "supabase", name: "Supabase", domain: "supabase.com", website: "https://supabase.com",
    description: "Postgres-based application backend platform.", aliases: ["supabase"], category: "ENGINEERING",
    evidence: { domains: ["supabase.com"] },
  },
  {
    slug: "neon", name: "Neon", domain: "neon.com", website: "https://neon.com",
    description: "Managed serverless Postgres.", aliases: ["neon"], category: "ENGINEERING",
    evidence: { domains: ["neon.com", "neon.tech"] },
  },
  {
    slug: "upstash", name: "Upstash", domain: "upstash.com", website: "https://upstash.com",
    description: "Serverless data and messaging infrastructure.", aliases: ["upstash"], category: "ENGINEERING",
    evidence: { domains: ["upstash.com"] },
  },
  {
    slug: "posthog", name: "PostHog", domain: "posthog.com", website: "https://posthog.com",
    description: "Product analytics and development tools.", aliases: ["posthog"], category: "DATA",
    evidence: { domains: ["posthog.com"] },
  },
  {
    slug: "elevenlabs", name: "ElevenLabs", domain: "elevenlabs.io", website: "https://elevenlabs.io",
    description: "AI voice and audio tools.", aliases: ["elevenlabs"], category: "CREATOR",
    evidence: { domains: ["elevenlabs.io"] },
  },
  {
    slug: "browserbase", name: "Browserbase", domain: "browserbase.com", website: "https://browserbase.com",
    description: "Browser automation infrastructure.", aliases: ["browserbase"], category: "ENGINEERING",
    evidence: { domains: ["browserbase.com"] },
  },
  {
    slug: "ref", name: "Ref", domain: "ref.tools", website: "https://ref.tools",
    description: "Documentation tools for software development.", aliases: ["ref"], category: "ENGINEERING",
    evidence: { domains: ["ref.tools"] },
  },
  {
    slug: "context7", name: "Context7", domain: "context7.com", website: "https://context7.com",
    description: "Library documentation for coding assistants.", aliases: ["context7"], category: "ENGINEERING",
    evidence: { domains: ["context7.com"] },
  },
  {
    slug: "figma", name: "Figma", domain: "figma.com", website: "https://figma.com",
    description: "Collaborative product design tools.", aliases: ["figma"], category: "DESIGN",
    evidence: { domains: ["figma.com"] },
  },
  {
    slug: "readwise", name: "Readwise", domain: "readwise.io", website: "https://readwise.io",
    description: "Highlight collection and review.", aliases: ["readwise"], category: "PRODUCTIVITY",
    evidence: { domains: ["readwise.io"] },
  },
  {
    slug: "firecrawl", name: "Firecrawl", domain: "firecrawl.dev", website: "https://firecrawl.dev",
    description: "Web crawling and data extraction.", aliases: ["firecrawl"], category: "ENGINEERING",
    evidence: { domains: ["firecrawl.dev"] },
  },
  {
    slug: "openrouter", name: "OpenRouter", domain: "openrouter.ai", website: "https://openrouter.ai",
    description: "Unified access to AI model APIs.", aliases: ["openrouter"], category: "AI",
    evidence: { domains: ["openrouter.ai"] },
  },
  {
    slug: "tailscale", name: "Tailscale", domain: "tailscale.com", website: "https://tailscale.com",
    description: "Private networking and access control.", aliases: ["tailscale"], category: "ENGINEERING",
    evidence: { domains: ["tailscale.com"] },
  },
  {
    slug: "exa", name: "Exa", domain: "exa.ai", website: "https://exa.ai",
    description: "Web search and retrieval for AI applications.", aliases: ["exa"], category: "AI",
    evidence: { domains: ["exa.ai"] },
  },
];
