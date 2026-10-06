import { describe, expect, test } from "vitest";
import { trimToLength } from "./published-text-limits";

describe("trimToLength", () => {
  test("trims and keeps text within the limit", () => {
    expect(trimToLength("  Name  ", 80)).toBe("Name");
  });

  test("cuts text over the limit", () => {
    expect(trimToLength("x".repeat(81), 80)).toBe("x".repeat(80));
  });

  test("drops a character that the cut would split", () => {
    expect(trimToLength(`${"x".repeat(79)}🙂`, 80)).toBe("x".repeat(79));
  });

  test("keeps a whole character that ends at the limit", () => {
    expect(trimToLength(`${"x".repeat(78)}🙂`, 80)).toBe(`${"x".repeat(78)}🙂`);
  });

  test("does not end on a space after cutting", () => {
    expect(trimToLength(`${"x".repeat(79)} tail`, 80)).toBe("x".repeat(79));
  });
});
