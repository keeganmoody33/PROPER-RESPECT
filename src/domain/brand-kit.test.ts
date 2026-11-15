import { describe, expect, it } from "vitest";
import { brandAccent, brandCardKit, contrast, headlineAccentColour } from "./brand-kit";
import { normalizeProductBrand } from "./product-brand";
import { HOMEPAGE_BRANDS } from "@/src/data/homepage-brands";

/** A stored snapshot for a product whose site has these colours and component styles. */
function stored(colors: Record<string, string>, components?: unknown) {
  return normalizeProductBrand({
    productSlug: "example", canonicalDomain: "example.com", retrievalId: "kit-2026-11-13", retrievedAt: "2026-11-13T12:00:00.000Z", responseHash: "a".repeat(64),
  }, {
    brand: { status: "ok", brand: { domain: "example.com", logos: [], colors: [] } },
    styleguide: { status: "ok", domain: "example.com", styleguide: { mode: "light", colors, ...(components ? { components } : {}) } },
  });
}

// Read from each product's site on 2026-11-13.
const firecrawl = stored({ accent: "#ff4c00", background: "#f9f9f9", text: "#262626" }, {
  card: { backgroundColor: "#f9f9f9", borderColor: "#e5e7eb", borderRadius: "8px", padding: "16px", textColor: "#262626" },
  button: { primary: { backgroundColor: "#ff4c00", color: "#ffffff", borderRadius: "20px", fontWeight: 450 }, secondary: { backgroundColor: "#000000", color: "#ffffff", borderRadius: "20px" } },
});
const cloudflare = stored({ accent: "#ff5e1f", background: "#ffffff", text: "#262626" }, {
  card: { backgroundColor: "#ff5e1f", borderColor: "#f0f0f0", borderRadius: "4px", padding: "32px", textColor: "#ffffff" },
  button: { primary: { backgroundColor: "#ffffff", color: "#1f1f1f", borderColor: "#ffffff", borderRadius: "9999px", fontWeight: 500 }, secondary: { backgroundColor: "#ffffff", color: "#1f1f1f", borderRadius: "9999px" } },
});
const clay = stored({ accent: "#3859f9", background: "#ffffff", text: "#000000" }, {
  card: { backgroundColor: "#fefdfb", borderColor: "#ffffff", borderRadius: "18px", padding: "16px 20px", textColor: "#000000" },
  button: { primary: { backgroundColor: "#000000", color: "#ffffff", borderRadius: "12px", fontWeight: 500 }, secondary: { backgroundColor: "#f3f2ed", color: "#000000", borderRadius: "12px" } },
});

