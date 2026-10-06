import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  normalizeCursorAdminEvents,
  normalizeCursorAdminSpend,
  normalizeCursorCsv,
} from "./normalizer.ts";

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const eventPages = [fixture("admin-events-page-1.synthetic.json"), fixture("admin-events-page-2.synthetic.json")];
const spendPages = [1, 2].map((page) => ({ page, text: fixture(`admin-spend-page-${page}.synthetic.json`) }));
const csv = [1, 2, 3].map((version) => fixture(`dashboard-v${version}.synthetic.csv`));
const window = {
  start: "2026-10-01T00:00:00.000Z",
  end: "2026-10-02T23:59:59.999Z",
  bounds: "inclusive",
};
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
const alterJson = (text, mutate) => {
  const object = JSON.parse(text);
  mutate(object);
  return JSON.stringify(object);
};
const reportEvents = (pages = eventPages, context = team, filters = {}) => normalizeCursorAdminEvents(pages, context, filters);
const reportSpend = (pages = spendPages, context = team, options = { pageSize: 2 }) => normalizeCursorAdminSpend(pages, context, options);
const reportCsv = (text = csv[0], context = personal, options = { window }) => normalizeCursorCsv(text, context, options);
const withoutPosition = ({ position, ...event }) => event;
const automatedEventPage = alterJson(eventPages[1], (page) => {
  page.totalUsageEventsCount = 1;
  page.pagination = { numPages: 1, currentPage: 1, pageSize: 2, hasNextPage: false, hasPreviousPage: false };
  page.usageEvents = [page.usageEvents[1]];
});

test("official Admin event fields preserve exact decimals, token categories, and inclusive bounds", () => {
  const report = reportEvents();
  assert.equal(report.format, "proper-cursor-report-v1");
  assert.equal(report.schema, "cursor-admin-events-2026-10-06");
  assert.equal(report.kind, "events");
  assert.deepEqual(report.source, team.source);
  assert.equal(report.identityBasis, "owner-supplied-unverified");
  assert.equal(report.capturedAt, team.capturedAt);
  assert.deepEqual(report.window, window);
  assert.deepEqual(report.events[0].tokens, {
    input: "9007199254740993",
    output: "13",
    cacheWrite: "10",
    cacheRead: "20",
    total: null,
    inputWithCacheWrite: null,
    inputWithoutCacheWrite: null,
  });
  assert.equal(report.events[0].requestUnits, "0.1234567890123456789");
  assert.equal(report.events[0].modelCostCents, "0.01234567890123456789");
  assert.equal(report.events[0].reportedChargeCents, "0.123456789012345678901");
  assert.equal(report.events[0].cursorTokenFeeCents, "0.000000125");
  assert.equal(report.events[0].discountPercentOff, "12.5");
  assert.equal(report.events[0].at, window.start);
  assert.equal(report.events[3].at, window.end);
  assert.match(report.contentDigest, /^[a-f0-9]{64}$/u);
});

test("complete Admin pagination reports the provider count without proving an atomic snapshot", () => {
  const report = reportEvents();
  assert.equal(report.coverage.completeness, "complete");
  assert.equal(report.coverage.basis, "provider-pagination");
  assert.equal(report.coverage.returnedRows, 4);
  assert.equal(report.coverage.expectedRows, 4);
  assert.equal(report.coverage.expectedPages, 2);
  assert.deepEqual(report.coverage.pagesPresent, [1, 2]);
  assert.equal(report.coverage.atomicSnapshot, "unproven");
  assert.equal(reportEvents([...eventPages].reverse()).contentDigest, report.contentDigest);
});

test("identical legitimate events are retained with report positions and no invented event IDs", () => {
  const report = reportEvents();
  assert.equal(report.events.length, 4);
  assert.deepEqual(withoutPosition(report.events[1]), withoutPosition(report.events[2]));
  assert.deepEqual(report.events[1].position, { page: 1, row: 2 });
  assert.deepEqual(report.events[2].position, { page: 2, row: 1 });
  for (const event of report.events) {
    assert.equal(event.id, undefined);
    assert.equal(event.eventId, undefined);
    assert.equal(event.cashPaid, null);
  }
});

