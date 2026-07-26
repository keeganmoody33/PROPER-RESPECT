import type { Metadata } from "next";
import {
  handleSchema,
  type PublicProfile,
} from "./public-profile";

export function parsePublicSiteUrl(value: string): URL {
  const url = new URL(value);
  const isLocal =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]";

  if (url.href !== `${url.origin}/`) {
    throw new Error("Public site URL must be an origin without a path");
  }

  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal)) {
    throw new Error("Public site URL must use HTTPS outside local development");
  }

  return url;
}

export function buildPublicProfileMetadata(input: {
  siteUrl: URL;
  profile: Pick<PublicProfile, "handle" | "displayName" | "bio">;
}): Metadata {
  const handle = handleSchema.parse(input.profile.handle);
  const profileUrl = new URL(`/${handle}`, input.siteUrl);

  return {
    metadataBase: input.siteUrl,
    title: input.profile.displayName,
    description: input.profile.bio,
    alternates: {
      canonical: profileUrl,
    },
    openGraph: {
      type: "profile",
      title: input.profile.displayName,
      description: input.profile.bio,
      url: profileUrl,
    },
  };
}
