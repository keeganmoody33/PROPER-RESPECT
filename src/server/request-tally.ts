/**
 * Request tally: classify each page request as presumed human or as one kind
 * of automated client, from its User-Agent alone.
 *
 * Pure functions only (no I/O) so they can be unit tested. Storage lives in
 * src/server/tally-store.ts. Category ids follow the bot-tally taxonomy.
 *
 * Limits, stated plainly in the footer: a client that lies about its
 * User-Agent is counted as whatever it claims to be, and nothing here is
 * network or cryptographically verified yet.
 */

export const TALLY_CATEGORIES = [
  'presumed_human',
  'search_engine_crawler',
  'ai_training_crawler',
  'ai_search_indexer',
  'ai_assistant_fetch',
  'seo_crawler',
  'link_preview',
  'monitoring',
  'unattributed_automation',
  'undeclared',
] as const

export type TallyCategory = (typeof TALLY_CATEGORIES)[number]

export const TALLY_LABELS: Record<TallyCategory, string> = {
  presumed_human: 'presumed human',
  search_engine_crawler: 'search engine crawler',
  ai_training_crawler: 'AI training crawler',
  ai_search_indexer: 'AI search indexer',
  ai_assistant_fetch: 'AI assistant fetch',
  seo_crawler: 'SEO crawler',
  link_preview: 'link preview',
  monitoring: 'monitoring',
  unattributed_automation: 'unattributed automation',
  undeclared: 'undeclared',
}

export const TALLY_DEFINITIONS: Record<TallyCategory, string> = {
  presumed_human: 'not classified as automated. a count of requests, not of people.',
  search_engine_crawler: 'Google, Bing and others mapping the web for search.',
  ai_training_crawler: 'collects pages to train AI models.',
  ai_search_indexer: 'indexes pages so an AI answer engine can cite them.',
  ai_assistant_fetch: 'an AI fetched this page because a person asked it about you.',
  seo_crawler: 'link and ranking audit tools.',
  link_preview: 'someone shared a link and an app fetched the preview card.',
  monitoring: 'uptime and performance checks.',
  unattributed_automation: 'scripts and headless browsers with no declared purpose.',
  undeclared: 'sent no identification at all.',
}

// Checked in order; the first match wins. Patterns match the lowercased UA.
const RULES: Array<[Exclude<TallyCategory, 'presumed_human' | 'undeclared'>, RegExp]> = [
  ['ai_assistant_fetch', /chatgpt-user|claude-user|perplexity-user|mistralai-user|meta-externalfetcher|gemini-deep-research|google-agent/],
  ['ai_search_indexer', /oai-searchbot|claude-searchbot|perplexitybot|youbot|duckassistbot|amzn-searchbot|phindbot/],
  ['ai_training_crawler', /gptbot|claudebot|anthropic-ai|ccbot|bytespider|meta-externalagent|amazonbot|diffbot|cohere-ai|ai2bot|timpibot|omgili|imagesiftbot|friendlycrawler|img2dataset/],
  ['link_preview', /facebookexternalhit|facebookcatalog|twitterbot|slackbot|slack-imgproxy|linkedinbot|discordbot|whatsapp|telegrambot|skypeuripreview|embedly|redditbot|pinterestbot|iframely|vkshare|cardyb|mastodon|bluesky|snapchat|google-pagerenderer/],
  ['search_engine_crawler', /googlebot|google-inspectiontool|storebot-google|adsbot-google|bingbot|bingpreview|duckduckbot|yandex(bot|images)|baiduspider|applebot|petalbot|seznambot|sogou|yeti\/|slurp|qwantbot|mojeekbot|coccocbot/],
  ['seo_crawler', /ahrefsbot|ahrefssiteaudit|semrushbot|mj12bot|dotbot|rogerbot|screaming frog|serpstatbot|dataforseobot|barkrowler|blexbot|seokicks|siteauditbot|sitebulb/],
  ['monitoring', /uptimerobot|pingdom|statuscake|betteruptime|better stack|site24x7|checkly|datadogsynthetics|newrelicsynthetics|uptime-kuma|hetrixtools|freshping|vercel-screenshot/],
  ['unattributed_automation', /curl\/|wget\/|python-requests|python-urllib|aiohttp|httpx|go-http-client|node-fetch|axios|undici|okhttp|java\/|libwww-perl|headlesschrome|phantomjs|playwright|puppeteer|selenium|scrapy|postmanruntime|insomnia|httpclient|bot\b|bot\/|crawler|spider|scraper/],
]

export function classifyUserAgent(userAgent: string | null | undefined): TallyCategory {
  const ua = (userAgent ?? '').trim().toLowerCase()
  if (ua === '' || ua === '-') return 'undeclared'
  for (const [category, pattern] of RULES) {
    if (pattern.test(ua)) return category
  }
  return 'presumed_human'
}

type HeaderSource = { get(name: string): string | null }

/**
 * True when a request is a page the site served (a document or its markdown
 * twin), not an asset, API call, prefetch or client-side data fetch.
 */
export function isCountablePageRequest(method: string, pathname: string, headers: HeaderSource): boolean {
  if (method !== 'GET') return false
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/') || pathname.startsWith('/_vercel/')) return false
  const purpose = `${headers.get('purpose') ?? ''} ${headers.get('sec-purpose') ?? ''}`.toLowerCase()
  if (purpose.includes('prefetch') || purpose.includes('prerender')) return false
  if (headers.get('next-router-prefetch') || headers.get('rsc') || headers.get('next-router-state-tree')) return false
  return true
}

export type TallySnapshot = {
  since: string | null
  presumedHuman: number
  automated: number
  byCategory: Record<TallyCategory, number>
}

/** Builds a snapshot from raw hash fields, ignoring anything unknown or malformed. */
export function toSnapshot(raw: Record<string, unknown> | null | undefined, since: string | null): TallySnapshot {
  const byCategory = Object.fromEntries(TALLY_CATEGORIES.map((c) => [c, 0])) as Record<TallyCategory, number>
  for (const category of TALLY_CATEGORIES) {
    const value = Number(raw?.[category] ?? 0)
    byCategory[category] = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
  }
  const automated = TALLY_CATEGORIES.filter((c) => c !== 'presumed_human').reduce((sum, c) => sum + byCategory[c], 0)
  return { since, presumedHuman: byCategory.presumed_human, automated, byCategory }
}