test("request billing, absent token fields, and Included usage remain distinct from cash paid", () => {
  const [, included, , sparse] = reportEvents().events;
  assert.equal(included.kind, "Included in Business");
  assert.equal(included.isTokenBasedCall, false);
  assert.equal(included.isChargeable, false);
  assert.equal(included.requestUnits, "1.4");
  assert.equal(included.reportedChargeCents, "0.5");
  assert.equal(included.tokens.input, null);
  assert.equal(included.tokens.cacheRead, null);
  assert.equal(included.modelCostCents, null);
  assert.equal(included.cashPaid, null);
  assert.equal(sparse.tokens.input, null);
  assert.equal(sparse.tokens.output, null);
  assert.equal(sparse.tokens.cacheWrite, null);
  assert.equal(sparse.tokens.cacheRead, "5");
  assert.equal(sparse.tokens.total, null);
  assert.equal(sparse.requestUnits, "0.0000001");
  assert.equal(sparse.modelCostCents, "0.000000000000000001");
});

test("Admin reports retain service, cloud, automation, conversation, filter and billing provenance", () => {
  const filters = {
    userId: "123",
    hostingType: "SELF_HOSTED_POOL",
  };
  const billingWindow = { ...window, basis: "owner-supplied" };
  delete billingWindow.bounds;
  const report = reportEvents(eventPages, { ...team, billingWindow }, filters);
  assert.deepEqual(report.filters, filters);
  assert.deepEqual(report.billingWindow, billingWindow);
  assert.equal(report.events[3].serviceAccountId, "synthetic-service-account");
  assert.equal(report.events[3].serviceAccountName, "Synthetic runner");
  assert.equal(report.events[3].cloudAgentId, "synthetic-cloud-run");
  assert.equal(report.events[3].automationId, "synthetic-automation");
  assert.equal(report.events[3].conversationId, "synthetic-conversation-2");
  assert.equal(report.events[3].isHeadless, true);
});

test("a missing Admin page remains partial even if that page contains valid rows", () => {
  for (const page of eventPages) {
    const report = reportEvents([page]);
    assert.equal(report.coverage.completeness, "partial");
    assert.equal(report.coverage.returnedRows, 2);
    assert.equal(report.coverage.expectedRows, 4);
    assert.equal(report.coverage.expectedPages, 2);
    assert.ok(report.coverage.missing.length > 0);
  }
});

test("inconsistent Admin pagination, counts, periods and duplicate pages reject", () => {
  const mutations = [
    (page) => { page.totalUsageEventsCount = 5; },
    (page) => { page.pagination.numPages = 3; },
    (page) => { page.pagination.pageSize = 3; },
    (page) => { page.pagination.hasPreviousPage = false; },
    (page) => { page.period.endDate += 1; },
  ];
  for (const mutate of mutations) assert.throws(() => reportEvents([eventPages[0], alterJson(eventPages[1], mutate)]));
  assert.throws(() => reportEvents([eventPages[0], eventPages[0]]));
  const shortReport = reportEvents([alterJson(eventPages[0], (page) => { page.usageEvents.pop(); }), eventPages[1]]);
  assert.equal(shortReport.coverage.completeness, "partial");
  assert.equal(shortReport.coverage.returnedRows, 3);
  assert.equal(shortReport.coverage.expectedRows, 4);
});

test("available event attribution must agree with the caller's requested filters", () => {
  const filters = {
    email: "runner@synthetic.invalid",
    serviceAccountId: "synthetic-service-account",
    cloudAgentId: "*",
    automationId: "synthetic-automation",
  };
  assert.deepEqual(reportEvents([automatedEventPage], team, filters).filters, filters);
  for (const filters of [
    { email: "wrong@synthetic.invalid" },
    { serviceAccountId: "wrong-service-account" },
    { cloudAgentId: "wrong-cloud-run" },
    { automationId: "wrong-automation" },
  ]) assert.throws(() => reportEvents([automatedEventPage], team, filters));
  assert.throws(() => reportEvents(eventPages, team, { cloudAgentId: "*" }));
});

test("Admin event pages reject rows beyond the provider's remaining offset", () => {
  const pages = eventPages.map((text, index) => alterJson(text, (page) => {
    page.totalUsageEventsCount = 3;
    if (index === 0) page.usageEvents = page.usageEvents.slice(0, 1);
  }));
  assert.throws(() => reportEvents(pages));
  assert.throws(() => reportEvents([pages[1]]));
});

test("email filters do not treat an asterisk as a wildcard", () => {
  assert.throws(() => reportEvents([automatedEventPage], team, { email: "*" }));
});

