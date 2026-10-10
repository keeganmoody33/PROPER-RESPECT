import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assertCollectorBridgeCounts,
  assertGlobHasNoSkips,
  countDeclaredTests,
  parseTapSummary,
} from "./assert-test-counts";

const skippedTap = `# tests 16
# pass 10
# fail 0
# skipped 6
`;
const shortTap = `# tests 10
# pass 10
# fail 0
# skipped 0
`;
const greenTap = `# tests 16
# pass 16
# fail 0
# skipped 0
`;

describe("collector-bridge test count gate", () => {
  it("fails when TAP reports skips even if Node would stay green", () => {
    expect(() => assertCollectorBridgeCounts(parseTapSummary(skippedTap), 16)).toThrow(/skip=0/);
  });

  it("fails when pass count drops below the declared collector-bridge tests", () => {
    expect(() => assertCollectorBridgeCounts(parseTapSummary(shortTap), 16)).toThrow(/pass=16/);
  });

  it("accepts an exact pass count with zero skips", () => {
    expect(() => assertCollectorBridgeCounts(parseTapSummary(greenTap), 16)).not.toThrow();
  });

  it("fails a Cursor report glob TAP that contains skips", () => {
    expect(() => assertGlobHasNoSkips(parseTapSummary(skippedTap))).toThrow(/must not skip/);
    expect(() => assertGlobHasNoSkips(parseTapSummary(greenTap))).not.toThrow();
  });

  it("counts declared collector-bridge tests from source rather than a stale constant", () => {
    const source = readFileSync(new URL("./collector-bridge.test.mjs", import.meta.url), "utf8");
    expect(countDeclaredTests(source)).toBeGreaterThanOrEqual(16);
    expect(source).not.toMatch(/skip:\s*integrationSkip/);
    expect(source).not.toMatch(/\{ skip: integrationSkip \}/);
  });
});
