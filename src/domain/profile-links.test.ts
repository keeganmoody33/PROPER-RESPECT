import { describe, expect, test } from "vitest";
import { profileLinkUrlSchema, validateProfileLinks } from "./profile-links";

const LINK_RULE = "Use an http or https link without embedded credentials.";

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
  test("answers text that isn't a URL with the link rule, not a TypeError", () => {
    const result = profileLinkUrlSchema.safeParse("not a url");
    expect(result.success).toBe(false);
    expect(result.error?.issues.map(issue => issue.message)).toContain(LINK_RULE);
  });
  test("rejects a saved link or name destination that isn't a URL with the link rule", () => {
    expect(() => validateProfileLinks([{ label: "Website", url: "not a url" }])).toThrow(LINK_RULE);
    expect(() => validateProfileLinks([{ label: "Website", url: "https://example.com" }], "not a url")).toThrow(LINK_RULE);
  });
});
