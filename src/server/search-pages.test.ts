import { load } from "cheerio";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SearchPage, { generateMetadata as searchMetadata } from "@/app/search/page";
import ToolPage, { generateMetadata as toolMetadata } from "@/app/tools/[slug]/page";
import { SEARCH_QUERY_MAX } from "@/src/domain/search-listing";

beforeEach(() => {
  vi.stubEnv("PROPER_RESPECT_E2E_REFERENCE", "1");
  vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://public.example");
});
afterEach(() => vi.unstubAllEnvs());

const search = async (params: Record<string, string> = {}) => load(renderToStaticMarkup(await SearchPage({ searchParams: Promise.resolve(params) })));
const tool = async (slug: string, params: Record<string, string> = {}) =>
  load(renderToStaticMarkup(await ToolPage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(params) })));
const rows = ($: ReturnType<typeof load>, scope = "") => $(`${scope} ul a`).map((_, link) => [[$(link).attr("href"), $(link).text()]]).get();
const DASHES = ["—", "–", " - "];

it("an empty search shows listed people A to Z, one box and two tabs that keep the search", async () => {
  const $ = await search();
  expect($("h1").text()).toBe("Search people and tools");
  expect($('form[role="search"][action="/search"][method="get"] input[name="q"]').attr("maxlength")).toBe(String(SEARCH_QUERY_MAX));
  expect($('nav[aria-label="Search for"] a').map((_, link) => [[$(link).text(), $(link).attr("href"), $(link).attr("aria-current") ?? ""]]).get())
    .toEqual([["People", "/search", "page"], ["Tools", "/search?tab=tools", ""]]);
  expect($("#results-title").text()).toBe("People with a listed page, A to Z");
  expect(rows($)).toEqual([["/lecturesfrom", "Keegan Moody@lecturesfrom"], ["/synthetic-ria", "Synthetic Ria@synthetic-ria"], ["/synthetic-sam", "Synthetic Sam@synthetic-sam"]]);
  expect(DASHES.filter(dash => $("main").text().includes(dash))).toEqual([]);
});

it("a search finds a person, and the Tools tab finds a tool with its counts", async () => {
  const people = await search({ q: "sam" });
  expect(people("#results-title").text()).toBe("People matching “sam”");
  expect(rows(people)).toEqual([["/synthetic-sam", "Synthetic Sam@synthetic-sam"]]);
  expect(people('nav a[href="/search?q=sam&tab=tools"]').text()).toBe("Tools");

  const tools = await search({ q: "clay", tab: "tools" });
  expect(tools('input[type="hidden"][name="tab"]').val()).toBe("tools");
  expect(rows(tools)).toEqual([["/tools/clay", "Clay1 person uses it now · 1 person used it before"]]);
  expect((await search({ tab: "tools" }))("#results-title").text()).toBe("Tools on listed pages");
  expect(rows(await search({ q: "nobody-here" }))).toEqual([]);
});

it("an over-long search is refused in words, and no results are read", async () => {
  const $ = await search({ q: "a".repeat(SEARCH_QUERY_MAX + 1) });
  expect($('[role="alert"]').text()).toBe("Search with 80 characters or fewer.");
  expect($("ul").length).toBe(0);
});

it("the search page is canonical at /search and a results page is not indexed", async () => {
  const plain = await searchMetadata({ searchParams: Promise.resolve({}) });
  expect([plain.title, plain.alternates?.canonical, plain.robots]).toEqual(["Search people and tools", "https://public.example/search", undefined]);
  expect((await searchMetadata({ searchParams: Promise.resolve({ q: "clay" }) })).robots).toEqual({ index: false, follow: true });
});

it("a tool page lists who uses it now and who used it before, each linking to their page", async () => {
  const $ = await tool("clay");
  expect($("h1").text()).toBe("Clay");
  expect($('section[aria-labelledby="uses-now"] h2').text()).toBe("Uses it now");
  expect(rows($, 'section[aria-labelledby="uses-now"]')).toEqual([["/synthetic-sam", "Synthetic Sam@synthetic-sam · Daily"]]);
  expect($('section[aria-labelledby="used-before"] h2').text()).toBe("Used before");
  expect(rows($, 'section[aria-labelledby="used-before"]')).toEqual([["/synthetic-ria", "Synthetic Ria@synthetic-ria · Stopped using"]]);
  expect($('section[aria-labelledby="used-before"]').text()).toContain("Past tools count");
  expect(DASHES.filter(dash => $("main").text().includes(dash))).toEqual([]);
  const metadata = await toolMetadata({ params: Promise.resolve({ slug: "clay" }), searchParams: Promise.resolve({}) });
  expect([metadata.title, metadata.alternates?.canonical]).toEqual(["Clay: who uses it", "https://public.example/tools/clay"]);
});

it("an unknown or malformed tool is a 404, never an error", async () => {
  await Promise.all(["no-such-tool", "Not A Slug", "manual-acme-0123456789abcdef012345"].map(async slug => {
    await expect(tool(slug)).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    expect((await toolMetadata({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) })).robots).toEqual({ index: false, follow: false });
  }));
});
