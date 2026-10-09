import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { replaceCursorReport } from "./checkpoint.ts";
import { normalizeCursorAdminEvents, normalizeCursorAdminSpend, normalizeCursorCsv } from "./normalizer.ts";

const fixture = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const pages = [fixture("admin-events-page-1.synthetic.json"), fixture("admin-events-page-2.synthetic.json")];
const context = {
  source: { ownerAlias: "fixture-owner", accountAlias: "work-cursor", workspaceAlias: "fixture-team", sourceAlias: "fixture-admin",
    scope: "team-workspace", sample: "synthetic" },
  capturedAt: "2026-10-04T00:00:00.000Z", billingWindow: null,
};
const normalized = (texts = pages, changes = {}) => normalizeCursorAdminEvents(texts, { ...context, ...changes });
const originalCharge = "0.123456789012345678901", updatedCharge = "0.223456789012345678901";
const changed = pages.map(text => text.replace(`"chargedCents": ${originalCharge}`, `"chargedCents": ${updatedCharge}`));

test("complete reports replace atomically; replays retain the entire report and identical events", () => {
  const initial = replaceCursorReport(null, normalized());
  assert.equal(initial.status, "replaced");
  assert.equal(initial.checkpoint.report.events.length, 4);
  const replay = replaceCursorReport(initial.checkpoint, normalized(pages, { capturedAt: "2026-10-05T00:00:00.000Z" }));
  assert.equal(replay.status, "replay");
  assert.equal(replay.checkpoint.report, initial.checkpoint.report);
  assert.equal(replay.checkpoint.observedAt, "2026-10-05T00:00:00.000Z");
  const next = replaceCursorReport(initial.checkpoint, normalized(changed, { capturedAt: "2026-10-05T00:00:00.000Z" }));
  assert.equal(next.status, "replaced");
  assert.equal(next.checkpoint.report.events.length, 4);
  assert.equal(initial.checkpoint.report.events[0].reportedChargeCents, originalCharge);
  assert.equal(next.checkpoint.report.events[0].reportedChargeCents, updatedCharge);
  assert.ok(Object.isFrozen(next.checkpoint.report.events[0].tokens));
});

test("partial reports cannot erase a last good complete window or create a checkpoint", () => {
  const retained = replaceCursorReport(null, normalized()).checkpoint;
  const partial = normalized([pages[0]], { capturedAt: "2026-10-05T00:00:00.000Z" });
  const outcome = replaceCursorReport(retained, partial);
  assert.equal(outcome.reason, "incomplete-report");
  assert.equal(outcome.checkpoint, retained);
  assert.equal(replaceCursorReport(null, partial).checkpoint, null);
});

test("account, workspace, owner, source, filter and window mismatches cannot merge", () => {
  const retained = replaceCursorReport(null, normalized()).checkpoint;
  for (const key of ["ownerAlias", "accountAlias", "workspaceAlias", "sourceAlias"]) {
    const incoming = normalized(pages, { source: { ...context.source, [key]: "other-scope" } });
    assert.equal(replaceCursorReport(retained, incoming).reason, "different-source");
  }
  const filtered = normalizeCursorAdminEvents(pages, context, { userId: "12345" });
  assert.equal(replaceCursorReport(retained, filtered).reason, "different-report");
  // Changing a valid report window changes the slot, without reinterpreting events.
  const extended = normalized(pages.map(value => value.replaceAll("1790985599999", "1791071999999")));
  assert.notEqual(extended.contentDigest, retained.report.contentDigest);
  assert.equal(replaceCursorReport(retained, extended).reason, "different-report");
});

test("older or conflicting captures cannot overwrite a changed report", () => {
  const retained = replaceCursorReport(null, normalized()).checkpoint;
  assert.equal(replaceCursorReport(retained, normalized(changed, { capturedAt: "2026-10-03T00:00:00.000Z" })).reason, "stale-report");
  assert.equal(replaceCursorReport(retained, normalized(changed)).reason, "conflicting-capture");
});

test("a newer identical replay prevents an intermediate older changed capture from replacing it", () => {
  const initial = replaceCursorReport(null, normalized()).checkpoint;
  const replay = replaceCursorReport(initial, normalized(pages, { capturedAt: "2026-10-06T00:00:00.000Z" }));
  assert.equal(replay.status, "replay");
  const stale = replaceCursorReport(replay.checkpoint, normalized(changed, { capturedAt: "2026-10-05T00:00:00.000Z" }));
  assert.equal(stale.status, "blocked");
  assert.equal(stale.reason, "stale-report");
});

test("mutation after normalization rejects; retained checkpoint has its own frozen copy", () => {
  const source = normalized(), retained = replaceCursorReport(null, source).checkpoint;
  source.events[0].reportedChargeCents = "999";
  assert.equal(replaceCursorReport(retained, source).reason, "invalid-report");
  assert.equal(retained.report.events[0].reportedChargeCents, originalCharge);
});

test("CSV count assertions remain unknown and cannot authorize complete-window replacement", () => {
  const csv = normalizeCursorCsv(fixture("dashboard-v2.synthetic.csv"),
    { ...context, source: { ...context.source, scope: "personal-account", workspaceAlias: null } },
    { window: normalized().window, expectedRows: 3 });
  assert.equal(csv.coverage.completeness, "unknown");
  assert.equal(replaceCursorReport(null, csv).reason, "incomplete-report");
});

test("spend snapshots occupy their own report slot and cannot replace event reports", () => {
  const retained = replaceCursorReport(null, normalized()).checkpoint;
  const spend = normalizeCursorAdminSpend([1, 2].map(page => ({ page, text: fixture(`admin-spend-page-${page}.synthetic.json`) })), context, { pageSize: 2 });
  assert.equal(replaceCursorReport(null, spend).status, "replaced");
  assert.equal(replaceCursorReport(retained, spend).reason, "different-report");
});
