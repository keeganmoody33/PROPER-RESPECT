import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  CURSOR_COLLECTOR_METRICS,
  cursorCollectorSourceId,
  projectCursorCollectorReport,
} from "./collector-bridge.ts";
import {
  normalizeCursorAdminEvents,
  normalizeCursorAdminSpend,
  normalizeCursorCsv,
} from "./normalizer.ts";

// Integration-owner checkouts contain this contract. This isolated branch uses a
// pinned detached checkout when explicitly selected; an invalid selection fails.
const selectedContractRoot = process.env.CURSOR_COLLECTOR_CONTRACT_ROOT;
const contractUrl = selectedContractRoot === undefined
  ? new URL("../../domain/collector-contract.ts", import.meta.url)
  : pathToFileURL(resolve(selectedContractRoot, "src/domain/collector-contract.ts"));
const contract = selectedContractRoot !== undefined || existsSync(fileURLToPath(contractUrl))
  ? await import(contractUrl.href)
  : null;

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const eventPages = [1, 2].map((page) => fixture(`admin-events-page-${page}.synthetic.json`));
const csv = fixture("dashboard-v1.synthetic.csv");
const inclusiveWindow = { start: "2026-10-01T00:00:00.000Z", end: "2026-10-02T23:59:59.999Z", bounds: "inclusive" };
const approvedWindow = { start: inclusiveWindow.start, end: "2026-10-03T00:00:00.000Z" };
const personal = {
  source: {
    ownerAlias: "synthetic-owner",
    accountAlias: "synthetic-personal-account",
    workspaceAlias: null,
    sourceAlias: "synthetic-dashboard-export",
    scope: "personal-account",
    sample: "synthetic",
  },
  capturedAt: "2026-10-06T12:00:00.000Z",
  billingWindow: null,
};
const team = {
  ...personal,
  source: {
    ...personal.source,
    accountAlias: "synthetic-work-account",
    workspaceAlias: "synthetic-workspace",
    sourceAlias: "synthetic-admin-report",
    scope: "team-workspace",
  },
};
const adminReport = () => normalizeCursorAdminEvents(eventPages, team);
const csvReport = (text = csv, context = personal) => normalizeCursorCsv(text, context, { window: inclusiveWindow });
const selection = (report, overrides = {}) => ({
  reportId: "synthetic-review-1",
  sourceId: cursorCollectorSourceId(report),
  window: approvedWindow,
  allowedMetrics: [...CURSOR_COLLECTOR_METRICS],
  suppliedFileComplete: true,
  ...overrides,
});
// Unit tests inspect only the projection; the group below always uses the real
// shared schema and delivery functions rather than a substitute contract.
const project = (report, overrides = {}, validate = (value) => value) =>
  projectCursorCollectorReport(report, selection(report, overrides), validate);
