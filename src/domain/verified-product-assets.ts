// Verified 2026-09-19. Official presentation assets; never evidence of ownership or use.
import { z } from "zod";
import copilotManifest from "../../public/product-assets/github-copilot/2026-09-19/source-manifest.json";

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const sourceUrl = z.url().refine(value => new URL(value).protocol === "https:");
const assetPath = z.string().regex(/^\/product-assets\/[a-z0-9-]+\/\d{4}-\d{2}-\d{2}\/[a-zA-Z0-9_.-]+$/);
const asset = z.object({ path: assetPath, sha256 });
const verifiedProductAssetsSchema = z.object({
  schemaVersion: z.literal(1),
  provider: z.literal("official-vendor"),
  revision: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  productSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  canonicalDomain: z.string().regex(/^(?:[a-z0-9-]+\.)+[a-z]{2,63}$/),
  productUrl: sourceUrl,
  verifiedAt: z.iso.datetime(),
  manifestPath: assetPath,
  logoSource: z.object({
    pageUrl: sourceUrl,
    productGuidanceUrl: sourceUrl,
    archiveUrl: sourceUrl,
    archiveSha256: sha256,
    useBasis: z.string().min(1),
  }).strict(),
  logos: z.array(asset.extend({
    mode: z.enum(["light", "dark"]),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    archiveMember: z.string().min(1),
  }).strict()).min(1),
  typography: z.object({
    family: z.string().min(1),
    cssFamily: z.string().regex(/^[a-zA-Z0-9-]+$/),
    fallbacks: z.array(z.string().regex(/^[a-zA-Z0-9 -]+$/)).min(1),
    sourceUrl,
    sourceRevision: z.string().regex(/^[a-f0-9]{40}$/),
    files: z.array(asset.extend({
      weight: z.number().int().min(1).max(1000),
      format: z.literal("woff2"),
      sourceUrl,
    }).strict()).min(1),
    license: asset.extend({ name: z.string().min(1), sourceUrl }).strict(),
  }).strict(),
}).strict();

export type VerifiedProductAssets = z.infer<typeof verifiedProductAssetsSchema>;

const identityKey = (product: { slug: string; domain: string }) => `${product.slug}@${product.domain}`;
const registry = new Map<string, VerifiedProductAssets>([copilotManifest].map(manifest => {
  const assets = verifiedProductAssetsSchema.parse(manifest);
  return [identityKey({ slug: assets.productSlug, domain: assets.canonicalDomain }), assets];
}));

/** Exact product identity only: a parent domain or similar name cannot select a sub-brand. */
export function verifiedProductAssets(product: { slug: string; domain: string }) {
  return registry.get(identityKey(product));
}

export function selectVerifiedProductLogo(assets: VerifiedProductAssets, surface: "light" | "dark", failedPaths: readonly string[] = []) {
  return assets.logos.find(logo => logo.mode === surface && !failedPaths.includes(logo.path));
}

export function verifiedProductTypography(assets: VerifiedProductAssets): Record<`--brand-card-${string}`, string> {
  const family = [`"${assets.typography.cssFamily}"`, ...assets.typography.fallbacks].join(", ");
  return {
    "--brand-card-heading-font": family,
    "--brand-card-body-font": family,
    "--brand-card-heading-weight": "500",
    "--brand-card-body-weight": "400",
    "--brand-card-heading-tracking": "normal",
    "--brand-card-body-tracking": "normal",
  };
}

export function verifiedProductFontFaces(assets: VerifiedProductAssets) {
  return assets.typography.files.map(file =>
    `@font-face{font-family:"${assets.typography.cssFamily}";src:url("${file.path}") format("${file.format}");font-weight:${file.weight};font-style:normal;font-display:swap;}`,
  ).join("\n");
}
