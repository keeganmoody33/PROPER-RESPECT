import { afterEach, expect, it, vi } from "vitest";
import { publicSiteOrigin, publicPageMetadata, publicPathMetadata } from "./public-site";
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

it("builds a canonical URL for a site path made only of safe names, and refuses any other", () => {
  vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://public.example");
  expect(publicPathMetadata("Search people and tools", "Find a page", "/search").alternates?.canonical).toBe("https://public.example/search");
  expect(publicPathMetadata("Clay: who uses it", "People", "/tools/clay").openGraph).toMatchObject({ url: "https://public.example/tools/clay", title: "Clay: who uses it" });
  ["//attacker.example", "/tools/../admin", "/tools/Clay", "tools/clay", "/tools/clay?x=1"]
    .forEach(path => expect(() => publicPathMetadata("Title", "Description", path)).toThrow());
});

const staticEntries = [
  { url: "https://public.example/", lastModified: "2026-11-17T00:00:00.000Z" },
  { url: "https://public.example/about/origins", lastModified: "2026-11-17" },
  { url: "https://public.example/about/contact", lastModified: "2026-09-22" },
  { url: "https://public.example/about/privacy", lastModified: "2026-11-15" },
  { url: "https://public.example/about/terms", lastModified: "2026-11-15" },
  { url: "https://public.example/about/methodology", lastModified: "2026-11-12" },
];

it("marks preview pages noindex and keeps the sitemap to public pages, with no listed page when search can't be read", async () => {
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://public.example");
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "");
  expect(layoutMetadata().robots).toEqual({ index: false, follow: false });
  expect(await sitemap()).toEqual([...staticEntries, { url: "https://public.example/search" }]);
});

it("lists search, every listed page and every tool page, and never an unlisted or unpublished page", async () => {
  vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://public.example");
  vi.stubEnv("PROPER_RESPECT_E2E_REFERENCE", "1");
  const urls = (await sitemap()).map(entry => entry.url);
  expect(urls.slice(staticEntries.length)).toEqual([
    "https://public.example/search",
    "https://public.example/lecturesfrom", "https://public.example/synthetic-ria", "https://public.example/synthetic-sam",
    "https://public.example/tools/clay", "https://public.example/tools/github", "https://public.example/tools/wisprflow",
  ]);
  expect(urls).not.toContain("https://public.example/keegan");
});