const values = (review, metric) => review.rows.filter((row) => row.metric === metric).map((row) => row.value);
const wideReport = () => normalizeCursorAdminEvents(eventPages.map((page) => page.replace(
  '"endDate": 1790985599999', '"endDate": 1792108799999',
)), team);
const freeze = (value) => {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

test("projection preserves exact native quantities and keeps billing units and costs unknown", () => {
  const report = adminReport();
  const { review, sourceId, omitted } = project(report);
  assert.equal(sourceId, cursorCollectorSourceId(report));
  assert.equal(review.format, "cursor-complete-report-v1");
  assert.equal(review.reportId, "synthetic-review-1");
  assert.deepEqual(review.source, { provider: "cursor", kind: "owner-supplied-report", accountAlias: null, sample: "unknown" });
  assert.equal(review.coverage, "partial");
  assert.equal(review.complete, true);
  assert.deepEqual(review.window, approvedWindow);
  assert.equal(review.rows.length, 4 * CURSOR_COLLECTOR_METRICS.length);
  assert.deepEqual(values(review, "input_tokens"), ["9007199254740993", null, null, null]);
  assert.deepEqual(values(review, "cached_input_tokens"), ["20", null, null, "5"]);
  assert.deepEqual(values(review, "output_tokens"), ["13", null, null, null]);
  assert.deepEqual(values(review, "total_tokens"), [null, null, null, null]);
  assert.deepEqual(values(review, "requests"), [null, null, null, null]);
  assert.deepEqual(values(review, "usage_cost_usd"), [null, null, null, null]);
  for (const omission of ["cache-write-tokens", "request-billing-units", "reported-costs-and-charges", "provider-coverage-details"]) {
    assert.ok(omitted.includes(omission));
  }
  assert.equal(omitted.includes("outside-approved-window"), false);
});

test("only distinct approved collector metrics are emitted", () => {
  const report = adminReport();
  const { review } = project(report, { allowedMetrics: ["output_tokens", "input_tokens"] });
  assert.equal(review.rows.length, 8);
  assert.deepEqual([...new Set(review.rows.map((row) => row.metric))].sort(), ["input_tokens", "output_tokens"]);
  for (const allowedMetrics of [[], ["output_tokens", "output_tokens"], ["cache_write_input_tokens"]]) {
    assert.throws(() => project(report, { allowedMetrics }));
  }
});

test("legitimate equal events receive distinct report ordinal IDs without deduplication", () => {
  const report = adminReport();
  const { review } = project(report, { allowedMetrics: ["output_tokens"] });
  assert.equal(review.rows.length, 4);
  const [firstDuplicate, secondDuplicate] = review.rows.slice(1, 3);
  assert.notEqual(firstDuplicate.id, secondDuplicate.id);
  const withoutId = (row) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== "id"));
  assert.deepEqual(withoutId(firstDuplicate), withoutId(secondDuplicate));
  assert.equal(new Set(review.rows.map((row) => row.id)).size, review.rows.length);
  const all = project(report).review.rows.filter((row) => row.metric === "output_tokens");
  assert.deepEqual(review.rows.map((row) => row.id), all.map((row) => row.id));
});

test("CSV ambiguous input and money stay private while known zero and unknown quantities remain distinct", () => {
  const report = freeze(csvReport());
  const original = structuredClone(report);
  const { review, omitted } = project(report);
  assert.deepEqual(values(review, "input_tokens"), [null, null, null]);
  assert.deepEqual(values(review, "cached_input_tokens"), ["89", null, "0"]);
  assert.deepEqual(values(review, "output_tokens"), ["67", null, "0"]);
  assert.deepEqual(values(review, "total_tokens"), ["200", null, "0"]);
  assert.deepEqual(values(review, "usage_cost_usd"), [null, null, null]);
  assert.deepEqual(values(review, "requests"), [null, null, null]);
  assert.ok(omitted.includes("csv-input-category-interpretation"));
  assert.ok(omitted.includes("reported-costs-and-charges"));
  assert.deepEqual(report, original);
  assert.equal(report.events[0].tokens.inputWithCacheWrite, "41");
  assert.equal(report.events[0].tokens.inputWithoutCacheWrite, "3");
  assert.equal(report.events[0].reportedCostUsd, "0.01234567890123456789");
  assert.equal(report.events[0].costToYouLabel, "Included");
  assert.equal(report.coverage.completeness, "unknown");
});

test("projection sanitizes account aliases, provider identifiers, labels and raw payloads", () => {
  const pages = eventPages.map((page) => page.replace('"model":', '"prompt": "synthetic-private-prompt", "model":'));
  const report = normalizeCursorAdminEvents(pages, team);
  const original = structuredClone(report);
  const { review } = project(freeze(report));
  const payload = JSON.stringify(review);
  for (const privateValue of [
    "synthetic-private-prompt", "human@synthetic.invalid", "runner@synthetic.invalid",
    "synthetic-work-account", "synthetic-workspace", "synthetic-conversation-1",
    "synthetic-cloud-run", "synthetic-automation", "Synthetic runner", "Included in Business",
    "0.123456789012345678901",
  ]) assert.equal(payload.includes(privateValue), false);
  for (const row of review.rows) assert.deepEqual(Object.keys(row).sort(), ["at", "id", "kind", "metric", "unit", "value"]);
  assert.deepEqual(report, original);
});

