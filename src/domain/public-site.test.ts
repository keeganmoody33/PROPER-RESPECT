import { describe, expect, it } from "vitest";
import {
  buildPublicProfileMetadata,
  parsePublicSiteUrl,
} from "./public-site";

describe("parsePublicSiteUrl", () => {
  it("accepts and normalizes the configured production origin", () => {
    expect(
      parsePublicSiteUrl("https://props.lecturesfrom.com/").href,
    ).toBe("https://props.lecturesfrom.com/");
  });

  it("rejects values that are not a bare origin", () => {
    expect(() =>
      parsePublicSiteUrl("https://props.lecturesfrom.com/keegan"),
    ).toThrow("must be an origin");
  });

  it("rejects insecure non-local origins", () => {
    expect(() => parsePublicSiteUrl("http://props.lecturesfrom.com")).toThrow(
      "must use HTTPS",
    );
  });

  it("keeps local development origins valid", () => {
    expect(parsePublicSiteUrl("http://localhost:3000").href).toBe(
      "http://localhost:3000/",
    );
  });
});

describe("buildPublicProfileMetadata", () => {
  it("publishes the configured origin as the profile canonical and Open Graph URL", () => {
    const metadata = buildPublicProfileMetadata({
      siteUrl: parsePublicSiteUrl("https://props.lecturesfrom.com"),
      profile: {
        handle: "keegan",
        displayName: "Keegan Moody",
        bio: "Builder.",
      },
    });

    expect(metadata).toMatchObject({
      metadataBase: new URL("https://props.lecturesfrom.com"),
      title: "Keegan Moody",
      description: "Builder.",
      alternates: {
        canonical: new URL("https://props.lecturesfrom.com/keegan"),
      },
      openGraph: {
        type: "profile",
        title: "Keegan Moody",
        description: "Builder.",
        url: new URL("https://props.lecturesfrom.com/keegan"),
      },
    });
  });
});
