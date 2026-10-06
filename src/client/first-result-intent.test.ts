import { describe, expect, it } from "vitest";
import { firstResultSource, firstResultReturnUrl } from "./first-result-intent";

describe("first-result source intent", () => {
  it("retains only a supported source across authentication", () => {
    expect(firstResultSource("?source=claude-code&token=private")).toBe("claude-code");
    expect(firstResultReturnUrl("claude-code")).toBe("/app/collection?source=claude-code");
    expect(firstResultReturnUrl("metric-packet")).toBe("/app/collection?source=metric-packet");
  });
  it("rejects unexpected sources and never forwards arbitrary return URLs or credentials", () => {
    for (const search of ["", "?source=clay", "?source=https://evil.example", "?source=codex&source=github", "?returnTo=https://evil.example&token=private"]) {
      expect(firstResultSource(search)).toBeNull();
    }
    expect(firstResultReturnUrl(null)).toBe("/app/collection");
  });
});
