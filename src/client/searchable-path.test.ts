import { expect, it } from "vitest";
import { searchablePublicPath } from "./searchable-path";

it.each(["/", "/keegan", "/a-handle", "/about", "/collection", "/about/privacy", "/about/contact", `/${"a".repeat(39)}`])("accepts public page %s", pathname => {
  expect(searchablePublicPath(pathname)).toBe(pathname);
});

it.each([null, "/app", "/app/collection/private", "/sign-in", "/sign-up/step", "/onboarding", "/api", "/api/analytics/searchable", "/admin", "/evidence-fixture", "/icon", "/apple-icon", "/agents", "/auth", "/index", "/_next", "/about/missing", "/keegan?note=secret", "/keegan#secret", "/%61pp", "//attacker.test", "https://attacker.test/", "/keegan-", `/${"a".repeat(40)}`])("refuses excluded or unsafe path %s", pathname => {
  expect(searchablePublicPath(pathname)).toBeNull();
});
