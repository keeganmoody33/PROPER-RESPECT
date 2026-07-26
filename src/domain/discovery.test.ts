import { describe, expect, it } from "vitest";
import {
  extractDomain,
  normalizeVendorName,
  prepareImportedProp,
  proposeDrafts,
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
  it("handles bare domains, schemes, and www", () => {
    expect(extractDomain("notion.so/workspace/page")).toBe("notion.so");
    expect(extractDomain("https://www.github.com/keeganmoody33")).toBe(
      "github.com",
    );
    expect(extractDomain("not a url")).toBeNull();
  });
});

describe("resolveProduct", () => {
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

describe("proposeDrafts", () => {
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
