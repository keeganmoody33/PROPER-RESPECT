import { describe, expect, it } from "vitest";
import { MAILBOX_REVOCATION_REQUEST_BUDGET_MS, revocationWindowOpen } from "./mailbox-revocation";

describe("revocationWindowOpen (R17)", () => {
  const until = 1_000_000;
  it("allows the provider call only while it can finish before reconnects are allowed again", () => {
    expect(revocationWindowOpen(until, until - MAILBOX_REVOCATION_REQUEST_BUDGET_MS)).toBe(true);
    expect(revocationWindowOpen(until, until - MAILBOX_REVOCATION_REQUEST_BUDGET_MS + 1)).toBe(false);
    expect(revocationWindowOpen(until, until + 1)).toBe(false);
  });
  it("leaves room for the whole request timeout plus a margin", () => {
    expect(MAILBOX_REVOCATION_REQUEST_BUDGET_MS).toBeGreaterThan(10_000);
  });
});
