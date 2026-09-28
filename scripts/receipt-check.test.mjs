import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { checkReceipt, evaluateReceipt } from "./receipt-check.mjs";

const now = new Date("2026-10-02T08:17:00.000Z");
const env = { GITHUB_EVENT_NAME: "schedule", GITHUB_RUN_ID: "123", GITHUB_SHA: "abc123" };

function calendarCard({ capturedAt = "2026-10-02T06:00:05.000Z", freshness = "FRESH" } = {}) {
  return {
    product: { name: "GitHub", slug: "github", domain: "github.com", description: "Code hosting" },
    status: "ACTIVE",
    activity: {
      kind: "contributionCalendar", attributionScope: "PERSONAL", capturedAt, freshness,
      provenanceLabel: "GitHub contribution calendar", total: 3, days: [],
    },
  };
}

function profile(cards) {
  return { handle: "lecturesfrom", displayName: "Owner", bio: "", cards };
}

test("a fresh GitHub calendar passes", () => {
  const line = evaluateReceipt(profile([calendarCard()]), { handle: "lecturesfrom", now, env });
  assert.deepEqual(line, {
    checkedAt: "2026-10-02T08:17:00.000Z", event: "schedule", runId: "123", sha: "abc123",
    handle: "lecturesfrom", capturedAt: "2026-10-02T06:00:05.000Z", freshness: "FRESH", ageHours: 2.28, ok: true,
  });
});

test("a STALE or ERROR calendar fails", () => {
  for (const freshness of ["STALE", "ERROR"]) {
    const line = evaluateReceipt(profile([calendarCard({ freshness })]), { handle: "lecturesfrom", now, env });
    assert.equal(line.freshness, freshness);
    assert.equal(line.ok, false);
  }
});

test("a calendar 37 hours old fails, and one exactly 36 hours old passes", () => {
  const old = evaluateReceipt(profile([calendarCard({ capturedAt: "2026-09-30T19:17:00.000Z" })]), { handle: "lecturesfrom", now, env });
  assert.equal(old.ageHours, 37);
  assert.equal(old.ok, false);
  const edge = evaluateReceipt(profile([calendarCard({ capturedAt: "2026-09-30T20:17:00.000Z" })]), { handle: "lecturesfrom", now, env });
  assert.equal(edge.ageHours, 36);
  assert.equal(edge.ok, true);
});

test("the 36-hour limit uses the exact age, not the rounded one", () => {
  // 36 hours and 15 seconds rounds to 36.00 but is over the limit.
  const over = evaluateReceipt(profile([calendarCard({ capturedAt: "2026-09-30T20:16:45.000Z" })]), { handle: "lecturesfrom", now, env });
  assert.equal(over.ageHours, 36);
  assert.equal(over.ok, false);
});

test("a capture time in the future fails", () => {
  const line = evaluateReceipt(profile([calendarCard({ capturedAt: "2026-10-02T09:00:00.000Z" })]), { handle: "lecturesfrom", now, env });
  assert.ok(line.ageHours < 0);
  assert.equal(line.ok, false);
});

test("a missing GitHub calendar card fails", () => {
  const otherProduct = { ...calendarCard(), product: { ...calendarCard().product, slug: "gitlab" } };
  const otherKind = { ...calendarCard(), activity: { ...calendarCard().activity, kind: "headlineMetrics" } };
  const noActivity = { ...calendarCard(), activity: undefined };
  for (const cards of [[], [otherProduct], [otherKind], [noActivity]]) {
    const line = evaluateReceipt(profile(cards), { handle: "lecturesfrom", now, env });
    assert.equal(line.ok, false);
    assert.equal(line.capturedAt, null);
    assert.equal(line.reason, "MISSING_CARD");
  }
});

test("an unpublished profile fails", () => {
  const line = evaluateReceipt(null, { handle: "lecturesfrom", now, env });
  assert.equal(line.ok, false);
  assert.equal(line.reason, "NOT_PUBLISHED");
});

test("an unparseable capture time fails", () => {
  const line = evaluateReceipt(profile([calendarCard({ capturedAt: "not a date" })]), { handle: "lecturesfrom", now, env });
  assert.equal(line.ok, false);
  assert.equal(line.ageHours, null);
});

test("the check prints one JSON line and returns exit code 1 on failure", async () => {
  const printed = [];
  const code = await checkReceipt({
    env: { ...env, PUBLIC_CONVEX_URL: "https://example.convex.cloud", RECEIPT_HANDLE: "lecturesfrom" },
    now,
    query: async (name, args) => {
      assert.equal(name, "publicProfiles:getByHandleV2");
      assert.deepEqual(args, { handle: "lecturesfrom" });
      return profile([calendarCard({ freshness: "STALE" })]);
    },
    print: line => printed.push(line),
  });
  assert.equal(code, 1);
  assert.equal(printed.length, 1);
  assert.equal(JSON.parse(printed[0]).ok, false);
});

test("the check exits 0 on a fresh card", async () => {
  const printed = [];
  const code = await checkReceipt({
    env: { ...env, PUBLIC_CONVEX_URL: "https://example.convex.cloud", RECEIPT_HANDLE: "lecturesfrom" },
    now,
    query: async () => profile([calendarCard()]),
    print: line => printed.push(line),
  });
  assert.equal(code, 0);
  assert.equal(JSON.parse(printed[0]).ok, true);
});

test("an unreachable backend still prints a failing line", async () => {
  const printed = [];
  const code = await checkReceipt({
    env: { ...env, PUBLIC_CONVEX_URL: "https://example.convex.cloud", RECEIPT_HANDLE: "lecturesfrom" },
    now,
    query: async () => { throw new Error("network down: secret-looking detail"); },
    print: line => printed.push(line),
  });
  assert.equal(code, 1);
  const line = JSON.parse(printed[0]);
  assert.equal(line.ok, false);
  assert.equal(line.reason, "UNREACHABLE");
  assert.doesNotMatch(printed[0], /secret-looking detail/);
});

test("bad configuration prints a failing line without querying", async () => {
  for (const config of [
    { PUBLIC_CONVEX_URL: "", RECEIPT_HANDLE: "lecturesfrom" },
    { PUBLIC_CONVEX_URL: "http://example.convex.cloud", RECEIPT_HANDLE: "lecturesfrom" },
    { PUBLIC_CONVEX_URL: "https://example.convex.cloud", RECEIPT_HANDLE: "Not A Handle" },
  ]) {
    const printed = [];
    let queried = false;
    const code = await checkReceipt({
      env: { ...env, ...config }, now,
      query: async () => { queried = true; return null; },
      print: line => printed.push(line),
    });
    assert.equal(code, 1);
    assert.equal(queried, false);
    assert.equal(JSON.parse(printed[0]).reason, "BAD_CONFIGURATION");
  }
});

const receiptWorkflow = () => readFileSync(".github/workflows/receipt.yml", "utf8");

test("the write-capable job runs only on the default branch", () => {
  assert.match(receiptWorkflow(), /if: github\.ref == format\('refs\/heads\/\{0\}', github\.event\.repository\.default_branch\)/);
});

test("each append attempt starts from a clean clone and tells a missing branch from a fetch error", () => {
  const workflow = receiptWorkflow();
  assert.match(workflow, /ls-remote --exit-code --heads origin receipts/);
  assert.match(workflow, /rm -rf receipts-work/);
});