test("source identity pins account, workspace, schema, filters and billing rather than capture or usage", () => {
  const report = adminReport();
  const sourceId = cursorCollectorSourceId(report);
  assert.match(sourceId, /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u);
  assert.equal(cursorCollectorSourceId(normalizeCursorAdminEvents(eventPages, { ...team, capturedAt: "2026-10-07T12:00:00.000Z" })), sourceId);
  assert.equal(cursorCollectorSourceId(wideReport()), sourceId);
  const changedUsage = eventPages.map((page) => page.replace('"chargedCents": 0.5', '"chargedCents": 0.75'));
  assert.equal(cursorCollectorSourceId(normalizeCursorAdminEvents(changedUsage, team)), sourceId);
  for (const key of ["ownerAlias", "accountAlias", "workspaceAlias", "sourceAlias"]) {
    const changed = normalizeCursorAdminEvents(eventPages, { ...team, source: { ...team.source, [key]: `different-${key}` } });
    assert.notEqual(cursorCollectorSourceId(changed), sourceId);
  }
  assert.notEqual(cursorCollectorSourceId(normalizeCursorAdminEvents(eventPages, team, { userId: "123" })), sourceId);
  assert.notEqual(cursorCollectorSourceId(normalizeCursorAdminEvents(eventPages, {
    ...team, billingWindow: { start: inclusiveWindow.start, end: "2026-10-31T23:59:59.999Z", basis: "owner-supplied" },
  })), sourceId);
  assert.notEqual(cursorCollectorSourceId(csvReport(csv, team)), sourceId);
  assert.notEqual(cursorCollectorSourceId(csvReport()), cursorCollectorSourceId(csvReport(csv, team)));
  assert.throws(() => project(report, { sourceId: cursorCollectorSourceId(csvReport()) }));
});

test("incomplete Admin reports, spend reports and incomplete supplied files cannot project", () => {
  const partial = normalizeCursorAdminEvents([eventPages[0]], team);
  const spend = normalizeCursorAdminSpend([1, 2].map((page) => ({
    page, text: fixture(`admin-spend-page-${page}.synthetic.json`),
  })), team, { pageSize: 2 });
  assert.throws(() => project(partial));
  assert.throws(() => project(spend));
  for (const report of [adminReport(), csvReport()]) {
    for (const suppliedFileComplete of [false, undefined]) assert.throws(() => project(report, { suppliedFileComplete }));
  }
});

test("approved subsets use half-open millisecond boundaries and retain original report ordinals", () => {
  const report = adminReport();
  const start = report.events[1].at;
  const end = report.events[3].at;
  const selected = project(report, { window: { start, end }, allowedMetrics: ["output_tokens"] });
  assert.equal(selected.review.rows.length, 2);
  assert.ok(selected.review.rows.every((row) => row.at === start));
  assert.ok(selected.omitted.includes("outside-approved-window"));
  const full = project(report, { allowedMetrics: ["output_tokens"] }).review;
  assert.deepEqual(selected.review.rows, full.rows.slice(1, 3));
  const finalMillisecond = project(report, {
    window: { start: inclusiveWindow.end, end: approvedWindow.end }, allowedMetrics: ["cached_input_tokens"],
  });
  assert.equal(finalMillisecond.review.rows.length, 1);
  assert.equal(finalMillisecond.review.rows[0].value, "5");
  assert.equal(report.events.length, 4);
});

test("approval cannot exceed report coverage or a seven-day half-open view", () => {
  const report = adminReport();
  for (const window of [
    { start: "2026-09-30T23:59:59.999Z", end: approvedWindow.end },
    { start: approvedWindow.start, end: "2026-10-03T00:00:00.001Z" },
    { start: approvedWindow.end, end: approvedWindow.start },
    { start: approvedWindow.start, end: approvedWindow.start },
    { start: "2026-10-01T00:00:00.0001Z", end: approvedWindow.end },
  ]) assert.throws(() => project(report, { window }));
  const wide = wideReport();
  assert.equal(project(wide, { window: { start: approvedWindow.start, end: "2026-10-08T00:00:00.000Z" } }).review.rows.length, 24);
  assert.throws(() => project(wide, { window: { start: approvedWindow.start, end: "2026-10-08T00:00:00.001Z" } }));
  assert.equal(wide.window.end, "2026-10-15T23:59:59.999Z");
});

