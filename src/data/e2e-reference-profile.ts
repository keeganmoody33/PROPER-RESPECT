import type { PublicProfile } from "../domain/public-profile";

export const e2eReferenceProfile: PublicProfile = {
  handle: "keegan",
  displayName: "Keegan Moody",
  bio: "GTM engineer, system builder, ideator, and hip-hop evangelist.",
  cards: [
    {
      product: {
        name: "GitHub",
        slug: "github",
        domain: "github.com",
        description: "Code, collaboration, and shipped work.",
        logoUrl: "https://github.githubassets.com/favicons/favicon.svg",
      },
      status: "ACTIVE",
      headline: "Where the receipts live.",
      note: "I use GitHub to turn product thinking into inspectable, attributable work.",
      startedAt: "2024-01-01",
      activity: {
        kind: "contributionCalendar",
        attributionScope: "PERSONAL",
        capturedAt: "2026-07-26T18:00:00.000Z",
        freshness: "FRESH",
        provenanceLabel: "GitHub account",
        total: 523,
        memberSince: "2024-01-01",
        days: [
          { date: "2026-07-20", count: 1, level: 1 },
          { date: "2026-07-21", count: 4, level: 3 },
          { date: "2026-07-22", count: 2, level: 2 },
          { date: "2026-07-23", count: 7, level: 4 },
          { date: "2026-07-24", count: 2, level: 2 },
          { date: "2026-07-25", count: 5, level: 3 },
          { date: "2026-07-26", count: 1, level: 1 },
        ],
      },
      primaryLink: {
        type: "CANONICAL",
        url: "https://github.com/keeganmoody33",
        label: "See Keegan on GitHub",
      },
    },
    {
      product: {
        name: "Wispr Flow",
        slug: "wisprflow",
        domain: "wisprflow.ai",
        description: "Voice dictation at the speed of thought.",
      },
      status: "ACTIVE",
      headline: "Talking is faster than typing.",
      note: "I use Wispr Flow to dictate specs, notes, and messages.",
      startedAt: "2025-01-01",
      activity: {
        kind: "headlineMetrics",
        attributionScope: "PERSONAL",
        capturedAt: "2026-07-26T18:00:00.000Z",
        freshness: "STALE",
        provenanceLabel: "Wispr Flow Insights snapshot",
        primary: {
          label: "Total words dictated",
          value: 373701,
          unit: "words",
        },
        supporting: [
          { label: "Average speed", value: 113, unit: "WPM" },
          { label: "Current streak", value: 9, unit: "days" },
          { label: "Apps used", value: 65 },
        ],
      },
      primaryLink: {
        type: "CANONICAL",
        url: "https://wisprflow.ai",
        label: "Open Wispr Flow",
      },
    },
  ],
};
