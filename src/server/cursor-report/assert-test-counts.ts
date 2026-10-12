import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type TapCounts = { tests: number; pass: number; fail: number; skipped: number };

export function parseTapSummary(tap: string): TapCounts {
  const value = (name: string): number => {
    const matches = [...tap.matchAll(new RegExp(`^# ${name} (\\d+)$`, "gm"))];
    const match = matches.at(-1);
    if (!match) throw new Error(`TAP summary missing # ${name}`);
    return Number(match[1]);
  };
  return { tests: value("tests"), pass: value("pass"), fail: value("fail"), skipped: value("skipped") };
}

export function countDeclaredTests(source: string): number {
  return [...source.matchAll(/^\s*test\(/gm)].length;
}

export function assertCollectorBridgeCounts(actual: TapCounts, expectedPass: number): void {
  if (actual.skipped !== 0 || actual.fail !== 0 || actual.pass !== expectedPass || actual.tests !== expectedPass) {
    throw new Error(
      `collector-bridge.test.mjs must report pass=${expectedPass} skip=0 fail=0; got pass=${actual.pass} skipped=${actual.skipped} fail=${actual.fail} tests=${actual.tests}`,
    );
  }
}

export function assertGlobHasNoSkips(actual: TapCounts): void {
  if (actual.skipped !== 0) {
    throw new Error(`cursor-report Node suite must not skip; got skipped=${actual.skipped} pass=${actual.pass}`);
  }
}

const collectorBridgeUrl = new URL("./collector-bridge.test.mjs", import.meta.url);

export function expectedCollectorBridgePass(source = readFileSync(collectorBridgeUrl, "utf8")): number {
  return countDeclaredTests(source);
}

export function runCollectorBridgeTap(nodeArgs: string[] = ["--experimental-strip-types", "--test", "--test-reporter", "tap"]): TapCounts {
  const result = spawnSync(process.execPath, [...nodeArgs, fileURLToPath(collectorBridgeUrl)], {
    encoding: "utf8",
    env: process.env,
  });
  const tap = `${result.stdout}${result.stderr}`;
  if (result.error) throw result.error;
  return parseTapSummary(tap);
}

if (process.argv[1] && /assert-test-counts\.ts$/.test(process.argv[1])) {
  const globTapPath = process.argv[2];
  if (globTapPath) assertGlobHasNoSkips(parseTapSummary(readFileSync(globTapPath, "utf8")));
  assertCollectorBridgeCounts(runCollectorBridgeTap(), expectedCollectorBridgePass());
}
