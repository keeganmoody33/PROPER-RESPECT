import type { Metadata } from "next";
import { handleSchema } from "@/src/domain/public-profile";

export function publicSiteOrigin(): URL {
  const configured = process.env.PUBLIC_SITE_ORIGIN?.trim();
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("PUBLIC_SITE_ORIGIN is required in production.");
  }
  const invalid = () => new Error("PUBLIC_SITE_ORIGIN must be an HTTPS origin (HTTP localhost is allowed outside production).");
  let url: URL;
  try {
    url = new URL(configured || "http://localhost:3000");
  } catch {
    throw invalid();
  }
  const local = process.env.NODE_ENV !== "production" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
      url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw invalid();
  }
  return url;
}

export function publicPageMetadata(title: string, description: string, handle?: string): Metadata {
  const origin = publicSiteOrigin();
  const path = handle === undefined ? "/" : `/${handleSchema.parse(handle)}`;
  const url = new URL(path, origin).href;
  const image = new URL("/share-image.png", origin).href;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: "PROPER—RESPECT",
      title,
      description,
      url,
      images: [{ url: image, width: 1200, height: 630, alt: "PROPER—RESPECT. Your tools. Your track record." }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
