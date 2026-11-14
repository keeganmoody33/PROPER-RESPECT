import { oklabDistance } from "../../src/domain/oklab.ts";

/**
 * Compares the traits measured on a product's own site with the traits measured on its homepage card.
 * Both sides come from scripts/brand-fidelity.mjs. Every tolerance is a named constant decided before any comparison ran.
 */

/** OKLab distance. 0.02 is about the smallest difference people notice; under this, two colours read as the same colour at a glance. */
export const COLOR_MATCH_DISTANCE = 0.05;
/** Two radii this close look the same at card size. */
export const RADIUS_MATCH_PX = 2;
/** Upper edges of the radius classes: square, then slightly rounded. Anything rounder that is not a pill is "rounded". */
export const SQUARE_MAX_PX = 1;
export const SLIGHT_MAX_PX = 8;
/** Letter-spacing within this much reads the same in small labels. */
export const TRACKING_MATCH_EM = 0.03;
/** A pill's radius is at least half its height. */
const PILL_HEIGHT_SHARE = 0.5;
/** Digits shown for measured distances and letter-spacing. */
const SHOWN_DIGITS = 3;

export type Measured<T> = { value: T; method: string } | { untested: string };
export type RadiusValue = { px: number; heightPx?: number };
export type FamilyValue = { family: string; generic: "serif" | "sans-serif" | "monospace" | "unknown" };
export type ColorValue = { hex: string; source?: string } | { transparent: true };

/** The traits a card is compared on. The site's side and the card's side measure the same list, element for element. */
export type BrandTraits = {
  surface: Measured<ColorValue>;
  text: Measured<ColorValue>;
  headingFamily: Measured<FamilyValue>;
  bodyFamily: Measured<FamilyValue>;
  buttonFill: Measured<ColorValue>;
  buttonText: Measured<ColorValue>;
  buttonRadius: Measured<RadiusValue>;
  buttonFamily: Measured<FamilyValue>;
  buttonCase: Measured<"uppercase" | "as written">;
  buttonTracking: Measured<number>;
  accent: Measured<ColorValue>;
  panelRadius: Measured<RadiusValue>;
  chipRadius: Measured<RadiusValue>;
  labelMono: Measured<boolean>;
  labelCase: Measured<"uppercase" | "as written">;
  labelTracking: Measured<number>;
};
export type TraitName = keyof BrandTraits;
export type BrandCapture = { slug: string; name: string; url: string; capturedAt: string; commit?: string; blocked?: string; traits: Partial<BrandTraits> };

type Comparison = { result: "passed" | "failed" | "untested"; reason?: string };
type Comparator<T> = (site: T, card: T) => Comparison;

const verdict = (passed: boolean, reason?: string): Comparison => (passed ? { result: "passed" } : { result: "failed", reason });

function radiusClass({ px, heightPx }: RadiusValue) {
  if (px <= SQUARE_MAX_PX) return "square";
  if (heightPx !== undefined && px >= heightPx * PILL_HEIGHT_SHARE - SQUARE_MAX_PX) return "pill";
  return px <= SLIGHT_MAX_PX ? "slightly rounded" : "rounded";
}
const sameColor: Comparator<ColorValue> = (site, card) => {
  if ("transparent" in site || "transparent" in card) return verdict("transparent" in site && "transparent" in card, "one side is unfilled");
  const distance = oklabDistance(site.hex, card.hex);
  return verdict(distance <= COLOR_MATCH_DISTANCE, `OKLab distance ${distance.toFixed(SHOWN_DIGITS)} > ${COLOR_MATCH_DISTANCE}`);
};
const sameRadius: Comparator<RadiusValue> = (site, card) => verdict(
  Math.abs(site.px - card.px) <= RADIUS_MATCH_PX || radiusClass(site) === radiusClass(card),
  `${radiusClass(site)} vs ${radiusClass(card)}`,
);
// Folds a family name to its identity. "Fraunces Variable" and "fraunces" both become "fraunces"; "Inter Display" stays "interdisplay".
// https://regex101.com/?regex=%5Cbvariable%5Cb%7C%5B%5Ea-z0-9%5D&flags=g&testString=fraunces%20variable%0Ainter%20display
const FAMILY_NOISE = /\bvariable\b|[^a-z0-9]/g;
const familyKey = (family: string) => family.toLowerCase().replace(FAMILY_NOISE, "");
const sameFamily: Comparator<FamilyValue> = (site, card) => {
  if (familyKey(site.family) === familyKey(card.family)) return { result: "passed" };
  return verdict(site.generic !== "unknown" && site.generic === card.generic, `${site.family} (${site.generic}) vs ${card.family} (${card.generic})`);
};
const same = <T,>(site: T, card: T) => verdict(site === card, `${String(site)} vs ${String(card)}`);
const sameTracking: Comparator<number> = (site, card) => verdict(Math.abs(site - card) <= TRACKING_MATCH_EM, `${site.toFixed(SHOWN_DIGITS)}em vs ${card.toFixed(SHOWN_DIGITS)}em`);

