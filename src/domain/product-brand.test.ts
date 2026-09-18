import { describe, expect, it } from "vitest";
import { normalizeProductBrand, productBrandSnapshotSchema, selectProductBrandLogo } from "./product-brand";
import wisprReceipt from "../../docs/verification/fixtures/2026-09-17-context-brands/wisprflow.json";
import githubReceipt from "../../docs/verification/fixtures/2026-09-17-context-brands/github.json";

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

  it("selects matching then unknown then opposite-mode logos, preferring compact icons", () => {
    const snapshot = normalizeProductBrand(input, responses);
    const item = snapshot.logos[0];
    snapshot.logos = [
      { ...item, mode: "light", type: "icon", url: "https://assets.example.com/light.svg" },
      { ...item, mode: "dark", type: "logo", url: "https://assets.example.com/dark-wordmark.svg" },
      { ...item, mode: "unknown", type: "icon", url: "https://assets.example.com/unknown.svg" },
      item,
    ];
    expect(selectProductBrandLogo(snapshot, "dark")).toEqual(item);
    snapshot.logos.pop();
    expect(selectProductBrandLogo(snapshot, "dark")?.type).toBe("logo");
    snapshot.logos.splice(1, 1);
    expect(selectProductBrandLogo(snapshot, "dark")?.mode).toBe("unknown");
    snapshot.logos.pop();
    expect(selectProductBrandLogo(snapshot, "dark")?.mode).toBe("light");
    snapshot.logos = [];
    expect(selectProductBrandLogo(snapshot, "dark")).toBeUndefined();
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
