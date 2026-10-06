import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ConvexError } from "convex/values";
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

test("native Convex session authenticates the GitHub import without a legacy template", async () => {
  const getToken = vi.fn(async (options?: { template?: string }) => options?.template ? null : "native-convex-jwt");
  mocks.auth.mockResolvedValueOnce({ userId: "owner", sessionClaims: { aud: "convex" }, getToken });
  const response = await POST(request({ origin: "https://props.example.test" }));
  expect(response.status).toBe(200);
  expect(getToken).toHaveBeenCalledWith();
  expect(mocks.setAuth).toHaveBeenCalledWith("native-convex-jwt");
  expect(mocks.oauth).toHaveBeenCalledWith("owner", "oauth_github");
  expect(mocks.action.mock.calls[0][1]).toEqual({ token: "test-only-github-token" });
});

test("native session import works when requesting a nonexistent legacy template would throw", async () => {
  const getToken = vi.fn(async (options?: { template?: string }) => {
    if (options?.template) throw new Error("JWT template does not exist");
    return "native-convex-jwt";
  });
  mocks.auth.mockResolvedValueOnce({ userId: "owner", sessionClaims: { aud: "convex" }, getToken });
  expect((await POST(request({ origin: "https://props.example.test" }))).status).toBe(200);
  expect(getToken).toHaveBeenCalledExactlyOnceWith();
  expect(mocks.setAuth).toHaveBeenCalledWith("native-convex-jwt");
  expect(mocks.action).toHaveBeenCalledOnce();
});

test.each([undefined, {}, { aud: "another-service" }, { aud: ["convex"] }])(
  "requires the legacy Convex template without the native integration audience: %j", async sessionClaims => {
    const getToken = vi.fn(async (options?: { template?: string }) => options?.template === "convex" ? "template-convex-jwt" : "wrong-audience-jwt");
    mocks.auth.mockResolvedValueOnce({ userId: "owner", sessionClaims, getToken });
    const response = await POST(request({ origin: "https://props.example.test" }));
    expect(response.status).toBe(200);
    expect(getToken).toHaveBeenCalledWith({ template: "convex" });
    expect(mocks.setAuth).toHaveBeenCalledWith("template-convex-jwt");
    expect(mocks.setAuth).not.toHaveBeenCalledWith("wrong-audience-jwt");
  },
);

test.each([{ aud: "convex" }, { aud: "another-service" }])(
  "missing Convex token never imports GitHub activity: %j", async sessionClaims => {
    const getToken = vi.fn(async () => null);
    mocks.auth.mockResolvedValueOnce({ userId: "owner", sessionClaims, getToken });
    expect((await POST(request({ origin: "https://props.example.test" }))).status).toBe(409);
    expect(mocks.setAuth).not.toHaveBeenCalled();
    expect(mocks.action).not.toHaveBeenCalled();
  },
);

test("an authenticated Convex owner still needs a GitHub credential", async () => {
  mocks.oauth.mockResolvedValueOnce({ data: [] });
  expect((await POST(request({ origin: "https://props.example.test" }))).status).toBe(409);
  expect(mocks.setAuth).not.toHaveBeenCalled();
  expect(mocks.action).not.toHaveBeenCalled();
});

test("missing Convex configuration stops before accessing GitHub credentials", async () => {
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "");
  expect((await POST(request({ origin: "https://props.example.test" }))).status).toBe(503);
  expect(mocks.clerkClient).not.toHaveBeenCalled();
  expect(mocks.action).not.toHaveBeenCalled();
});

test.each([1, 27, 60])("returns the GitHub rate-limit retry message as JSON with HTTP 429 (%i minutes)", async minutes => {
  const message = `Too many GitHub connection attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
  mocks.action.mockRejectedValueOnce(new ConvexError(message));
  const response = await POST(request({ origin: "https://props.example.test" }));
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe(String(minutes * 60));
  expect(await response.json()).toEqual({ error: message });
});

test.each([
  new Error("Provider failed with secret-token"),
  new ConvexError("Private backend diagnostic: secret-token"),
  new ConvexError({ secret: "secret-token" }),
])("returns a generic JSON error for other backend failures", async error => {
  mocks.action.mockRejectedValueOnce(error);
  const response = await POST(request({ origin: "https://props.example.test" }));
  expect(response.status).toBe(500);
  expect(response.headers.has("retry-after")).toBe(false);
  expect(await response.json()).toEqual({ error: "GitHub connection failed. Please try again." });
});
