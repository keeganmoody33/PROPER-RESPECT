import type { MetadataRoute } from "next";
import { publicSiteOrigin } from "@/src/server/public-site";
import { homepageUpdatedAt } from "@/src/server/agent-discovery";
import { trustDocuments } from "@/src/server/trust-pages";
import { getSitemapListing } from "@/src/data/search";

// Listed pages change whenever someone publishes, so the sitemap is read per request, never frozen at build.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = publicSiteOrigin();
  const { handles, tools } = await getSitemapListing();
  return [
    { url: origin.href, lastModified: homepageUpdatedAt },
    ...Object.entries(trustDocuments).map(([slug, document]) => ({
      url: new URL(`/about/${slug}`, origin).href,
      lastModified: document.updatedAt,
    })),
    { url: new URL("/search", origin).href },
    ...handles.map(handle => ({ url: new URL(`/${handle}`, origin).href })),
    ...tools.map(slug => ({ url: new URL(`/tools/${slug}`, origin).href })),
  ];
}
