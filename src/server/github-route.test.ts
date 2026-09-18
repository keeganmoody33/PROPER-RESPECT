import { afterEach, beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), clerkClient: vi.fn(), action: vi.fn(), setAuth: vi.fn(), oauth: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth, clerkClient: mocks.clerkClient }));
vi.mock("convex/browser", () => ({ ConvexHttpClient: class { action = mocks.action; setAuth = mocks.setAuth; } }));
import { POST } from "../../app/api/connect/github/route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://test.convex.cloud");
  mocks.auth.mockResolvedValue({ userId: "owner", getToken: async () => "owner-jwt" });
  mocks.clerkClient.mockResolvedValue({ users: { getUserOauthAccessToken: mocks.oauth } });
  mocks.oauth.mockResolvedValue({ data: [{ token: "test-only-github-token" }] });
  mocks.action.mockResolvedValue({ imported: 1 });
});
afterEach(() => vi.unstubAllEnvs());
const request = (headers: Record<string, string>) => new Request("https://props.example.test/api/connect/github", { method: "POST", headers });

test.each([
  {},
  { origin: "https://attacker.test" },
  { origin: "null" },
  { origin: "https://props.example.test", "sec-fetch-site": "cross-site" },
  { origin: "https://props.example.test", "sec-fetch-site": "same-site" },
])("rejects cross-origin import before accessing credentials: %j", async headers => {
  expect((await POST(request(headers as Record<string, string>))).status).toBe(403);
  expect(mocks.auth).not.toHaveBeenCalled();
  expect(mocks.clerkClient).not.toHaveBeenCalled();
  expect(mocks.action).not.toHaveBeenCalled();
});
test.each([{}, { "sec-fetch-site": "same-origin" }])("same-origin owner import uses the owner's credentials: %j", async extra => {
  const response = await POST(request({ origin: "https://props.example.test", ...extra } as Record<string, string>));
  expect(response.status).toBe(200);
  expect(mocks.oauth).toHaveBeenCalledWith("owner", "oauth_github");
  expect(mocks.setAuth).toHaveBeenCalledWith("owner-jwt");
  expect(mocks.action.mock.calls[0][1]).toEqual({ token: "test-only-github-token" });
});
test("same-origin does not bypass owner authentication", async () => {
  mocks.auth.mockResolvedValueOnce({ userId: null });
  expect((await POST(request({ origin: "https://props.example.test" }))).status).toBe(401);
  expect(mocks.clerkClient).not.toHaveBeenCalled();
  expect(mocks.action).not.toHaveBeenCalled();
});
