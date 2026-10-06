import { describe, expect, it } from "vitest";
import { mailboxTesterAllowed } from "./mailbox-testers";

describe("mailboxTesterAllowed (R16)", () => {
  it("allows a listed email, ignoring case and spacing", () => {
    expect(mailboxTesterAllowed("Tester@Example.com", "owner@example.com, tester@example.com")).toBe(true);
    expect(mailboxTesterAllowed(" owner@example.com ", "OWNER@example.com\ntester@example.com")).toBe(true);
  });

  it("refuses an email that isn't listed", () => {
    expect(mailboxTesterAllowed("stranger@example.com", "owner@example.com,tester@example.com")).toBe(false);
    expect(mailboxTesterAllowed("owner@example.com.evil", "owner@example.com")).toBe(false);
  });

  it("allows nobody when the list is missing or empty", () => {
    expect(mailboxTesterAllowed("owner@example.com", undefined)).toBe(false);
    expect(mailboxTesterAllowed("owner@example.com", "")).toBe(false);
    expect(mailboxTesterAllowed("owner@example.com", " , \n")).toBe(false);
  });

  it("refuses a caller with no email", () => {
    expect(mailboxTesterAllowed(undefined, "owner@example.com")).toBe(false);
    expect(mailboxTesterAllowed("", "owner@example.com")).toBe(false);
  });
});
