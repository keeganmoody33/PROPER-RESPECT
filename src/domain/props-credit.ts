import { z } from "zod";
import { handleSchema } from "./handle.ts";
import { isHttpUrl, parseLooseHttpUrl } from "./http-url.ts";
import { GITHUB_LOGIN, GITHUB_MARKETING_PATHS } from "./product-destination.ts";

// Props: one credit per card to the person who put its owner on the product. The owner sets it privately and it
// goes out with the card. A link is only ever a platform's fixed host plus the encoded handle.

export const CREDIT_OTHER_HANDLE_MAX = 40;
export const CREDIT_OTHER_PLATFORM_MAX = 30;
// Room for a pasted profile link, not only a handle: a 30-letter non-Latin YouTube handle percent-encodes to about 180
// characters before its host and any share query, so 200 cut real links short.
export const CREDIT_INPUT_MAX = 512;
const PROPER_RESPECT_ORIGIN = "https://proper-respect.com";

type PlatformRule = Readonly<{
  label: string;
  // Hosts a pasted profile link may come from, matched exactly.
  hosts: readonly string[];
  // The handle in a profile link's path segments, or undefined when the path isn't a profile.
  fromPath: (segments: readonly string[]) => string | undefined;
  accepts: (handle: string) => boolean;
  refused: string;
  href: (handle: string) => string;
  // Whether the handle is written after an @. A LinkedIn profile is named by its link, not an @handle.
  at: boolean;
}>;

const only = (segments: readonly string[]) => segments.length === 1 ? segments[0] : undefined;
const afterAt = (segments: readonly string[]) => segments.length === 1 && segments[0].startsWith("@") ? segments[0].slice(1) : undefined;
const encoded = (handle: string) => encodeURIComponent(handle);
const YOUTUBE_MIN = 3;
const YOUTUBE_MAX = 30;
const PROFILE_PATH_SEGMENTS = 2;
// Accepts an X handle: matches "jack_1", rejects "jack-1". https://regex101.com/?regex=%5E%5BA-Za-z0-9_%5D%7B1%2C15%7D%24&flags=&testString=jack_1%0Ajack-1
const X_HANDLE = /^[A-Za-z0-9_]{1,15}$/;
// Accepts a LinkedIn profile slug: matches "jane-doe", rejects "jane.doe". https://regex101.com/?regex=%5E%5BA-Za-z0-9-%5D%7B3%2C100%7D%24&flags=&testString=jane-doe%0Ajane.doe
const LINKEDIN_SLUG = /^[A-Za-z0-9-]{3,100}$/;
// Accepts a YouTube handle's characters, with no separator first or last: matches "mkbhd.tech", rejects "_mkbhd". https://regex101.com/?regex=%5E%5B%5Cp%7BL%7D%5Cp%7BN%7D%5D%28%3F%3A%5B%5Cp%7BL%7D%5Cp%7BM%7D%5Cp%7BN%7D_.%5C-%C2%B7%5D%2A%5B%5Cp%7BL%7D%5Cp%7BM%7D%5Cp%7BN%7D%5D%29%3F%24&flags=u&testString=mkbhd.tech%0A_mkbhd
const YOUTUBE_HANDLE = /^[\p{L}\p{N}](?:[\p{L}\p{M}\p{N}_.\-\u00B7]*[\p{L}\p{M}\p{N}])?$/u;
// Accepts text with no letter outside printable ASCII and the middle dot: matches "mkbhd", rejects "ユー". https://regex101.com/?regex=%5E%5B%5Cx20-%5Cx7E%C2%B7%5D%2A%24&flags=&testString=mkbhd%0A%E3%83%A6%E3%83%BC
const LATIN_ONLY = /^[\x20-\x7E\u00B7]*$/;
// Accepts an Instagram username: matches "jane.doe_", rejects "jane..doe". https://regex101.com/?regex=%5E%28%3F%21%5C.%29%28%3F%21.%2A%5C.%5C.%29%28%3F%21.%2A%5C.%24%29%5BA-Za-z0-9._%5D%7B1%2C30%7D%24&flags=&testString=jane.doe_%0Ajane..doe
const INSTAGRAM_USERNAME = /^(?!\.)(?!.*\.\.)(?!.*\.$)[A-Za-z0-9._]{1,30}$/;
// Accepts a Substack handle: matches "janedoe", rejects "jane-doe". https://regex101.com/?regex=%5E%5BA-Za-z0-9%5D%7B4%2C32%7D%24&flags=&testString=janedoe%0Ajane-doe
const SUBSTACK_HANDLE = /^[A-Za-z0-9]{4,32}$/;
// Accepts text with no control or bidirectional-override character, which could make it read as something else: matches "a teammate", rejects "a\u202Eteammate". https://regex101.com/?regex=%5E%5B%5E%5Cp%7BCc%7D%E2%80%8E%E2%80%8F%E2%80%AA-%E2%80%AE%E2%81%A6-%E2%81%A9%5D%2B%24&flags=u&testString=a%20teammate%0Aa%E2%80%AEteammate
const PLAIN_TEXT = /^[^\p{Cc}\u200E\u200F\u202A-\u202E\u2066-\u2069]+$/u;
// Accepts one leading @: matches "@jack", rejects "jack@". https://regex101.com/?regex=%5E%40&flags=&testString=%40jack%0Ajack%40
const LEADING_AT = /^@/;

