import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";

const route = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
import { afterEach, expect, it, vi } from "vitest";
import { SearchableAnalytics } from "@/components/searchable-analytics";

afterEach(() => vi.unstubAllEnvs());

it.each([undefined, "development", "preview"])("does not track %s traffic", environment => {
  vi.stubEnv("VERCEL_ENV", environment);
  expect(renderToStaticMarkup(createElement(SearchableAnalytics))).toBe("");
});

it("isolates production analytics from the parent document", () => {
  vi.stubEnv("VERCEL_ENV", "production");
  route.pathname = "/keegan";
  const $ = load(renderToStaticMarkup(createElement(SearchableAnalytics)));
  expect($("script")).toHaveLength(0);
  expect($("iframe").attr("sandbox")).toBe("allow-scripts");
  expect($("iframe").attr("referrerpolicy")).toBe("no-referrer");
  expect($("iframe").attr("src")).toBe("/api/analytics/searchable?path=%2Fkeegan");
});

it.each(["/app", "/app/collection/private-fixture", "/sign-in", "/sign-up", "/onboarding", "/api/unknown", "/_next", "/about/missing"])("loads no tracker for %s", pathname => {
  vi.stubEnv("VERCEL_ENV", "production");
  route.pathname = pathname;
  expect(renderToStaticMarkup(createElement(SearchableAnalytics))).toBe("");
});
