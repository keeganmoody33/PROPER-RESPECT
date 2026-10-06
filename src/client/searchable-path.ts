export const SEARCHABLE_TRACKER_ORIGIN = "https://tracker.searchableanalytics.com";
export const SEARCHABLE_PUBLIC_PATH = "^/(?:$|about/(?:origins|contact|privacy|terms|methodology)$|(?!(?:app|sign-in|sign-up|onboarding|api|admin|icon|apple-icon|evidence-fixture|agents|auth|index)$)[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$)";

export function searchablePublicPath(pathname: string | null): string | null {
  return pathname !== null && new RegExp(SEARCHABLE_PUBLIC_PATH).test(pathname) ? pathname : null;
}