test("the caller's validator receives the projection exactly once and controls acceptance", () => {
  const report = adminReport();
  let calls = 0;
  const accepted = project(report, {}, (candidate) => {
    calls++;
    return { validated: true, candidate };
  });
  assert.equal(calls, 1);
  assert.equal(accepted.review.validated, true);
  const refusal = new Error("synthetic-schema-refusal");
  assert.throws(() => project(report, {}, () => { throw refusal; }), (error) => error === refusal);
  calls = 0;
  assert.throws(() => project(report, { sourceId: "different-source" }, () => { calls++; }));
  assert.equal(calls, 0);
});

const integrationSkip = contract ? false : "Shared collector contract is absent; set CURSOR_COLLECTOR_CONTRACT_ROOT to its pinned validation checkout.";
describe("actual shared Cursor collector schema and delivery contract", { skip: integrationSkip }, () => {
  const validatedProject = (report, overrides = {}) => project(report, overrides, (candidate) => contract.cursorCompleteReportSchema.parse(candidate));
  const grant = (projection, allowedMetrics = [...CURSOR_COLLECTOR_METRICS]) => ({
    connectionId: "synthetic-cursor-connection",
    generation: 1,
    window: projection.review.window,
    expiresAt: "2026-10-20T00:00:00.000Z",
    allowedMetrics,
    checkpoint: null,
    descriptor: {
      sourceId: projection.sourceId,
      deviceId: "synthetic-device",
      collectorVersion: "cursor-report-bridge-v1",
      context: "WORK",
      account: { kind: "UNKNOWN" },
      sample: "synthetic",
      kind: "cursor-complete-export",
      provider: "cursor",
    },
  });

  test("Admin projection validates and round-trips exact quantities through real delivery", () => {
    assert.deepEqual([...contract.CURSOR_METRICS], [...CURSOR_COLLECTOR_METRICS]);
    const projection = validatedProject(adminReport());
    const delivery = contract.buildReviewDelivery({ grant: grant(projection), review: projection.review });
    assert.deepEqual(contract.assembleReview(delivery), projection.review);
    assert.equal(values(contract.assembleReview(delivery), "input_tokens")[0], "9007199254740993");
    assert.equal(delivery.manifest.review.coverage, "partial");
    assert.equal(delivery.manifest.expectedCheckpoint, null);
    assert.ok(delivery.chunks.flatMap((chunk) => chunk.rows).every((row) => row.kind === "cursor-measurement"));
  });

  test("personal CSV zero and unknown values round-trip without private money or input reinterpretation", () => {
    const report = csvReport();
    const projection = validatedProject(report);
    const syntheticGrant = grant(projection);
    syntheticGrant.descriptor.context = "PERSONAL";
    const assembled = contract.assembleReview(contract.buildReviewDelivery({ grant: syntheticGrant, review: projection.review }));
    assert.deepEqual(assembled, projection.review);
    assert.deepEqual(values(assembled, "input_tokens"), [null, null, null]);
    assert.deepEqual(values(assembled, "output_tokens"), ["67", null, "0"]);
    assert.deepEqual(values(assembled, "usage_cost_usd"), [null, null, null]);
    assert.equal(report.events[0].reportedCostUsd, "0.01234567890123456789");
    assert.equal(assembled.source.accountAlias, null);
    assert.equal(assembled.coverage, "partial");
  });

  test("newer capture and approved metric order do not manufacture another usage delivery", () => {
    const original = validatedProject(adminReport(), { allowedMetrics: ["input_tokens", "output_tokens"] });
    const newerReport = normalizeCursorAdminEvents(eventPages, { ...team, capturedAt: "2026-10-07T12:00:00.000Z" });
    const newer = validatedProject(newerReport, { allowedMetrics: ["output_tokens", "input_tokens"] });
    assert.deepEqual(newer, original);
    const approved = grant(original, ["input_tokens", "output_tokens"]);
    assert.deepEqual(
      contract.buildReviewDelivery({ grant: approved, review: newer.review }),
      contract.buildReviewDelivery({ grant: approved, review: original.review }),
    );
  });

  test("selected metrics and narrowed windows satisfy real authorization without widening approval", () => {
    const allowedMetrics = ["output_tokens"];
    const projection = validatedProject(adminReport(), {
      allowedMetrics,
      window: { start: "2026-10-01T12:34:56.789Z", end: "2026-10-02T23:59:59.999Z" },
    });
    const syntheticGrant = grant(projection, allowedMetrics);
    const delivery = contract.buildReviewDelivery({ grant: syntheticGrant, review: projection.review });
    assert.deepEqual(contract.assembleReview(delivery), projection.review);
    assert.equal(projection.review.rows.length, 2);
    assert.throws(() => contract.buildReviewDelivery({ grant: grant(projection, ["input_tokens"]), review: projection.review }));
    assert.throws(() => contract.buildReviewDelivery({
      grant: { ...syntheticGrant, window: approvedWindow }, review: projection.review,
    }));
    assert.throws(() => contract.buildReviewDelivery({
      grant: { ...syntheticGrant, descriptor: { ...syntheticGrant.descriptor, provider: "codex", kind: "codex-local-history" } },
      review: projection.review,
    }));
  });

  test("the actual schema rejects false quantities, duplicate row identities and private additions", () => {
    const review = validatedProject(adminReport()).review;
    const first = review.rows[0];
    assert.throws(() => contract.cursorCompleteReportSchema.parse({ ...review, rows: [first, first] }));
    assert.throws(() => contract.cursorCompleteReportSchema.parse({ ...review, rows: [{ ...first, value: "1.4" }] }));
    assert.throws(() => contract.cursorCompleteReportSchema.parse({ ...review, complete: false }));
    assert.throws(() => contract.cursorCompleteReportSchema.parse({ ...review, accountAlias: "synthetic-private-account" }));
    assert.throws(() => contract.cursorCompleteReportSchema.parse({ ...review, rows: [{ ...first, userEmail: "synthetic@private.invalid" }] }));
  });

  test("bounded complete synthetic reports exercise actual multi-chunk delivery and integrity rejection", () => {
    const event = '{"timestamp":"1790812800000","userEmail":"human@synthetic.invalid","kind":"Usage-based","model":"synthetic-model","tokenUsage":{"inputTokens":9007199254740993,"cacheReadTokens":0,"outputTokens":1}}';
    const page = `{"totalUsageEventsCount":1000,"pagination":{"numPages":1,"currentPage":1,"pageSize":1000,"hasNextPage":false,"hasPreviousPage":false},"usageEvents":[${Array(1000).fill(event).join(",")}],"period":{"startDate":1790812800000,"endDate":1790985599999}}`;
    const report = normalizeCursorAdminEvents([page], team);
    const projection = validatedProject(report);
    const delivery = contract.buildReviewDelivery({ grant: grant(projection), review: projection.review });
    assert.equal(projection.review.rows.length, 6000);
    assert.ok(delivery.chunks.length > 1);
    for (const chunk of delivery.chunks) assert.ok(new TextEncoder().encode(JSON.stringify(chunk)).length <= contract.COLLECTOR_LIMITS.chunkBytes);
    assert.deepEqual(contract.assembleReview({ manifest: delivery.manifest, chunks: [...delivery.chunks].reverse() }), projection.review);
    assert.throws(() => contract.assembleReview({ manifest: delivery.manifest, chunks: delivery.chunks.slice(1) }));
    const changed = structuredClone(delivery.chunks);
    changed[0].rows[0].row.value = "1";
    assert.throws(() => contract.assembleReview({ manifest: delivery.manifest, chunks: changed }));
  });
});
