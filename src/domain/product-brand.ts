import { z } from "zod";

/** Presentation context only. No owner, relationship, observation or usage fields. */
export const CONTEXT_BRAND_ADAPTER_VERSION = "context-brand-v2-2026-09-18";
const modeSchema = z.enum(["light", "dark", "unknown"]);
const colorSchema = z.string().regex(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/);
const labelSchema = z.string().min(1).max(120);
const fontSchema = z.string().min(1).max(100).regex(/^[\p{L}\p{N} _-]+$/u);
export const canonicalBrandDomainSchema = z.string().max(253).regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/);

function isSafeAssetUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.hash &&
      !url.port && canonicalBrandDomainSchema.safeParse(url.hostname).success &&
      !/(?:^|\.)(?:localhost|local|internal)$/.test(url.hostname) &&
      ![...url.searchParams.keys()].some((key) => /key|token|auth|secret|password|credential|signature|session|jwt|bearer|^code$|^sig$|^x-amz-/i.test(key));
  } catch { return false; }
}
export const productBrandLogoSchema = z.object({
  url: z.string().max(2_048).refine(isSafeAssetUrl),
  mode: modeSchema,
  type: z.enum(["logo", "icon", "unknown"]),
  width: z.number().int().positive().max(32_768).optional(),
  height: z.number().int().positive().max(32_768).optional(),
}).strict();
export const genericFontFamilies = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-serif", "ui-sans-serif", "ui-monospace", "ui-rounded", "emoji", "math", "fangsong"]);
export const productBrandFontFamilyKey = (family: string) => family.trim().replace(/\s+/g, " ").toLowerCase();
function fontAssetFormat(value: unknown) {
  if (typeof value !== "string" || !isSafeAssetUrl(value) || /[\s<>"'\\{}\u0000-\u001f\u007f]/.test(value)) return undefined;
  const url = new URL(value);
  if (url.hostname === "api.context.dev") return undefined;
  const extension = url.pathname.match(/\.(woff2?|ttf|otf)$/i)?.[1].toLowerCase();
  return extension === "ttf" ? "truetype" : extension === "otf" ? "opentype" : extension;
}
export const productBrandFontFileSchema = z.object({
  url: z.string().max(2_048).refine((value) => Boolean(fontAssetFormat(value))),
  weight: z.number().int().min(1).max(1_000),
  format: z.enum(["woff2", "woff", "truetype", "opentype"]),
}).strict().refine((file) => file.format === fontAssetFormat(file.url));
const fontLinkSchema = z.object({
  family: fontSchema.refine((family) => !genericFontFamilies.has(productBrandFontFamilyKey(family))),
  source: z.enum(["fonts", "styleguide"]),
  type: z.enum(["google", "custom"]),
  category: z.enum(["sans-serif", "serif", "monospace", "display", "handwriting"]).optional(),
  files: z.array(productBrandFontFileSchema).min(1).max(16),
}).strict();
export const productBrandTypographyRoleSchema = z.object({
  family: fontSchema,
  fallbacks: z.array(fontSchema).max(32),
  weight: z.number().int().min(1).max(1_000).optional(),
  fontSizePx: z.number().min(1).max(256).optional(),
  lineHeight: z.number().min(0.8).max(3).optional(),
  letterSpacingEm: z.number().min(-0.1).max(0.25).optional(),
}).strict();
export type ProductBrandTypographyRole = z.infer<typeof productBrandTypographyRoleSchema>;
const receiptSchema = z.object({
  endpoint: z.enum(["brand", "fonts", "styleguide"]),
  status: z.enum(["ok", "unavailable", "error"]),
  httpStatus: z.number().int().min(100).max(599).optional(),
  requestId: z.string().max(128).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  partial: z.boolean().optional(),
}).strict();
const productBrandSnapshotV1Schema = z.object({
  schemaVersion: z.literal(1),
  provider: z.literal("context.dev"),
  adapterVersion: z.string().min(1).max(100),
  productSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
  canonicalDomain: canonicalBrandDomainSchema,
  retrievalId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  // Defer Zod's circular ISO module initialization in the server/client bundle.
  retrievedAt: z.lazy(() => z.iso.datetime()),
  partial: z.boolean(),
  logos: z.array(productBrandLogoSchema).max(32),
  colors: z.array(z.object({ hex: colorSchema, name: labelSchema.optional(), source: labelSchema.optional() }).strict()).max(64),
  fonts: z.array(z.object({ family: fontSchema, uses: z.array(labelSchema).max(32), fallbacks: z.array(fontSchema).max(32) }).strict()).max(64),
  styleguide: z.object({
    mode: modeSchema,
    colors: z.object({ accent: colorSchema.optional(), background: colorSchema.optional(), text: colorSchema.optional() }).strict(),
    headingFamily: fontSchema.optional(),
    bodyFamily: fontSchema.optional(),
  }).strict().optional(),
  receipts: z.array(receiptSchema).max(3),
  responseHash: z.string().regex(/^[0-9a-f]{64}$/),
}).strict();
const productBrandSnapshotV2Schema = productBrandSnapshotV1Schema.extend({
  schemaVersion: z.literal(2),
  fontLinks: z.array(fontLinkSchema).max(64),
  styleguide: productBrandSnapshotV1Schema.shape.styleguide.unwrap().extend({
    typography: z.object({ heading: productBrandTypographyRoleSchema.optional(), body: productBrandTypographyRoleSchema.optional() }).strict().optional(),
  }).optional(),
});
export const productBrandSnapshotSchema = z.discriminatedUnion("schemaVersion", [productBrandSnapshotV1Schema, productBrandSnapshotV2Schema]);
export const productBrandRetrievalSchema = productBrandSnapshotV1Schema.pick({ productSlug: true, canonicalDomain: true, retrievalId: true, retrievedAt: true, responseHash: true });
export type ProductBrandSnapshot = z.infer<typeof productBrandSnapshotSchema>;
export type ContextBrandResponses = { brand: unknown; fonts?: unknown; styleguide?: unknown };
export type ProductBrandReceipt = ProductBrandSnapshot["receipts"][number];
/** Logo mode describes its intended surface; callers can back an opposite-mode fallback. */
export function selectProductBrandLogo(snapshot: Pick<ProductBrandSnapshot, "logos">, surface: "light" | "dark") {
  for (const candidateMode of [surface, "unknown", surface === "dark" ? "light" : "dark"]) {
    const candidates = snapshot.logos.filter((logo) => logo.mode === candidateMode);
    const selected = candidates.find((logo) => logo.type === "icon") ?? candidates.find((logo) => logo.type === "logo") ?? candidates[0];
    if (selected) return selected;
  }
  return undefined;
}
type SnapshotInput = Pick<ProductBrandSnapshot, "productSlug" | "canonicalDomain" | "retrievalId" | "retrievedAt" | "responseHash"> & { receipts?: ProductBrandReceipt[] };
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown, limit = 120) => typeof value === "string" && value.trim() && value.length <= limit && !/[\u0000-\u001f\u007f]/.test(value) ? value.trim() : undefined;
function fontFamily(value: unknown) {
  const family = text(value, 100)?.replace(/^(['"])(.*)\1$/, "$2");
  return fontSchema.safeParse(family).success ? family : undefined;
}
function color(value: unknown) {
  if (typeof value !== "string") return undefined;
  const hex = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3,4}$/.test(hex)) return `#${[...hex.slice(1)].map((digit) => digit + digit).join("")}`;
  return colorSchema.safeParse(hex).success ? hex : undefined;
}
function mode(value: unknown): ProductBrandSnapshot["logos"][number]["mode"] { return value === "light" || value === "dark" ? value : "unknown"; }
function optionalFields<T extends Record<string, unknown>>(value: T) { return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)); }

