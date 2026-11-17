import { productUseOptions } from "@/src/domain/product-uses";
import type { RelationshipLevel, RelationshipStatus } from "@/src/domain/relationship-level";
import { suggestedHeadline } from "@/src/domain/suggested-headline";

const YEAR_LENGTH = 4;

/**
 * The owner's headline as they left it: their saved line, or null while they haven't touched the field. Null is what lets
 * a suggestion show without ever counting as theirs.
 */
export function initialOwnerHeadline(saved: string): string | null {
  return saved.trim() ? saved : null;
}

/** What the field shows and what a save sends. An untouched suggestion is shown but saves nothing. */
export function headlineField(owner: string | null, suggestion: string | undefined) {
  return { value: owner ?? suggestion ?? "", suggested: owner === null && Boolean(suggestion), toSave: owner ?? "" };
}

/**
 * A suggested first line for a product whose uses the owner can pick; for any other product, the same line as an example
 * placeholder. A discovery gets neither until its owner picks a level: its status is the system's guess, not an answer.
 */
export function headlineHelp(input: {
  productName: string; productSlug: string; confirmed: boolean; status: RelationshipStatus; level?: RelationshipLevel;
  uses: readonly string[]; startedAt: string;
}): { suggestion?: string; placeholder?: string } {
  if (!input.confirmed && !input.level) return {};
  const year = Number(input.startedAt.slice(0, YEAR_LENGTH));
  const line = suggestedHeadline({ productName: input.productName, level: input.level, status: input.status, uses: input.uses,
    ...(input.startedAt && Number.isInteger(year) ? { sinceYear: year } : {}) });
  return productUseOptions(input.productSlug).length ? { suggestion: line } : { placeholder: line };
}
