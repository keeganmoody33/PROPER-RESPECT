import { describe, expect, test } from "vitest";
import { USAGE_LINK_LABELS, usageLinkHost, usageLinkLabelText, usageLinkSchema, usageLinkUrlSchema } from "./usage-links";

describe("usage links", () => {
  test("the owner picks from five labels", () => {
    expect(USAGE_LINK_LABELS.map(usageLinkLabelText)).toEqual(["See how I use it", "Watch it in action", "Proof of use", "Demo", "Tutorial"]);
  });

  test.each([
    "https://www.loom.com/share/e5b8c04bca094dd8a5507925ab887002",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://github.com/keeganmoody33/PROPER-RESPECT",
  ])("accepts any https link: %s", url => {
    expect(usageLinkUrlSchema.parse(url)).toBe(url);
  });

  test.each([
    "http://www.loom.com/share/e5b8c04bca094dd8a5507925ab887002",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "https://user:secret@example.com/work",
    "not a link",
    `https://example.com/${"a".repeat(2048)}`,
  ])("refuses %s", url => {
    expect(usageLinkUrlSchema.safeParse(url).success).toBe(false);
  });

  test("a card keeps only the link and a listed label", () => {
    const url = "https://www.loom.com/share/e5b8c04bca094dd8a5507925ab887002";
    expect(usageLinkSchema.parse({ url, label: "TUTORIAL", embedUrl: "https://evil.example" })).toEqual({ url, label: "TUTORIAL" });
    expect(usageLinkSchema.safeParse({ url, label: "Watch my <b>thing</b>" }).success).toBe(false);
    expect(usageLinkSchema.safeParse({ url }).success).toBe(false);
  });

  test("the card names where the link goes", () => {
    expect(usageLinkHost("https://www.loom.com/share/x")).toBe("loom.com");
    expect(usageLinkHost("https://youtu.be/x")).toBe("youtu.be");
  });
});
