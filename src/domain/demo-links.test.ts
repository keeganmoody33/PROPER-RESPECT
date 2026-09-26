import { describe, expect, test } from "vitest";
import { DEMO_FRAME_ORIGINS, demoLinkSchema, demoPresentation, parseDemoLink, sameDemo } from "./demo-links";

const LOOM = "e5b8c04bca094dd8a5507925ab887002";
const ARCADE = "wdQ1LccMH6KrwcBz7mKl";

describe("demo link parsing", () => {
  test.each([
    [`https://www.loom.com/share/${LOOM}`, { provider: "LOOM", id: LOOM }],
    [`https://loom.com/share/${LOOM}?sid=abc123`, { provider: "LOOM", id: LOOM }],
    [`https://www.loom.com/share/Building-in-Clay-${LOOM}`, { provider: "LOOM", id: LOOM }],
    [`https://www.loom.com/embed/${LOOM}`, { provider: "LOOM", id: LOOM }],
    ["https://cap.so/s/pbwfp7zkqz6xzbp", { provider: "CAP", id: "pbwfp7zkqz6xzbp" }],
    ["https://cap.so/embed/pbwfp7zkqz6xzbp", { provider: "CAP", id: "pbwfp7zkqz6xzbp" }],
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s", { provider: "YOUTUBE", id: "dQw4w9WgXcQ" }],
    ["https://youtube.com/watch?v=dQw4w9WgXcQ", { provider: "YOUTUBE", id: "dQw4w9WgXcQ" }],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", { provider: "YOUTUBE", id: "dQw4w9WgXcQ" }],
    ["https://youtu.be/dQw4w9WgXcQ?si=share", { provider: "YOUTUBE", id: "dQw4w9WgXcQ" }],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", { provider: "YOUTUBE", id: "dQw4w9WgXcQ" }],
    ["https://www.youtube.com/live/dQw4w9WgXcQ", { provider: "YOUTUBE", id: "dQw4w9WgXcQ" }],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", { provider: "YOUTUBE", id: "dQw4w9WgXcQ" }],
    ["https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", { provider: "YOUTUBE", id: "dQw4w9WgXcQ" }],
    ["https://vimeo.com/76979871", { provider: "VIMEO", id: "76979871" }],
    ["https://www.vimeo.com/76979871", { provider: "VIMEO", id: "76979871" }],
    ["https://vimeo.com/76979871/a1b2c3d4e5", { provider: "VIMEO", id: "76979871", hash: "a1b2c3d4e5" }],
    ["https://player.vimeo.com/video/76979871?h=a1b2c3d4e5", { provider: "VIMEO", id: "76979871", hash: "a1b2c3d4e5" }],
    [`https://app.arcade.software/share/${ARCADE}`, { provider: "ARCADE", id: ARCADE }],
    [`https://demo.arcade.software/${ARCADE}`, { provider: "ARCADE", id: ARCADE }],
    [`  https://www.loom.com/share/${LOOM}  `, { provider: "LOOM", id: LOOM }],
    // A scheme's default port is the same origin: the URL parser drops it, and
    // the stored demo holds no URL. Any other port is refused below.
    [`https://www.loom.com:443/share/${LOOM}`, { provider: "LOOM", id: LOOM }],
  ])("reads %s", (input, expected) => {
    expect(parseDemoLink(input)).toEqual(expected);
  });

  test.each([
    // Other schemes and plain http.
    `http://www.loom.com/share/${LOOM}`,
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "ftp://vimeo.com/76979871",
    // Look-alike and wrong hosts.
    `https://www.loom.com.evil.example/share/${LOOM}`,
    `https://evilloom.com/share/${LOOM}`,
    `https://www.loom.com.@evil.example/share/${LOOM}`,
    "https://youtu.be.evil.example/dQw4w9WgXcQ",
    "https://www.youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    "https://vimeo.com.evil.example/76979871",
    "https://cap.so.evil.example/s/pbwfp7zkqz6xzbp",
    `https://arcade.software/share/${ARCADE}`,
    `https://www.loom.com./share/${LOOM}`,
    // Credentials and ports.
    `https://user:secret@www.loom.com/share/${LOOM}`,
    `https://www.loom.com:8443/share/${LOOM}`,
    // Paths and ids that aren't a single video.
    "https://www.loom.com/share/not-a-video",
    `https://www.loom.com/share/${LOOM}/extra`,
    "https://www.loom.com/looms/videos",
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&v=aaaaaaaaaaa",
    "https://www.youtube.com/playlist?list=PL1234567890",
    "https://www.youtube.com/@channel",
    "https://youtu.be/dQw4w9WgXcQ/extra",
    "https://vimeo.com/channels/staffpicks/76979871",
    "https://vimeo.com/76979871/not-hex!",
    "https://cap.so/s/..%2F..%2Fadmin",
    "https://cap.so/dashboard",
    `https://demo.arcade.software/share/${ARCADE}/x`,
    // Not a URL, or too long.
    "",
    "loom.com/share/" + LOOM,
    `https://cap.so/s/${"a".repeat(2100)}`,
  ])("rejects %s", input => {
    expect(parseDemoLink(input)).toBeNull();
  });

  test("ignores anything that isn't a string", () => {
    expect(parseDemoLink(undefined as unknown as string)).toBeNull();
    expect(parseDemoLink({ href: `https://www.loom.com/share/${LOOM}` } as unknown as string)).toBeNull();
  });
});

