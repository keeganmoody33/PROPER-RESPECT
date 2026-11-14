import { describe, expect, it, vi } from "vitest";
import type { AssetFetcher } from "./brand-asset-route";
import { serveBrandFont, serveGoogleFont } from "./brand-font-route";

const FILE = `${"a1".repeat(32)}.woff2`;
const font = (bytes: number, init: ResponseInit = {}) => new Response(new Uint8Array(bytes), { headers: { "content-type": "font/woff2", "set-cookie": "x=1", "content-length": String(bytes) }, ...init });

describe("serveBrandFont", () => {
  it("serves the provider's font from this origin, cacheable forever and with none of the upstream's headers", async () => {
    const fetcher = vi.fn(async (url: string) => (url ? font(1200) : font(0)));
    const response = await serveBrandFont(FILE, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe(`https://media.brand.dev/fonts/${FILE}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("font/woff2");
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect((await response.arrayBuffer()).byteLength).toBe(1200);
  });

  it("refuses any name that is not one content-addressed font file, without fetching", async () => {
    const fetcher = vi.fn(async (url: string) => (url ? font(10) : font(0)));
    for (const file of ["../secret", "font.woff2", `${"a1".repeat(32)}.svg`, `${"a1".repeat(32)}.woff2/x`]) {
      expect((await serveBrandFont(file, fetcher)).status, file).toBe(404);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("answers 404 when the provider has no such font and 502 when the provider fails", async () => {
    expect((await serveBrandFont(FILE, async () => new Response("no", { status: 404 }))).status).toBe(404);
    expect((await serveBrandFont(FILE, async () => new Response("no", { status: 500 }))).status).toBe(502);
    expect((await serveBrandFont(FILE, async () => { throw new Error("network"); })).status).toBe(502);
  });

  it("refuses a file larger than a font should be, declared or not", async () => {
    const tooBig = 3 * 1024 * 1024 + 1;
    expect((await serveBrandFont(FILE, async () => font(tooBig))).status).toBe(502);
    const undeclared = new Response(new Uint8Array(tooBig));
    undeclared.headers.delete("content-length");
    expect((await serveBrandFont(FILE, async () => undeclared)).status).toBe(502);
  });

  it("closes an upstream response it is not going to serve", async () => {
    const refused = (status: number, bytes = 10) => {
      const cancel = vi.fn();
      const body = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array(1)); }, cancel });
      return { cancel, response: new Response(body, { status, headers: { "content-length": String(bytes) } }) };
    };
    for (const upstream of [refused(404), refused(500), refused(200, 3 * 1024 * 1024 + 1)]) {
      await serveBrandFont(FILE, async () => upstream.response);
      expect(upstream.cancel, String(upstream.response.status)).toHaveBeenCalledTimes(1);
    }
  });

  it("does not cache a failure for a year", async () => {
    const response = await serveBrandFont(FILE, async () => new Response("no", { status: 500 }));
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

describe("serveGoogleFont", () => {
  it("serves one Google font file from this origin, cacheable forever because its path is versioned", async () => {
    const fetcher = vi.fn<AssetFetcher>(async url => (url ? font(800) : font(0)));
    const response = await serveGoogleFont("roboto", "v51", "abc_D-9.ttf", fetcher);
    expect(fetcher.mock.calls.map(([url, init]) => [url, init.redirect, init.credentials])).toEqual([["https://fonts.gstatic.com/s/roboto/v51/abc_D-9.ttf", "error", "omit"]]);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("font/ttf");
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("refuses any other host, path or file type without fetching, so it is no open proxy", async () => {
    const fetcher = vi.fn(async (url: string) => (url ? font(10) : font(0)));
    for (const [family, version, file] of [["roboto", "v51", "abc.woff2"], ["..", "v51", "abc.ttf"], ["roboto", "v51", "../../../evil.example/x.ttf"], ["roboto", "latest", "abc.ttf"]]) {
      expect((await serveGoogleFont(family, version, file, fetcher)).status, `${family}/${version}/${file}`).toBe(404);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refuses a font file larger than a card should load", async () => {
    expect((await serveGoogleFont("notocoloremoji", "v50", "abc.ttf", async () => font(3 * 1024 * 1024 + 1))).status).toBe(502);
  });
});
