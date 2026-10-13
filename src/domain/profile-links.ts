import { z } from "zod";
import { isHttpUrl } from "./http-url.ts";

export const PROFILE_LINK_LIMIT = 8;

/**
 * Only http and https links without embedded credentials are published or
 * rendered; javascript:, data:, user:pass@ and the rest never are.
 * Scheme checks live in src/domain/http-url.ts.
 */
// Zod still runs this refine after a failed url check, so it must not throw.
export const profileLinkUrlSchema = z.string().trim().max(2048).url()
  .refine(isHttpUrl, "Use an http or https link without embedded credentials.");
export const profileLinksSchema = z.array(z.object({
  label: z.string().trim().min(1).max(60),
  url: profileLinkUrlSchema,
})).max(PROFILE_LINK_LIMIT);

export function validateProfileLinks(links: unknown, preferredLinkUrl?: string) {
  const profileLinks = profileLinksSchema.parse(links);
  const preferred = preferredLinkUrl === undefined ? undefined : profileLinkUrlSchema.parse(preferredLinkUrl);
  if (preferred && !profileLinks.some(link => link.url === preferred)) {
    throw new Error("Choose your name destination from your saved profile links.");
  }
  return { profileLinks, preferredLinkUrl: preferred };
}
