import { readFileSync, mkdtempSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";
import { parseCodexUsageCapture, reviewCodexUsageCaptures, formatCodexUsagePreview, CODEX_USAGE_LIMITS } from "./codex-usage";

const fixtureText = readFileSync("tests/fixtures/codex-usage/account-snapshot.json", "utf8");
const fixture = () => JSON.parse(fixtureText);
const withRawCount = (raw: string) => fixtureText.replace(/("lifetimeTokens"\s*:\s*)1200/, `$1${raw}`);
const lossyCounts = ["1e-999", "9007199254740991.1", "1.0000000000000001", "-1e-999", "9.0071992547409911e15"];

describe("bounded installed Codex metadata snapshots", () => {
  test.each(lossyCounts)("rejects lossy raw numeric token %s", raw => {
    expect(() => parseCodexUsageCapture(withRawCount(raw))).toThrow("Invalid Codex metadata capture.");
  });

  test.each(["0", "0e-999", "1.0", "1e3", "1000e-3", "9007199254740991", "9.007199254740991e15"])("retains exact safe integer token %s", raw => {
    expect(parseCodexUsageCapture(withRawCount(raw)).response.summary.lifetimeTokens).toBe(Number(raw));
  });

  test("unsupported JSON source-context runtime fails explicitly", () => {
    const parse = JSON.parse;
    const mock = vi.spyOn(JSON, "parse").mockImplementation((text, reviver) => parse(text, reviver && function (key, value) { return reviver.call(this, key, value); }));
    try {
      expect(() => parseCodexUsageCapture(fixtureText)).toThrow("Codex metadata preview requires JSON.parse source context (Node.js 22+).");
    } finally { mock.mockRestore(); }
  });
  test("keeps source totals and subsets separate, without inventing billed cost", () => {
    const review = reviewCodexUsageCaptures([fixture()]);
    const snapshot = review.accounts[0].snapshots[0];
    expect(snapshot.response.summary.lifetimeTokens).toBe(1200);
    expect(snapshot.response.threadUsage?.groups[0]).toMatchObject({ inputTokens: 1000, cachedInputTokens: 800, netNewInputTokens: 200, outputTokens: 200, totalTokens: 1200 });
    const output = formatCodexUsagePreview(review);
    expect(output).toContain("Cached input (included in input): 800");
    expect(output).toContain("Reported total tokens: 1200");
    expect(output).toContain("Estimated credits: 1.500000");
    expect(output).toContain("Estimated USD: unknown");
    expect(output).toContain("Billed spend: unknown");
    expect(output).toContain("Live provider semantics: unvalidated");
    expect(output).not.toContain("2400");
  });

  test("missing and null remain unknown while explicit zero survives", () => {
    const value = fixture();
    value.response = { summary: { lifetimeTokens: null, currentStreakDays: 0 } };
    const capture = parseCodexUsageCapture(JSON.stringify(value));
    expect(capture.response.summary).toMatchObject({ lifetimeTokens: null, currentStreakDays: 0, peakDailyTokens: null });
    expect(capture.response.dailyUsageBuckets).toBeNull();
    expect(capture.response.threadUsage).toBeNull();
    const output = formatCodexUsagePreview(reviewCodexUsageCaptures([capture]));
    expect(output).toContain("Current streak days: 0");
    expect(output).toContain("Lifetime tokens: unknown");
  });

  test("replay is idempotent; overlapping captures remain separate snapshots", () => {
    const first = fixture(), later = fixture();
    later.capture = { id: "capture-2", capturedAt: "2026-09-23T12:00:00.000Z" };
    later.response.summary.lifetimeTokens = 1600;
    const review = reviewCodexUsageCaptures([later, first, first]);
    expect(review.replays).toBe(1);
    expect(review.accounts[0].snapshots.map(item => item.response.summary.lifetimeTokens)).toEqual([1200, 1600]);
    expect(review).not.toHaveProperty("totalTokens");
    expect(formatCodexUsagePreview(review)).toContain("Do not add these snapshots");
    expect(reviewCodexUsageCaptures([first, later, first])).toEqual(review);
  });

  test("quarantines incompatible same-identity captures without choosing the larger value", () => {
    const changed = fixture();
    changed.response.summary.lifetimeTokens = 9999;
    const review = reviewCodexUsageCaptures([fixture(), changed, fixture()]);
    expect(review.accounts[0].snapshots).toHaveLength(0);
    expect(review.accounts[0].conflicts).toHaveLength(1);
    expect(review.accounts[0].conflicts[0].variantCount).toBe(2);
    expect(formatCodexUsagePreview(review)).not.toContain("9999");
    expect(reviewCodexUsageCaptures([changed, fixture(), fixture()])).toEqual(review);
  });

  test("same capture IDs in different owner/account scopes never collide", () => {
    const account = fixture(), owner = fixture();
    account.scope.accountAlias = "other-account";
    owner.scope.ownerAlias = "other-owner";
    const review = reviewCodexUsageCaptures([fixture(), account, owner]);
    expect(review.accounts).toHaveLength(3);
    expect(review.accounts.every(item => item.snapshots.length === 1 && item.conflicts.length === 0)).toBe(true);
  });

  test("retains date-only buckets, normalizes ordering and never fills missing days", () => {
    const value = fixture();
    value.response.dailyUsageBuckets = [{ startDate: "2026-09-22", tokens: 0 }, { startDate: "2026-09-20", tokens: 7 }];
    const capture = parseCodexUsageCapture(JSON.stringify(value));
    expect(capture.response.dailyUsageBuckets).toEqual([{ startDate: "2026-09-20", tokens: 7 }, { startDate: "2026-09-22", tokens: 0 }]);
    expect(formatCodexUsagePreview(reviewCodexUsageCaptures([capture]))).toContain("Reporting timezone: unknown");
  });

  test("formats micro-units exactly and retains an inconsistent total with a visible caveat", () => {
    const value = fixture();
    value.response.threadUsage.estimatedUsageUsdMicros = Number.MAX_SAFE_INTEGER;
    value.response.threadUsage.groups[0].totalTokens = 1199;
    const output = formatCodexUsagePreview(reviewCodexUsageCaptures([value]));
    expect(output).toContain("Estimated USD: 9007199254.740991");
    expect(output).toContain("Reported total tokens: 1199");
    expect(output).toContain("reported total differs from input + output");
  });

  test.each([
    (value: ReturnType<typeof fixture>) => { value.response.summary.lifetimeTokens = -1; },
    (value: ReturnType<typeof fixture>) => { value.response.summary.lifetimeTokens = Number.MAX_SAFE_INTEGER + 1; },
    (value: ReturnType<typeof fixture>) => { value.response.summary.lifetimeTokens = 1.5; },
    (value: ReturnType<typeof fixture>) => { value.source.version = "unsupported"; },
    (value: ReturnType<typeof fixture>) => { value.capture.capturedAt = "not-a-date"; },
    (value: ReturnType<typeof fixture>) => { value.response.dailyUsageBuckets[0].startDate = "2026-02-30"; },
    (value: ReturnType<typeof fixture>) => { value.response.dailyUsageBuckets.push(value.response.dailyUsageBuckets[0]); },
    (value: ReturnType<typeof fixture>) => { value.response.threadUsage.threadId = "different-thread"; },
    (value: ReturnType<typeof fixture>) => { value.response.threadUsage.groups[0].cachedInputTokens = 1001; },
    (value: ReturnType<typeof fixture>) => { value.response.threadUsage.groups = Array(CODEX_USAGE_LIMITS.groups + 1).fill(value.response.threadUsage.groups[0]); },
    (value: ReturnType<typeof fixture>) => { value.response.dailyUsageBuckets = Array.from({ length: CODEX_USAGE_LIMITS.days + 1 }, (_, index) => ({ startDate: new Date(Date.UTC(2010, 0, index + 1)).toISOString().slice(0, 10), tokens: 0 })); },
    (value: ReturnType<typeof fixture>) => { value.response.threadUsage.estimatedUsageCreditsMicros = null; },
    (value: ReturnType<typeof fixture>) => { delete value.scope.accountAlias; },
    (value: ReturnType<typeof fixture>) => { value.response.summary.prompt = "PRIVATE_SENTINEL_SECRET"; },
    (value: ReturnType<typeof fixture>) => { value.scope.accountAlias = "/private/owner/path"; },
  ])("rejects unsupported or malformed input with no source values in errors", change => {
    const value = fixture(); change(value);
    expect(() => parseCodexUsageCapture(JSON.stringify(value))).toThrow("Invalid Codex metadata capture.");
  });

  test("rejects malformed JSON, oversized bytes and too many captures", () => {
    expect(() => parseCodexUsageCapture("PRIVATE_SENTINEL_SECRET")).toThrow("Invalid Codex metadata capture.");
    expect(() => parseCodexUsageCapture(" ".repeat(CODEX_USAGE_LIMITS.bytes + 1))).toThrow("Invalid Codex metadata capture.");
    expect(() => reviewCodexUsageCaptures(Array(CODEX_USAGE_LIMITS.captures + 1).fill(fixture()))).toThrow("Invalid Codex metadata capture.");
  });
});

describe("file-only preview command", () => {
  test("reports an unsupported numeric-source runtime without a preview", () => {
    const legacyParse = "const parse=JSON.parse;JSON.parse=(text,reviver)=>parse(text,reviver&&function(key,value){return reviver.call(this,key,value)});";
    const result = spawnSync(process.execPath, ["--no-warnings", "--experimental-strip-types", "--import", `data:text/javascript,${encodeURIComponent(legacyParse)}`, "scripts/codex-usage-preview.mjs", "tests/fixtures/codex-usage/account-snapshot.json"], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr.trim()).toBe("Codex metadata preview requires JSON.parse source context (Node.js 22+).");
  });
  test.each(lossyCounts)("lossy count %s emits no partial CLI preview", raw => {
    const directory = mkdtempSync(join(tmpdir(), "codex-usage-preview-"));
    const path = join(directory, "private-input.json");
    try {
      writeFileSync(path, withRawCount(raw));
      const result = spawnSync(process.execPath, ["--no-warnings", "--experimental-strip-types", "scripts/codex-usage-preview.mjs", "tests/fixtures/codex-usage/account-snapshot.json", path], { encoding: "utf8" });
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Could not preview Codex metadata");
      expect(result.stderr).not.toContain(path);
      expect(result.stderr).not.toContain(raw);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  const run = (...paths: string[]) => execFileSync(process.execPath, ["--experimental-strip-types", "scripts/codex-usage-preview.mjs", ...paths], { encoding: "utf8", env: { ...process.env, NODE_NO_WARNINGS: "1" } });
  test("actually previews a synthetic file and reports an exact replay", () => {
    const path = "tests/fixtures/codex-usage/account-snapshot.json";
    const output = run(path, path);
    expect(output).toContain("Exact replays ignored: 1");
    expect(output).toContain("Lifetime tokens: 1200");
    expect(output.match(/Capture: synthetic-capture-1/g)).toHaveLength(1);
  });
  test("fails closed without printing a path or raw secret", () => {
    const directory = mkdtempSync(join(tmpdir(), "codex-usage-preview-"));
    const path = join(directory, "PRIVATE_PATH_SECRET.json");
    try {
      writeFileSync(path, '{"prompt":"PRIVATE_CONTENT_SECRET"}');
      const result = spawnSync(process.execPath, ["--experimental-strip-types", "scripts/codex-usage-preview.mjs", path], { encoding: "utf8", env: { ...process.env, NODE_NO_WARNINGS: "1" } });
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Could not preview Codex metadata");
      expect(result.stderr).not.toMatch(/PRIVATE_PATH_SECRET|PRIVATE_CONTENT_SECRET/);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  test("rejects directories, symlinks, oversized files and malformed UTF-8 before preview", () => {
    const directory = mkdtempSync(join(tmpdir(), "codex-usage-preview-"));
    try {
      const real = join(directory, "valid.json"), link = join(directory, "link.json");
      const large = join(directory, "large.json"), encoding = join(directory, "encoding.json");
      writeFileSync(real, fixtureText);
      symlinkSync(real, link);
      writeFileSync(large, " ".repeat(CODEX_USAGE_LIMITS.bytes + 1));
      writeFileSync(encoding, Buffer.from([0xff]));
      for (const path of [directory, link, large, encoding]) {
        const result = spawnSync(process.execPath, ["--no-warnings", "--experimental-strip-types", "scripts/codex-usage-preview.mjs", path], { encoding: "utf8" });
        expect(result.status).toBe(1);
        expect(result.stdout).toBe("");
        expect(result.stderr).toContain("Could not preview Codex metadata");
        expect(result.stderr).not.toContain(directory);
      }
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  test("conflicts return a distinct failure code and never expose disputed counts", () => {
    const directory = mkdtempSync(join(tmpdir(), "codex-usage-preview-"));
    try {
      const changed = fixture(); changed.response.summary.lifetimeTokens = 987654321;
      const path = join(directory, "conflict.json"); writeFileSync(path, JSON.stringify(changed));
      const result = spawnSync(process.execPath, ["--no-warnings", "--experimental-strip-types", "scripts/codex-usage-preview.mjs", "tests/fixtures/codex-usage/account-snapshot.json", path], { encoding: "utf8" });
      expect(result.status).toBe(2);
      expect(result.stdout).toContain("incompatible variants quarantined");
      expect(result.stdout).not.toContain("987654321");
      expect(result.stderr).toBe("");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
