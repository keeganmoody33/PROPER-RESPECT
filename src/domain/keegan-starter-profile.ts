import type { PublicProfile } from "./public-profile";

export type KeeganStarterCard = PublicProfile["cards"][number] & {
  seedKey: string;
};

export const KEEGAN_STARTER_CARDS = [
  {
    seedKey: "github",
    product: {
      name: "GitHub",
      slug: "github",
      domain: "github.com",
      description: "The home base for code, collaboration, and shipped work.",
    },
    status: "ACTIVE",
    headline: "Where the receipts live.",
    note: "I use GitHub to turn product thinking into inspectable, attributable work.",
    startedAt: "2024-01-01",
    primaryLink: {
      type: "CANONICAL",
      url: "https://github.com/keeganmoody33",
      label: "See Keegan on GitHub",
    },
  },
  {
    seedKey: "wisprflow",
    product: {
      name: "Wispr Flow",
      slug: "wisprflow",
      domain: "wisprflow.ai",
      description: "Voice dictation that keeps up with how I actually think.",
    },
    status: "ACTIVE",
    headline: "Talking is faster than typing.",
    note: "I use Wispr Flow to dictate specs, notes, and messages at the speed of thought.",
    startedAt: "2025-01-01",
    primaryLink: {
      type: "CANONICAL",
      url: "https://wisprflow.ai",
      label: "Check out Wispr Flow",
    },
  },
  {
    seedKey: "notebooklm",
    product: {
      name: "NotebookLM",
      slug: "notebooklm",
      domain: "notebooklm.google.com",
      description:
        "NotebookLM, now Gemini Notebook, keeps my source-grounded research and synthesis in one continuous workspace.",
    },
    status: "ACTIVE",
    headline: "Research grounded in my own sources.",
    note: "I use this evolving NotebookLM and Gemini Notebook workflow to turn source material into working knowledge.",
    startedAt: "2025-01-01",
    primaryLink: {
      type: "CANONICAL",
      url: "https://notebooklm.google.com",
      label: "Check out NotebookLM",
    },
  },
  {
    seedKey: "devin-desktop",
    product: {
      name: "Devin Desktop",
      slug: "devin-desktop",
      domain: "devin.ai",
      description:
        "The next generation of Windsurf for managing local and cloud coding agents from one desktop.",
    },
    status: "ACTIVE",
    headline: "Agent work with an IDE still in reach.",
    note: "I use Devin Desktop to scope, delegate, review, and ship agent work without losing the IDE workflows I built in Windsurf.",
    startedAt: "2026-06-01",
    primaryLink: {
      type: "CANONICAL",
      url: "https://devin.ai/download",
      label: "Download Devin Desktop",
    },
  },
] as const satisfies readonly KeeganStarterCard[];
