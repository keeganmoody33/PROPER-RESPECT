import { describe, expect, it } from "vitest";
import { isPrivateReplayPath } from "./analytics";

describe("session replay route gate", () => {
  it.each(["/app", "/app/collection", "/app/collection/abc", "/sign-in", "/sign-in/factor-one", "/sign-up", "/onboarding"])(
    "keeps %s out of replay", path => {
      expect(isPrivateReplayPath(path)).toBe(true);
    });

  it.each(["/", "/about", "/keegan", "/apple", "/application", "/agents.md"])("records public route %s", path => {
    expect(isPrivateReplayPath(path)).toBe(false);
  });
});
