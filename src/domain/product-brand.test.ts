import { describe, expect, it } from "vitest";
import { brandTitleNamesProduct, normalizeProductBrand, productBrandSnapshotSchema, selectProductBrandLogo } from "./product-brand";
import wisprReceipt from "../../docs/verification/fixtures/2026-09-17-context-brands/wisprflow.json";
import githubReceipt from "../../docs/verification/fixtures/2026-09-17-context-brands/github.json";
import { HOMEPAGE_BRANDS } from "@/src/data/homepage-brands";

const MEDIA_HOST = "https://media.brand.dev/";
const UUID_PREFIX = 8;

const input = {
  productSlug: "wispr-flow", canonicalDomain: "wisprflow.ai",
  retrievalId: "test-brand-retrieval", retrievedAt: "2026-09-17T16:00:00.000Z",
  responseHash: "a".repeat(64),
};
const responses = {
  brand: { status: "ok", code: 200, request_id: "brand-request", brand: {
    domain: "wisprflow.ai", logos: [{ url: "https://assets.example.com/flow.svg", mode: "dark", type: "icon", resolution: { width: 64, height: 64 } }],
    colors: [{ hex: "#AbC", name: "Lilac", source: "website" }],
  } },
  fonts: { status: "ok", domain: "wisprflow.ai", fonts: [{ font: "Inter", uses: ["body"], fallbacks: ["sans-serif"] }] },
  styleguide: { status: "ok", domain: "wisprflow.ai", styleguide: {
    mode: "light", colors: { accent: "#ABCDEF", background: "#fff", text: "#000" },
    typography: { headings: { h1: { fontFamily: "Inter" } }, p: { fontFamily: "Arial" } },
  } },
};

