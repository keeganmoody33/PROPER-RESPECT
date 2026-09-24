import previousIcons from "../../public/product-assets/2026-09-21-product-icons.json";
import exactIcons from "../../public/product-assets/2026-09-22-product-icons.json";

import usageIcons from "../../public/product-assets/2026-09-24-product-icons.json";

const icons = [...previousIcons, ...exactIcons, ...usageIcons];

export type ProductIcon = (typeof icons)[number];

// Presentation only. A similar name or parent domain cannot identify a product.
export function officialProductIcon(product: { slug: string; domain: string }): ProductIcon | undefined {
  return icons.find(icon => icon.productSlug === product.slug && icon.canonicalDomain === product.domain);
}
