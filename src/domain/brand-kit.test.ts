import { describe, expect, it } from "vitest";
import { brandCardKit, contrast } from "./brand-kit";
import { normalizeProductBrand } from "./product-brand";

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
      "--brand-card-button-fill": "#ff4c00", "--brand-card-button-text": "#ffffff", "--brand-card-button-radius": "20px", "--brand-card-button-weight": "450",
      "--brand-card-quiet-fill": "#000000", "--brand-card-quiet-text": "#ffffff",
    });
  });

  it("gives the button the brand's accent when the stored one would vanish on the card", () => {
    // Cloudflare's first button sits on its orange hero, so it is white: invisible on a white card.
    const kit = brandCardKit(cloudflare, "#ffffff", "#262626");
    expect(kit["--brand-card-button-fill"]).toBe("#ff5e1f");
    expect(kit["--brand-card-button-text"]).toBe("#ffffff");
    expect(kit["--brand-card-button-radius"]).toBe("9999px");
    expect(kit["--brand-card-radius"]).toBe("6px");
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

  it("leaves buttons alone when the brand has nothing that shows, and does nothing without solid card colours", () => {
    const plain = stored({ background: "#ffffff", text: "#111111" });
    expect(Object.keys(brandCardKit(plain, "#ffffff", "#111111"))).toEqual(["--brand-card-border"]);
    expect(brandCardKit(firecrawl, "rgba(0,0,0,0)", "#262626")).toEqual({});
    expect(brandCardKit(firecrawl, "#f9f9f9", "#26262680")).toEqual({});
  });
});
