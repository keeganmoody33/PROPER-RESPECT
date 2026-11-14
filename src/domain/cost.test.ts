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
  it("keeps the full record on the back: basis, exact amount, as-of date and any period", () => {
    expect(costDetail(monthly)).toBe("Owner-reported cost: $5.00/month · as of 2026-09-01");
    expect(costDetail({ ...monthly, basis: "RECEIPT", period: { start: "2026-08-01", end: "2026-08-31" } }))
      .toBe("Receipt cost: $5.00/month · as of 2026-09-01 · 2026-08-01 to 2026-08-31");
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