test("service account filters do not treat an asterisk as a wildcard", () => {
  assert.throws(() => reportEvents([automatedEventPage], team, { serviceAccountId: "*" }));
  assert.deepEqual(reportEvents([automatedEventPage], team, { cloudAgentId: "*", automationId: "*" }).filters,
    { cloudAgentId: "*", automationId: "*" });
});

test("Admin events cannot promote caller billing provenance to source-reported", () => {
  assert.throws(() => reportEvents(eventPages, {
    ...team,
    billingWindow: { start: window.start, end: window.end, basis: "source-reported" },
  }));
});

test("Admin imports reject private-dashboard JSON, malformed JSON and duplicate keys", () => {
  assert.throws(() => reportEvents(['{"usageEvents":[],"startDate":1790812800000,"endDate":1790985599999}']));
  assert.throws(() => reportEvents(["{broken"]));
  assert.throws(() => reportEvents([eventPages[0].replace('"totalUsageEventsCount": 4', '"totalUsageEventsCount": 4, "totalUsageEventsCount": 4')]));
  assert.throws(() => reportEvents([eventPages[0].replace('"inputTokens": 9007199254740993', '"inputTokens": 1, "inputTokens": 2')]));
  assert.throws(() => reportEvents([eventPages[0].replace('"inputTokens": 9007199254740993', '"inputTokens": 1, "input\\u0054okens": 2')]));
});

test("Admin numeric fields accept numeric lexemes and reject dashboard numeric strings", () => {
  for (const mutate of [
    (page) => { page.usageEvents[0].requestsCosts = "1.4"; },
    (page) => { page.usageEvents[0].chargedCents = "0.5"; },
    (page) => { page.usageEvents[0].tokenUsage.inputTokens = "10"; },
    (page) => { page.usageEvents[0].tokenUsage.inputTokens = -1; },
    (page) => { page.usageEvents[0].tokenUsage.outputTokens = 1.5; },
    (page) => { page.usageEvents[0].requestsCosts = -1; },
    (page) => { page.usageEvents[0].maxMode = "true"; },
  ]) assert.throws(() => reportEvents([alterJson(eventPages[0], mutate), eventPages[1]]));
});

test("unknown JSON payload fields do not enter a report or its content digest", () => {
  const extraPages = eventPages.map((page) => alterJson(page, (value) => {
    value.prompt = "synthetic-sensitive-payload";
    value.usageEvents[0].prompt = "synthetic-sensitive-payload";
  }));
  const baseline = reportEvents(eventPages.map((page) => JSON.stringify(JSON.parse(page))));
  const report = reportEvents(extraPages);
  assert.equal(JSON.stringify(report).includes("synthetic-sensitive-payload"), false);
  assert.equal(report.contentDigest, baseline.contentDigest);
});

test("official spend preserves fractional cents, limits, missing requests and source billing start", () => {
  const report = reportSpend();
  assert.equal(report.schema, "cursor-admin-spend-2026-10-06");
  assert.equal(report.kind, "spend");
  assert.equal(report.window, null);
  assert.deepEqual(report.billingWindow, { start: window.start, end: null, basis: "source-reported" });
  assert.equal(report.spend[0].onDemandSpendCents, "1234.000000123456789");
  assert.equal(report.spend[0].overallSpendCents, "2345.750000123456789");
  assert.equal(report.spend[0].hardLimitOverrideDollars, "0");
  assert.equal(report.spend[0].monthlyLimitDollars, null);
  assert.equal(report.spend[0].effectivePerUserLimitDollars, "50.5");
  assert.equal(report.spend[1].onDemandSpendCents, "0.000000000000000001");
  assert.equal(report.spend[1].fastPremiumRequests, null);
  assert.equal(report.spend[2].fastPremiumRequests, "0");
  assert.equal(report.spend[2].monthlyLimitDollars, "0");
  assert.equal(report.coverage.completeness, "complete");
  assert.equal(report.coverage.returnedRows, 3);
  assert.equal(report.coverage.expectedRows, 3);
  for (const spend of report.spend) assert.equal(spend.cashPaid, null);
});

