import { afterEach, expect, it, vi } from "vitest";
import * as signInPage from "@/app/sign-in/[[...sign-in]]/page";
import * as signUpPage from "@/app/sign-up/[[...sign-up]]/page";

afterEach(() => vi.unstubAllEnvs());

it.each([
  ["sign-in", signInPage],
  ["sign-up", signUpPage],
])("excludes the %s catch-all route from indexing outside preview", (_, route) => {
  vi.stubEnv("VERCEL_ENV", "production");
  expect(Reflect.get(route, "metadata")).toMatchObject({
    robots: { index: false, follow: false },
  });
});
