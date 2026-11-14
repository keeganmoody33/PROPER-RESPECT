import { describe, expect, it } from "vitest";
import { brandCardKit } from "./brand-kit";
import { HOMEPAGE_BRANDS, HOMEPAGE_SITE_TRAITS } from "@/src/data/homepage-brands";

/** Each homepage brand's kit with its measured site file, on the card colours the provider gave it. */
function kit(slug: string, withSite = true) {
  const brand = HOMEPAGE_BRANDS[slug], { background, text } = brand.styleguide!.colors;
  return brandCardKit(brand, background!, text!, withSite ? HOMEPAGE_SITE_TRAITS[slug] : undefined);
}
const kits = (key: string) => Object.fromEntries(Object.keys(HOMEPAGE_BRANDS).map(slug => [slug, kit(slug)[key as keyof ReturnType<typeof kit>]]));

describe("a brand without a site file", () => {
  it("gets exactly the kit it got before site files existed", () => {
    // Recorded at 2ba6aa8, before any rule read a site file.
    expect(Object.fromEntries(Object.keys(HOMEPAGE_BRANDS).map(slug => [slug, kit(slug, false)]))).toEqual({
    "clay": { "--brand-card-border": "#c7c7c7", "--brand-card-radius": "18px", "--brand-card-button-fill": "#000000", "--brand-card-button-text": "#ffffff", "--brand-card-button-radius": "12px", "--brand-card-button-weight": "500", "--brand-card-chart": "#3859f9", "--brand-card-quiet-fill": "#f3f2ed", "--brand-card-quiet-text": "#000000" },
    "cloudflare": { "--brand-card-border": "#cfcfcf", "--brand-card-radius": "4px", "--brand-card-button-fill": "#ff5e1f", "--brand-card-button-text": "#262626", "--brand-card-button-radius": "9999px", "--brand-card-button-weight": "500", "--brand-card-chart": "#ff5e1f" },
    "context-dev": { "--brand-card-border": "#c7c7c7", "--brand-card-radius": "7.2px", "--brand-card-button-fill": "#2563eb", "--brand-card-button-text": "#ffffff", "--brand-card-button-radius": "9999px", "--brand-card-button-weight": "400", "--brand-card-chart": "#2563eb" },
    "docker": { "--brand-card-border": "#ccced2", "--brand-card-radius": "18px", "--brand-card-button-fill": "#2560ff", "--brand-card-button-text": "#ffffff", "--brand-card-button-radius": "8px", "--brand-card-button-weight": "500", "--brand-card-chart": "#2560ff", "--brand-card-quiet-fill": "#ffffff", "--brand-card-quiet-text": "#000000" },
    "elicit": { "--brand-card-border": "#c5c5c1", "--brand-card-radius": "8px", "--brand-card-button-fill": "#083d44", "--brand-card-button-text": "#ffffff", "--brand-card-button-radius": "8px", "--brand-card-button-weight": "400", "--brand-card-chart": "#083d44" },
    "exa": { "--brand-card-border": "#c7c7c7", "--brand-card-radius": "4px", "--brand-card-button-fill": "#000000", "--brand-card-button-text": "#ffffff", "--brand-card-button-radius": "4px", "--brand-card-button-weight": "500", "--brand-card-chart": "#1f40ed", "--brand-card-quiet-fill": "#1f40ed", "--brand-card-quiet-text": "#ffffff" },
    "firecrawl": { "--brand-card-border": "#cbcbcb", "--brand-card-radius": "8px", "--brand-card-button-fill": "#ff4c00", "--brand-card-button-text": "#262626", "--brand-card-button-radius": "20px", "--brand-card-button-weight": "450", "--brand-card-chart": "#ff4c00", "--brand-card-quiet-fill": "#000000", "--brand-card-quiet-text": "#ffffff" },
    "github": { "--brand-card-border": "#c7c7c7", "--brand-card-radius": "8px", "--brand-card-button-fill": "#08872b", "--brand-card-button-text": "#ffffff", "--brand-card-button-radius": "6px", "--brand-card-button-weight": "500", "--brand-card-chart": "#0d6731" },
    "n8n": { "--brand-card-border": "#c8c8c8", "--brand-card-radius": "8px", "--brand-card-button-fill": "#ffbcca", "--brand-card-button-text": "#212121", "--brand-card-button-radius": "9999px", "--brand-card-button-weight": "400", "--brand-card-chart": "#161616", "--brand-card-quiet-fill": "#d9d9d9", "--brand-card-quiet-text": "#161616" },
    "open-places": { "--brand-card-border": "#c8c7c1", "--brand-card-radius": "22px", "--brand-card-button-fill": "#3f5a2c", "--brand-card-button-text": "#ffffff", "--brand-card-button-radius": "12px", "--brand-card-button-weight": "600", "--brand-card-chart": "#3f5a2c" },
    "porkbun": { "--brand-card-border": "#c6c2c2", "--brand-card-radius": "8px", "--brand-card-button-fill": "#ef7878", "--brand-card-button-text": "#000000", "--brand-card-button-radius": "3px", "--brand-card-button-weight": "400", "--brand-card-chart": "#000000", "--brand-card-quiet-fill": "#ffffff", "--brand-card-quiet-text": "#222222" },
    "spider": { "--brand-card-border": "#374151", "--brand-card-radius": "8px", "--brand-card-button-fill": "#f8fafc", "--brand-card-button-text": "#0c0e13", "--brand-card-button-radius": "0px", "--brand-card-button-weight": "400", "--brand-card-chart": "#24c45c" },
    });
  });
});

describe("corners", () => {
  it("take the site's measured panel and button corners, square included, with a pill kept a pill", () => {
    expect(kits("--brand-card-radius")).toEqual({
      // Clay's 48px, Context.dev's 25.2px and n8n's 34px panels are held to the card's 24px most.
      clay: "24px", "context-dev": "24px", n8n: "24px", docker: "0px", spider: "0px", exa: "6px", firecrawl: "20px", github: "8px", "open-places": "18px",
      // No bordered panel was measured on Cloudflare's or Elicit's first screen, and Porkbun has no site file: the stored radius stays.
      cloudflare: "4px", elicit: "8px", porkbun: "8px",
    });
    expect(kits("--brand-card-button-radius")).toEqual({
      clay: "12px", "context-dev": "999px", n8n: "999px", docker: "8px", spider: "0px", exa: "4px", firecrawl: "10px", github: "6px", "open-places": "999px",
      cloudflare: "999px", elicit: "8px", porkbun: "3px",
    });
  });
});
