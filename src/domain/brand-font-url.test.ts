import { describe, expect, it } from "vitest";
import { brandFontUpstream, ownOriginFontUrl } from "./brand-font-url";

const HASH = "45386689a773179ad2a4f750698c7b6152d7b57f4e7c41aed967d8704d49e115";

describe("brand font URLs", () => {
  it("moves the provider's fonts to this site, because its host lets no other origin load them", () => {
    expect(ownOriginFontUrl(`https://media.brand.dev/fonts/${HASH}.woff2`)).toBe(`/api/brand-fonts/${HASH}.woff2`);
    expect(ownOriginFontUrl(`https://media.brand.dev/fonts/${HASH}.otf`)).toBe(`/api/brand-fonts/${HASH}.otf`);
  });

  it("leaves every other font URL as it is", () => {
    for (const url of [
      "https://fonts.gstatic.com/s/roboto/v51/abc.ttf",
      `https://media.brand.dev/${HASH}.woff2`,
      `https://media.brand.dev/fonts/${HASH}.woff2?x=1`,
      `https://media.brand.dev/fonts/../${HASH}.woff2`,
      `https://media.brand.dev.evil.example/fonts/${HASH}.woff2`,
      `http://media.brand.dev/fonts/${HASH}.woff2`,
      `https://media.brand.dev/fonts/${HASH}.svg`,
    ]) expect(ownOriginFontUrl(url)).toBe(url);
  });

  it("names the one upstream file a font request may fetch, and nothing else", () => {
    expect(brandFontUpstream(`${HASH}.woff2`)).toEqual({ url: `https://media.brand.dev/fonts/${HASH}.woff2`, contentType: "font/woff2" });
    expect(brandFontUpstream(`${HASH}.woff`)?.contentType).toBe("font/woff");
    expect(brandFontUpstream(`${HASH}.ttf`)?.contentType).toBe("font/ttf");
    expect(brandFontUpstream(`${HASH}.otf`)?.contentType).toBe("font/otf");
    for (const file of ["", "font.woff2", `${HASH}.svg`, `${HASH.toUpperCase()}.woff2`, `${HASH}.woff2/..`, `../${HASH}.woff2`, `${HASH.slice(1)}.woff2`, `${HASH}.woff2?x`, `%2e%2e/${HASH}.woff2`]) {
      expect(brandFontUpstream(file), file).toBeNull();
    }
  });
});
