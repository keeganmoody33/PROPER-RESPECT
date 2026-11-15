import { describe, expect, it } from "vitest";
import { brandSiteTraitsFromMeasurement, type BrandSiteTraits, type SiteMeasurement } from "./brand-site-traits";
import { brandCardKit } from "./brand-kit";
import { contrast } from "./brand-kit";

const DESKTOP_WIDTH = 1440, DESKTOP_HEIGHT = 900;
const VIEWPORT = { width: DESKTOP_WIDTH, height: DESKTOP_HEIGHT } as const;
/** Shares of the viewport, or of the backdrop's frame, a heading's backdrop spans. */
const JUST_OVER_FULL = 0.81, NARROW = 0.6, MOST_OF_FRAME = 0.95, PART_OF_FRAME = 0.7;
const META = { productSlug: "example", canonicalDomain: "example.com", measuredAt: "2026-11-14T18:00:00.000Z", url: "https://example.com/", viewport: VIEWPORT };
const site = (raw: SiteMeasurement): BrandSiteTraits => brandSiteTraitsFromMeasurement(META, raw);
const WHITE = "#ffffff", INK = "#1f2328";
const kit = (raw: SiteMeasurement) => brandCardKit(undefined, WHITE, INK, site(raw));
/** A grid pitch in pixels, as a site's background-size states it. */
const GRID_PITCH_PX = 10;
const TERMINAL_RADIUS_PX = 10;
/** Bars are marks: 3:1 against what they are drawn on. */
const MARK_CONTRAST = 3;
/** A border or rule must show against the card. */
const BORDER_CONTRAST = 1.3;
const TEXT_CONTRAST = 4.5;
const SPIDER_BUTTON_HEIGHT_PX = 48, PILL_RADIUS_PX = 24, FIRECRAWL_RADIUS_PX = 10, FIRECRAWL_HEIGHT_PX = 36;
/** First-screen fills in square pixels, measured 2026-11-15: Spider's white buttons and its green dots; GitHub's green button. */
const SPIDER_WHITE_FILL = 20_213, SPIDER_GREEN_DOTS = 49, GITHUB_BUTTON_FILL = 8_908;
const OPEN_PLACES_FIGURE_PX = 52;

describe("the brand's feel, as measured traits", () => {
  it("stores the biggest number's face and colour, the second surface, its pattern, a dark inverse panel, the page's rule and its muted text", () => {
    expect(site({
      number: { font: { family: "Mona Sans Mono", generic: "monospace" }, colour: "#08872B" },
      panelFill: "#f2f5f3",
      surfacePattern: { kind: "grid", pitchPx: GRID_PITCH_PX, line: "#e2e6e3" },
      inversePanel: { fill: "#0e1217", text: "#e6ebf2", border: "#363941", radiusPx: TERMINAL_RADIUS_PX },
      rule: { style: "dashed", hex: "#f0f0f0" },
      mutedText: "#58635b",
    }).traits).toEqual({
      numberFont: { value: { family: "Mona Sans Mono", generic: "monospace" }, from: "largest number" },
      numberColour: { value: "#08872b", from: "largest number" },
      panelFill: { value: "#f2f5f3", from: "second large surface" },
      surfacePattern: { value: { kind: "grid", pitchPx: GRID_PITCH_PX, line: "#e2e6e3" }, from: "second large surface" },
      inversePanel: { value: { fill: "#0e1217", text: "#e6ebf2", border: "#363941", radiusPx: TERMINAL_RADIUS_PX }, from: "dark panel" },
      rule: { value: { style: "dashed", hex: "#f0f0f0" }, from: "most common border" },
      mutedText: { value: "#58635b", from: "secondary text on the page background" },
    });
  });

  it("drops a value that is not a plain colour, a known pattern or a number in range, alone", () => {
    expect(site({
      number: { font: { family: "x;y", generic: "fantasy" }, colour: "red" }, panelFill: "url(a)",
      surfacePattern: { kind: "stripes", pitchPx: GRID_PITCH_PX, line: "#e2e6e3" }, rule: { style: "groove", hex: "#000000" }, mutedText: "#zzzzzz",
    }).traits).toEqual({});
  });

  it("calls a heading's backdrop full-bleed at 80% of the viewport, or of the frame it sits in", () => {
    expect(site({ hero: { hex: "#0f1117", widthShare: JUST_OVER_FULL, kind: "colour" } }).traits.hero?.value).toEqual({ kind: "colour", hex: "#0f1117" });
    expect(site({ hero: { hex: "#0f1117", widthShare: NARROW, frameShare: MOST_OF_FRAME, kind: "colour" } }).traits.hero?.value).toEqual({ kind: "colour", hex: "#0f1117" });
    expect(site({ hero: { hex: "#0f1117", widthShare: NARROW, frameShare: PART_OF_FRAME, kind: "colour" } }).traits.hero?.value).toEqual({ kind: "none" });
  });
});

