import { describe, expect, it, vi } from "vitest";
import type { AssetFetcher } from "./brand-asset-route";
import { serveBrandImage } from "./brand-image-route";

const UUID = "f895934e-e887-4c7d-ab99-3f7ae465499f";
const MEGABYTE = 1024 * 1024;
const image = (bytes: number, contentType = "text/html") => new Response(new Uint8Array(bytes), { headers: { "content-type": contentType, "set-cookie": "x=1", "content-length": String(bytes) } });

describe("serveBrandImage", () => {
  it("serves a provider PNG from this origin with a type chosen here, not the upstream's", async () => {
    const fetcher = vi.fn<AssetFetcher>(async url => (url ? image(900) : image(0)));
    const response = await serveBrandImage(`${UUID}.png`, fetcher);
    expect(fetcher.mock.calls.map(([url, init]) => [url, init.redirect, init.credentials])).toEqual([[`https://media.brand.dev/${UUID}.png`, "error", "omit"]]);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect((await response.arrayBuffer()).byteLength).toBe(900);
  });

  it("serves an SVG so that it can run no script and load nothing, even when opened on its own", async () => {
    const response = await serveBrandImage(`${UUID}.svg`, async () => image(300, "image/svg+xml"));
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    expect(response.headers.get("content-security-policy")).toBe("default-src 'none'; style-src 'unsafe-inline'; sandbox");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("refuses any name that is not one provider logo file, without fetching", async () => {
    const fetcher = vi.fn(async (url: string) => (url ? image(10) : image(0)));
    for (const file of ["../secret", "logo.png", `${UUID}.jpg`, `${UUID}.html`, `${UUID}.png/x`, `fonts/${UUID}.png`]) {
      expect((await serveBrandImage(file, fetcher)).status, file).toBe(404);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("answers 404 for a missing logo, 502 for a failing or oversized one, and caches neither", async () => {
    const statuses = await Promise.all([
      serveBrandImage(`${UUID}.png`, async () => new Response("no", { status: 404 })),
      serveBrandImage(`${UUID}.png`, async () => new Response("no", { status: 500 })),
      serveBrandImage(`${UUID}.png`, async () => { throw new Error("network"); }),
      serveBrandImage(`${UUID}.png`, async () => image(MEGABYTE + 1)),
    ]);
    expect(statuses.map(response => [response.status, response.headers.get("cache-control")])).toEqual([
      [404, "no-store"], [502, "no-store"], [502, "no-store"], [502, "no-store"],
    ]);
  });
});
