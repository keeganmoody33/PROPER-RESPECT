import { afterEach, expect, it, vi } from "vitest";
import { GET } from "@/app/index.md/route";
import { homepageMarkdown } from "./agent-discovery";

afterEach(() => vi.unstubAllEnvs());
it.each(["preview", "production"])("uses the existing public body and canonical metadata in %s", async environment => {
  vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://public.example");
  vi.stubEnv("VERCEL_ENV", environment);
  const response = GET();
  expect(await response.text()).toBe(homepageMarkdown());
  expect(response.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
  expect(response.headers.get("Vary")).toBe("Accept");
  expect(response.headers.get("Content-Location")).toBe("https://public.example/index.md");
  expect(response.headers.get("Link")).toContain('<https://public.example/>; rel="canonical"');
  expect(response.headers.get("X-Robots-Tag")).toBe(environment === "preview" ? "noindex, nofollow" : null);
});