function normalizedTypography(value: unknown): { role?: ProductBrandTypographyRole; dropped: boolean } {
  const item = record(value), family = fontFamily(item.fontFamily);
  if (!family) return { dropped: Object.keys(item).length > 0 };
  const fallbacks = array(item.fontFallbacks).slice(0, 32).flatMap((fallback) => fontFamily(fallback) ? [fontFamily(fallback)!] : []);
  const pixelSize = typeof item.fontSize === "string" && item.fontSize.match(/^(\d+(?:\.\d+)?)px$/);
  const fontSizePx = pixelSize && productBrandTypographyRoleSchema.shape.fontSizePx.safeParse(Number(pixelSize[1])).success ? Number(pixelSize[1]) : undefined;
  const numeric = (input: unknown, kind: "lineHeight" | "letterSpacingEm") => {
    if (kind === "letterSpacingEm" && input === "normal") return 0;
    if (typeof input !== "string") return undefined;
    const match = input.match(/^(-?\d+(?:\.\d+)?)(px|em|%)?$/);
    if (!match) return undefined;
    let number = Number(match[1]);
    if (match[2] === "px") { if (!fontSizePx) return number === 0 && kind === "letterSpacingEm" ? 0 : undefined; number /= fontSizePx; }
    if (match[2] === "%") { if (kind !== "lineHeight") return undefined; number /= 100; }
    return productBrandTypographyRoleSchema.shape[kind].safeParse(number).success ? number : undefined;
  };
  const weight = productBrandTypographyRoleSchema.shape.weight.safeParse(item.fontWeight).success ? item.fontWeight as number | undefined : undefined;
  const lineHeight = numeric(item.lineHeight, "lineHeight"), letterSpacingEm = numeric(item.letterSpacing, "letterSpacingEm");
  const role = productBrandTypographyRoleSchema.parse(optionalFields({ family, fallbacks, weight, fontSizePx, lineHeight, letterSpacingEm }));
  const dropped = (item.fontFallbacks !== undefined && (!Array.isArray(item.fontFallbacks) || fallbacks.length !== item.fontFallbacks.length)) ||
    [[item.fontWeight, weight], [item.fontSize, fontSizePx], [item.lineHeight, lineHeight], [item.letterSpacing, letterSpacingEm]].some(([raw, normalized]) => raw !== undefined && normalized === undefined);
  return { role, dropped };
}

