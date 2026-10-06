import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyUserAgent, isCountablePageRequest, toSnapshot } from "@/src/server/request-tally";
import { readTally, recordHit } from "@/src/server/tally-store";

const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

describe("classifyUserAgent", () => {
  it.each([
    [CHROME, "presumed_human"],
    ["", "undeclared"],
    [null, "undeclared"],
    ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)", "ai_training_crawler"],
    ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot", "ai_assistant_fetch"],
    ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)", "ai_assistant_fetch"],
    ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot", "ai_search_indexer"],
    ["Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "search_engine_crawler"],
    ["Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)", "seo_crawler"],
    ["facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", "link_preview"],
    ["Mozilla/5.0 (compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)", "monitoring"],
    ["curl/8.7.1", "unattributed_automation"],
    ["Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.0.0 Safari/537.36", "unattributed_automation"],
  ])("%s → %s", (ua, expected) => {
    expect(classifyUserAgent(ua)).toBe(expected);
  });
});

describe("isCountablePageRequest", () => {
  const h = (values: Record<string, string> = {}) => new Headers(values);
  it("counts page GETs and skips everything else", () => {
    expect(isCountablePageRequest("GET", "/", h())).toBe(true);
    expect(isCountablePageRequest("POST", "/", h())).toBe(false);
    expect(isCountablePageRequest("GET", "/api/tally", h())).toBe(false);
    expect(isCountablePageRequest("GET", "/", h({ "next-router-prefetch": "1" }))).toBe(false);
    expect(isCountablePageRequest("GET", "/", h({ rsc: "1" }))).toBe(false);
    expect(isCountablePageRequest("GET", "/", h({ "sec-purpose": "prefetch;prerender" }))).toBe(false);
  });

  it.each(["/__clerk/v1/client", "/trpc/x", "/.well-known/ard.json", "/robots.txt", "/sitemap.xml", "/llms.txt", "/icon", "/apple-icon"])(
    "skips non-page endpoint %s",
    path => {
      expect(isCountablePageRequest("GET", path, h())).toBe(false);
    },
  );

  it("still counts markdown twins of pages", () => {
    expect(isCountablePageRequest("GET", "/about/origins.md", h())).toBe(true);
  });
});

describe("toSnapshot", () => {
  it("sums automated categories and ignores junk", () => {
    const snap = toSnapshot({ presumed_human: "10", ai_training_crawler: 3, undeclared: "2", junk: 99, monitoring: "x" }, null);
    expect(snap.presumedHuman).toBe(10);
    expect(snap.automated).toBe(3);
    expect(snap.unidentified).toBe(2);
    expect(snap.byCategory.monitoring).toBe(0);
  });
});

describe("tally store", () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  const env = { KV_REST_API_URL: "https://kv.example/", KV_REST_API_TOKEN: "synthetic", VERCEL_ENV: "production" };

  it("increments the production hash over the REST pipeline", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([{ result: 1 }, { result: 1 }])));
    vi.stubGlobal("fetch", fetchMock);
    await recordHit("link_preview", env);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://kv.example/pipeline");
    expect(JSON.parse(String(init.body))[0]).toEqual(["HINCRBY", "pr:tally:v1", "link_preview", 1]);
  });

  it("keeps preview traffic out of the public count", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([{ result: 1 }, { result: 0 }])));
    vi.stubGlobal("fetch", fetchMock);
    await recordHit("presumed_human", { ...env, VERCEL_ENV: "preview" });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))[0][1]).toBe("pr:preview:tally:v1");
  });

  it("never throws when the store is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    await expect(recordHit("presumed_human", env)).resolves.toBeUndefined();
  });

  it("reads the hash into a snapshot", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{ result: ["presumed_human", "7", "monitoring", "2"] }, { result: "2026-10-06T07:00:00.000Z" }]))));
    const snap = await readTally(env);
    expect(snap).toMatchObject({ presumedHuman: 7, automated: 2, since: "2026-10-06T07:00:00.000Z" });
  });

  it("fails a read when a pipeline command errors, instead of reporting zeros", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{ error: "WRONGTYPE" }, { result: null }]))));
    await expect(readTally(env)).rejects.toThrow(/WRONGTYPE/);
  });

  it("returns null without configuration", async () => {
    expect(await readTally({})).toBeNull();
  });

  it("never reads or writes a provider in the synthetic public fixture", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([{ result: [] }, { result: null }])));
    vi.stubGlobal("fetch", fetchMock);
    const fixtureEnv = { ...env, PROPER_RESPECT_E2E_REFERENCE: "1" };
    await recordHit("presumed_human", fixtureEnv);
    expect(await readTally(fixtureEnv)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("proxy counting", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });
  const loadProxy = async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    vi.stubEnv("PROPER_RESPECT_E2E_REFERENCE", "1");
    for (const key of ["KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]) vi.stubEnv(key, "");
    return (await import("../../proxy")).default;
  };

  it("records a hit without blocking routing", async () => {
    const proxy = await loadProxy();
    const waitUntil = vi.fn();
    const response = await proxy(new NextRequest("https://request.example/about/origins", { headers: { "user-agent": "curl/8.7.1" } }), { waitUntil } as never);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(response).toBeDefined();
  });

  it("does not count API calls", async () => {
    const proxy = await loadProxy();
    const waitUntil = vi.fn();
    await proxy(new NextRequest("https://request.example/api/tally"), { waitUntil } as never);
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it("isolates the proxy unit fixture from inherited store credentials", async () => {
    vi.stubEnv("KV_REST_API_URL", "https://synthetic-kv.example");
    vi.stubEnv("KV_REST_API_TOKEN", "synthetic-canary");
    vi.stubEnv("VERCEL_ENV", "production");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([{ result: 1 }, { result: 1 }])));
    vi.stubGlobal("fetch", fetchMock);
    const proxy = await loadProxy();
    const pending: Promise<unknown>[] = [];
    await proxy(new NextRequest("https://request.example/about/origins"), { waitUntil: (promise: Promise<unknown>) => pending.push(promise) } as never);
    await Promise.all(pending);
    expect(pending).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
