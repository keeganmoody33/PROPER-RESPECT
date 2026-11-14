import { expect, test } from "vitest";
import { formatPeriod, freshnessNote, monthYear } from "./format-period";

test("a period reads as months a visitor knows, in UTC whatever the reader's time zone", () => {
  expect(formatPeriod("2026-08-01", "2026-08-31")).toBe("Aug 2026");
  expect(formatPeriod("2026-06-08", "2026-08-30")).toBe("Jun–Aug 2026");
  expect(formatPeriod("2023-03-01", "2026-08-31")).toBe("Mar 2023 – Aug 2026");
  expect(formatPeriod("2025-12-29", "2026-01-04")).toBe("Dec 2025 – Jan 2026");
  expect(monthYear("2026-09-01T00:00:00.000Z")).toBe("Sep 2026");
});

test("a date that doesn't parse is shown as written rather than as a wrong month", () => {
  expect(formatPeriod("2026-02-30", "2026-03-01")).toBe("2026-02-30 to 2026-03-01");
  expect(formatPeriod("someday", "2026-03-01")).toBe("someday to 2026-03-01");
});

test("freshness says when the numbers were last updated instead of a status word, and says so when a refresh failed", () => {
  expect(freshnessNote("FRESH", "2026-09-18T09:00:00.000Z")).toBeUndefined();
  expect(freshnessNote("STALE", "2026-09-18T09:00:00.000Z")).toBe("last updated Sep 2026");
  expect(freshnessNote("ERROR", "2026-09-18T09:00:00.000Z")).toBe("last updated Sep 2026 · refresh failed");
});