function normalizedFontLinks(value: unknown, source: "fonts" | "styleguide", families: string[]) {
  const entries = Object.entries(record(value));
  let dropped = value !== undefined && (!value || typeof value !== "object" || Array.isArray(value)) || entries.length > 32;
  const allowedFamilies = new Set(families.map(productBrandFontFamilyKey));
  const links: z.infer<typeof fontLinkSchema>[] = [];
  for (const [name, raw] of entries.slice(0, 32)) {
    const item = record(raw), family = fontFamily(name);
    if (!family || !allowedFamilies.has(productBrandFontFamilyKey(family)) || genericFontFamilies.has(productBrandFontFamilyKey(family)) || !["google", "custom"].includes(String(item.type))) { dropped = true; continue; }
    const entries = Object.entries(record(item.files));
    const files = entries.slice(0, 16).flatMap(([weight, url]) => {
      const parsed = productBrandFontFileSchema.safeParse({ url, weight: /^\d{1,4}$/.test(weight) ? Number(weight) : undefined, format: fontAssetFormat(url) });
      return parsed.success ? [parsed.data] : [];
    });
    const category = fontLinkSchema.shape.category.safeParse(item.category);
    if (!category.success || files.length !== entries.length || !files.length) dropped = true;
    if (files.length) links.push(fontLinkSchema.parse(optionalFields({ family, source, type: item.type, category: category.success ? category.data : undefined, files })));
  }
  return { links, dropped };
}