describe("brandCardKit", () => {
  it("keeps a stored button that shows on the card, in its own shape and weight", () => {
    expect(brandCardKit(firecrawl, "#f9f9f9", "#262626")).toEqual({
      // Its own border (#e5e7eb) is too faint to define the card's edge, so one is drawn from its text colour.
      "--brand-card-border": "#cbcbcb", "--brand-card-radius": "8px",
      // White on this orange is 3.3:1, too low for the button's small text: the orange deepens 16%, as little as makes its white label read 4.5:1.
      "--brand-card-button-fill": "#d64000", "--brand-card-button-text": "#ffffff", "--brand-card-button-radius": "20px", "--brand-card-button-weight": "450",
      "--brand-card-quiet-fill": "#000000", "--brand-card-quiet-text": "#ffffff",
      // The accent is 3.2:1 on the card: too faint for text, enough for bars.
      "--brand-card-chart": "#ff4c00",
    });
  });

  it("gives the button the brand's accent when the stored one would vanish on the card", () => {
    // Cloudflare's first button sits on its orange hero, so it is white: invisible on a white card.
    const kit = brandCardKit(cloudflare, "#ffffff", "#262626");
    expect(kit["--brand-card-button-fill"]).toBe("#ff5e1f");
    expect(kit["--brand-card-button-text"]).toBe("#262626");
    expect(kit["--brand-card-button-radius"]).toBe("9999px");
    expect(kit["--brand-card-radius"]).toBe("4px");
    expect(kit).not.toHaveProperty("--brand-card-quiet-fill");
  });

  it("always draws a border that shows, even when the stored one matches the card", () => {
    for (const [snapshot, surface, text] of [[clay, "#ffffff", "#000000"], [cloudflare, "#ffffff", "#262626"], [firecrawl, "#f9f9f9", "#262626"], [undefined, "#171713", "#f0eee7"]] as const) {
      const border = brandCardKit(snapshot, surface, text)["--brand-card-border"]!;
      expect(contrast(border, surface)).toBeGreaterThanOrEqual(1.3);
    }
    const strong = stored({ background: "#ffffff", text: "#111111" }, { card: { borderColor: "#8a8a8a" } });
    expect(brandCardKit(strong, "#ffffff", "#111111")["--brand-card-border"]).toBe("#8a8a8a");
    expect(brandCardKit(clay, "#ffffff", "#000000")["--brand-card-border"]).not.toBe("#ffffff");
  });

  it("uses the quiet button when it shows, and never a label that can't be read on its fill", () => {
    const kit = brandCardKit(clay, "#ffffff", "#000000");
    expect(kit).toMatchObject({ "--brand-card-button-fill": "#000000", "--brand-card-button-text": "#ffffff", "--brand-card-quiet-fill": "#f3f2ed", "--brand-card-quiet-text": "#000000", "--brand-card-radius": "18px" });
    const unreadable = stored({ accent: "#ffb000", background: "#ffffff", text: "#111111" }, { button: { primary: { backgroundColor: "#ffb000", color: "#ffe9a0" } } });
    expect(brandCardKit(unreadable, "#ffffff", "#111111")["--brand-card-button-text"]).toBe("#111111");
  });

  it("never puts a label on a button that small text can't be read on", () => {
    // The card's button text is 0.7rem, so it needs 4.5:1, not the 3:1 that large text gets.
    for (const [snapshot, surface, text] of [[firecrawl, "#f9f9f9", "#262626"], [cloudflare, "#ffffff", "#262626"], [clay, "#ffffff", "#000000"]] as const) {
      const kit = brandCardKit(snapshot, surface, text);
      expect(contrast(kit["--brand-card-button-text"]!, kit["--brand-card-button-fill"]!), snapshot.canonicalDomain).toBeGreaterThanOrEqual(4.5);
      if (kit["--brand-card-quiet-fill"]) expect(contrast(kit["--brand-card-quiet-text"]!, kit["--brand-card-quiet-fill"])).toBeGreaterThanOrEqual(4.5);
    }
    // A dark card with white text and a white button: the card's text can't be the fallback label.
    const whiteButton = stored({ background: "#101010", text: "#ffffff" }, { button: { primary: { backgroundColor: "#ffffff", color: "#fafafa" } } });
    expect(brandCardKit(whiteButton, "#101010", "#ffffff")).toMatchObject({ "--brand-card-button-fill": "#ffffff", "--brand-card-button-text": "#000000" });
  });

  it("darkens a derived border until it shows, down to the card's text colour", () => {
    // Grey text on black: a light mix of it is still nearly black.
    const border = brandCardKit(stored({ background: "#000000", text: "#757575" }), "#000000", "#757575")["--brand-card-border"]!;
    expect(contrast(border, "#000000")).toBeGreaterThanOrEqual(1.3);
  });

  it("keeps the default outlined button for a brand stored before button values were kept, even with an accent", () => {
    // Until the hourly re-fetch reaches it, such a brand has an accent and no components.
    const legacy = stored({ accent: "#123456", background: "#ffffff", text: "#111111" });
    expect(Object.keys(brandCardKit(legacy, "#ffffff", "#111111"))).toEqual(["--brand-card-border", "--brand-card-chart"]);
  });

  it("leaves buttons alone when the brand has nothing that shows, and does nothing without solid card colours", () => {
    const plain = stored({ background: "#ffffff", text: "#111111" });
    expect(Object.keys(brandCardKit(plain, "#ffffff", "#111111"))).toEqual(["--brand-card-border", "--brand-card-chart"]);
    expect(brandCardKit(firecrawl, "rgba(0,0,0,0)", "#262626")).toEqual({});
    expect(brandCardKit(firecrawl, "#f9f9f9", "#26262680")).toEqual({});
  });

  it("draws a chart in the brand's accent when its bars show on the card, and in the card's text colour when they would not", () => {
    // Bars are marks, not text: they need 3:1 against the card (WCAG 1.4.11).
    const charts = Object.fromEntries(Object.entries(HOMEPAGE_BRANDS).map(([slug, brand]) => {
      const { background, text } = brand.styleguide!.colors;
      return [slug, brandCardKit(brand, background!, text!)["--brand-card-chart"]];
    }));
    expect(charts).toEqual({
      clay: "#3859f9", cloudflare: "#ff5e1f", "context-dev": "#2563eb", docker: "#2560ff", elicit: "#083d44", exa: "#1f40ed",
      // Spider's site accent is slate, a grey; its bars take the green of its logo, as its site's highlights do.
      firecrawl: "#ff4c00", github: "#0d6731", "open-places": "#3f5a2c", spider: "#24c45c",
      // n8n's pink is 1.5:1 on its card and Porkbun's coral 2.6:1, so their bars take the card's text colour.
      n8n: "#161616", porkbun: "#000000",
    });
    expect(brandCardKit(stored({ background: "#ffffff", text: "#111111" }), "#ffffff", "#111111")["--brand-card-chart"]).toBe("#111111");
  });

  it("lets a square brand's card be square", () => {
    const square = stored({ background: "#0c0e13", text: "#f8fafc" }, { card: { borderRadius: "0px" } });
    expect(brandCardKit(square, "#0c0e13", "#f8fafc")["--brand-card-radius"]).toBe("0px");
  });

  it("fills the button from the site's other stored button when the first has no fill that shows", () => {
    // GitHub's first stored button is an outline; its green sign-up button is stored second.
    const kit = brandCardKit(HOMEPAGE_BRANDS.github, "#ffffff", "#000000");
    expect(kit).toMatchObject({ "--brand-card-button-fill": "#08872b", "--brand-card-button-text": "#ffffff" });
    expect(kit).not.toHaveProperty("--brand-card-quiet-fill");
  });
});

