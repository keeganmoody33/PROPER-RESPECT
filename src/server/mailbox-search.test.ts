import { expect, test } from "vitest";
import { mailboxSearchWindow } from "./mailbox-search";

test("catalog search uses verified domains and fixed epoch boundaries", () => {
  const search = mailboxSearchWindow("KNOWN_PRODUCTS", 1_800_000_000_000);
  expect(search.query).toContain("from:wisprflow.ai");
  expect(search.query).toContain("from:github.com");
  expect(search.query).toMatch(/before:1800000000$/);
  expect(search.queryKey).toContain(search.query);
});
test("incremental overlap starts from the last completed boundary, never an unfinished page", () => {
  const window = mailboxSearchWindow("INCREMENTAL", 1_800_000_000_000, 1_799_000_000);
  expect(window.after).toBe(1_799_000_000 - 172800);
  expect(window.before).toBe(1_800_000_000);
  expect(() => mailboxSearchWindow("INCREMENTAL", 1_800_000_000_000, 1_900_000_000)).toThrow();
});
