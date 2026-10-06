import { afterEach, expect, it, vi } from "vitest";
import { trustDocuments, trustMarkdown, trustMarkdownResponse, trustMetadata } from "./trust-pages";

afterEach(() => vi.unstubAllEnvs());

it.each(["origins", "contact", "privacy", "terms", "methodology"] as const)("keeps %s previews out of indexing without overriding inherited HTML robots", async slug => {
  vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://canonical.example");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("VERCEL_URL", "preview.example");
  const metadata = trustMetadata(slug);
  expect(metadata.robots).toBeUndefined();
  expect(metadata.alternates?.canonical).toBe(`https://canonical.example/about/${slug}`);
  const response = trustMarkdownResponse(slug);
  expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  expect(response.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  expect(await response.text()).not.toContain("preview.example");
  vi.stubEnv("VERCEL_ENV", "production");
  expect(trustMarkdownResponse(slug).headers.get("X-Robots-Tag")).toBeNull();
});

it("states Google's Limited Use commitment and links the policy on the privacy page", () => {
  vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://canonical.example");
  const markdown = trustMarkdown("privacy");
  expect(markdown).toContain("Proper Respect's use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.");
  expect(markdown).toContain("(https://developers.google.com/terms/api-services-user-data-policy)");
  expect(trustDocuments.privacy.sections.map(section => section.heading)).toContain("How to request deletion");
});

it("covers each required terms section and links contact and data handling", () => {
  expect(trustDocuments.terms.sections.map(section => section.heading)).toEqual([
    "Acceptable use", "Your content and our right to display it", "What we may remove and how",
    "Disclose affiliate and referral links", "No warranty", "Changes to these terms", "Contact",
  ]);
  const links = trustDocuments.terms.sections.flatMap(section => section.links ?? []).map(link => link.href);
  expect(links).toEqual(expect.arrayContaining(["mailto:33@lecturesfrom.com", "/about/privacy"]));
});

it("discloses PostHog analytics, replay limits and private-route handling on the privacy page", () => {
  vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://canonical.example");
  const markdown = trustMarkdown("privacy");
  expect(markdown).toContain("PostHog");
  expect(markdown).toMatch(/session replay/i);
  expect(markdown).toMatch(/signed-in|sign-in/i);
  expect(markdown).toMatch(/bot/i);
});

it("distinguishes isolated Searchable public visits from PostHog without promising AI referral measurement", () => {
  vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://canonical.example");
  const markdown = trustMarkdown("privacy");
  expect(markdown).toContain("isolated browser frame");
  expect(markdown).toContain("without query strings or fragments");
  expect(markdown).toContain("Signed-in, sign-in, sign-up and onboarding routes are excluded");
  expect(markdown).toContain("does not measure referrals from AI services");
  expect(markdown).toContain("PostHog");
  expect(trustDocuments.privacy.updatedAt).toBe("2026-10-06");
});
