// Private/public separation for PostHog. Signed-in and auth routes never send
// replay, clicks, errors or detailed URLs: only a pageview collapsed to the
// route prefix (for example "/app") so traffic volume stays countable.
const PRIVATE_PREFIXES = ["/app", "/sign-in", "/sign-up", "/onboarding"];
const KEPT_ON_PRIVATE = new Set(["$pageview", "$pageleave"]);
// Page-derived properties that could carry private headings or text.
const PRIVATE_PAGE_PROPERTIES = ["$title", "$el_text", "$elements", "$elements_chain"];

function privatePrefix(pathname: string): string | undefined {
  return PRIVATE_PREFIXES.find(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isPrivateReplayPath(pathname: string): boolean {
  return privatePrefix(pathname) !== undefined;
}

/** Collapses a private path or URL to its route prefix; anything else is returned unchanged. */
function scrubValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  if (value.startsWith("/")) {
    const prefix = privatePrefix(value.split(/[?#]/)[0]);
    return prefix ?? value;
  }
  if (!/^https?:\/\//.test(value)) return value;
  try {
    const url = new URL(value);
    const prefix = privatePrefix(url.pathname);
    return prefix ? `${url.origin}${prefix}` : value;
  } catch {
    return value;
  }
}

function scrubRecord(record: Record<string, unknown> | undefined) {
  if (!record) return;
  for (const [key, value] of Object.entries(record)) record[key] = scrubValue(value);
}

type AnalyticsEvent = {
  event: string;
  properties: Record<string, unknown>;
  $set?: Record<string, unknown>;
  $set_once?: Record<string, unknown>;
};

/** PostHog `before_send` hook body: null drops the event. */
export function sanitizeAnalyticsEvent<T extends AnalyticsEvent>(event: T): T | null {
  const props = event.properties ?? {};
  let pathname = typeof props.$pathname === "string" ? props.$pathname : undefined;
  if (!pathname && typeof props.$current_url === "string") {
    try { pathname = new URL(props.$current_url).pathname; } catch { /* not a URL */ }
  }
  const onPrivateRoute = pathname !== undefined && isPrivateReplayPath(pathname);
  if (onPrivateRoute && !KEPT_ON_PRIVATE.has(event.event)) return null;
  if (onPrivateRoute) for (const key of PRIVATE_PAGE_PROPERTIES) delete props[key];
  scrubRecord(props);
  scrubRecord(props.$set as Record<string, unknown> | undefined);
  scrubRecord(props.$set_once as Record<string, unknown> | undefined);
  scrubRecord(event.$set);
  scrubRecord(event.$set_once);
  return event;
}
