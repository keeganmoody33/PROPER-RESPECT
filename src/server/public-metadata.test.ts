import { afterEach, describe, expect, it, vi } from "vitest";
import { generateMetadata } from "@/app/[handle]/page";
import { getPublicProfile } from "@/src/data/get-public-profile";
import { e2eReferenceProfile } from "@/src/data/e2e-reference-profile";

vi.mock("@/src/data/get-public-profile", () => ({ getPublicProfile: vi.fn() }));
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });

describe("public profile metadata", () => {
  it("uses the returned canonical handle for a legacy request", async () => {
    vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://proper-respect.com");
    vi.mocked(getPublicProfile).mockResolvedValue({ ...e2eReferenceProfile, handle: "lecturesfrom" });
    const metadata = await generateMetadata({ params: Promise.resolve({ handle: "keegan" }) });
    expect(metadata.alternates?.canonical).toBe("https://proper-respect.com/lecturesfrom");
    expect(metadata.openGraph).toMatchObject({ url: "https://proper-respect.com/lecturesfrom" });
  });
  it.each(["https://proper-respect.com", "https://props.lecturesfrom.com"])(
    "uses configured public origin %s, independently of mailbox callbacks", async (origin) => {
      vi.stubEnv("PUBLIC_SITE_ORIGIN", origin);
      vi.stubEnv("MAILBOX_APPLICATION_ORIGIN", "https://auth.example.com");
      vi.mocked(getPublicProfile).mockResolvedValue(e2eReferenceProfile);
      const metadata = await generateMetadata({ params: Promise.resolve({ handle: e2eReferenceProfile.handle }) });
      expect(metadata.alternates?.canonical).toBe(`${origin}/${e2eReferenceProfile.handle}`);
      expect(metadata.openGraph).toMatchObject({ url: `${origin}/${e2eReferenceProfile.handle}`, title: e2eReferenceProfile.displayName });
      expect(metadata.twitter).toMatchObject({ card: "summary_large_image", images: [`${origin}/share-image.png?v=20260922`] });
    },
  );

  it("does not advertise an unpublished profile", async () => {
    vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://proper-respect.com");
    vi.mocked(getPublicProfile).mockResolvedValue(null);
    const metadata = await generateMetadata({ params: Promise.resolve({ handle: "private-owner" }) });
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph).toBeUndefined();
  });

  it("does not advertise an unavailable profile", async () => {
    vi.mocked(getPublicProfile).mockRejectedValue(new Error("Unavailable"));
    const metadata = await generateMetadata({ params: Promise.resolve({ handle: "missing" }) });
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.alternates).toBeUndefined();
  });
});
