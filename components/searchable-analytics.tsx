import { SearchableAnalyticsFrame } from "./searchable-analytics-frame";

export function SearchableAnalytics() {
  if (process.env.VERCEL_ENV !== "production") return null;

  return <SearchableAnalyticsFrame />;
}
