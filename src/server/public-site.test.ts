import { afterEach, expect, it, vi } from "vitest";
import { publicSiteOrigin, publicPageMetadata } from "./public-site";
import { generateMetadata as layoutMetadata } from "@/app/layout";
import sitemap from "@/app/sitemap";

vi.mock("next/font/local", () => ({ default: () => ({ variable: "test-font" }) }));

afterEach(() => vi.unstubAllEnvs());

it.each(["http://public.example", "https://user:password@example.com", "https://example.com/path", "https://example.com?token=secret", "https://example.com/#fragment", "not a URL"])("rejects invalid public origin %s without echoing it", (origin) => {
  vi.stubEnv("PUBLIC_SITE_ORIGIN", origin);
  expect(() => publicSiteOrigin()).toThrow(/PUBLIC_SITE_ORIGIN must be/);
});

it("requires explicit production origin and rejects HTTP loopback in production", () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("PUBLIC_SITE_ORIGIN", "");
  expect(() => publicSiteOrigin()).toThrow(/required in production/);
  vi.stubEnv("PUBLIC_SITE_ORIGIN", "http://localhost:3000");
  expect(() => publicSiteOrigin()).toThrow(/must be/);
});

it("permits HTTP loopback only for local development", () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("PUBLIC_SITE_ORIGIN", "http://localhost:3117");
  expect(publicSiteOrigin().origin).toBe("http://localhost:3117");
});

it("keeps request-host data out of canonical URLs and refuses unsafe handles", () => {
  vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://public.example");
  vi.stubEnv("VERCEL_URL", "attacker.example");
  expect(publicPageMetadata("Profile", "Published bio", "a-handle").alternates?.canonical).toBe("https://public.example/a-handle");
  expect(() => publicPageMetadata("Profile", "Bio", "//attacker.example")).toThrow();
});

it("marks preview pages noindex and keeps the sitemap limited to completed public pages", () => {
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://public.example");
  expect(layoutMetadata().robots).toEqual({ index: false, follow: false });
  expect(sitemap()).toEqual([
    { url: "https://public.example/", lastModified: "2026-09-23T00:00:00.000Z" },
    ...["origins", "contact", "privacy"].map(slug => ({ url: `https://public.example/about/${slug}`, lastModified: "2026-09-22" })),
  ]);
});