describe("demo presentation", () => {
  test.each([
    [{ provider: "LOOM", id: LOOM }, `https://www.loom.com/embed/${LOOM}`, `https://www.loom.com/share/${LOOM}`, "Loom"],
    [{ provider: "CAP", id: "pbwfp7zkqz6xzbp" }, "https://cap.so/embed/pbwfp7zkqz6xzbp", "https://cap.so/s/pbwfp7zkqz6xzbp", "Cap"],
    [{ provider: "YOUTUBE", id: "dQw4w9WgXcQ" }, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "YouTube"],
    [{ provider: "VIMEO", id: "76979871" }, "https://player.vimeo.com/video/76979871", "https://vimeo.com/76979871", "Vimeo"],
    [{ provider: "VIMEO", id: "76979871", hash: "a1b2c3d4e5" }, "https://player.vimeo.com/video/76979871?h=a1b2c3d4e5", "https://vimeo.com/76979871/a1b2c3d4e5", "Vimeo"],
    [{ provider: "ARCADE", id: ARCADE }, `https://demo.arcade.software/${ARCADE}`, `https://app.arcade.software/share/${ARCADE}`, "Arcade"],
  ] as const)("builds %o from a fixed template", (link, embedUrl, watchUrl, providerLabel) => {
    expect(demoPresentation(link)).toEqual({ provider: link.provider, providerLabel, embedUrl, watchUrl });
  });

  test("every player origin is one the card's frame list names", () => {
    const origins = new Set<string>(DEMO_FRAME_ORIGINS);
    for (const link of [
      { provider: "LOOM", id: LOOM }, { provider: "CAP", id: "abc" }, { provider: "YOUTUBE", id: "dQw4w9WgXcQ" },
      { provider: "VIMEO", id: "1" }, { provider: "ARCADE", id: ARCADE },
    ] as const) {
      expect(origins.has(new URL(demoPresentation(link)!.embedUrl).origin)).toBe(true);
    }
  });

  test.each([
    { provider: "LOOM", id: "../../admin" },
    { provider: "LOOM", id: `${LOOM}?autoplay=1` },
    { provider: "YOUTUBE", id: "dQw4w9WgXcQ\"><script>" },
    { provider: "VIMEO", id: "76979871", hash: "a1b2&autoplay=1" },
    { provider: "VIMEO", id: "abc" },
    { provider: "CAP", id: "a/b" },
    { provider: "ARCADE", id: "" },
    { provider: "LOOM", id: LOOM, hash: "a1b2c3d4e5" },
    { provider: "EVIL", id: "x" },
  ])("refuses stored parts that a template can't hold safely: %o", link => {
    expect(demoPresentation(link as never)).toBeNull();
    expect(demoLinkSchema.safeParse(link).success).toBe(false);
  });

  test("the public schema keeps only provider, id and hash", () => {
    expect(demoLinkSchema.parse({ provider: "LOOM", id: LOOM, embedUrl: "https://evil.example" })).toEqual({ provider: "LOOM", id: LOOM });
  });

  test("the same video compares equal however it was pasted", () => {
    expect(sameDemo(parseDemoLink(`https://www.loom.com/share/${LOOM}?sid=1`), { provider: "LOOM", id: LOOM })).toBe(true);
    expect(sameDemo(parseDemoLink("https://vimeo.com/76979871"), { provider: "VIMEO", id: "76979871", hash: "a1b2c3d4e5" })).toBe(false);
    expect(sameDemo(null, undefined)).toBe(false);
  });
});
