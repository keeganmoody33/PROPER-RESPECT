import { expect, it } from "vitest";
import * as signInPage from "@/app/sign-in/[[...sign-in]]/page";
import * as signUpPage from "@/app/sign-up/[[...sign-up]]/page";

it.each([
  ["sign-in", signInPage],
  ["sign-up", signUpPage],
])("exports noindex/nofollow metadata for the %s catch-all route", (_, route) => {
  expect(Reflect.get(route, "metadata")).toMatchObject({
    robots: { index: false, follow: false },
  });
});
