import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { decimal, instant } from "./decode.ts";
import { normalizeCursorAdminEvents } from "./normalizer.ts";

const page = readFileSync(new URL("./fixtures/admin-events-page-1.synthetic.json", import.meta.url), "utf8");
const context = {
  source: { ownerAlias: "owner", accountAlias: "work", workspaceAlias: "team", sourceAlias: "admin", scope: "team-workspace", sample: "synthetic" },
  capturedAt: "2026-10-06T00:00:00.000Z", billingWindow: null,
};

test("discount bounds compare exact decimals and never round a value above 100", () => {
  assert.throws(() => normalizeCursorAdminEvents([page.replace('"discountPercentOff": 12.5', '"discountPercentOff": 100.000000000000000001')], context));
  const valid = normalizeCursorAdminEvents([page.replace('"discountPercentOff": 12.5', '"discountPercentOff": 99.999999999999999999')], context);
  assert.equal(valid.events[0].discountPercentOff, "99.999999999999999999");
});

test("decimal expansion has explicit magnitude and precision bounds", () => {
  assert.equal(decimal("1.234e-18"), "0.000000000000000001234");
  assert.equal(decimal("100.0000"), "100");
  assert.equal(decimal("9007199254740993e1"), "90071992547409930");
  for (const value of ["1e129", "1e-129", "-0", "01", "1e999999", "NaN", "Infinity"]) assert.throws(() => decimal(value));
});

test("millisecond instants reject rollover dates, leap seconds and finer precision", () => {
  for (const value of ["2026-02-30T00:00:00Z", "2026-10-01T24:00:00Z", "2026-10-01T00:00:60Z", "2026-10-01T00:00:00.0000Z"])
    assert.throws(() => instant(value));
  assert.equal(instant("2024-02-29T00:00:00Z"), "2024-02-29T00:00:00.000Z");
});

test("offset conversion stays within the supported UTC range and is idempotent", () => {
  for (const value of ["1970-01-01T00:00:00+01:00", "9999-12-31T23:59:59-01:00"]) assert.throws(() => instant(value));
  const utc = instant("2026-10-01T01:00:00+01:00");
  assert.equal(instant(utc), utc);
});
