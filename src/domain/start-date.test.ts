import { describe, expect, it } from "vitest";
import { isStartDate, isYearOnly, startDateSchema } from "./start-date";
import { relationshipEditSchema } from "./inventory";

describe("a start date", () => {
  it("is a real calendar date or just a year", () => {
    expect(["2023", "2026-11-17", "2024-02-29"].map(isStartDate)).toEqual([true, true, true]);
    expect(["0000", "23", "20234", "2023-02-30", "2023-2-3", "2023-11", "since 2023", ""].map(isStartDate))
      .toEqual([false, false, false, false, false, false, false, false]);
  });

  it("names only its year when that is all it has", () => {
    expect(isYearOnly("2023")).toBe(true);
    expect(isYearOnly("2023-01-01")).toBe(false);
  });

  it("saves a year as just the year, never with a month or day added", () => {
    const edit = { status: "ACTIVE", level: "WEEKLY", goTo: false, headline: "", note: "" };
    expect(relationshipEditSchema.parse({ ...edit, startedAt: "2023" }).startedAt).toBe("2023");
    expect(startDateSchema.safeParse("2023-13-01").error?.issues.map(issue => issue.message)).toEqual(["Use a real calendar date or a year, or leave it unknown."]);
  });
});
