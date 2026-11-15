import { describe, expect, it } from "vitest";
import { brandSiteTraitsFromMeasurement, type BrandSiteTraits, type SiteMeasurement } from "./brand-site-traits";
import { brandCardKit, brandMark } from "./brand-kit";
import { contrast } from "./brand-kit";
import { oklab } from "./oklab";
import { HOMEPAGE_BRANDS } from "@/src/data/homepage-brands";

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
const OPEN_PLACES_FIGURE_PX = 52, DOCKER_FIGURE_PX = 60;

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
    // A chart drawn in the text colour, where no brand colour reads even moved as far as a mark may move, is no brand's line.
    const pale = kit({ signatureCandidates: [{ hex: "#fff1a8", from: "primary call-to-action" }], fills: [] });
    expect([pale["--brand-card-chart"], pale["--brand-card-chart-tint"]]).toEqual([INK, undefined]);
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

describe("the big number and the back's values", () => {
  it("draws a number the site sets in a grey, or doesn't set at all, in the brand's mark where that reads 4.5:1 at any size", () => {
    const docker = kit({ signatureCandidates: [{ hex: "#2560ff", from: "primary call-to-action" }], figures: [{ sizePx: DOCKER_FIGURE_PX, colour: "#000000", top: 0, font: { generic: "sans-serif" } }] });
    expect(docker["--brand-card-number-colour"]).toBe("#2560ff");
    expect(kit({ signatureCandidates: [{ hex: "#2560ff", from: "primary call-to-action" }] })["--brand-card-number-colour"]).toBe("#2560ff");
    // A mark at 3:1 is a large number's floor, not a small one's: Cloudflare's orange on white leaves its grey number alone.
    expect(kit({ signatureCandidates: [{ hex: "#ff5e1f", from: "logo" }], figures: [{ sizePx: DOCKER_FIGURE_PX, colour: "#262626", top: 0, font: { generic: "sans-serif" } }] })["--brand-card-number-colour"]).toBe("#262626");
  });

  it("sets the back's values in the front's number colour where it reads 4.5:1 on their panel, but not a highlight's ink", () => {
    const github = kit({ signatureCandidates: [{ hex: "#08872b", from: "primary call-to-action" }], figures: [{ sizePx: DOCKER_FIGURE_PX, colour: "#08872b", top: 0, font: { generic: "monospace" } }], rule: { style: "solid", hex: "#d2d9d4" } });
    expect(github["--brand-card-value-colour"]).toBe("#08872b");
    expect(kit({ figures: [{ sizePx: DOCKER_FIGURE_PX, colour: "#ff4d00", top: 0, font: { generic: "sans-serif" } }] })["--brand-card-value-colour"]).toBeUndefined();
    expect(kit({ figures: [{ sizePx: OPEN_PLACES_FIGURE_PX, colour: "#5c480a", top: 0, font: { generic: "sans-serif" }, backdrop: "#f7e7a1" }] })["--brand-card-value-colour"]).toBeUndefined();
  });
});


describe("a dot pattern", () => {
  it("is drawn as dots, not grid lines", () => {
    const n8n = kit({ texture: { kind: "dots", pitchPx: 18, line: "#d9d9d9" } });
    expect([n8n["--brand-card-pattern-dot"], n8n["--brand-card-pattern-line"], n8n["--brand-card-pattern-pitch"]]).toEqual(["#d9d9d9", undefined, "18px"]);
  });
});

/** The hue of a colour in OKLCH, in degrees. */
const hue = (hex: string) => { const [, a, b] = oklab(hex); return (Math.atan2(b, a) * 180) / Math.PI; };
/** Two hues this close read as the same colour family. */
const SAME_HUE_DEGREES = 6;