test("spend subset pagination stays partial and preserves search scope", () => {
  const report = reportSpend([spendPages[1]], team, { pageSize: 2, searchTerm: "synthetic" });
  assert.deepEqual(report.filters, { searchTerm: "synthetic" });
  assert.equal(report.coverage.completeness, "partial");
  assert.deepEqual(report.coverage.pagesPresent, [2]);
  assert.equal(report.coverage.expectedPages, 2);
  assert.equal(report.coverage.expectedRows, null);
  assert.ok(report.coverage.missing.includes("search-member-count-semantics"));
});

test("unsearched spend pages reject rows beyond the provider's remaining offset", () => {
  const pages = spendPages.map(({ page, text }) => ({ page, text: alterJson(text, (value) => {
    if (page === 1) value.teamMemberSpend = value.teamMemberSpend.slice(0, 1);
    else value.teamMemberSpend.push({ ...value.teamMemberSpend[0], userId: "synthetic-member-4", email: "four@synthetic.invalid" });
  }) }));
  assert.throws(() => reportSpend(pages));
  assert.throws(() => reportSpend([pages[1]]));
});

test("searched spend retains unknown member-count semantics even when all pages are present", () => {
  const report = reportSpend(spendPages, team, { pageSize: 2, searchTerm: "synthetic" });
  assert.equal(report.coverage.completeness, "unknown");
  assert.equal(report.coverage.expectedRows, null);
  assert.equal(report.coverage.returnedRows, 3);
  assert.deepEqual(report.coverage.pagesPresent, [1, 2]);
  assert.ok(report.coverage.missing.includes("search-member-count-semantics"));
});

test("searched spend does not infer total pages from the ambiguous totalMembers count", () => {
  const page = {
    page: 1,
    text: alterJson(spendPages[0].text, (value) => { value.totalMembers = 15; value.totalPages = 1; }),
  };
  const report = reportSpend([page], team, { pageSize: 2, searchTerm: "synthetic" });
  assert.equal(report.coverage.completeness, "unknown");
  assert.equal(report.coverage.expectedRows, null);
  assert.equal(report.coverage.returnedRows, 2);
  assert.equal(report.coverage.expectedPages, 1);
  assert.ok(report.coverage.missing.includes("search-member-count-semantics"));
});

test("spend accepts a validated owner end without inventing a billing cycle end", () => {
  const report = reportSpend(spendPages, {
    ...team,
    billingWindow: { start: window.start, end: "2026-10-31T23:59:59.999Z", basis: "owner-supplied" },
  });
  assert.equal(report.billingWindow.start, window.start);
  assert.equal(report.billingWindow.end, "2026-10-31T23:59:59.999Z");
  assert.throws(() => reportSpend(spendPages, {
    ...team,
    billingWindow: { start: "2026-09-01T00:00:00.000Z", end: null, basis: "owner-supplied" },
  }));
});

test("spend rejects inconsistent pages, cycle starts, metadata and numeric strings", () => {
  for (const mutate of [
    (page) => { page.totalMembers = 4; },
    (page) => { page.totalPages = 3; },
    (page) => { page.subscriptionCycleStart += 1; },
    (page) => { page.teamMemberSpend[0].spendCents = "0"; },
  ]) assert.throws(() => reportSpend([spendPages[0], { page: 2, text: alterJson(spendPages[1].text, mutate) }]));
  assert.throws(() => reportSpend([spendPages[0], spendPages[0]]));
  assert.throws(() => reportSpend(spendPages, team, { pageSize: 0 }));
});

test("observed CSV v1 preserves ambiguous input labels, Cost to you and absent token cells", () => {
  const report = reportCsv();
  assert.equal(report.schema, "cursor-dashboard-csv-observed-2026-10-06");
  assert.equal(report.csvVersion, 1);
  assert.deepEqual(report.source, personal.source);
  assert.equal(report.events[0].model, "synthetic,model");
  assert.deepEqual(report.events[0].tokens, {
    input: null,
    cacheWrite: null,
    cacheRead: "89",
    output: "67",
    total: "200",
    inputWithCacheWrite: "41",
    inputWithoutCacheWrite: "3",
  });
  assert.equal(report.events[0].reportedCostUsd, "0.01234567890123456789");
  assert.equal(report.events[0].costToYouUsd, null);
  assert.equal(report.events[0].costToYouLabel, "Included");
  assert.equal(report.events[0].cashPaid, null);
  assert.equal(report.events[1].tokens.total, null);
  assert.equal(report.events[1].tokens.inputWithCacheWrite, null);
  assert.equal(report.events[1].reportedCostUsd, null);
  assert.equal(report.events[1].costLabel, "-");
  assert.equal(report.events[1].costToYouUsd, "0.000000000000000001");
  assert.equal(report.events[2].tokens.output, "0");
  assert.equal(report.events[2].costLabel, "Free");
});

