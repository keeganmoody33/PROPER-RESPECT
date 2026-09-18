import { expect, test } from "vitest";
import { evidenceObservationSchema, canUseAsStart } from "./evidence-claims";
import { parsePrivateEvidence, privateEvidenceIdentity } from "./private-evidence";
const usage = { kind: "USAGE", metric: "Words dictated", value: 12345, unit: "words", excerpt: "Words dictated: 12,345", scope: "UNKNOWN", acquisition: "USER_SUPPLIED" } as const;
test("unknown usage windows stay unknown and never become use start", () => {
  const parsed = evidenceObservationSchema.parse(usage);
  expect(parsed).toEqual(usage);
  expect(canUseAsStart(parsed, "CORRECT")).toBe(false);
});
test("private intake validates numbers, dates, scope, fields and original excerpts", () => {
  const input = { payload: usage.excerpt, observations: [usage] };
  expect(parsePrivateEvidence(input)).toEqual(input);
  for (const changes of [{ value: -1 }, { value: Infinity }, { date: "2026-02-30" }, { periodStart: "2026-09-16", periodEnd: "2026-09-15" }, { unexpected: 1 }, { acquisition: "SOURCE_REPORTED" }, { excerpt: "invented" }]) {
    expect(() => parsePrivateEvidence({ ...input, observations: [{ ...usage, ...changes }] })).toThrow();
  }
  for (const sourceUrl of ["http://example.com", "https://user:secret@example.com", "javascript:alert(1)"]) expect(() => parsePrivateEvidence({ ...input, sourceUrl })).toThrow();
});
test("content identity is stable and includes structured observations", () => {
  const input = parsePrivateEvidence({ payload: usage.excerpt, observations: [usage] });
  expect(privateEvidenceIdentity(input)).toBe(privateEvidenceIdentity(input));
  expect(privateEvidenceIdentity(input)).not.toBe(privateEvidenceIdentity({ ...input, observations: [{ ...usage, scope: "PERSONAL" }] }));
});
test("subscription and payment facts retain explicit cadence and unknown currency separately from usage", () => {
  const common = { excerpt: "Plan Pro, paid 15, billed monthly", scope: "PERSONAL", acquisition: "USER_SUPPLIED" } as const;
  const subscription = evidenceObservationSchema.parse({ ...common, kind: "SUBSCRIPTION", plan: "Pro", billingCadence: "MONTHLY" });
  const payment = evidenceObservationSchema.parse({ ...common, kind: "PAYMENT", amount: 15, billingCadence: "MONTHLY" });
  expect(subscription.date).toBeUndefined();
  expect(payment).not.toHaveProperty("currency");
  expect(payment).not.toHaveProperty("periodStart");
  expect(canUseAsStart(subscription, "CORRECT")).toBe(false);
  expect(canUseAsStart(payment, "CORRECT")).toBe(false);
  expect(evidenceObservationSchema.safeParse({ ...common, kind: "PAYMENT", amount: -15 }).success).toBe(false);
  expect(evidenceObservationSchema.safeParse({ ...common, kind: "PAYMENT", amount: 15, currency: "$" }).success).toBe(false);
  expect(evidenceObservationSchema.safeParse({ ...common, kind: "SUBSCRIPTION", plan: "Pro", value: 100 }).success).toBe(false);
});
test("bounded intake measures UTF-8 bytes and bounds observations", () => {
  expect(() => parsePrivateEvidence({ payload: "é".repeat(32_001) + usage.excerpt, observations: [usage] })).toThrow();
  expect(() => parsePrivateEvidence({ payload: usage.excerpt, observations: Array(25).fill(usage) })).toThrow();
  expect(() => parsePrivateEvidence({ payload: usage.excerpt, observations: [] })).toThrow();
});
