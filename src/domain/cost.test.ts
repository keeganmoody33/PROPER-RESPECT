import { describe, expect, it } from "vitest";
import { costDetail, costSchema, costSummary, type Cost } from "./cost";

const valid = { amount: 12.34, currency: "USD", cadence: "MONTHLY", basis: "ESTIMATE", asOf: "2026-09-01" };
describe("how a cost reads on a card", () => {
  const monthly: Cost = { amount: 5, currency: "USD", cadence: "MONTHLY", basis: "OWNER_REPORTED", asOf: "2026-09-01" };
  it("reads in a few words on the front: whole amounts without cents, the cadence, and who says so", () => {
    expect(costSummary(monthly)).toBe("Costs $5/month · owner-reported");
    expect(costSummary({ ...monthly, amount: 12.34, basis: "ESTIMATE", cadence: "ANNUAL" })).toBe("Costs $12.34/year · estimated");
    expect(costSummary({ ...monthly, amount: 0, basis: "RECEIPT", cadence: "ONE_TIME" })).toBe("Costs $0 one-time · from a receipt");
    expect(costSummary({ ...monthly, currency: "EUR", cadence: "UNKNOWN" })).toBe("Costs €5 (billing interval unknown) · owner-reported");
  });
  it("says on the front how old a price is once it is more than six months before today", () => {
    const old = { ...monthly, asOf: "2025-12-15" };
    expect(costSummary(old, { today: "2026-09-01" })).toBe("Costs $5/month · owner-reported · as of Dec 2025");
    expect(costSummary({ ...monthly, asOf: "2026-03-02" }, { today: "2026-09-01" })).toBe("Costs $5/month · owner-reported");
    expect(costSummary(old, { today: "2026-06-01" })).toBe("Costs $5/month · owner-reported");
  });
  it("never shows a price dated after today as current: the front leaves it out and the back says its date is in the future", () => {
    const future = { ...monthly, asOf: "2027-01-01" };
    expect(costSummary(future, { today: "2026-11-14" })).toBeUndefined();
    expect(costDetail(future, { today: "2026-11-14" })).toBe("Owner-reported cost: $5/month · dated 1 Jan 2027, after today");
    expect(costSummary(monthly, { today: "2026-09-01" })).toBe("Costs $5/month · owner-reported");
  });
  it("calls an invented example's price a sample, front and back, since no owner reported it, and never ages it", () => {
    expect(costSummary({ ...monthly, asOf: "2020-01-01" }, { today: "2026-09-01", sample: true })).toBe("Costs $5/month · sample");
    expect(costDetail(monthly, { sample: true })).toBe("Sample cost: $5/month · as of 1 Sep 2026");
  });
  it("keeps the full record on the back, in plain words: basis, amount with cents only when it has them, the day it was true and any period", () => {
    expect(costDetail(monthly)).toBe("Owner-reported cost: $5/month · as of 1 Sep 2026");
    expect(costDetail({ ...monthly, amount: 149.5 })).toBe("Owner-reported cost: $149.50/month · as of 1 Sep 2026");
    expect(costDetail({ ...monthly, basis: "RECEIPT", period: { start: "2026-08-01", end: "2026-08-31" } }))
      .toBe("Receipt cost: $5/month · as of 1 Sep 2026 · 1 Aug 2026 to 31 Aug 2026");
  });
});

describe("dated cost observations", () => {
  it("retains zero as a real cost and distinguishes estimates from receipts", () => {
    expect(costSchema.parse({ ...valid, amount: 0 }).amount).toBe(0);
    expect(costSchema.parse(valid).basis).toBe("ESTIMATE");
  });
  it("rejects invalid costs rather than publishing misleading values", () => {
    for (const change of [{ amount: -1 }, { amount: Number.NaN }, { asOf: "" }, { asOf: "2026-02-30" }, { currency: "$" }, { period: { start: "2026-09-02", end: "2026-09-01" } }]) {
      expect(costSchema.safeParse({ ...valid, ...change }).success).toBe(false);
    }
  });
});
