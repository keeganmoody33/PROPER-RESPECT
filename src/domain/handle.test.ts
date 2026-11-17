import { readdirSync } from "node:fs";
import { expect, it } from "vitest";
import { claimableHandleSchema } from "./onboarding";
import { RESERVED_HANDLES } from "./handle";

it("refuses every handle a first-level route already answers at", () => {
  // A folder in app/ answers at its own name. Route groups, private folders and dynamic segments don't.
  const routes = readdirSync("app", { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^[a-z0-9-]+$/.test(entry.name))
    .map(entry => entry.name);
  expect(routes).toEqual(expect.arrayContaining(["app", "about"]));
  expect(routes.filter(route => claimableHandleSchema.safeParse(route).success)).toEqual([]);
});

it.each(["search", "tools", "people", "explore", "app", "about"])("refuses %s, which is held for a page of the site", handle => {
  const result = claimableHandleSchema.safeParse(handle);
  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.message).toBe("This handle is reserved.");
  expect(RESERVED_HANDLES.has(handle)).toBe(true);
});

it("still lets an ordinary handle through", () => {
  expect(claimableHandleSchema.parse(" Ada-L ")).toBe("ada-l");
});
