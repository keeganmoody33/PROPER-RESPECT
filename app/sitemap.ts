import type { MetadataRoute } from "next";
import { publicSiteOrigin } from "@/src/server/public-site";
import { homepageUpdatedAt } from "@/src/server/agent-discovery";
import { trustDocuments } from "@/src/server/trust-pages";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: publicSiteOrigin().href, lastModified: homepageUpdatedAt },
    ...Object.entries(trustDocuments).map(([slug, document]) => ({
      url: new URL(`/about/${slug}`, publicSiteOrigin()).href,
      lastModified: document.updatedAt,
    })),
  ];
}
