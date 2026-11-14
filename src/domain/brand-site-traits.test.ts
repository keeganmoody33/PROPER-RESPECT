import { expect, test } from "vitest";
import { brandSiteTraitsFromMeasurement, brandSiteTraitsSchema, signatureColour, type SiteMeasurement } from "./brand-site-traits";

/** Spider's measured 2026-11-14: a 48px-tall square button, labels tracked 0.14em, at a 1440x900 viewport. */
const DESKTOP_WIDTH = 1440, DESKTOP_HEIGHT = 900, SPIDER_TRACKING_EM = 0.14, SPIDER_BUTTON_HEIGHT_PX = 48;
/** A 21px radius on a 42px-tall button is a pill; a 3em letter-spacing and a -4px radius are out of range. */
const PILL_RADIUS_PX = 21, PILL_HEIGHT_PX = 42, OUT_OF_RANGE_TRACKING_EM = 3, NEGATIVE_RADIUS_PX = -4;
const META = { productSlug: "spider", canonicalDomain: "spider.cloud", measuredAt: "2026-11-14T18:00:00.000Z", url: "https://spider.cloud/", viewport: { width: DESKTOP_WIDTH, height: DESKTOP_HEIGHT } };
const SPIDER: SiteMeasurement = {
  surface: "#0c0e13", text: "#f8fafc",
  headingFont: { family: "Fraunces Variable", generic: "serif" }, bodyFont: { family: "Inter Variable", generic: "sans-serif" },
  labels: { font: { family: "Berkeley", generic: "monospace" }, case: "uppercase", trackingEm: SPIDER_TRACKING_EM },
  primaryButton: { fill: "#f8fafc", label: "#0c0e13", radiusPx: 0, heightPx: SPIDER_BUTTON_HEIGHT_PX, font: { family: "Berkeley", generic: "monospace" }, case: "uppercase", trackingEm: SPIDER_TRACKING_EM },
  secondaryButton: { label: "#94a3b8", border: "#414a58", radiusPx: 0, heightPx: SPIDER_BUTTON_HEIGHT_PX, font: { family: "Berkeley", generic: "monospace" }, case: "uppercase", trackingEm: SPIDER_TRACKING_EM },
  panelRadiusPx: 0,
  signatureCandidates: [{ hex: "#f8fafc", from: "primary call-to-action" }, { hex: "#3bde77", from: "heading highlight" }, { hex: "#24c45c", from: "logo" }],
  hero: { hex: undefined, fullBleed: false },
};

test("a page measurement becomes a stored file of typed traits, each with where it was found", () => {
  expect(brandSiteTraitsFromMeasurement(META, SPIDER)).toEqual({
    schemaVersion: 1, ...META,
    traits: {
      surface: { value: "#0c0e13", from: "page background" },
      text: { value: "#f8fafc", from: "text on the page background" },
      headingFont: { value: { family: "Fraunces Variable", generic: "serif" }, from: "first heading" },
      bodyFont: { value: { family: "Inter Variable", generic: "sans-serif" }, from: "first paragraph" },
      labelFont: { value: { family: "Berkeley", generic: "monospace" }, from: "small labels" },
      labelCase: { value: "uppercase", from: "small labels" },
      labelTrackingEm: { value: SPIDER_TRACKING_EM, from: "small labels" },
      primaryButton: { value: { fill: "#f8fafc", text: "#0c0e13", radius: { px: 0, pill: false }, font: { family: "Berkeley", generic: "monospace" }, case: "uppercase", trackingEm: SPIDER_TRACKING_EM }, from: "primary call-to-action" },
      secondaryButton: { value: { text: "#94a3b8", border: "#414a58", radius: { px: 0, pill: false }, font: { family: "Berkeley", generic: "monospace" }, case: "uppercase", trackingEm: SPIDER_TRACKING_EM }, from: "secondary call-to-action" },
      panelRadiusPx: { value: 0, from: "bordered panels" },
      signature: { value: "#3bde77", from: "heading highlight" },
      hero: { value: { kind: "none" }, from: "backdrop behind the first heading" },
    },
  });
});

test("a value that is not a plain colour, number, name or enumeration is dropped alone", () => {
  const traits = brandSiteTraitsFromMeasurement(META, {
    surface: "rgb(0, 0, 0)", text: "#F8FAFC", labels: { font: { family: "Inter\", sans-serif; x: url(a)", generic: "sans-serif" }, case: "constructor", trackingEm: OUT_OF_RANGE_TRACKING_EM },
    primaryButton: { fill: "javascript:alert(1)", label: "#000000", radiusPx: PILL_RADIUS_PX, heightPx: PILL_HEIGHT_PX }, panelRadiusPx: NEGATIVE_RADIUS_PX,
  }).traits;
  expect(traits).toEqual({
    text: { value: "#f8fafc", from: "text on the page background" },
    labelFont: { value: { generic: "sans-serif" }, from: "small labels" },
    primaryButton: { value: { text: "#000000", radius: { px: PILL_RADIUS_PX, pill: true } }, from: "primary call-to-action" },
  });
});

test("a full-bleed colour hero is stored with its colour and can be the signature; a narrower backdrop is no hero", () => {
  const clay = brandSiteTraitsFromMeasurement({ ...META, productSlug: "clay", canonicalDomain: "clay.com", url: "https://clay.com/" }, {
    signatureCandidates: [{ hex: "#000000", from: "logo" }], hero: { hex: "#035d44", fullBleed: true, kind: "colour" },
  }).traits;
  expect(clay.hero).toEqual({ value: { kind: "colour", hex: "#035d44" }, from: "backdrop behind the first heading" });
  expect(clay.signature).toEqual({ value: "#035d44", from: "hero" });
  expect(brandSiteTraitsFromMeasurement(META, { hero: { hex: "#0f1117", fullBleed: false } }).traits.hero).toEqual({ value: { kind: "none" }, from: "backdrop behind the first heading" });
  expect(brandSiteTraitsFromMeasurement(META, { hero: { hex: "#035d44", fullBleed: true, kind: "image" } }).traits).toEqual({ hero: { value: { kind: "image", hex: "#035d44" }, from: "backdrop behind the first heading" } });
});

test("the signature is the most colourful candidate, greys never count and the earlier of two equals wins", () => {
  expect(signatureColour([{ hex: "#cbd810", from: "primary call-to-action" }, { hex: "#035d44", from: "hero" }])).toEqual({ hex: "#cbd810", from: "primary call-to-action" });
  expect(signatureColour([{ hex: "#94a3b8", from: "primary call-to-action" }, { hex: "#ffffff", from: "logo" }])).toBe(undefined);
  expect(signatureColour([{ hex: "#2560ff", from: "primary call-to-action" }, { hex: "#2560ff", from: "logo" }])).toEqual({ hex: "#2560ff", from: "primary call-to-action" });
});

test("a stored file must name the root of its own canonical domain and nothing else", () => {
  const file = brandSiteTraitsFromMeasurement(META, {});
  expect(brandSiteTraitsSchema.safeParse({ ...file, url: "https://spider.cloud/pricing" }).success).toBe(false);
  expect(brandSiteTraitsSchema.safeParse({ ...file, url: "http://spider.cloud/" }).success).toBe(false);
  expect(brandSiteTraitsSchema.safeParse({ ...file, traits: { css: "color: red" } }).success).toBe(false);
  expect(brandSiteTraitsSchema.safeParse(file).success).toBe(true);
});
