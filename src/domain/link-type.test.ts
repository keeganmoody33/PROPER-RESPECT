import { expect, test } from "vitest";
import { linkDisclosure, linkTypeLabel } from "./link-type";

test("every link type reads as words a visitor understands, never its stored name", () => {
  expect((["CANONICAL", "AFFILIATE", "REFERRAL", "INVITE"] as const).map(linkTypeLabel))
    .toEqual(["Direct link", "Affiliate link", "Referral link", "Invite link"]);
});

test("only an affiliate or referral link carries a disclosure", () => {
  expect((["CANONICAL", "AFFILIATE", "REFERRAL", "INVITE"] as const).map(linkDisclosure))
    .toEqual([undefined, "Affiliate link", "Referral link", undefined]);
});
