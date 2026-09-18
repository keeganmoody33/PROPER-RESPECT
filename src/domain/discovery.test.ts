import { describe, expect, it } from "vitest";
import {
  extractDomain,
  normalizeVendorName,
  prepareImportedProp,
  proposeDrafts,
  resolveCatalogProductWebsite,
  resolveProduct,
  type RawSignal,
} from "./discovery";

function signal(overrides: Partial<RawSignal>): RawSignal {
  return {
    sourceType: "MANUAL",
    capturedAt: "2026-07-25T00:00:00.000Z",
    payload: "{}",
    ...overrides,
  };
}

describe("normalizeVendorName", () => {
  it("strips corporate suffixes and punctuation", () => {
    expect(normalizeVendorName("Notion Labs, Inc.")).toBe("notion labs");
    expect(normalizeVendorName("GitHub, Inc")).toBe("github");
  });
});

describe("extractDomain", () => {
  it("does not turn package names, credentials, or non-web links into product domains", () => {
    for (const value of ["some-package", "@vendor/package", "https://localhost", "ftp://clay.com", "https://name:secret@clay.com", "javascript:alert(1)"]) {
      expect(extractDomain(value)).toBeNull();
    }
  });
  it("handles bare domains, schemes, and www", () => {
    expect(extractDomain("notion.so/workspace/page")).toBe("notion.so");
    expect(extractDomain("https://www.github.com/keeganmoody33")).toBe(
      "github.com",
    );
    expect(extractDomain("not a url")).toBeNull();
  });
});

describe("resolveProduct", () => {
  it("resolves an explicitly cataloged product URL before its shared company domain", () => {
    expect(resolveProduct(signal({ url: "https://github.com/features/copilot" }))?.slug).toBe("github-copilot");
    expect(resolveProduct(signal({ url: "https://devin.ai/download" }))?.slug).toBe("devin-desktop");
  });
  it("preserves a named product when the company domain is shared", () => {
    expect(resolveProduct(signal({ vendor: "Devin Desktop", url: "https://devin.ai/download" }))?.slug).toBe("devin-desktop");
    expect(resolveProduct(signal({ vendor: "GitHub Copilot Pro", url: "https://github.com" }))?.slug).toBe("github-copilot");
    expect(resolveProduct(signal({ vendor: "GitHub Copilot Pro+", url: "https://github.com" }))?.slug).toBe("github-copilot");
  });

  it("resolves known package names using verified catalog domains", () => {
    const packages = { "@clerk/nextjs": "clerk.com", convex: "convex.dev", next: "nextjs.org", react: "react.dev", zod: "zod.dev", typescript: "typescriptlang.org" };
    for (const [vendor, domain] of Object.entries(packages)) {
      expect(resolveProduct(signal({ vendor, sourceType: "GITHUB" }))?.domain).toBe(domain);
    }
    expect(resolveProduct(signal({ vendor: "unrecognized-package" }))).toBeNull();
  });
  it("keeps Devin, Devin Desktop, Windsurf, and Greptile distinct", () => {
    const products = [
      signal({ vendor: "Devin" }),
      signal({ vendor: "Devin Desktop" }),
      signal({ vendor: "Windsurf" }),
      signal({ vendor: "Greptile" }),
    ].map((item) => resolveProduct(item)?.slug);

    expect(products).toEqual([
      "devin",
      "devin-desktop",
      "windsurf",
      "greptile",
    ]);
  });

  it("collapses vendor name, domain, and URL variants onto one product", () => {
    const variants = [
      signal({ vendor: "Notion" }),
      signal({ vendor: "notion.so" }),
      signal({ vendor: "Notion Labs, Inc." }),
      signal({ url: "https://notion.so/keegan/gtm-system" }),
      signal({ url: "https://www.notion.site/some-page" }),
    ];

    for (const variant of variants) {
      expect(resolveProduct(variant)?.slug).toBe("notion");
    }
  });

  it("derives an identity from the domain for unknown vendors", () => {
    const product = resolveProduct(
      signal({ url: "https://clay.com/workbook", sourceType: "GMAIL" }),
    );
    expect(product).toEqual({
      slug: "clay",
      name: "Clay",
      domain: "clay.com",
      description: "Discovered via gmail evidence.",
    });
  });

  it("returns null when nothing resolvable is present", () => {
    expect(resolveProduct(signal({ vendor: "???" }))).toBeNull();
  });
});

describe("resolveCatalogProductWebsite", () => {
  it("recognizes canonical product URLs and known root websites, including tracking-only variations", () => {
    expect(resolveCatalogProductWebsite("https://www.github.com/features/copilot/?ref=owner#overview")?.product.slug).toBe("github-copilot");
    expect(resolveCatalogProductWebsite("https://devin.ai/download/")?.product.slug).toBe("devin-desktop");
    expect(resolveCatalogProductWebsite("https://flowvoice.ai/?ref=owner")?.product.slug).toBe("wisprflow");
    expect(resolveCatalogProductWebsite("https://app.devin.ai")?.product.slug).toBe("devin");
  });

  it("does not infer a parent product from an unverified subproduct path or subdomain", () => {
    for (const url of [
      "https://github.com/features/spark", "https://copilot.github.com",
      "https://github.com/features/copilot-extra", "https://devin.ai/another-product",
      "https://random.devin.ai", "https://example.github.io",
    ]) expect(resolveCatalogProductWebsite(url)).toBeNull();
  });
});

describe("proposeDrafts", () => {
  it("keeps GitHub and Copilot receipt lines separate with useful product destinations", () => {
    const proposals = proposeDrafts([
      signal({ vendor: "GitHub", url: "https://github.com", sourceType: "BILLING" }),
      signal({ vendor: "GitHub Copilot Pro", url: "https://github.com", sourceType: "BILLING" }),
      signal({ vendor: "Devin Desktop", url: "https://devin.ai/download" }),
    ]);
    expect(proposals.map(p => [p.product.slug, p.canonicalUrl, p.signalIndexes])).toEqual([
      ["github", "https://github.com", [0]],
      ["github-copilot", "https://github.com/features/copilot", [1]],
      ["devin-desktop", "https://devin.ai/download", [2]],
    ]);
  });
  it("prepares imported products as private pending drafts", () => {
    const proposal = proposeDrafts([
      signal({ vendor: "GitHub", sourceType: "GITHUB" }),
    ])[0];

    expect(prepareImportedProp(proposal, "GITHUB")).toMatchObject({
      visibility: "DRAFT",
      status: "TESTING",
      draftStatus: "PENDING",
    });
  });

  it("merges cross-source signals for the same vendor into one proposal", () => {
    const proposals = proposeDrafts([
      signal({ vendor: "Notion", sourceType: "GMAIL" }),
      signal({
        url: "https://notion.so/page",
        sourceType: "BROWSER_HISTORY",
      }),
      signal({ vendor: "GitHub", sourceType: "GITHUB" }),
    ]);

    expect(proposals.map((p) => p.product.slug).sort()).toEqual([
      "github",
      "notion",
    ]);
    const notion = proposals.find((p) => p.product.slug === "notion")!;
    expect(notion.signalIndexes).toEqual([0, 1]);
    expect(notion.canonicalUrl).toBe("https://notion.so");
  });

  it("skips unresolvable signals", () => {
    expect(proposeDrafts([signal({ vendor: "???" })])).toEqual([]);
  });
});