/** The caller establishes canonical identity; a provider redirect never changes it. */
export function normalizeProductBrand(input: SnapshotInput, responses: ContextBrandResponses): ProductBrandSnapshot {
  canonicalBrandDomainSchema.parse(input.canonicalDomain);
  const brandResponse = record(responses.brand), brand = record(brandResponse.brand);
  if (brandResponse.status !== "ok") throw new Error("Context.dev brand response unavailable.");
  if (brand.domain !== input.canonicalDomain) throw new Error("Context.dev brand domain did not match canonical product.");
  const logos = array(brand.logos).slice(0, 32).flatMap((value) => {
    const logo = record(value), resolution = record(logo.resolution);
    const parsed = productBrandLogoSchema.safeParse(optionalFields({
      url: logo.url, mode: mode(logo.mode), type: logo.type === "icon" || logo.type === "logo" ? logo.type : "unknown",
      width: typeof resolution.width === "number" && Number.isInteger(resolution.width) && resolution.width > 0 && resolution.width <= 32_768 ? resolution.width : undefined,
      height: typeof resolution.height === "number" && Number.isInteger(resolution.height) && resolution.height > 0 && resolution.height <= 32_768 ? resolution.height : undefined,
    }));
    return parsed.success ? [parsed.data] : [];
  });
  const colors = array(brand.colors).slice(0, 64).flatMap((value) => {
    const item = record(value), hex = color(item.hex);
    return hex ? [optionalFields({ hex, name: text(item.name), source: text(item.source) })] : [];
  });
  const fontResponse = record(responses.fonts);
  const hasFonts = fontResponse.status === "ok" && fontResponse.domain === input.canonicalDomain && Array.isArray(fontResponse.fonts);
  const fonts = hasFonts ? array(fontResponse.fonts).slice(0, 64).flatMap((value) => {
    const item = record(value), family = fontFamily(item.font);
    return family ? [{ family, uses: array(item.uses).slice(0, 32).flatMap((use) => text(use) ? [text(use)!] : []), fallbacks: array(item.fallbacks).slice(0, 32).flatMap((fallback) => fontFamily(fallback) ? [fontFamily(fallback)!] : []) }] : [];
  }) : [];
  const styleResponse = record(responses.styleguide);
  const style = record(styleResponse.styleguide), styleColors = record(style.colors), typography = record(style.typography);
  const hasStyleguide = styleResponse.status === "ok" && styleResponse.domain === input.canonicalDomain && Object.keys(style).length > 0;
  const heading = normalizedTypography(record(typography.headings).h1), body = normalizedTypography(typography.p);
  const fontAssets = normalizedFontLinks(hasFonts ? fontResponse.fontLinks : undefined, "fonts", fonts.map((font) => font.family));
  const styleAssets = normalizedFontLinks(hasStyleguide ? style.fontLinks : undefined, "styleguide", [heading.role, body.role].flatMap((role) => role ? [role.family, ...role.fallbacks] : []));
  const styleguide = hasStyleguide && Object.keys(style).length ? optionalFields({
    mode: mode(style.mode), colors: optionalFields({ accent: color(styleColors.accent), background: color(styleColors.background), text: color(styleColors.text) }),
    headingFamily: fontFamily(record(record(typography.headings).h1).fontFamily), bodyFamily: fontFamily(record(typography.p).fontFamily),
    typography: heading.role || body.role ? optionalFields({ heading: heading.role, body: body.role }) : undefined,
  }) : undefined;
  const dropped: Record<ProductBrandReceipt["endpoint"], boolean> = {
    brand: !Array.isArray(brand.logos) || !Array.isArray(brand.colors) || logos.length !== array(brand.logos).length || colors.length !== array(brand.colors).length,
    fonts: fonts.length !== array(fontResponse.fonts).length || fontAssets.dropped,
    styleguide: ["accent", "background", "text"].some((key) => styleColors[key] !== undefined && !color(styleColors[key])) ||
      (record(record(typography.headings).h1).fontFamily !== undefined && !fontFamily(record(record(typography.headings).h1).fontFamily)) ||
      (record(typography.p).fontFamily !== undefined && !fontFamily(record(typography.p).fontFamily)) || heading.dropped || body.dropped || styleAssets.dropped,
  };
  const receipts: ProductBrandReceipt[] = (["brand", "fonts", "styleguide"] as const).map((endpoint) => {
    const response = record(responses[endpoint]);
    const ok = endpoint === "brand" || (endpoint === "fonts" ? hasFonts : hasStyleguide);
    const existing = input.receipts?.find((receipt) => receipt.endpoint === endpoint);
    return receiptSchema.parse(optionalFields({
      endpoint, status: ok ? "ok" : existing?.status === "error" ? "error" : "unavailable",
      httpStatus: existing?.httpStatus,
      requestId: receiptSchema.shape.requestId.safeParse(response.request_id).success ? response.request_id : existing?.requestId,
      partial: response.partial === true || response.finalDOMState === "still-loading" || dropped[endpoint] ? true : existing?.partial,
    }));
  });
  return productBrandSnapshotSchema.parse({
    schemaVersion: 2, provider: "context.dev", adapterVersion: CONTEXT_BRAND_ADAPTER_VERSION,
    productSlug: input.productSlug, canonicalDomain: input.canonicalDomain, retrievalId: input.retrievalId, retrievedAt: input.retrievedAt,
    partial: receipts.some((receipt) => receipt.status !== "ok" || receipt.partial === true),
    logos, colors, fonts, fontLinks: [...fontAssets.links, ...styleAssets.links], ...(styleguide ? { styleguide } : {}), receipts, responseHash: input.responseHash,
  });
}
