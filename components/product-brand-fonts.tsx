import type { CSSProperties } from "react";
import {
  genericFontFamilies,
  productBrandFontFamilyKey,
  productBrandSnapshotSchema,
  type ProductBrandSnapshot,
} from "@/src/domain/product-brand";

type TypographyProperties = CSSProperties & Partial<Record<`--brand-card-${string}`, string>>;

function retainedTypography(snapshot?: ProductBrandSnapshot) {
  const style: TypographyProperties = {};
  const faces: string[] = [];
  const parsed = productBrandSnapshotSchema.safeParse(snapshot);
  // V1 contains family metadata only. Keep its established card fallbacks.
  if (!parsed.success || parsed.data.schemaVersion !== 2) return { style, faces };
  const brand = parsed.data;
  for (const name of ["heading", "body"] as const) {
    const family = name === "heading" ? brand.styleguide?.headingFamily : brand.styleguide?.bodyFamily;
    const role = brand.styleguide?.typography?.[name] ?? (family ? { family, fallbacks: [] } : undefined);
    if (!role) continue;
    const key = productBrandFontFamilyKey(role.family);
    const links = brand.fontLinks.filter((link) => productBrandFontFamilyKey(link.family) === key)
      .sort((a, b) => Number(b.source === "styleguide") - Number(a.source === "styleguide"));
    const files = [...new Map(links.flatMap((link) => link.files).reverse().map((file) => [file.weight, file])).values()];
    const alias = `PRBrand-${brand.productSlug}-${brand.responseHash.slice(0, 16)}-${name}`;
    for (const file of files) {
      faces.push(`@font-face{font-family:"${alias}";src:url("${file.url}") format("${file.format}");font-weight:${file.weight};font-style:normal;font-display:swap;}`);
    }
    const observedFallbacks = brand.fonts.find((font) => productBrandFontFamilyKey(font.family) === key)?.fallbacks ?? [];
    const category = links.find((link) => link.category && genericFontFamilies.has(link.category))?.category;
    const families = [role.family, ...role.fallbacks, ...observedFallbacks, ...(category ? [category] : [])];
    // Every stack ends in a browser-available fallback even when asset loading fails.
    if (!families.some((item) => genericFontFamilies.has(productBrandFontFamilyKey(item)))) {
      families.push(...(name === "heading" ? ["Georgia", "Times New Roman", "serif"] : ["Arial", "Helvetica", "sans-serif"]));
    }
    const unique = [...new Map(families.map((item) => [productBrandFontFamilyKey(item), item])).values()];
    style[`--brand-card-${name}-font`] = [
      ...(files.length ? [`"${alias}"`] : []),
      ...unique.map((item) => genericFontFamilies.has(productBrandFontFamilyKey(item)) ? productBrandFontFamilyKey(item) : `"${item}"`),
    ].join(", ");
    if (role.weight !== undefined) style[`--brand-card-${name}-weight`] = String(role.weight);
    if (role.lineHeight !== undefined) style[`--brand-card-${name}-leading`] = String(role.lineHeight);
    if (role.letterSpacingEm !== undefined) style[`--brand-card-${name}-tracking`] = `${role.letterSpacingEm}em`;
  }
  return { style, faces };
}

/** Variables inherit only within the card receiving them; sampled page sizes are not applied. */
export function productBrandTypography(snapshot?: ProductBrandSnapshot): TypographyProperties {
  return retainedTypography(snapshot).style;
}

/** Fixed font-face declarations only: no provider lookup, script, stylesheet, or global selector. */
export function ProductBrandFonts({ snapshot }: { snapshot?: ProductBrandSnapshot }) {
  const { faces } = retainedTypography(snapshot);
  return faces.length ? <style data-product-brand-fonts={snapshot?.retrievalId}>{faces.join("\n")}</style> : null;
}
