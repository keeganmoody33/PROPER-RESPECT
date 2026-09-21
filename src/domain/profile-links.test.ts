import { describe, expect, test } from "vitest";
import { validateProfileLinks } from "./profile-links";

describe("profile link validation", () => {
  test("keeps the owner's labels and choice, trimming surrounding whitespace", () => {
    expect(validateProfileLinks([{ label: " My site ", url: " https://example.com/me " }], "https://example.com/me")).toEqual({ profileLinks: [{ label: "My site", url: "https://example.com/me" }], preferredLinkUrl: "https://example.com/me" });
  });
  test("does not invent a preferred destination", () => {
    expect(validateProfileLinks([{ label: "Website", url: "http://example.com" }]).preferredLinkUrl).toBeUndefined();
  });
  test.each([
    [{ label: " ", url: "https://example.com" }],
    [{ label: "x".repeat(61), url: "https://example.com" }],
    [{ label: "Website", url: `https://example.com/${"a".repeat(2048)}` }],
  ])("rejects empty labels and excessive lengths", link => {
    expect(() => validateProfileLinks([link])).toThrow();
  });
});
