// Caps on text a publication can make public. Lengths count UTF-16 code units,
// like the other limits here (product names, `z.string().max`) and a browser's
// `maxLength`.

export const DISPLAY_NAME_MAX = 80;
export const BIO_MAX = 500;
// Above the longest default label, `Open ${name}` for a 160-character name.
export const LINK_LABEL_MAX = 200;
export const PUBLISHED_URL_MAX = 2048;

/** Trims, then keeps at most `max` code units without splitting a character. */
export function trimToLength(value: string, max: number) {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  let cut = trimmed.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1);
  return cut.trimEnd();
}
