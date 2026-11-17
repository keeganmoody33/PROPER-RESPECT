import { getFunctionName } from "convex/server";
import { afterEach, expect, test, vi } from "vitest";

const { fetchQuery } = vi.hoisted(() => ({ fetchQuery: vi.fn() }));
vi.mock("convex/nextjs", () => ({ fetchQuery }));
vi.mock("@/src/env", () => ({ getServerEnv: () => ({ NEXT_PUBLIC_CONVEX_URL: "https://test.convex.cloud" }) }));
import { getListedToolSlugs, getSitemapListing, getToolPage, searchPeople, searchQueryProblem, searchTools } from "./search";
import { SEARCH_QUERY_MAX, SEARCH_WORDS_MAX } from "@/src/domain/search-listing";

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
const fixture = () => vi.stubEnv("PROPER_RESPECT_E2E_REFERENCE", "1");
const backend = () => { vi.stubEnv("PROPER_RESPECT_E2E_REFERENCE", "0"); vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://test.convex.cloud"); };

test("fixture mode lists the invented pages A to Z and finds a person by name or handle, with no backend", async () => {
  fixture();
  expect(await searchPeople("")).toEqual({ more: false, people: [
    { handle: "lecturesfrom", displayName: "Keegan Moody" }, { handle: "synthetic-ria", displayName: "Synthetic Ria" }, { handle: "synthetic-sam", displayName: "Synthetic Sam" },
  ] });
  expect((await searchPeople("sam")).people).toEqual([{ handle: "synthetic-sam", displayName: "Synthetic Sam" }]);
  expect((await searchPeople("lectures")).people.map(person => person.handle)).toEqual(["lecturesfrom"]);
  expect((await searchPeople("nobody")).people).toEqual([]);
  expect(fetchQuery).not.toHaveBeenCalled();
});

test("fixture mode counts people per tool, and a tool page splits them into now and before", async () => {
  fixture();
  expect((await searchTools("")).tools[0]).toEqual({ slug: "clay", name: "Clay", peopleNow: 1, peopleBefore: 1 });
  expect((await searchTools("wis")).tools.map(tool => tool.slug)).toEqual(["wisprflow"]);
  expect(await getToolPage("clay")).toEqual({
    slug: "clay", name: "Clay", peopleNow: 1, peopleBefore: 1,
    now: { people: [{ handle: "synthetic-sam", displayName: "Synthetic Sam", levelLabel: "Daily" }], nextAfter: null },
    before: { people: [{ handle: "synthetic-ria", displayName: "Synthetic Ria", levelLabel: "Stopped using" }], nextAfter: null },
  });
  expect(await getToolPage("no-such-tool")).toBeNull();
  expect(await getToolPage("Not A Slug")).toBeNull();
  expect([...await getListedToolSlugs("lecturesfrom")]).toEqual(["github", "wisprflow"]);
  expect([...await getListedToolSlugs("keegan")]).toEqual([]);
  expect(await getSitemapListing()).toEqual({ handles: ["lecturesfrom", "synthetic-ria", "synthetic-sam"], tools: ["clay", "github", "wisprflow"] });
});

test("a search over 80 characters is refused before it is sent", () => {
  expect(searchQueryProblem("a".repeat(SEARCH_QUERY_MAX))).toBeNull();
  expect(searchQueryProblem(` ${"a".repeat(SEARCH_QUERY_MAX)} `)).toBeNull();
  expect(searchQueryProblem("a".repeat(SEARCH_QUERY_MAX + 1))).toBe("Search with 80 characters or fewer.");
  expect(searchQueryProblem(Array.from({ length: SEARCH_WORDS_MAX }, () => "a").join("  "))).toBeNull();
  expect(searchQueryProblem(Array.from({ length: SEARCH_WORDS_MAX + 1 }, () => "a").join(" "))).toBe("Search with 16 words or fewer.");
});

test("the backend's rows become links only when each handle and slug is one", async () => {
  backend();
  fetchQuery.mockResolvedValueOnce({ more: false, people: [{ handle: "synthetic-sam", displayName: "Synthetic Sam" }, { handle: "//attacker.example", displayName: "Bad" }, { handle: " padded", displayName: "Bad" }] });
  expect((await searchPeople("  sam ")).people).toEqual([{ handle: "synthetic-sam", displayName: "Synthetic Sam" }]);
  expect(getFunctionName(fetchQuery.mock.calls[0][0])).toBe("publicProfiles:searchPeople");
  expect(fetchQuery.mock.calls[0].slice(1)).toEqual([{ q: "sam" }, { url: "https://test.convex.cloud" }]);

  fetchQuery.mockResolvedValueOnce({ more: true, tools: [{ slug: "clay", name: "Clay", peopleNow: 2, peopleBefore: 0 }, { slug: "../etc", name: "Bad", peopleNow: 1, peopleBefore: 0 }] });
  expect(await searchTools("cl")).toEqual({ more: true, tools: [{ slug: "clay", name: "Clay", peopleNow: 2, peopleBefore: 0 }] });

  fetchQuery.mockResolvedValueOnce({ slug: "clay", name: "Clay", peopleNow: 1, peopleBefore: 0,
    now: { people: [{ handle: "synthetic-sam", displayName: "Synthetic Sam", levelLabel: "Daily" }, { handle: "javascript:alert(1)", displayName: "Bad", levelLabel: "Daily" }], nextAfter: null },
    before: { people: [], nextAfter: null } });
  expect((await getToolPage("clay", { nowAfter: "a" }))?.now.people.map(person => person.handle)).toEqual(["synthetic-sam"]);
  expect(fetchQuery.mock.calls[2][1]).toEqual({ slug: "clay", nowAfter: "a" });

  fetchQuery.mockResolvedValueOnce(["clay", "https://user:pass@example.com"]);
  expect([...await getListedToolSlugs("synthetic-sam")]).toEqual(["clay"]);
  fetchQuery.mockResolvedValueOnce({ handles: ["synthetic-sam", "data:text/html,x"], tools: ["clay", "ftp://x"] });
  expect(await getSitemapListing()).toEqual({ handles: ["synthetic-sam"], tools: ["clay"] });
});

test("a card's tool links and the sitemap degrade to nothing when search can't be read, and pages that need search fail loudly", async () => {
  backend();
  fetchQuery.mockRejectedValue(new Error("Could not find public function"));
  expect([...await getListedToolSlugs("synthetic-sam")]).toEqual([]);
  expect(await getSitemapListing()).toEqual({ handles: [], tools: [] });
  await expect(searchPeople("sam")).rejects.toThrow("Could not find public function");
});