const RULES = {
  PROPER_RESPECT: {
    label: "Proper Respect",
    hosts: ["proper-respect.com", "www.proper-respect.com"],
    fromPath: only,
    // The site's own handle rule (src/domain/handle.ts). Handles are lowercase, so a pasted one is lowercased first.
    accepts: handle => handleSchema.safeParse(handle).success && handle === handle.trim(),
    refused: "Enter a Proper Respect handle: up to 39 lowercase letters, numbers or hyphens, starting and ending with a letter or number.",
    href: handle => `${PROPER_RESPECT_ORIGIN}/${encoded(handle)}`,
    at: true,
  },
  X: {
    label: "X",
    hosts: ["x.com", "www.x.com", "mobile.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"],
    fromPath: only,
    // https://help.x.com/en/managing-your-account/x-username-rules (checked 2026-11-15): letters, numbers and
    // underscores, at most 15. The page states no minimum, so one character is allowed (short legacy names exist).
    accepts: handle => X_HANDLE.test(handle),
    refused: "Enter an X handle: up to 15 letters, numbers or underscores.",
    href: handle => `https://x.com/${encoded(handle)}`,
    at: true,
  },
  LINKEDIN: {
    label: "LinkedIn",
    hosts: ["linkedin.com", "www.linkedin.com"],
    fromPath: segments => segments.length === PROFILE_PATH_SEGMENTS && segments[0] === "in" ? segments[1] : undefined,
    // https://www.linkedin.com/help/linkedin/answer/a542685 (checked 2026-11-15): a custom profile URL is 3 to 100
    // characters, with no spaces, symbols or special characters. Hyphens are our reading: LinkedIn's own generated
    // profile links use them, but the page doesn't list them.
    accepts: handle => LINKEDIN_SLUG.test(handle),
    refused: "Enter the part of their LinkedIn profile link after /in/: 3 to 100 letters, numbers or hyphens.",
    href: handle => `https://www.linkedin.com/in/${encoded(handle)}`,
    at: false,
  },
  GITHUB: {
    label: "GitHub",
    hosts: ["github.com", "www.github.com"],
    fromPath: only,
    // The repo's GitHub login rule and reserved paths (src/domain/product-destination.ts). It matches
    // https://docs.github.com/en/enterprise-cloud@latest/admin/managing-iam/iam-configuration-reference/username-considerations-for-external-authentication
    // (checked 2026-11-15): letters, numbers and hyphens, no hyphen first or last, at most 39 on GitHub.com.
    accepts: handle => GITHUB_LOGIN.test(handle) && !GITHUB_MARKETING_PATHS.has(handle.toLowerCase()),
    refused: "Enter a GitHub username: up to 39 letters, numbers or single hyphens, not starting or ending with a hyphen.",
    href: handle => `https://github.com/${encoded(handle)}`,
    at: true,
  },
  YOUTUBE: {
    label: "YouTube",
    hosts: ["youtube.com", "www.youtube.com", "m.youtube.com"],
    fromPath: afterAt,
    // https://support.google.com/youtube/answer/11585688 (checked 2026-11-15): 3 to 30 characters of letters and
    // numbers in any supported language, underscores, hyphens, periods and the Latin middle dot, none of those first
    // or last. Some scripts allow shorter handles (Han and Hangul from 1), so a handle with a non-Latin letter may be
    // 1 or 2 characters; the per-script maximums are not checked.
    accepts: handle => YOUTUBE_HANDLE.test(handle) && [...handle].length <= YOUTUBE_MAX && ([...handle].length >= YOUTUBE_MIN || !LATIN_ONLY.test(handle)),
    refused: "Enter a YouTube handle: 3 to 30 letters, numbers, underscores, hyphens or periods, starting and ending with a letter or number.",
    href: handle => `https://www.youtube.com/@${encoded(handle)}`,
    at: true,
  },
  INSTAGRAM: {
    label: "Instagram",
    hosts: ["instagram.com", "www.instagram.com"],
    fromPath: only,
    // Instagram's help center publishes no username rule (checked 2026-11-15). Secondary sources agree on at most 30
    // letters, numbers, periods and underscores, with no period first, last or twice in a row; that is our rule.
    accepts: handle => INSTAGRAM_USERNAME.test(handle),
    refused: "Enter an Instagram username: up to 30 letters, numbers, periods or underscores, with no period first, last or twice in a row.",
    href: handle => `https://www.instagram.com/${encoded(handle)}/`,
    at: true,
  },
  SUBSTACK: {
    label: "Substack",
    // The profile on substack.com, never a publication's subdomain.
    hosts: ["substack.com", "www.substack.com"],
    fromPath: afterAt,
    // https://support.substack.com/hc/en-us/articles/15574565677204-What-are-Substack-Handles (checked 2026-11-15):
    // letters and numbers only, 4 to 32 characters.
    accepts: handle => SUBSTACK_HANDLE.test(handle),
    refused: "Enter a Substack handle: 4 to 32 letters or numbers, from their substack.com/@ profile.",
    href: handle => `https://substack.com/@${encoded(handle)}`,
    at: true,
  },
} as const satisfies Record<string, PlatformRule>;