/** Each trait: the statement it tests, written before any capture, and how its two sides are compared. */
export const TARGETS: { [Name in TraitName]: { statement: string; compare: Comparator<BrandTraits[Name] extends Measured<infer T> ? T : never> } } = {
  surface: { statement: "the card's surface is the site's page background", compare: sameColor },
  text: { statement: "the card's text colour is the site's body text colour", compare: sameColor },
  headingFamily: { statement: "the card's heading is set in the site's h1 family", compare: sameFamily },
  bodyFamily: { statement: "the card's body text is set in the site's paragraph family", compare: sameFamily },
  buttonFill: { statement: "the card's button fill is the site's primary call-to-action fill", compare: sameColor },
  buttonText: { statement: "the card's button label colour is the site's primary call-to-action label colour", compare: sameColor },
  buttonRadius: { statement: "the card's button corners match the site's primary call-to-action within 2px or in class", compare: sameRadius },
  buttonFamily: { statement: "the card's button label is set in the site's call-to-action family", compare: sameFamily },
  buttonCase: { statement: "the card's button label has the site's call-to-action case", compare: same },
  buttonTracking: { statement: "the card's button label has the site's call-to-action letter-spacing", compare: sameTracking },
  accent: { statement: "the card's chart bars are the site's accent", compare: sameColor },
  panelRadius: { statement: "the card's corners match the site's bordered panels within 2px or in class", compare: sameRadius },
  chipRadius: { statement: "the card's chips match the site's button corners within 2px or in class", compare: sameRadius },
  labelMono: { statement: "the card's small labels are monospace exactly when the site's are", compare: same },
  labelCase: { statement: "the card's small labels have the site's small-label case", compare: same },
  labelTracking: { statement: "the card's small labels have the site's small-label letter-spacing", compare: sameTracking },
};
export const TRAIT_NAMES = Object.keys(TARGETS) as TraitName[];

/** The card's chips have no counterpart on the site, so they are held to the site's buttons. */
const SITE_SIDE: Partial<Record<TraitName, TraitName>> = { chipRadius: "buttonRadius" };

export type Row = { slug: string; name: string; trait: TraitName; statement: string; site: string; card: string } & Comparison;

type TraitValue = ColorValue | RadiusValue | FamilyValue | boolean | number | string;

export function describe(measured: Measured<TraitValue> | undefined): string {
  if (!measured) return "not measured";
  if ("untested" in measured) return `untested: ${measured.untested}`;
  const { value } = measured;
  if (typeof value === "object") {
    if ("transparent" in value) return "transparent";
    if ("hex" in value) return value.source ? `${value.hex} (${value.source})` : value.hex;
    if ("px" in value) return `${value.px}px ${radiusClass(value)}`;
    if ("family" in value) return `${value.family} (${value.generic})`;
  }
  return typeof value === "number" ? `${value.toFixed(SHOWN_DIGITS)}em` : String(value);
}

export function compareBrand(site: BrandCapture, card: BrandCapture): Row[] {
  return TRAIT_NAMES.map(trait => {
    const siteTrait = site.traits[SITE_SIDE[trait] ?? trait], cardTrait = card.traits[trait];
    const base = { slug: card.slug, name: card.name, trait, statement: `${card.name}: ${TARGETS[trait].statement}`, site: describe(siteTrait), card: describe(cardTrait) };
    if (site.blocked) return { ...base, result: "untested", reason: `site capture blocked: ${site.blocked}` };
    if (!siteTrait || "untested" in siteTrait) return { ...base, result: "untested", reason: siteTrait ? `site: ${siteTrait.untested}` : "site trait not measured" };
    if (!cardTrait || "untested" in cardTrait) return { ...base, result: "untested", reason: cardTrait ? `card: ${cardTrait.untested}` : "card trait not measured" };
    const compare = TARGETS[trait].compare as Comparator<unknown>;
    return { ...base, ...compare(siteTrait.value, cardTrait.value) };
  });
}

const cell = (text: string) => text.replaceAll("|", "\\|");

export function assertionsMarkdown({ title, commit, rows, sites }: { title: string; commit: string; rows: Row[]; sites: BrandCapture[] }): string {
  const slugs = [...new Set(rows.map(row => row.slug))];
  const count = (slug: string, result: Row["result"]) => rows.filter(row => row.slug === slug && row.result === result).length;
  const summary = slugs.map(slug => `| ${rows.find(row => row.slug === slug)!.name} | ${count(slug, "passed")} | ${count(slug, "failed")} | ${count(slug, "untested")} |`);
  const table = rows.map((row, index) => `| ${index + 1} | ${cell(row.statement)} | ${cell(row.site)} | ${cell(row.card)} | ${row.result}${row.reason ? `: ${cell(row.reason)}` : ""} |`);
  const methods = sites.flatMap(site => TRAIT_NAMES.flatMap(trait => {
    const measured = site.traits[trait];
    return measured && "method" in measured ? [`- ${site.name} ${trait}: ${measured.method}`] : [];
  }));
  return [
    `# ${title}`, "",
    `Card commit: \`${commit}\`. Tolerances: colour OKLab distance <= ${COLOR_MATCH_DISTANCE}; radius within ${RADIUS_MATCH_PX}px or the same class (square <= ${SQUARE_MAX_PX}px, slightly rounded <= ${SLIGHT_MAX_PX}px, pill >= half the height, else rounded); family the same named family, else the same generic class; letter-spacing within ${TRACKING_MATCH_EM}em.`, "",
    "| Brand | Passed | Failed | Untested |", "| --- | --- | --- | --- |", ...summary, "",
    `Totals: ${rows.filter(row => row.result === "passed").length} passed, ${rows.filter(row => row.result === "failed").length} failed, ${rows.filter(row => row.result === "untested").length} untested.`, "",
    "| # | Target | Site | Card | Result |", "| --- | --- | --- | --- | --- |", ...table, "",
    "## How each site trait was located", "", ...methods, "",
  ].join("\n");
}
