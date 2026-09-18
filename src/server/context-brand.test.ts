import { describe, expect, it, vi } from "vitest";
import { retrieveProductBrand } from "./context-brand";
import { normalizeProductBrand, type ContextBrandResponses } from "../domain/product-brand";

const input = { productSlug: "wispr-flow", canonicalDomain: "wisprflow.ai", retrievalId: "request-one", retrievedAt: "2026-09-17T16:00:00.000Z" };
const brand = { status: "ok", code: 200, request_id: "brand-request", brand: { domain: "wisprflow.ai", logos: [{ url: "https://assets.example.com/flow.svg", mode: "dark", type: "icon" }], colors: [{ hex: "#fff" }] }, key_metadata: { account: "PRIVATE" }, unexpected: "PRIVATE" };
const fonts = { status: "ok", domain: "wisprflow.ai", fonts: [{ font: "Inter", uses: ["body"], fallbacks: ["sans-serif"] }] };
const styleguide = { status: "ok", domain: "wisprflow.ai", styleguide: { mode: "light", colors: { accent: "#abcdef" }, typography: { p: { fontFamily: "Inter" } } } };
const successfulFetch = () => vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(brand)).mockResolvedValueOnce(Response.json(fonts)).mockResolvedValueOnce(Response.json(styleguide));

