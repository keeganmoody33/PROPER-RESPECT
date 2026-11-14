import { describe, expect, it } from "vitest";
import { brandCardKit, brandMark } from "./brand-kit";
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

describe("the button", () => {
  it("takes the fill and label of the site's primary call-to-action when it shows on the card, else falls back as before", () => {
    const buttons = Object.fromEntries(Object.keys(HOMEPAGE_BRANDS).map(slug => [slug, [kit(slug)["--brand-card-button-fill"], kit(slug)["--brand-card-button-text"]]]));
    expect(buttons).toEqual({
      // The site's own call-to-action: Clay's lime, Context.dev's black pill, Elicit's lighter teal.
      clay: ["#cbd810", "#000000"], "context-dev": ["#000000", "#ffffff"], elicit: ["#026370", "#fcfcf8"],
      docker: ["#2560ff", "#ffffff"], exa: ["#000000", "#ffffff"], github: ["#08872b", "#ffffff"], n8n: ["#ffbcca", "#212121"], "open-places": ["#3f5a2c", "#ffffff"], spider: ["#f8fafc", "#0c0e13"],
      // White on Firecrawl's orange is 3.3:1, under the 4.5:1 floor, so the label stays the card's text colour.
      firecrawl: ["#ff4c00", "#262626"],
      // Cloudflare's call-to-action is white on its orange hero and would vanish on the white card, so the fallback holds.
      cloudflare: ["#ff5e1f", "#262626"],
      porkbun: ["#ef7878", "#000000"],
    });
  });

  it("takes the site's button outline, type, case and letter-spacing", () => {
    expect(kit("docker")["--brand-card-button-border"]).toBe("#000000");
    expect(kit("clay")).not.toHaveProperty("--brand-card-button-border");
    expect(kits("--brand-card-button-case")).toEqual({
      spider: "uppercase", n8n: "uppercase", clay: "none", cloudflare: "none", "context-dev": "none", docker: "none", elicit: "none", exa: "none", firecrawl: "none", github: "none", "open-places": "none",
      porkbun: undefined,
    });
    expect(kits("--brand-card-button-tracking")).toMatchObject({ spider: "0.14em", n8n: "0.02em", clay: "-0.01em", exa: "-0.02em", firecrawl: "0em", porkbun: undefined });
    expect(kits("--brand-card-button-font")).toEqual({
      // Spider's Berkeley and n8n's Baumer Mono have no file the provider stored, so the card uses a system monospace face.
      spider: 'ui-monospace, "SF Mono", Menlo, monospace', n8n: 'ui-monospace, "SF Mono", Menlo, monospace',
      // Every other measured button is set in the family the card already loads for its body text.
      clay: "var(--brand-card-body-font)", cloudflare: "var(--brand-card-body-font)", "context-dev": "var(--brand-card-body-font)", docker: "var(--brand-card-body-font)",
      elicit: "var(--brand-card-body-font)", exa: "var(--brand-card-body-font)", firecrawl: "var(--brand-card-body-font)", github: "var(--brand-card-body-font)", "open-places": "var(--brand-card-body-font)",
      porkbun: undefined,
    });
  });
});

describe("the signature colour", () => {
  it("draws the chart when it differs from the provider's accent, falling back to the site's hero colour, then the provider's, then the text", () => {
    expect(kits("--brand-card-chart")).toEqual({
      // Spider's heading green, Elicit's call-to-action teal and GitHub's sign-up green differ from the provider's accent by more than 0.05.
      spider: "#3bde77", elicit: "#026370", github: "#08872b",
      // Clay's lime call-to-action is 1.6:1 on its white card, under the 3:1 bars need, so the bars take its green hero.
      clay: "#035d44",
      // Cloudflare's logo orange is the provider's accent within 0.05, so the provider's stays.
      cloudflare: "#ff5e1f", "context-dev": "#2563eb", docker: "#2560ff", exa: "#1f40ed", firecrawl: "#ff4c00", "open-places": "#3f5a2c",
      // n8n's signature is the provider's pink, 1.5:1 on the card: the bars keep the card's text colour, and Porkbun has no site file.
      n8n: "#161616", porkbun: "#000000",
    });
  });

  it("colours the link glyph only where it reads as text, 4.5:1", () => {
    const glyph = (slug: string) => {
      const brand = HOMEPAGE_BRANDS[slug];
      return brandMark(brand, brand.styleguide!.colors.background!, 4.5, HOMEPAGE_SITE_TRAITS[slug]);
    };
    expect([glyph("spider"), glyph("elicit"), glyph("github"), glyph("clay"), glyph("n8n"), glyph("firecrawl")]).toEqual(["#3bde77", "#026370", "#08872b", "#035d44", undefined, undefined]);
  });
});

describe("the small labels", () => {
  it("take the site's small-label type, case and letter-spacing", () => {
    const mono = 'ui-monospace, "SF Mono", Menlo, monospace', body = "var(--brand-card-body-font)";
    expect(kits("--brand-card-label-font")).toEqual({
      spider: mono, n8n: mono,
      clay: body, "context-dev": body, docker: body, exa: body, firecrawl: body, github: body, "open-places": body,
      // No small labels were measured on Cloudflare's or Elicit's first screen.
      cloudflare: undefined, elicit: undefined, porkbun: undefined,
    });
    expect(kits("--brand-card-label-case")).toEqual({
      spider: "uppercase", n8n: "uppercase",
      clay: "none", "context-dev": "none", docker: "none", exa: "none", firecrawl: "none", github: "none", "open-places": "none",
      cloudflare: undefined, elicit: undefined, porkbun: undefined,
    });
    expect(kits("--brand-card-label-tracking")).toEqual({
      spider: "0.14em", n8n: "0.02em", clay: "0em", "context-dev": "0em", docker: "-0.011em", exa: "-0.02em", firecrawl: "0em", github: "0.015em", "open-places": "0em",
      cloudflare: undefined, elicit: undefined, porkbun: undefined,
    });
  });
});

describe("the hero band", () => {
  it("is drawn only for a site whose first heading sits on a full-bleed colour, in that colour with a label that reads on it", () => {
    const bands = Object.fromEntries(Object.keys(HOMEPAGE_BRANDS).flatMap(slug => {
      const { "--brand-card-band": band, "--brand-card-band-text": label } = kit(slug);
      return band ? [[slug, [band, label]]] : [];
    }));
    // Clay's heading sits on its green hero section; black on it is 2.6:1, so its label is white.
    // Cloudflare's sits on a 99%-wide orange panel, where its #262626 text is 5.1:1.
    // Docker's dark hero panel is 81% of the width, so it is no band.
    expect(bands).toEqual({ clay: ["#035d44", "#ffffff"], cloudflare: ["#ff5e1f", "#262626"] });
  });
});
