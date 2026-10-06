import { z } from "zod";

// A usage link: the owner's work-sample link, shown on the back of a card
// under a label they pick, like a Loom of them building in Clay. Only the link
// is kept. Nothing is copied, embedded or played on this site.

export const USAGE_LINK_LABELS = ["SEE_HOW_I_USE_IT", "WATCH_IT_IN_ACTION", "PROOF_OF_USE", "DEMO", "TUTORIAL"] as const;
export type UsageLinkLabel = (typeof USAGE_LINK_LABELS)[number];
export const DEFAULT_USAGE_LINK_LABEL: UsageLinkLabel = "SEE_HOW_I_USE_IT";
const LABEL_TEXT: Record<UsageLinkLabel, string> = {
  SEE_HOW_I_USE_IT: "See how I use it",
  WATCH_IT_IN_ACTION: "Watch it in action",
  PROOF_OF_USE: "Proof of use",
  DEMO: "Demo",
  TUTORIAL: "Tutorial",
};

export function usageLinkLabelText(label: UsageLinkLabel) {
  return LABEL_TEXT[label];
}

// The private work-sample field's rule (src/domain/inventory.ts): https, no
// credentials, at most 2,048 characters. Zod still runs a refine after a
// failed url check, so the parse must not throw on text that isn't a URL.
export const usageLinkUrlSchema = z.string().url().max(2048).refine(value => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}, "Use an https link without embedded credentials.");

export const usageLinkSchema = z.object({
  url: usageLinkUrlSchema,
  label: z.enum(USAGE_LINK_LABELS),
});
export type UsageLink = z.infer<typeof usageLinkSchema>;

/** Where the link goes, shown under its label: the host without "www.". */
export function usageLinkHost(url: string) {
  return new URL(url).hostname.replace(/^www\./, "");
}
