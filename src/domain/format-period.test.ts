import { expect, test } from "vitest";
import { dayMonthYear, formatPeriod, freshnessNote, monthYear, yearOf } from "./format-period";

test("a period reads as months a visitor knows, in UTC whatever the reader's time zone", () => {
  expect(formatPeriod("2026-08-01", "2026-08-31")).toBe("Aug 2026");
  expect(formatPeriod("2026-06-08", "2026-08-30")).toBe("Jun–Aug 2026");
  expect(formatPeriod("2023-03-01", "2026-08-31")).toBe("Mar 2023 – Aug 2026");
  expect(formatPeriod("2025-12-01", "2026-01-31")).toBe("Dec 2025 – Jan 2026");
  expect(monthYear("2026-09-01T00:00:00.000Z")).toBe("Sep 2026");
});

test("a date that doesn't parse is shown as written rather than as a wrong month", () => {
  expect(formatPeriod("2026-02-30", "2026-03-01")).toBe("2026-02-30 to 2026-03-01");
  expect(formatPeriod("someday", "2026-03-01")).toBe("someday to 2026-03-01");
});

test("freshness says when the numbers were last updated instead of a status word, and says so when a refresh failed", () => {
  expect(freshnessNote("FRESH", "2026-09-18T09:00:00.000Z")).toBeUndefined();
  expect(freshnessNote("STALE", "2026-09-18T09:00:00.000Z")).toBe("last updated 18 Sep 2026");
  expect(freshnessNote("ERROR", "2026-09-18T09:00:00.000Z")).toBe("last updated 18 Sep 2026 · refresh failed");
});

test("a day reads as a visitor writes it, in UTC: the exact day, so its age is plain", () => {
  expect(dayMonthYear("2026-09-01T00:00:00.000Z")).toBe("1 Sep 2026");
  expect(dayMonthYear("2026-08-31T23:59:59.000Z")).toBe("31 Aug 2026");
  expect(dayMonthYear("2023-01-01")).toBe("1 Jan 2023");
  expect(dayMonthYear("2026-02-30")).toBe("2026-02-30");
  expect([yearOf("2023-01-01"), yearOf("nonsense")]).toEqual(["2023", "nonsense"]);
});

test("a period under 28 days reads as its days, not as a whole month", () => {
  expect(formatPeriod("2026-08-30", "2026-08-31")).toBe("30–31 Aug 2026");
  expect(formatPeriod("2026-08-31", "2026-08-31")).toBe("31 Aug 2026");
  expect(formatPeriod("2026-07-30", "2026-08-02")).toBe("30 Jul – 2 Aug 2026");
  expect(formatPeriod("2025-12-29", "2026-01-04")).toBe("29 Dec 2025 – 4 Jan 2026");
  expect(formatPeriod("2026-02-01", "2026-02-28")).toBe("Feb 2026");
  expect(formatPeriod("2026-08-02", "2026-08-28")).toBe("2–28 Aug 2026");
  expect(formatPeriod("2026-08-02", "2026-08-29")).toBe("Aug 2026");
});