test("observed CSV v2 preserves escaped quotes, duplicate events and numeric Included costs", () => {
  const report = reportCsv(csv[1]);
  assert.equal(report.csvVersion, 2);
  assert.equal(report.events.length, 3);
  assert.equal(report.events[0].model, 'synthetic "quoted", model');
  assert.equal(report.events[0].kind, "Included");
  assert.equal(report.events[0].maxMode, true);
  assert.equal(report.events[0].reportedCostUsd, "0.5");
  assert.equal(report.events[0].cashPaid, null);
  assert.deepEqual(withoutPosition(report.events[0]), withoutPosition(report.events[1]));
  assert.equal(report.events[2].maxMode, null);
  assert.equal(report.events[2].tokens.input, null);
  assert.equal(report.events[2].costLabel, "Included");
});

test("observed CSV v3 accepts BOM and CRLF, with cloud and automation attribution", () => {
  const report = reportCsv(`\uFEFF${csv[2].replaceAll("\n", "\r\n")}`);
  assert.equal(report.csvVersion, 3);
  assert.equal(report.events[0].cloudAgentId, "synthetic-cloud-run");
  assert.equal(report.events[0].automationId, "synthetic-automation");
  assert.equal(report.events[0].reportedCostUsd, "0.000000000000000001");
  assert.equal(report.events[1].cloudAgentId, null);
  assert.equal(report.events[1].automationId, null);
  assert.equal(report.events[1].maxMode, false);
  assert.equal(report.events[1].cashPaid, null);
});

test("CSV row assertions preserve unknown completeness and explicit owner account scope", () => {
  const unspecified = reportCsv();
  assert.equal(unspecified.coverage.completeness, "unknown");
  assert.equal(unspecified.coverage.basis, "unspecified-export");
  assert.equal(unspecified.coverage.expectedRows, null);
  const asserted = reportCsv(csv[0], personal, { window, expectedRows: 3 });
  assert.equal(asserted.coverage.completeness, "unknown");
  assert.equal(asserted.coverage.basis, "export-assertion");
  assert.equal(asserted.coverage.expectedRows, 3);
  assert.equal(asserted.coverage.returnedRows, 3);
  assert.equal(asserted.coverage.atomicSnapshot, "unproven");
  assert.equal(asserted.source.workspaceAlias, null);
  assert.deepEqual(reportCsv(csv[0], team).source, team.source);
  assert.throws(() => reportCsv(csv[0], personal, { window, expectedRows: 4 }));
});

test("CSV cannot promote caller billing provenance to source-reported", () => {
  const billingWindow = { start: window.start, end: window.end, basis: "owner-supplied" };
  assert.deepEqual(reportCsv(csv[0], { ...personal, billingWindow }).billingWindow, billingWindow);
  assert.throws(() => reportCsv(csv[0], {
    ...personal,
    billingWindow: { ...billingWindow, basis: "source-reported" },
  }));
});

test("CSV costs and integer token counts retain exact values beyond JavaScript precision", () => {
  const report = reportCsv(csv[0].replace("41,3", "9007199254740993,3"));
  assert.equal(report.events[0].tokens.inputWithCacheWrite, "9007199254740993");
  assert.equal(report.events[0].reportedCostUsd, "0.01234567890123456789");
});

test("CSV accepts explicit timestamp offsets and rejects ambiguous or submillisecond dates", () => {
  const offset = reportCsv(csv[0].replace("2026-10-01T00:00:00.000Z", "2026-10-01T02:00:00.000+02:00"));
  assert.equal(offset.events[0].at, window.start);
  for (const date of ["2026-10-01", "2026-10-01T00:00:00", "2026-10-01T00:00:00.0001Z", "2026-02-30T00:00:00.000Z"]) {
    assert.throws(() => reportCsv(csv[0].replace("2026-10-01T00:00:00.000Z", date)));
  }
});