describe("Context.dev presentation adapter", () => {
  it("retrieves bounded brand, font and styleguide responses and hashes only a safe retained projection", async () => {
    const fetcher = successfulFetch();
    const result = await retrieveProductBrand(input, { apiKey: "test-api-key", fetcher });
    expect(fetcher.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual(["/v1/brand/retrieve", "/v1/web/fonts", "/v1/web/styleguide"]);
    expect(JSON.parse(fetcher.mock.calls[0][1]?.body as string)).toEqual({ type: "by_domain", domain: "wisprflow.ai", timeoutOpts: { milliseconds: 60_000, behavior: "return-partial" } });
    expect(new URL(String(fetcher.mock.calls[1][0])).searchParams.get("domain")).toBe("wisprflow.ai");
    for (const [, options] of fetcher.mock.calls) {
      expect(options).toMatchObject({ redirect: "error", cache: "no-store", credentials: "omit" });
      expect(options?.signal).toBeInstanceOf(AbortSignal);
    }
    expect(result.snapshot).toMatchObject({ ...input, fonts: [{ family: "Inter" }], styleguide: { bodyFamily: "Inter" } });
    expect(JSON.stringify(result)).not.toMatch(/test-api-key|PRIVATE|key_metadata/);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(result.response)));
    expect(result.snapshot.responseHash).toBe([...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""));
  });

  it("hashes the version 2 retained font files and typed typography without retaining vendor CSS", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(brand))
      .mockResolvedValueOnce(Response.json({ ...fonts, fontLinks: { Inter: { type: "google", category: "sans-serif", files: { "400": "https://fonts.gstatic.com/inter.woff2" } } } }))
      .mockResolvedValueOnce(Response.json({ ...styleguide, styleguide: { ...styleguide.styleguide, typography: {
        p: { fontFamily: "Inter", fontWeight: 400, fontSize: "16px", lineHeight: "24px", letterSpacing: "0px", fontFallbacks: ["Inter", "sans-serif"] },
      }, components: { button: { primary: { css: "body{display:none}" } } } } }));
    const result = await retrieveProductBrand(input, { apiKey: "test-api-key", fetcher });
    expect(result.snapshot.schemaVersion).toBe(2);
    expect(result.response).toMatchObject({
      format: "context.dev/presentation-projection-v2",
      fonts: { fontLinks: { Inter: { type: "google", category: "sans-serif", files: { "400": "https://fonts.gstatic.com/inter.woff2" } } } },
      styleguide: { styleguide: { typography: { p: { fontFamily: "Inter", fontWeight: 400, fontSize: "16px", lineHeight: "1.5", letterSpacing: "0em", fontFallbacks: ["Inter", "sans-serif"] } } } },
    });
    expect(JSON.stringify(result)).not.toMatch(/components|display:none|test-api-key/);
    expect(normalizeProductBrand({ ...input, responseHash: result.snapshot.responseHash, receipts: result.snapshot.receipts }, result.response as ContextBrandResponses)).toEqual(result.snapshot);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(result.response)));
    expect(result.snapshot.responseHash).toBe([...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""));
  });

  it("bounds a provider request even when a transport ignores the abort signal", async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => undefined));
      let failure = "";
      const result = retrieveProductBrand(input, { apiKey: "test-api-key", fetcher }).catch((error: Error) => { failure = error.message; });
      await vi.advanceTimersByTimeAsync(65_000);
      expect(failure).toBe("Context.dev brand response unavailable.");
      await result;
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });

  it("bounds a response body that stops yielding bytes", async () => {
    vi.useFakeTimers();
    try {
      const cancel = vi.fn();
      const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"status":')); }, cancel });
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
      let failure = "";
      const result = retrieveProductBrand(input, { apiKey: "test-api-key", fetcher }).catch((error: Error) => { failure = error.message; });
      await vi.advanceTimersByTimeAsync(65_000);
      expect(failure).toBe("Context.dev brand response unavailable.");
      await result;
      expect(cancel).toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it("keeps the base snapshot when optional requests fail and records their bounded status", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(brand))
      .mockResolvedValueOnce(new Response("PRIVATE provider error", { status: 429 }))
      .mockRejectedValueOnce(new Error("PRIVATE network credentials"));
    const result = await retrieveProductBrand(input, { apiKey: "test-api-key", fetcher });
    expect(result.snapshot).toMatchObject({ partial: true, fonts: [], receipts: [
      { endpoint: "brand", status: "ok", httpStatus: 200 },
      { endpoint: "fonts", status: "error", httpStatus: 429 },
      { endpoint: "styleguide", status: "error" },
    ] });
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });

  it("fails a changed canonical domain before optional calls", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ...brand, brand: { ...brand.brand, domain: "different.example.com" } }));
    await expect(retrieveProductBrand(input, { apiKey: "test-api-key", fetcher })).rejects.toThrow("domain did not match");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403, 429, 500, 302])("does not retain a failed HTTP %i provider body", async (status) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("PRIVATE provider body", { status }));
    await expect(retrieveProductBrand(input, { apiKey: "test-api-key", fetcher })).rejects.toThrow("Context.dev brand response unavailable.");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("bounds response bytes and sanitizes invalid JSON and network errors", async () => {
    for (const response of [new Response("PRIVATE malformed JSON"), new Response("x".repeat(250 * 1_024 + 1))]) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
      await expect(retrieveProductBrand(input, { apiKey: "test-api-key", fetcher })).rejects.toThrow("Context.dev brand response unavailable.");
    }
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("PRIVATE network token"));
    await expect(retrieveProductBrand(input, { apiKey: "test-api-key", fetcher })).rejects.toThrow("Context.dev brand response unavailable.");
  });

  it("is reusable for another product and produces stable identical response hashes for replay", async () => {
    const githubInput = { ...input, productSlug: "github", canonicalDomain: "github.com" };
    const providerResponses = [brand, fonts, styleguide].map((value) => JSON.parse(JSON.stringify(value).replaceAll("wisprflow.ai", "github.com")));
    const makeFetcher = () => vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(providerResponses[0]))
      .mockResolvedValueOnce(Response.json(providerResponses[1]))
      .mockResolvedValueOnce(Response.json(providerResponses[2]));
    const first = await retrieveProductBrand(githubInput, { apiKey: "test-api-key", fetcher: makeFetcher() });
    const replay = await retrieveProductBrand(githubInput, { apiKey: "test-api-key", fetcher: makeFetcher() });
    expect(first).toEqual(replay);
    expect(first.snapshot.productSlug).toBe("github");
    expect(JSON.stringify(first.response)).not.toContain("wisprflow.ai");
  });
});
