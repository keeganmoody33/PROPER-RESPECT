import { NextRequest } from "next/server";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ clerk: vi.fn((handler: (_auth: unknown, request: NextRequest) => unknown) => (request: NextRequest) => handler({}, request)) }));
vi.mock("@clerk/nextjs/server", () => ({ clerkMiddleware: mocks.clerk }));
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); mocks.clerk.mockClear(); });

it.each(["", "synthetic-configured-key"])("keeps the same route decisions with Clerk configured=%s", async key => {
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", key);
  const { default: proxy, config } = await import("../../proxy");
  expect(mocks.clerk).toHaveBeenCalledTimes(key ? 1 : 0);
  expect(config.matcher).toContain("/__clerk/:path*");
  expect(config.matcher).toContain("/(api|trpc)(.*)");
  for (const path of ["/", "/app/collection", "/sign-in", "/__clerk/v1/client", "/api/connect/github"]) {
    const response = await proxy(new NextRequest(`https://request.example${path}`, { headers: { accept: "text/markdown" } }), {} as never);
    expect(response?.headers.get("x-middleware-rewrite")).toBe(path === "/" ? "https://request.example/index.md" : null);
  }
});
