import { NextRequest } from "next/server";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ clerk: vi.fn((handler: (_auth: unknown, request: NextRequest) => unknown) => (request: NextRequest) => handler({}, request)) }));
vi.mock("@clerk/nextjs/server", () => ({ clerkMiddleware: mocks.clerk }));
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); mocks.clerk.mockClear(); });

async function loadProxy(vercelEnv: string, nodeEnv = "production") {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.stubEnv("VERCEL_ENV", vercelEnv);
  vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://public.example");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "synthetic-configured-key");
  return (await import("../../proxy")).default;
}

it("sends production pages on another host to the public origin before Clerk loads", async () => {
  const proxy = await loadProxy("production");
  for (const method of ["GET", "HEAD"]) {
    const response = await proxy(new NextRequest("https://proper-respect.vercel.app/sign-in?redirect_url=%2Fapp", { method }), {} as never);
    expect(response?.status).toBe(308);
    expect(response?.headers.get("location")).toBe("https://public.example/sign-in?redirect_url=%2Fapp");
  }
});

it("keeps API, Clerk proxy and non-GET requests on the host they reached", async () => {
  const proxy = await loadProxy("production");
  for (const [method, path] of [["GET", "/api/connect/github"], ["GET", "/__clerk/v1/client"], ["GET", "/trpc/x"], ["POST", "/"]]) {
    const response = await proxy(new NextRequest(`https://proper-respect.vercel.app${path}`, { method }), {} as never);
    expect(response?.headers.get("location")).toBeNull();
  }
});

it("serves the public origin itself without a redirect", async () => {
  const proxy = await loadProxy("production");
  const response = await proxy(new NextRequest("https://public.example/sign-in"), {} as never);
  expect(response?.headers.get("location")).toBeNull();
});

it.each([["preview", "production"], ["", "production"], ["production", "development"]])("leaves VERCEL_ENV=%s NODE_ENV=%s hosts as they are", async (vercelEnv, nodeEnv) => {
  const proxy = await loadProxy(vercelEnv, nodeEnv);
  const response = await proxy(new NextRequest("https://proper-respect-abc123-team.vercel.app/sign-in"), {} as never);
  expect(response?.headers.get("location")).toBeNull();
});
