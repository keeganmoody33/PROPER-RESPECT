import { z } from "zod";
import { USE_OPTIONS, type UseOption } from "./product-use-options.ts";

// What a product does for its owner: ids from that product's USE_OPTIONS plus one line of their own.

export const USE_OTHER_MAX = 60;
export const USE_PICKS_MAX = 6;
export const USE_PICK_ID_MAX = 40;
const REFUSED_PICK = "Choose from the listed uses.";

// Shape only: which ids a product offers is checked by normalizeUses.
export const productUsesSchema = z.object({
  picks: z.array(z.string().max(USE_PICK_ID_MAX)).max(USE_PICKS_MAX),
  other: z.string().trim().max(USE_OTHER_MAX).optional(),
});
export type ProductUses = z.infer<typeof productUsesSchema>;

export type NormalizedUses = { ok: true; uses: ProductUses | undefined } | { ok: false; message: string };

export function productUseOptions(productSlug: string): readonly UseOption[] {
  return Object.hasOwn(USE_OPTIONS, productSlug) ? USE_OPTIONS[productSlug] : [];
}

export function normalizeUses(productSlug: string, uses: ProductUses | undefined): NormalizedUses {
  if (!uses) return { ok: true, uses: undefined };
  const options = productUseOptions(productSlug);
  if (!uses.picks.every(id => options.some(option => option.id === id))) return { ok: false, message: REFUSED_PICK };
  return { ok: true, uses: listedUses(productSlug, uses) };
}

// What a card can show: picks the product still lists, in its order, and the owner's trimmed words.
export function listedUses(productSlug: string, uses: ProductUses | undefined): ProductUses | undefined {
  if (!uses) return undefined;
  const picks = productUseOptions(productSlug).filter(option => uses.picks.includes(option.id)).map(option => option.id);
  const other = uses.other?.trim();
  if (!picks.length && !other) return undefined;
  return other ? { picks, other } : { picks };
}

export function productUseLabels(productSlug: string, uses: ProductUses | undefined): string[] {
  if (!uses) return [];
  const labels = productUseOptions(productSlug).filter(option => uses.picks.includes(option.id)).map(option => option.label);
  const other = uses.other?.trim();
  return other && !labels.includes(other) ? [...labels, other] : labels;
}
