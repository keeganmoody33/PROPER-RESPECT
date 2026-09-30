import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, expect, it, vi } from "vitest";
import { SearchableAnalytics } from "@/components/searchable-analytics";

afterEach(() => vi.unstubAllEnvs());

it.each([undefined, "development", "preview"])("does not track %s traffic", environment => {
  vi.stubEnv("VERCEL_ENV", environment);
  expect(renderToStaticMarkup(createElement(SearchableAnalytics))).toBe("");
});

it("renders the production tracker with the site's identity and cookies disabled", () => {
  vi.stubEnv("VERCEL_ENV", "production");
  const $ = load(renderToStaticMarkup(createElement(SearchableAnalytics)));
  const tracker = $("script[src]");
  expect(tracker).toHaveLength(1);
  expect(tracker.attr("src")).toBe("https://tracker.searchableanalytics.com/s.js");
  expect(tracker.attr("data-domain")).toBe("proper-respect.com");
  expect(tracker.attr("data-site-token")).toBe("pst_8cd07ae0c6361d5c9e6e4087");
  expect(tracker.attr("data-cookie")).toBe("false");
  expect(tracker.attr("defer")).toBeDefined();
  expect($("script").first().text()).toContain("window.sa=window.sa||");
});
