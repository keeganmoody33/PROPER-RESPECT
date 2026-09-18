import { afterEach, beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), action: vi.fn(), setAuth: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("convex/browser", () => ({ ConvexHttpClient: class { action = mocks.action; setAuth = mocks.setAuth; } }));
import { mailboxStart, mailboxCallback, mailboxRead } from "./mailbox-route";
beforeEach(() => {
  vi.stubEnv("MAILBOX_APPLICATION_ORIGIN", "https://props.example.test");
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://test.convex.cloud");
  mocks.auth.mockResolvedValue({ userId: "owner", getToken: async () => "signed-user-jwt" });
  mocks.action.mockReset(); mocks.setAuth.mockReset();
});
afterEach(() => { vi.unstubAllEnvs(); });
const request = (body = "", origin = "https://props.example.test") => new Request("https://props.example.test/api/connect/mailboxes/google/start", { method: "POST", headers: { origin, "content-type": "application/x-www-form-urlencoded" }, body });
test("start requires same-origin POST and never reaches the action for a foreign origin", async () => {
  expect((await mailboxStart(request("", "https://attacker.test"))).status).toBe(403);
  expect(mocks.action).not.toHaveBeenCalled();
});
test("start requires authenticated owner and uses their Convex JWT", async () => {
  mocks.auth.mockResolvedValueOnce({ userId: null });
  expect((await mailboxStart(request())).status).toBe(401);
  mocks.action.mockResolvedValueOnce({ url: "https://accounts.google.com/o/oauth2/v2/auth?state=safe" });
  const response = await mailboxStart(request());
  expect(response.status).toBe(303);
  expect(mocks.setAuth).toHaveBeenCalledWith("signed-user-jwt");
  expect(response.headers.get("location")).toContain("accounts.google.com");
  expect(response.headers.get("cache-control")).toBe("no-store");
});
test("callback returns only fixed success/failure redirects without provider details", async () => {
  mocks.action.mockRejectedValueOnce(new Error("secret-provider-text"));
  const response = await mailboxCallback(new Request("https://props.example.test/api/connect/mailboxes/google/callback?state=s&error_description=private"));
  expect(response.headers.get("location")).toBe("https://props.example.test/onboarding?gmail=failed");
  expect(await response.text()).not.toMatch(/secret|private/);
  mocks.action.mockResolvedValueOnce({ accountId: "id", generation: 1 });
  expect((await mailboxCallback(new Request("https://props.example.test/api/connect/mailboxes/google/callback?state=s&code=c"))).headers.get("location")).toBe("https://props.example.test/onboarding?gmail=connected");
});
test("read requires same-origin POST and forwards only account and expected generation", async () => {
  mocks.action.mockResolvedValueOnce({ readCount: 0, proposals: 0, hasMore: false });
  const response = await mailboxRead(request("accountId=account&expectedGeneration=1&ownerId=attacker"));
  expect(response.status).toBe(200);
  expect(mocks.action.mock.calls[0][1]).toEqual({ accountId: "account", expectedGeneration: 1 });
  expect(await response.json()).toEqual({ readCount: 0, proposals: 0, hasMore: false });
});

test("read accepts only a fixed search mode and never accepts a client query or cursor", async () => {
  mocks.action.mockResolvedValueOnce({ readCount: 0, proposals: 0, hasMore: false });
  expect((await mailboxRead(request("accountId=account&expectedGeneration=1&mode=KNOWN_PRODUCTS&q=from:attacker&cursor=untrusted"))).status).toBe(200);
  expect(mocks.action.mock.calls[0][1]).toEqual({ accountId: "account", expectedGeneration: 1, mode: "KNOWN_PRODUCTS" });
  mocks.action.mockClear();
  expect((await mailboxRead(request("accountId=account&expectedGeneration=1&mode=arbitrary"))).status).toBe(400);
  expect((await mailboxRead(request("accountId=account&expectedGeneration=1&mode=HISTORY&mode=KNOWN_PRODUCTS"))).status).toBe(400);
  expect(mocks.action).not.toHaveBeenCalled();
});

test.each(["accountId=a", "expectedGeneration=1", "accountId=a&expectedGeneration=0", "accountId=a&expectedGeneration=1&accountId=b"])("malformed reconnect intent is rejected: %s", async body => {
  const response = await mailboxStart(request(body));
  expect(response.status).toBe(400);
  expect(mocks.action).not.toHaveBeenCalled();
});
test("oversized form and missing origin fail before the action", async () => {
  expect((await mailboxStart(request(`padding=${"x".repeat(4097)}`))).status).toBe(400);
  const foreign = request();
  foreign.headers.delete("origin");
  expect((await mailboxStart(foreign)).status).toBe(403);
  expect(mocks.action).not.toHaveBeenCalled();
});
test("signed-out callback performs no exchange and never exposes query details", async () => {
  mocks.auth.mockResolvedValueOnce({ userId: null });
  const response = await mailboxCallback(new Request("https://props.example.test/api/connect/mailboxes/google/callback?code=secret-code"));
  expect(response.headers.get("location")).toBe("https://props.example.test/onboarding?gmail=failed");
  expect(mocks.action).not.toHaveBeenCalled();
});
