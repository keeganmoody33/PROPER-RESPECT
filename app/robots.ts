import type { MetadataRoute } from "next";
import { publicSiteOrigin } from "@/src/server/public-site";

export default function robots(): MetadataRoute.Robots {
  const origin = publicSiteOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      other: { Agentmap: new URL("/.well-known/ard.json", origin).href },
    },
    sitemap: new URL("/sitemap.xml", origin).href,
  };
}