describe("brandAccent", () => {
  it("keeps a site accent with colour, and replaces a grey one with the brand's most colourful colour that shows", () => {
    const accents = Object.fromEntries(Object.entries(HOMEPAGE_BRANDS).map(([slug, brand]) => [slug, brandAccent(brand, brand.styleguide!.colors.background!)]));
    expect(accents).toEqual({
      clay: { hex: "#3859f9", source: "site accent" }, cloudflare: { hex: "#ff5e1f", source: "site accent" },
      "context-dev": { hex: "#2563eb", source: "site accent" }, docker: { hex: "#2560ff", source: "site accent" },
      elicit: { hex: "#083d44", source: "site accent" }, exa: { hex: "#1f40ed", source: "site accent" },
      firecrawl: { hex: "#ff4c00", source: "site accent" }, github: { hex: "#0d6731", source: "site accent" },
      n8n: { hex: "#ffbcca", source: "site accent" }, "open-places": { hex: "#3f5a2c", source: "site accent" },
      porkbun: { hex: "#ef7878", source: "site accent" },
      // Slate #94a3b8 has an OKLCH chroma of 0.035; the logo's #24c45c (0.19) is the most colourful brand colour at 3:1 on the card.
      spider: { hex: "#24c45c", source: "logo colour" },
    });
  });

  it("keeps a grey accent when no brand colour has colour and shows on the card", () => {
    const grey = stored({ accent: "#94a3b8", background: "#0c0e13", text: "#f8fafc" });
    expect(brandAccent(grey, "#0c0e13")).toEqual({ hex: "#94a3b8", source: "site accent" });
    expect(brandAccent(undefined, "#0c0e13")).toBeUndefined();
  });
});

describe("headlineAccentColour", () => {
  it("draws the phrase in the brand's mark where the headline is large text and the mark reads 3:1 on the headline's surface", () => {
    expect(headlineAccentColour(firecrawl, "#f9f9f9", { sizePx: 24, weight: 500 })).toBe("#ff4c00");
    // Bold from 18.66px is large text too.
    expect(headlineAccentColour(firecrawl, "#f9f9f9", { sizePx: 20.8, weight: 700 })).toBe("#ff4c00");
  });

  it("keeps the headline's own colour for text under large size, and for a mark that doesn't reach 3:1 on the surface", () => {
    expect(headlineAccentColour(firecrawl, "#f9f9f9", { sizePx: 20.8, weight: 500 })).toBeUndefined();
    expect(headlineAccentColour(firecrawl, "#f9f9f9", { sizePx: 18.4, weight: 700 })).toBeUndefined();
    // Yellow on white is 1.4:1; Firecrawl's orange on its own orange is 1:1.
    expect(headlineAccentColour(stored({ accent: "#ffd400", background: "#ffffff", text: "#111111" }), "#ffffff", { sizePx: 24, weight: 400 })).toBeUndefined();
    expect(headlineAccentColour(firecrawl, "#ff4c00", { sizePx: 24, weight: 400 })).toBeUndefined();
  });
});
