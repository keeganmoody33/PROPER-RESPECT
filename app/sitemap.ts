import type { MetadataRoute } from "next";
import { publicSiteOrigin } from "@/src/server/public-site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: publicSiteOrigin().href }];
}