describe("what a card makes of the feel", () => {
  it("leaves a measured site's labels as typed when no case was measured; a card with no site keeps the house default", () => {
    expect(kit({ surface: WHITE })["--brand-card-label-case"]).toBe("none");
    expect(brandCardKit(undefined, WHITE, INK)["--brand-card-label-case"]).toBeUndefined();
  });

  it("sets the use chips and footer note in the site's button case and face, not its small-label case", () => {
    const clay = kit({ labels: { case: "uppercase" }, primaryButton: { fill: "#cbd810", label: "#000000", case: "as written", font: { generic: "sans-serif" } } });
    expect([clay["--brand-card-label-case"], clay["--brand-card-chip-case"], clay["--brand-card-chip-font"]])
      .toEqual(["uppercase", "none", 'system-ui, -apple-system, "Segoe UI", Arial, sans-serif']);
    expect(kit({ labels: { case: "uppercase" } })["--brand-card-chip-case"]).toBe("uppercase");
  });

  it("sets the hero number in the site's number face, and in its colour only where that colour reaches 3:1", () => {
    const github = kit({ number: { font: { family: "Mona Sans Mono", generic: "monospace" }, colour: "#08872b" } });
    // The card serves no Mona Sans Mono, so the figures stay in the brand's own served face rather than a system mono.
    expect([github["--brand-card-number-font"], github["--brand-card-number-colour"]])
      .toEqual(['var(--brand-card-heading-font, var(--brand-card-body-font, ui-monospace, "SF Mono", Menlo, monospace))', "#08872b"]);
    expect(kit({ number: { colour: "#f5f5f5" } })["--brand-card-number-colour"]).toBeUndefined();
  });

  it("puts the second surface, its grid and the page's rule behind and between the card's data", () => {
    const github = kit({ panelFill: "#f2f5f3", surfacePattern: { kind: "grid", pitchPx: GRID_PITCH_PX, line: "#e2e6e3" }, rule: { style: "solid", hex: "#d2d9d4" } });
    expect([github["--brand-card-panel"], github["--brand-card-pattern-line"], github["--brand-card-pattern-pitch"], github["--brand-card-rule"], github["--brand-card-rule-style"]])
      .toEqual(["#f2f5f3", "#e2e6e3", "10px", "#d2d9d4", "solid"]);
  });

  it("draws a dark inverse panel with its own text and border, and bars in a mark that passes on that fill", () => {
    const docker = brandCardKit(undefined, WHITE, INK, site({ inversePanel: { fill: "#0e1217", text: "#e6ebf2", border: "#363941", radiusPx: TERMINAL_RADIUS_PX }, signatureCandidates: [{ hex: "#1d63ed", from: "primary call-to-action" }] }));
    expect([docker["--brand-card-panel"], docker["--brand-card-panel-text"], docker["--brand-card-panel-border"], docker["--brand-card-panel-radius"]]).toEqual(["#0e1217", "#e6ebf2", "#363941", "10px"]);
    expect(contrast(docker["--brand-card-panel-chart"]!, "#0e1217")).toBeGreaterThanOrEqual(MARK_CONTRAST);
  });

  it("draws the page's rule only where it shows on the card (1.3:1); a fainter one gives way to a border mixed from the text", () => {
    expect(kit({ rule: { style: "solid", hex: "#d2d9d4" } })["--brand-card-rule"]).toBe("#d2d9d4");
    const clay = kit({ rule: { style: "solid", hex: "#f0f8ff" } });
    expect(clay["--brand-card-rule"]).not.toBe("#f0f8ff");
    expect(contrast(clay["--brand-card-rule"]!, WHITE)).toBeGreaterThanOrEqual(BORDER_CONTRAST);
    expect(clay["--brand-card-rule-style"]).toBe("solid");
  });

  it("frames the card's data panel in the site's rule: on its second surface, or on the card's own surface when it measured none", () => {
    const github = kit({ rule: { style: "solid", hex: "#d2d9d4" } });
    expect([github["--brand-card-panel"], github["--brand-card-panel-border"]]).toEqual([WHITE, "#d2d9d4"]);
    const firecrawl = kit({ panelFill: "#f9f9f9", rule: { style: "solid", hex: "#d2d9d4" } });
    expect([firecrawl["--brand-card-panel"], firecrawl["--brand-card-panel-border"]]).toEqual(["#f9f9f9", "#d2d9d4"]);
    // A dark inverse panel keeps its own border, and a site with no rule gets no frame.
    expect(kit({ inversePanel: { fill: "#0e1217", text: "#e6ebf2" }, rule: { style: "solid", hex: "#d2d9d4" } })["--brand-card-panel-border"]).toBeUndefined();
    expect(kit({ surface: WHITE })["--brand-card-panel"]).toBeUndefined();
  });

  it("uses the site's muted text for captions only where it reads at 4.5:1 on the card", () => {
    expect(kit({ mutedText: "#58635b" })["--brand-card-muted"]).toBe("#58635b");
    expect(kit({ mutedText: "#aaaaaa" })["--brand-card-muted"]).toBeUndefined();
  });

  it("rounds a card with no measured panel as the site's buttons, when they are not pills", () => {
    const square = { fill: "#f8fafc", label: "#0c0e13", radiusPx: 0, heightPx: SPIDER_BUTTON_HEIGHT_PX };
    expect(kit({ primaryButton: square })["--brand-card-radius"]).toBe("0px");
    expect(kit({ primaryButton: { ...square, radiusPx: PILL_RADIUS_PX } })["--brand-card-radius"]).toBeUndefined();
    expect(kit({ primaryButton: square, panelRadiusPx: TERMINAL_RADIUS_PX })["--brand-card-radius"]).toBe("10px");
  });

  it("draws the chart in outline where the site fills less than a 40px box of its first screen with the mark colour, as Spider draws lines", () => {
    const spider = brandCardKit(undefined, "#0c0e13", "#f8fafc", site({ signatureCandidates: [{ hex: "#3bde77", from: "heading highlight" }], fills: [{ hex: "#f8fafc", areaPx: SPIDER_WHITE_FILL }, { hex: "#3bde77", areaPx: SPIDER_GREEN_DOTS }] }));
    expect([spider["--brand-card-chart"], spider["--brand-card-chart-tint"]]).toEqual(["#3bde77", "#143325"]);
    const github = kit({ signatureCandidates: [{ hex: "#08872b", from: "primary call-to-action" }], fills: [{ hex: "#08872b", areaPx: GITHUB_BUTTON_FILL }] });
    expect([github["--brand-card-chart"], github["--brand-card-chart-tint"]]).toEqual(["#08872b", undefined]);
    // A chart drawn in the text colour, where no brand colour reads (n8n's pink), is no brand's line.
    expect(kit({ signatureCandidates: [{ hex: "#ffbcca", from: "primary call-to-action" }], fills: [] })["--brand-card-chart-tint"]).toBeUndefined();
  });

  it("sets the site's big number on the highlight that hugs it, where the number reads 3:1 on it", () => {
    const openPlaces = kit({ figures: [{ sizePx: OPEN_PLACES_FIGURE_PX, colour: "#5c480a", top: 0, font: { generic: "sans-serif" }, backdrop: "#f7e7a1" }] });
    expect([openPlaces["--brand-card-number-colour"], openPlaces["--brand-card-number-backdrop"]]).toEqual(["#5c480a", "#f7e7a1"]);
    expect(kit({ figures: [{ sizePx: OPEN_PLACES_FIGURE_PX, colour: "#f0e0a0", top: 0, font: { generic: "sans-serif" }, backdrop: "#f7e7a1" }] })["--brand-card-number-backdrop"]).toBeUndefined();
  });
});

describe("the button's label", () => {
  it("keeps the site's own label colour where deepening the fill a little makes it read 4.5:1, as white on Firecrawl's orange", () => {
    const firecrawl = kit({ primaryButton: { fill: "#ff4c00", label: "#ffffff", radiusPx: FIRECRAWL_RADIUS_PX, heightPx: FIRECRAWL_HEIGHT_PX } });
    expect(firecrawl["--brand-card-button-text"]).toBe("#ffffff");
    expect(contrast(firecrawl["--brand-card-button-fill"]!, "#ffffff")).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    expect(firecrawl["--brand-card-button-fill"]).toBe("#d64000");
    // Too far to deepen (white on a pale lime): the label gives way to one that reads, on the site's own fill.
    const clay = kit({ primaryButton: { fill: "#cbd810", label: "#ffffff", radiusPx: FIRECRAWL_RADIUS_PX, heightPx: FIRECRAWL_HEIGHT_PX } });
    expect([clay["--brand-card-button-fill"], clay["--brand-card-button-text"]]).toEqual(["#cbd810", INK]);
  });
});

