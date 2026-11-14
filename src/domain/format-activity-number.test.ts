import { expect, test } from "vitest";
import { fullNumber, groupedDecimal } from "./format-activity-number";

test("a published exact decimal reads with thousands separators and keeps every digit", () => {
  expect(groupedDecimal("2140000")).toBe("2,140,000");
  expect(groupedDecimal("48500")).toBe("48,500");
  expect(groupedDecimal("86")).toBe("86");
  expect(groupedDecimal("0")).toBe("0");
  expect(groupedDecimal("900719925474099312345678901234")).toBe("900,719,925,474,099,312,345,678,901,234");
  expect(groupedDecimal("1234.00000000000000000000000000000000000000001")).toBe("1,234.00000000000000000000000000000000000000001");
  expect(groupedDecimal("0.0000000000000000000000000000000000000000001")).toBe("0.0000000000000000000000000000000000000000001");
});

const CLOUDFLARE_LAST_WEEK = 48_360;
const N8N_RUNS = 2_140;
const WITH_FRACTION = 1_234.5;
const PORKBUN_DOMAINS = 11;

test("an activity number shown in full reads with thousands separators", () => {
  expect(fullNumber(CLOUDFLARE_LAST_WEEK)).toBe("48,360");
  expect(fullNumber(N8N_RUNS)).toBe("2,140");
  expect(fullNumber(WITH_FRACTION)).toBe("1,234.5");
  expect(fullNumber(PORKBUN_DOMAINS)).toBe("11");
});