type HandlePlatform = keyof typeof RULES;
export type CreditPlatform = HandlePlatform | "OTHER";

/** In the order the owner is offered them: Proper Respect first, Other last. */
export const CREDIT_PLATFORMS: readonly Readonly<{ id: CreditPlatform; label: string }>[] = [
  // Object.keys widens to string[]; RULES' own keys are exactly HandlePlatform.
  ...(Object.keys(RULES) as HandlePlatform[]).map(id => ({ id, label: RULES[id].label })),
  { id: "OTHER", label: "Other" },
];
// The same keys, as the non-empty tuple z.enum needs.
const HANDLE_PLATFORMS = Object.keys(RULES) as [HandlePlatform, ...HandlePlatform[]];
// A slash means a pasted link: no platform's handle can hold one.
const LINK_MARK = "/";

/** The platform an untyped value names, such as a form field's, or undefined when it names none. */
export function creditPlatform(value: unknown): CreditPlatform | undefined {
  return CREDIT_PLATFORMS.find(option => option.id === value)?.id;
}

const plain = (max: number) => (value: string) => value.length <= max && PLAIN_TEXT.test(value);

/** What the owner sent: the platform they picked, what they typed, and, for Other, where. Content is checked by normalizeCredit. */
export const creditInputSchema = z.object({
  platform: z.enum([...HANDLE_PLATFORMS, "OTHER"]),
  handle: z.string().max(CREDIT_INPUT_MAX),
  platformName: z.string().max(CREDIT_INPUT_MAX).optional(),
});
export type CreditInput = z.infer<typeof creditInputSchema>;

// A handle fits when it meets its platform's rule and the link built from it is an http(s) URL, so every layer that
// reads a credit through this schema checks that link as well.
const fits = (platform: HandlePlatform, handle: string) => RULES[platform].accepts(handle) && isHttpUrl(RULES[platform].href(handle));
// A Proper Respect credit links only when, at publish, its handle named a published profile.
const properRespectCredit = z.object({
  platform: z.literal("PROPER_RESPECT"), handle: z.string().refine(handle => fits("PROPER_RESPECT", handle)), linked: z.literal(true).optional(),
});
// filter keeps the tuple's element type but not its non-empty shape, which z.enum needs; five platforms remain.
const handleCredit = z.object({ platform: z.enum(HANDLE_PLATFORMS.filter(id => id !== "PROPER_RESPECT") as [HandlePlatform, ...HandlePlatform[]]), handle: z.string() })
  .refine(credit => fits(credit.platform, credit.handle));
