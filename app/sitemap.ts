import type { MetadataRoute } from "next";
import { publicSiteOrigin } from "@/src/server/public-site";
import { homepageUpdatedAt } from "@/src/server/agent-discovery";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: publicSiteOrigin().href, lastModified: homepageUpdatedAt }];
}