describe("a brand colour too pale or too dark for bars", () => {
  it("moves in lightness, keeping its hue, as little as makes the bars read 3:1 on what they sit on, before giving way to the text colour", () => {
    // n8n's pink call-to-action is 1.5:1 on its grey #f0f0f0 panel. Deepened, still pink, it reads 3:1 there.
    const n8n = kit({ panelFill: "#f0f0f0", signatureCandidates: [{ hex: "#ffbcca", from: "primary call-to-action" }], fills: [{ hex: "#ffbcca", areaPx: 12_005 }] });
    const bars = n8n["--brand-card-chart"]!;
    expect(n8n["--brand-card-panel"]).toBe("#f0f0f0");
    expect(contrast(bars, "#f0f0f0")).toBeGreaterThanOrEqual(MARK_CONTRAST);
    expect(Math.abs(hue(bars) - hue("#ffbcca"))).toBeLessThan(SAME_HUE_DEGREES);
    expect(bars).toBe("#b77987");
    // The site fills a 40px box and more with its pink, so the bars stay filled, not outlined.
    expect(n8n["--brand-card-chart-tint"]).toBeUndefined();
  });

  it("tries every brand colour as it is before moving any, so a colour that already reads wins over one that needed moving", () => {
    // Clay's lime is 1.6:1 on white and its green hero passes as is: the green draws the bars, not a darkened lime.
    const clay = kit({ signatureCandidates: [{ hex: "#cbd810", from: "primary call-to-action" }], hero: { hex: "#035d44", widthShare: 1, kind: "colour", radiusPx: 0 } });
    expect(clay["--brand-card-chart"]).toBe("#035d44");
  });

  it("lightens on a dark inverse panel, keeping its hue, before the panel's own text takes the bars", () => {
    const dark = brandCardKit(undefined, WHITE, INK, site({ inversePanel: { fill: "#0e1217", text: "#e6ebf2" }, signatureCandidates: [{ hex: "#5b2a86", from: "primary call-to-action" }] }));
    const bars = dark["--brand-card-panel-chart"]!;
    expect(contrast(bars, "#0e1217")).toBeGreaterThanOrEqual(MARK_CONTRAST);
    expect(bars).not.toBe("#e6ebf2");
    expect(Math.abs(hue(bars) - hue("#5b2a86"))).toBeLessThan(SAME_HUE_DEGREES);
  });
});

describe("a measured site that shows no brand colour", () => {
  // Exa: no colourful call-to-action, heading phrase, hero or logo, a near-black number, and the provider's blue nowhere in its first screen.
  const exaLike = { figures: [{ sizePx: DOCKER_FIGURE_PX, colour: "#111827", top: 0, font: { generic: "serif" as const } }], fills: [{ hex: "#fafafa", areaPx: 190_400 }, { hex: "#000000", areaPx: 7_233 }] };
  const provider = (accent: string) => ({ ...HOMEPAGE_BRANDS.exa, styleguide: { ...HOMEPAGE_BRANDS.exa.styleguide!, colors: { ...HOMEPAGE_BRANDS.exa.styleguide!.colors, accent } } });

  it("draws the card in the site's neutrals: its number in the site's number colour and its bars in the card's text colour", () => {
    const exa = brandCardKit(provider("#1f40ed"), WHITE, INK, site(exaLike));
    expect([exa["--brand-card-number-colour"], exa["--brand-card-chart"], exa["--brand-card-chart-tint"]]).toEqual(["#111827", INK, undefined]);
    expect(brandMark(provider("#1f40ed"), WHITE, TEXT_CONTRAST, site(exaLike))).toBeUndefined();
  });

  it("keeps the provider's colour where the site fills a 40px box or more of its first screen with it", () => {
    const filled = brandCardKit(provider("#1f40ed"), WHITE, INK, site({ ...exaLike, fills: [...exaLike.fills, { hex: "#1f40ed", areaPx: 40 * 40 }] }));
    expect(filled["--brand-card-chart"]).toBe("#1f40ed");
  });
});

describe("a coloured panel in the site's first screen", () => {
  // Context.dev frames its search box in a blue panel with rounded corners, the first screen's largest coloured surface.
  const framed = { surfaces: [{ hex: "#2563eb", area: 2_636_329, firstScreenArea: 224_852, chromeArea: 166_484, ink: "#000000", radiusPx: 32.4 }], rule: { style: "solid", hex: "#b2b2b2" } };

  it("is stored as the panel's frame colour and corner", () => {
    expect(site(framed).traits.framedPanel).toEqual({ value: { hex: "#2563eb", radiusPx: 32.4 }, from: "coloured panel" });
    // One that shows only below the first screen, or is mostly navigation chrome, or is the hero, is not the site's frame.
    expect(site({ surfaces: [{ ...framed.surfaces[0], firstScreenArea: 0 }] }).traits.framedPanel).toBeUndefined();
    expect(site({ surfaces: [{ ...framed.surfaces[0], chromeArea: 2_000_000 }] }).traits.framedPanel).toBeUndefined();
    expect(site({ surfaces: [{ ...framed.surfaces[0], hex: "#ff5e1f" }], hero: { hex: "#ff5e1f", widthShare: 1, kind: "colour", radiusPx: 16 } }).traits.framedPanel).toBeUndefined();
  });

  it("frames the card's data panel in that colour, thick and rounded, over the page's grey rule", () => {
    const card = kit(framed);
    expect([card["--brand-card-panel"], card["--brand-card-panel-border"], card["--brand-card-panel-frame"], card["--brand-card-panel-radius"]]).toEqual([WHITE, "#2563eb", "6px", "24px"]);
    // A frame that would not show on the card (3:1, as any graphic) is not drawn.
    expect(kit({ surfaces: [{ ...framed.surfaces[0], hex: "#a8c4ff" }] })["--brand-card-panel-frame"]).toBeUndefined();
  });
});