const otherCredit = z.object({
  platform: z.literal("OTHER"),
  handle: z.string().min(1).refine(plain(CREDIT_OTHER_HANDLE_MAX)),
  platformName: z.string().min(1).refine(plain(CREDIT_OTHER_PLATFORM_MAX)),
});

/** A stored or published credit, each handle within its platform's rule. */
export const propsCreditSchema = z.union([properRespectCredit, handleCredit, otherCredit]);
export type PropsCredit =
  | { platform: "PROPER_RESPECT"; handle: string; linked?: true }
  | { platform: Exclude<HandlePlatform, "PROPER_RESPECT">; handle: string }
  | { platform: "OTHER"; handle: string; platformName: string };

export type NormalizedCredit = { ok: true; credit: PropsCredit | undefined } | { ok: false; message: string };

function segmentsOf(pathname: string): string[] | undefined {
  try {
    return pathname.split("/").filter(Boolean).map(segment => decodeURIComponent(segment));
  } catch {
    return undefined;
  }
}

function typedHandle(platform: HandlePlatform, typed: string): NormalizedCredit {
  const rule: PlatformRule = RULES[platform];
  const notAProfile = { ok: false as const, message: `That link isn't a profile on ${rule.label}. Paste their ${rule.label} profile link or just the handle.` };
  let handle = typed.replace(LEADING_AT, "");
  if (typed.includes(LINK_MARK)) {
    const url = parseLooseHttpUrl(typed);
    const segments = url && rule.hosts.includes(url.hostname) ? segmentsOf(url.pathname) : undefined;
    const fromPath = segments && rule.fromPath(segments);
    if (fromPath === undefined) return notAProfile;
    handle = fromPath;
  }
  if (platform === "PROPER_RESPECT") handle = handle.toLowerCase();
  if (!fits(platform, handle)) return { ok: false, message: rule.refused };
  // TypeScript can't pick a union member from a platform it only knows is one of several; each handle platform has this shape.
  return { ok: true, credit: { platform, handle } as PropsCredit };
}

/** The credit a save stores, or a message the owner can act on. A blank handle stores no credit. */
export function normalizeCredit(input: CreditInput | undefined): NormalizedCredit {
  const typed = input?.handle.trim();
  if (!input || !typed) return { ok: true, credit: undefined };
  if (input.platform !== "OTHER") return typedHandle(input.platform, typed);
  if (!plain(CREDIT_OTHER_HANDLE_MAX)(typed)) {
    return { ok: false, message: `Keep their name or handle to ${CREDIT_OTHER_HANDLE_MAX} characters, in plain text.` };
  }
  const platformName = input.platformName?.trim() ?? "";
  if (!platformName || !plain(CREDIT_OTHER_PLATFORM_MAX)(platformName)) {
    return { ok: false, message: `Say where they are, in ${CREDIT_OTHER_PLATFORM_MAX} characters or fewer.` };
  }
  return { ok: true, credit: { platform: "OTHER", handle: typed, platformName } };
}

/** A stored or published credit as a card may show it, or undefined when it no longer fits its platform's rule. */
export function listedCredit(stored: unknown): PropsCredit | undefined {
  const parsed = propsCreditSchema.safeParse(stored);
  // The schema's handle-platform arm types its platform as any handle platform; its refinements make the value a PropsCredit.
  return parsed.success ? parsed.data as PropsCredit : undefined;
}

/** The credit's link: the platform's host and the encoded handle. Other, and an unpublished Proper Respect handle, have none. */
export function creditHref(stored: unknown): string | undefined {
  const credit = listedCredit(stored);
  if (!credit || credit.platform === "OTHER" || (credit.platform === "PROPER_RESPECT" && !credit.linked)) return undefined;
  const href = RULES[credit.platform].href(credit.handle);
  return isHttpUrl(href) ? href : undefined;
}

/** The words a card shows after "Props to": who, and where. */
export function creditText(credit: PropsCredit): { name: string; platform: string } {
  if (credit.platform === "OTHER") return { name: credit.handle, platform: credit.platformName };
  const rule = RULES[credit.platform];
  return { name: rule.at ? `@${credit.handle}` : credit.handle, platform: rule.label };
}
