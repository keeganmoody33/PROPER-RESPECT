import { describe, expect, it } from "vitest";
import { brandImageUpstream, ownOriginImageUrl } from "./brand-image-url";

const UUID = "f895934e-e887-4c7d-ab99-3f7ae465499f";

describe("brand image URLs", () => {
  it("moves the provider's logos to this site, so a visitor's browser never asks the provider for them", () => {
    expect(ownOriginImageUrl(`https://media.brand.dev/${UUID}.png`)).toBe(`/api/brand-images/${UUID}.png`);
    expect(ownOriginImageUrl(`https://media.brand.dev/${UUID}.svg`)).toBe(`/api/brand-images/${UUID}.svg`);
  });

  it("leaves every other image URL as it is", () => {
    for (const url of [
      "/product-assets/clay/2026-09-21/app-icon.png",
      "https://example.com/logo.png",
      `https://media.brand.dev/${UUID}.jpg`,
      `https://media.brand.dev/${UUID}.png?x=1`,
      `https://media.brand.dev/fonts/${UUID}.png`,
      `https://media.brand.dev/../${UUID}.png`,
      `https://media.brand.dev.evil.example/${UUID}.png`,
      `http://media.brand.dev/${UUID}.png`,
      `https://media.brand.dev/${UUID.toUpperCase()}.png`,
    ]) expect(ownOriginImageUrl(url)).toBe(url);
  });

  it("names the one upstream file an image request may fetch, with a type chosen here", () => {
    expect(brandImageUpstream(`${UUID}.png`)).toEqual({ url: `https://media.brand.dev/${UUID}.png`, contentType: "image/png" });
    expect(brandImageUpstream(`${UUID}.svg`)).toEqual({ url: `https://media.brand.dev/${UUID}.svg`, contentType: "image/svg+xml" });
    for (const file of ["", "logo.png", `${UUID}.jpg`, `${UUID}.html`, `${UUID}.svgz`, `${UUID}.png/..`, `../${UUID}.png`, `${UUID.slice(1)}.png`, `${UUID}.png?x`, `%2e%2e/${UUID}.png`, `fonts/${UUID}.png`]) {
      expect(brandImageUpstream(file), file).toBeNull();
    }
  });
});
