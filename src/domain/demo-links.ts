import { z } from "zod";

// Demo links: a recording of the owner using a product, shown on its card.
// Parse, don't trust: a pasted URL becomes a provider and an id, and every
// player or watch URL is rebuilt from a fixed template. Nothing a provider or a
// stored row supplies is rendered as HTML or used as a URL directly.

export const DEMO_PROVIDERS = ["LOOM", "CAP", "YOUTUBE", "VIMEO", "ARCADE"] as const;
export type DemoProvider = (typeof DEMO_PROVIDERS)[number];
export type DemoLink = { provider: DemoProvider; id: string; hash?: string };
export type DemoPresentation = { provider: DemoProvider; providerLabel: string; embedUrl: string; watchUrl: string };

// Origins a page must allow in frame-src to play these demos. Arcade asks
// sites to allow app.arcade.software as well as its player host.
export const DEMO_FRAME_ORIGINS = [
  "https://www.loom.com",
  "https://cap.so",
  "https://www.youtube-nocookie.com",
  "https://player.vimeo.com",
  "https://demo.arcade.software",
  "https://app.arcade.software",
] as const;

const PROVIDER_LABEL: Record<DemoProvider, string> = {
  LOOM: "Loom", CAP: "Cap", YOUTUBE: "YouTube", VIMEO: "Vimeo", ARCADE: "Arcade",
};
// Ids only ever hold characters that can't change a template's meaning.
const ID_PATTERN: Record<DemoProvider, RegExp> = {
  LOOM: /^[0-9a-f]{32}$/,
  CAP: /^[A-Za-z0-9_-]{1,64}$/,
  YOUTUBE: /^[A-Za-z0-9_-]{11}$/,
  VIMEO: /^[0-9]{1,12}$/,
  ARCADE: /^[A-Za-z0-9]{1,64}$/,
};
const VIMEO_HASH = /^[0-9a-f]{6,32}$/;
// A Loom share page can carry a title slug before the 32-hex id.
const LOOM_SEGMENT = /^(?:[A-Za-z0-9-]+-)?([0-9a-f]{32})$/;
const MAX_LENGTH = 2048;

function isProvider(value: unknown): value is DemoProvider {
  return typeof value === "string" && (DEMO_PROVIDERS as readonly string[]).includes(value);
}

function checked(provider: DemoProvider, id: string | undefined, hash?: string | null): DemoLink | null {
  if (id === undefined || !ID_PATTERN[provider].test(id)) return null;
  if (hash === undefined || hash === null) return { provider, id };
  return provider === "VIMEO" && VIMEO_HASH.test(hash) ? { provider, id, hash } : null;
}

/** Reads a pasted https link into one provider video, or null. */
export function parseDemoLink(input: string): DemoLink | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > MAX_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const path = url.pathname.split("/").filter(Boolean);
  const one = (length: number) => path.length === length;
  switch (url.hostname) {
    case "www.loom.com":
    case "loom.com":
      return one(2) && (path[0] === "share" || path[0] === "embed") ? checked("LOOM", LOOM_SEGMENT.exec(path[1])?.[1]) : null;
    case "cap.so":
      return one(2) && (path[0] === "s" || path[0] === "embed") ? checked("CAP", path[1]) : null;
    case "www.youtube.com":
    case "youtube.com":
    case "m.youtube.com": {
      if (one(1) && path[0] === "watch") {
        const ids = url.searchParams.getAll("v");
        return ids.length === 1 ? checked("YOUTUBE", ids[0]) : null;
      }
      return one(2) && ["shorts", "live", "embed"].includes(path[0]) ? checked("YOUTUBE", path[1]) : null;
    }
    case "youtu.be":
      return one(1) ? checked("YOUTUBE", path[0]) : null;
    case "www.youtube-nocookie.com":
      return one(2) && path[0] === "embed" ? checked("YOUTUBE", path[1]) : null;
    case "vimeo.com":
    case "www.vimeo.com":
      return one(1) || one(2) ? checked("VIMEO", path[0], path[1]) : null;
    case "player.vimeo.com":
      return one(2) && path[0] === "video" ? checked("VIMEO", path[1], url.searchParams.get("h")) : null;
    case "app.arcade.software":
      return one(2) && path[0] === "share" ? checked("ARCADE", path[1]) : null;
    case "demo.arcade.software":
      return one(1) ? checked("ARCADE", path[0]) : one(2) && path[0] === "share" ? checked("ARCADE", path[1]) : null;
    default:
      return null;
  }
}

/** The player and watch URLs for a stored demo, or null when its parts don't fit a template. */
export function demoPresentation(link: DemoLink): DemoPresentation | null {
  if (!link || typeof link !== "object" || !isProvider(link.provider) || typeof link.id !== "string") return null;
  if (link.hash !== undefined && typeof link.hash !== "string") return null;
  const safe = checked(link.provider, link.id, link.hash);
  if (!safe) return null;
  const { id, hash } = safe;
  const [embedUrl, watchUrl] = {
    LOOM: [`https://www.loom.com/embed/${id}`, `https://www.loom.com/share/${id}`],
    CAP: [`https://cap.so/embed/${id}`, `https://cap.so/s/${id}`],
    YOUTUBE: [`https://www.youtube-nocookie.com/embed/${id}`, `https://www.youtube.com/watch?v=${id}`],
    VIMEO: [`https://player.vimeo.com/video/${id}${hash ? `?h=${hash}` : ""}`, `https://vimeo.com/${id}${hash ? `/${hash}` : ""}`],
    ARCADE: [`https://demo.arcade.software/${id}`, `https://app.arcade.software/share/${id}`],
  }[safe.provider];
  return { provider: safe.provider, providerLabel: PROVIDER_LABEL[safe.provider], embedUrl, watchUrl };
}

/** What a public card stores: the provider, the id and a Vimeo hash. Never a URL. */
export const demoLinkSchema = z.object({
  provider: z.enum(DEMO_PROVIDERS),
  id: z.string(),
  hash: z.string().optional(),
}).refine(link => demoPresentation(link) !== null, "Use a Loom, Cap, YouTube, Vimeo or Arcade video link.");

export function sameDemo(first: DemoLink | null | undefined, second: DemoLink | null | undefined) {
  return Boolean(first && second && first.provider === second.provider && first.id === second.id &&
    (first.hash ?? null) === (second.hash ?? null));
}