describe("retained product brand presentation", () => {
  it("retains strict UTC datetime validation after deferred schema initialization", () => {
    for (const retrievedAt of ["not-a-date", "2026-09-17", "2026-02-30T00:00:00.000Z"]) {
      expect(() => normalizeProductBrand({ ...input, retrievedAt }, responses)).toThrow();
    }
  });

  it("normalizes supported brand fields with independent product and retrieval provenance", () => {
    const snapshot = normalizeProductBrand(input, responses);
    expect(productBrandSnapshotSchema.parse(snapshot)).toMatchObject({
      ...input, provider: "context.dev", schemaVersion: 2, partial: false,
      logos: [{ url: "https://assets.example.com/flow.svg", mode: "dark", type: "icon", width: 64, height: 64 }],
      colors: [{ hex: "#aabbcc", name: "Lilac", source: "website" }],
      fonts: [{ family: "Inter", uses: ["body"], fallbacks: ["sans-serif"] }],
      styleguide: { mode: "light", colors: { accent: "#abcdef", background: "#ffffff", text: "#000000" }, headingFamily: "Inter", bodyFamily: "Arial" },
    });
    expect(snapshot.receipts.map((receipt) => receipt.endpoint)).toEqual(["brand", "fonts", "styleguide"]);
    expect(snapshot).not.toHaveProperty("usage");
  });

  it("reads the immutable version 1 Wispr and GitHub records without adding fields", () => {
    for (const receipt of [wisprReceipt, githubReceipt]) {
      expect(productBrandSnapshotSchema.parse(receipt.snapshot)).toEqual(receipt.snapshot);
      expect(productBrandSnapshotSchema.safeParse({ ...receipt.snapshot, fontLinks: [] }).success).toBe(false);
    }
  });

  it("retains validated weight-specific files and explicit heading/body typography", () => {
    const snapshot = normalizeProductBrand(input, {
      ...responses,
      fonts: { ...responses.fonts, fontLinks: { Inter: { type: "google", category: "sans-serif", files: {
        "400": "https://fonts.gstatic.com/inter-regular.woff2", "600": "https://fonts.gstatic.com/inter-semibold.woff2",
      } } } },
      styleguide: { ...responses.styleguide, styleguide: { ...responses.styleguide.styleguide,
        typography: {
          headings: { h1: { fontFamily: "Inter", fontFallbacks: ["Inter", "sans-serif"], fontWeight: 600, fontSize: "64px", lineHeight: "72px", letterSpacing: "-1px" } },
          p: { fontFamily: "Arial", fontFallbacks: ["Arial", "sans-serif"], fontWeight: 400, fontSize: "16px", lineHeight: "24px", letterSpacing: "normal" },
        },
        fontLinks: { Arial: { type: "custom", files: { "400": "https://assets.example.com/arial.ttf" } } },
      } },
    });
    expect(snapshot).toMatchObject({ schemaVersion: 2, fontLinks: [
      { family: "Inter", source: "fonts", type: "google", category: "sans-serif", files: [
        { weight: 400, url: "https://fonts.gstatic.com/inter-regular.woff2", format: "woff2" },
        { weight: 600, url: "https://fonts.gstatic.com/inter-semibold.woff2", format: "woff2" },
      ] },
      { family: "Arial", source: "styleguide", type: "custom", files: [{ weight: 400, url: "https://assets.example.com/arial.ttf", format: "truetype" }] },
    ], styleguide: { typography: {
      heading: { family: "Inter", fallbacks: ["Inter", "sans-serif"], weight: 600, fontSizePx: 64, lineHeight: 1.125, letterSpacingEm: -0.015625 },
      body: { family: "Arial", fallbacks: ["Arial", "sans-serif"], weight: 400, fontSizePx: 16, lineHeight: 1.5, letterSpacingEm: 0 },
    } } });
    expect(snapshot.partial).toBe(false);
  });

  it("keeps the typed card and button values a card is themed from, and no vendor CSS", () => {
    const snapshot = normalizeProductBrand(input, { ...responses, styleguide: { ...responses.styleguide, styleguide: { ...responses.styleguide.styleguide, components: {
      card: { backgroundColor: "#F9F9F9", textColor: "#262626", borderColor: "#e5e7eb", borderRadius: "8px", padding: "16px 20px", boxShadow: "none", css: "background-color: #f9f9f9;" },
      button: {
        primary: { backgroundColor: "#ff4c00", color: "#fff", borderColor: "#e5e7eb", borderRadius: "3.35544e+07px", padding: "8px", fontWeight: 450, boxShadow: "inset 0 -6px 12px red", css: "x" },
        secondary: { backgroundColor: "transparent", color: "#262626", borderColor: "transparent", borderRadius: "12px", fontWeight: 500 },
        link: { color: "#262626" },
      },
    } } } });
    expect(snapshot.styleguide).toMatchObject({ components: {
      card: { background: "#f9f9f9", text: "#262626", border: "#e5e7eb", radiusPx: 8, paddingPx: 16 },
      buttonPrimary: { background: "#ff4c00", text: "#ffffff", border: "#e5e7eb", radiusPx: 9999, paddingPx: 8, weight: 450 },
      buttonSecondary: { text: "#262626", radiusPx: 12, weight: 500 },
    } });
    const kept = JSON.stringify(snapshot);
    for (const vendorCss of ["background-color", "inset", "css", "boxShadow", "transparent"]) expect(kept).not.toContain(vendorCss);
    expect(snapshot.partial).toBe(false);
    expect(productBrandSnapshotSchema.parse(snapshot)).toEqual(snapshot);
  });

  it("drops component values it cannot type, and still reads snapshots stored before components existed", () => {
    const snapshot = normalizeProductBrand(input, { ...responses, styleguide: { ...responses.styleguide, styleguide: { ...responses.styleguide.styleguide, components: {
      card: { backgroundColor: "url(https://evil.example/x)", borderRadius: "calc(1px + 2px)", padding: "-4px", textColor: 7 },
      button: { primary: "not an object", secondary: { fontWeight: 5000, borderRadius: "50%" } },
    } } } });
    expect(snapshot.styleguide).not.toHaveProperty("components");
    const before = normalizeProductBrand(input, responses);
    expect(before.styleguide).not.toHaveProperty("components");
    expect(productBrandSnapshotSchema.safeParse(before).success).toBe(true);
    expect(productBrandSnapshotSchema.safeParse({ ...before, styleguide: { ...before.styleguide, components: { card: { background: "red" } } } }).success).toBe(false);
  });

  it("keeps useful typography when unsafe files and CSS values are discarded", () => {
    const snapshot = normalizeProductBrand(input, {
      ...responses,
      fonts: { ...responses.fonts, fontLinks: { Inter: { type: "custom", files: {
        "400": "https://assets.example.com/inter.woff2",
        "500": "https://assets.example.com/inter.woff2?token=SECRET",
        "600": "https://assets.example.com/styles.css",
        "700": "https://localhost/inter.woff2",
        "800": "https://assets.example.com/font.woff2?q=</style><script>",
        "400 900": "https://assets.example.com/variable.woff2",
      } } } },
      styleguide: { ...responses.styleguide, styleguide: { ...responses.styleguide.styleguide, typography: {
        headings: { h1: { fontFamily: "Inter", fontWeight: 9999, fontFallbacks: ["serif", "bad; color:red"], fontSize: "64px", lineHeight: "url(SECRET)", letterSpacing: "999px", css: "body{display:none}" } },
      } } },
    });
    expect(snapshot).toMatchObject({ partial: true, fontLinks: [{ files: [{ weight: 400, url: "https://assets.example.com/inter.woff2" }] }], styleguide: { typography: { heading: { family: "Inter", fallbacks: ["serif"] } } } });
    expect(JSON.stringify(snapshot)).not.toMatch(/SECRET|script|styles\.css|9999|color:red|display:none/);
    expect(snapshot.receipts.filter((receipt) => receipt.partial).map((receipt) => receipt.endpoint)).toEqual(["fonts", "styleguide"]);
  });

  it("does not retain files from a mismatched endpoint or invent roles from font order", () => {
    const snapshot = normalizeProductBrand(input, {
      brand: responses.brand,
      fonts: { ...responses.fonts, domain: "other.example.com", fontLinks: { Inter: { type: "custom", files: { "400": "https://assets.example.com/inter.woff2" } } } },
    });
    expect(snapshot).toMatchObject({ fonts: [], fontLinks: [] });
    expect(snapshot.styleguide).toBeUndefined();
  });

  it("puts an icon made for the card's surface, or for any surface, in the square slot, preferring a square one", () => {
    const snapshot = normalizeProductBrand(input, responses);
    const logo = (mode: "light" | "dark" | "unknown", type: "icon" | "logo", width: number, height: number) =>
      ({ url: `https://assets.example.com/${mode}-${type}-${width}x${height}.svg`, mode, type, width, height });
    snapshot.logos = [logo("light", "logo", 400, 100), logo("light", "icon", 372, 256), logo("unknown", "icon", 512, 512), logo("dark", "icon", 512, 512)];
    expect(selectProductBrandLogo(snapshot, "light")).toEqual({ logo: logo("unknown", "icon", 512, 512), layout: "square" });
    snapshot.logos = [logo("unknown", "icon", 512, 512), logo("light", "icon", 128, 128)];
    expect(selectProductBrandLogo(snapshot, "light")).toEqual({ logo: logo("light", "icon", 128, 128), layout: "square" });
    snapshot.logos = [logo("light", "icon", 372, 256)];
    expect(selectProductBrandLogo(snapshot, "light")).toEqual({ logo: logo("light", "icon", 372, 256), layout: "square" });
  });

  it("draws the fullest wordmark that still reads at the title's height when no icon suits the surface", () => {
    const snapshot = normalizeProductBrand(input, responses);
    const logo = (mode: "light" | "dark" | "unknown", width: number, height: number) =>
      ({ url: `https://assets.example.com/${mode}-${width}x${height}.svg`, mode, type: "logo" as const, width, height });
    snapshot.logos = [logo("light", 120, 48), logo("light", 32, 14), logo("light", 240, 48), logo("light", 719, 59), { ...logo("dark", 1, 1), type: "icon" as const }];
    expect(selectProductBrandLogo(snapshot, "light")).toEqual({ logo: logo("light", 240, 48), layout: "wordmark" });
    snapshot.logos = [logo("unknown", 719, 59), logo("unknown", 900, 60)];
    expect(selectProductBrandLogo(snapshot, "light")).toEqual({ logo: logo("unknown", 719, 59), layout: "wordmark" });
  });

  it("falls back to a logo made for the other surface only in the square slot, where it gets its own backing", () => {
    const snapshot = normalizeProductBrand(input, responses);
    const logo = (mode: "light" | "dark", type: "icon" | "logo") => ({ url: `https://assets.example.com/${mode}-${type}.svg`, mode, type, width: 100, height: 100 });
    snapshot.logos = [logo("dark", "logo"), logo("dark", "icon")];
    expect(selectProductBrandLogo(snapshot, "light")).toEqual({ logo: logo("dark", "icon"), layout: "square" });
    snapshot.logos = [logo("light", "logo")];
    expect(selectProductBrandLogo(snapshot, "dark")).toEqual({ logo: logo("light", "logo"), layout: "square" });
    snapshot.logos = [];
    expect(selectProductBrandLogo(snapshot, "dark")).toBeUndefined();
  });

  it("chooses each homepage brand's logo and layout from its committed snapshot", () => {
    const chosen = Object.fromEntries(Object.entries(HOMEPAGE_BRANDS).map(([slug, brand]) => {
      const background = brand.styleguide?.colors.background;
      const choice = selectProductBrandLogo(brand, background === "#0c0e13" ? "dark" : "light");
      return [slug, `${choice?.layout} ${choice?.logo.mode} ${choice?.logo.type} ${choice?.logo.url.slice(MEDIA_HOST.length, MEDIA_HOST.length + UUID_PREFIX)}`];
    }));
    expect(chosen).toEqual({
      clay: "square dark icon 1263c04e",
      cloudflare: "wordmark light logo 5019dab7",
      "context-dev": "square unknown icon 2bae46d7",
      docker: "square light icon 01405b60",
      elicit: "square light icon 105442cc",
      exa: "square unknown icon 64377483",
      firecrawl: "square unknown icon f895934e",
      github: "square light icon c625fdf9",
      n8n: "wordmark light logo f234c3d6",
      "open-places": "square light icon d0d02048",
      porkbun: "square dark icon 419c73f1",
      spider: "square dark icon 0a17c0a1",
    });
  });

  it("drops malformed optional brand fields and preserves the useful partial snapshot", () => {
    const snapshot = normalizeProductBrand(input, {
      ...responses,
      brand: { ...responses.brand, brand: { ...responses.brand.brand,
        logos: [...responses.brand.brand.logos, { url: "javascript:alert(1)" }, { url: "https://assets.example.com/logo.svg?api_key=SECRET" }],
        colors: [...responses.brand.brand.colors, { hex: "red;background:url(secret)" }],
      } },
      fonts: { ...responses.fonts, fonts: [...responses.fonts.fonts, { font: "Bad; color:red", uses: [] }] },
    });
    expect(snapshot.logos).toHaveLength(1);
    expect(snapshot.colors).toHaveLength(1);
    expect(snapshot.fonts).toHaveLength(1);
    expect(snapshot.partial).toBe(true);
    expect(snapshot.receipts.find((receipt) => receipt.endpoint === "brand")?.partial).toBe(true);
    expect(JSON.stringify(snapshot)).not.toMatch(/SECRET|javascript|background:url/);
  });

  it("keeps a sparse response usable and never infers semantic palette roles", () => {
    const snapshot = normalizeProductBrand(input, { brand: { status: "ok", brand: { domain: "wisprflow.ai", colors: [{ hex: "#123456" }, { hex: "#abcdef" }] } } });
    expect(snapshot).toMatchObject({ logos: [], fonts: [], partial: true, colors: [{ hex: "#123456" }, { hex: "#abcdef" }] });
    expect(snapshot.styleguide).toBeUndefined();
    expect(snapshot.receipts.slice(1).every((receipt) => receipt.status === "unavailable")).toBe(true);
    expect(productBrandSnapshotSchema.safeParse({ ...snapshot, usage: 42 }).success).toBe(false);
  });

  it("requires exact canonical identity and excludes optional fields from a different domain", () => {
    expect(() => normalizeProductBrand(input, { brand: { ...responses.brand, brand: { ...responses.brand.brand, domain: "wispr.ai" } } })).toThrow("domain did not match");
    const snapshot = normalizeProductBrand(input, { ...responses, fonts: { ...responses.fonts, domain: "other.example.com" }, styleguide: { ...responses.styleguide, domain: "other.example.com" } });
    expect(snapshot.fonts).toEqual([]);
    expect(snapshot.styleguide).toBeUndefined();
    expect(snapshot.partial).toBe(true);
  });

  it.each([
    "http://assets.example.com/logo.svg", "https://person:password@assets.example.com/logo.svg",
    "https://assets.example.com/logo.svg?access_token=SECRET", "https://assets.example.com/logo.svg?X-Amz-Signature=SECRET",
    "https://127.0.0.1/logo.svg", "https://service.internal/logo.svg", "data:image/svg+xml,test",
  ])("rejects unsafe retained logo URL %s", (url) => {
    const snapshot = normalizeProductBrand(input, responses);
    expect(productBrandSnapshotSchema.safeParse({ ...snapshot, logos: [{ ...snapshot.logos[0], url }] }).success).toBe(false);
  });
});

