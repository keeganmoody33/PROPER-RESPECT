import { describe, expect, it } from "vitest";
import { costSchema } from "./cost";

const valid = { amount: 12.34, currency: "USD", cadence: "MONTHLY", basis: "ESTIMATE", asOf: "2026-09-01" };
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
