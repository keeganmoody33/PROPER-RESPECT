import { ProductCard } from "./product-card";
import type { PublicProfile } from "@/src/domain/public-profile";

// Demonstration data never enters a user's collection or a published profile.
const counts = [0, 2, 4, 1, 0, 6, 2, 3, 0, 0, 4, 7, 1, 2, 5, 0, 3, 2, 1, 0, 4, 6, 2, 0, 3, 1, 4, 2];
const example: PublicProfile["cards"][number] = {
  product: { name: "GitHub", slug: "github", domain: "github.com", logoUrl: "/brand/github/2026-09-21/favicon.svg", description: "Code hosting and collaboration." },
  status: "ACTIVE",
  headline: "Where I build and review code.",
  note: "An example of how a personal note and a usage snapshot appear together.",
  activity: {
    kind: "contributionCalendar", attributionScope: "PERSONAL", freshness: "STALE",
    capturedAt: "2026-08-29T00:00:00.000Z", provenanceLabel: "Illustrative sample, not account data",
    period: { start: "2026-08-01", end: "2026-08-28" },
    total: counts.reduce((sum, count) => sum + count, 0),
    days: counts.map((count, index) => ({ date: `2026-08-${String(index + 1).padStart(2, "0")}`, count, level: Math.min(count, 4) })),
  },
};

export function ProductExample() {
  return <div>
    <p>Inside a card / Illustrative example</p>
    <ProductCard card={example} index={0} />
    <p>Sample activity, not personal usage. Your cards use the evidence you add or connect.</p>
  </div>;
}