it.each([
  ["Open Places", ["Open Places"], true],
  ["open places", ["Open Places", "openplaces"], true],
  ["OpenPlaces", ["Open Places", "openplaces"], true],
  ["Cursor: The AI Code Editor", ["Cursor"], true],
  ["Porkbun | Domains", ["Porkbun"], true],
  ["Google", ["Gmail", "google mail"], false],
  ["GitHub", ["GitHub Copilot"], false],
  ["Cursory", ["Cursor"], false],
  ["", ["Cursor"], false],
  [undefined, ["Cursor"], false],
  ["Cursor", [], false],
  ["工具", ["工具"], true],
  ["Café", ["Café"], true],
  ["Caf", ["Café"], false],
  ["工具", ["道具"], false],
  ["---", ["Cursor"], false],
] as const)("a provider brand titled %j is accepted for %j: %j", (title, names, accepted) => {
  expect(brandTitleNamesProduct(title, names)).toBe(accepted);
});

it("rejects a title padded with a very long run of spaces without a slow scan", () => {
  const LONG_RUN = 200_000, BUDGET_MS = 200;
  const started = performance.now();
  expect(brandTitleNamesProduct(`Cursor${" ".repeat(LONG_RUN)}x`, ["Cursor"])).toBe(false);
  expect(brandTitleNamesProduct(`Cursor${" ".repeat(LONG_RUN)}- editor`, ["Cursor"])).toBe(false);
  expect(performance.now() - started).toBeLessThan(BUDGET_MS);
  expect(brandTitleNamesProduct("Cursor   -   The AI Code Editor", ["Cursor"])).toBe(true);
  expect(brandTitleNamesProduct("Exa \u2014 Search", ["Exa"])).toBe(true);
});
