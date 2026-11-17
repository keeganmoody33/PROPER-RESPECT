import type { PublicProfile } from "../domain/public-profile";
import { e2eReferenceProfile } from "./e2e-reference-profile";

// Fixture mode only: the listed pages search reads with no backend. Every person but the reference owner is invented.
const clay = { name: "Clay", slug: "clay", domain: "clay.com", description: "Data enrichment and outbound workflows." };
const github = e2eReferenceProfile.cards[0].product;

export const e2eSearchProfiles: readonly PublicProfile[] = [
  { ...e2eReferenceProfile, handle: "lecturesfrom" },
  {
    handle: "synthetic-sam", displayName: "Synthetic Sam", bio: "An invented page for search checks.",
    cards: [
      { product: clay, status: "ACTIVE", level: "DAILY", headline: "Every list starts here.", note: "", startedAt: "2024-03-01" },
      { product: github, status: "ACTIVE", level: "WEEKLY", headline: "Side projects live here.", note: "" },
    ],
  },
  {
    handle: "synthetic-ria", displayName: "Synthetic Ria", bio: "An invented page for search checks.",
    cards: [
      { product: clay, status: "ARCHIVED", level: "STOPPED", headline: "Built my first outbound lists with it.", note: "", startedAt: "2022-01-01" },
    ],
  },
];
