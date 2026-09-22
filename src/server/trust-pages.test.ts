import { afterEach, expect, it, vi } from "vitest";
import { trustMarkdownResponse, trustMetadata } from "./trust-pages";

afterEach(() => vi.unstubAllEnvs());

it.each(["origins", "contact", "privacy"] as const)("keeps %s previews out of indexing without overriding inherited HTML robots", async slug => {
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