test("CSV rejects unsupported columns and malformed quoting or row widths", () => {
  for (const text of [
    csv[0].replace("Cost to you", "Unverified extra column"),
    csv[0].replace("Cost to you", "Cost"),
    csv[0].replace('"synthetic,model"', '"synthetic,model'),
    csv[0].replace('"synthetic,model"', '"synthetic,model"trailing'),
    csv[0].replace('"synthetic,model"', 'synthetic"model'),
    csv[0].replace("$0.01234567890123456789,Included", "$0.01234567890123456789"),
  ]) assert.throws(() => reportCsv(text));
});

test("CSV rejects malformed tokens, money and Max Mode rather than substituting zero", () => {
  for (const text of [
    csv[0].replace("41,3", "-1,3"),
    csv[0].replace("41,3", "1.5,3"),
    csv[0].replace("41,3", "-,3"),
    csv[0].replace("$0.01234567890123456789", "$banana"),
    csv[1].replace(",Yes,", ",Unknown,"),
  ]) assert.throws(() => reportCsv(text));
});

test("scope, aliases, capture times and windows must be explicit and supported", () => {
  assert.throws(() => reportEvents(eventPages, personal));
  assert.throws(() => reportSpend(spendPages, personal));
  for (const context of [
    { ...personal, source: { ...personal.source, workspaceAlias: "unexpected-workspace" } },
    { ...team, source: { ...team.source, workspaceAlias: null } },
    { ...personal, source: { ...personal.source, scope: "local-device" } },
    { ...personal, source: { ...personal.source, accountAlias: "" } },
    { ...personal, capturedAt: "2026-10-06T12:00:00" },
  ]) assert.throws(() => reportCsv(csv[0], context));
  assert.throws(() => reportEvents(eventPages, team, { hostingType: "UNSUPPORTED" }));
  assert.throws(() => reportCsv(csv[0], personal, { window: { ...window, bounds: "exclusive" } }));
  assert.throws(() => reportCsv(csv[0], personal, { window: { ...window, end: "2026-09-30T00:00:00.000Z" } }));
  assert.throws(() => reportCsv(csv[0], personal, { window, expectedRows: -1 }));
});

test("event rows outside the inclusive report window reject", () => {
  assert.throws(() => reportEvents([alterJson(eventPages[0], (page) => { page.usageEvents[0].timestamp = "1790812799999"; }), eventPages[1]]));
  assert.throws(() => reportCsv(csv[0].replace("2026-10-01T00:00:00.000Z", "2026-09-30T23:59:59.999Z")));
});

test("whole report byte and 31-day window limits are enforced before normalization", () => {
  assert.throws(() => reportEvents(eventPages.map((page) => `${page}${" ".repeat(128_000)}`)));
  assert.throws(() => reportSpend([{ page: 1, text: `${spendPages[0].text}${" ".repeat(256_000)}` }]));
  assert.throws(() => reportCsv(`${csv[0]}${" ".repeat(256_000)}`));
  assert.throws(() => reportEvents([alterJson(eventPages[0], (page) => { page.period.endDate = page.period.startDate + 31 * 86_400_000 + 1; })]));
  assert.throws(() => reportCsv(csv[0], personal, { window: { ...window, end: "2026-11-01T00:00:00.001Z" } }));
  assert.equal(reportCsv(csv[0], personal, { window: { ...window, end: "2026-10-31T23:59:59.999Z" } }).events.length, 3);
});

test("row and page limits cannot be bypassed by splitting a report", () => {
  const makePage = (page, count, pageSize, numPages) => JSON.stringify({
    totalUsageEventsCount: count,
    pagination: { numPages, currentPage: page, pageSize, hasNextPage: page < numPages, hasPreviousPage: page > 1 },
    usageEvents: Array.from({ length: page < numPages ? pageSize : count - (numPages - 1) * pageSize }, () => ({
      timestamp: "1790812800000", model: "synthetic-model", userEmail: "human@synthetic.invalid", kind: "Included in Business",
    })),
    period: { startDate: 1790812800000, endDate: 1790985599999 },
  });
  assert.equal(reportEvents([makePage(1, 1000, 1000, 1)]).events.length, 1000);
  assert.throws(() => reportEvents([makePage(1, 1001, 1000, 2), makePage(2, 1001, 1000, 2)]));
  assert.throws(() => reportEvents(Array.from({ length: 17 }, (_, index) => makePage(index + 1, 17, 1, 17))));
  const [header, line] = csv[2].trimEnd().split("\n");
  assert.throws(() => reportCsv(`${header}\n${Array(1001).fill(line).join("\n")}\n`));
});
