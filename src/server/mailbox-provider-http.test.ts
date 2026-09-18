import { describe, expect, it, vi } from "vitest";
import { exchangeMailboxAuthorization, refreshMailboxAuthorization } from "./mailbox-provider-http";
import { createMailboxOAuthConfig } from "./mailbox-oauth";

const config = createMailboxOAuthConfig({ provider: "GOOGLE", clientId: "client", applicationOrigin: "https://props.example.test" });
const input = { code: "code", verifier: "v".repeat(43), clientSecret: "secret" };
const grant = { access_token: "access", refresh_token: "refresh", expires_in: 3600, token_type: "Bearer", scope: "openid email https://www.googleapis.com/auth/gmail.readonly" };
const identity = { sub: "opaque", email: "mail@example.test", email_verified: true };

describe("trusted mailbox provider transport", () => {
  it("exchanges code and verifies identity through fixed HTTPS endpoints", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(grant))
      .mockResolvedValueOnce(Response.json(identity));
    const result = await exchangeMailboxAuthorization(config, input, fetcher);
    expect(result.identity).toEqual({ providerAccountId: "opaque", accountLabel: "mail@example.test" });
    expect(result.credential).toMatchObject({ accessToken: "access", refreshToken: "refresh" });
    expect(result.credential.expiresAt).toBeGreaterThan(Date.now());
    expect(fetcher.mock.calls.map(call => call[0])).toEqual(["https://oauth2.googleapis.com/token", "https://openidconnect.googleapis.com/v1/userinfo"]);
    for (const [, options] of fetcher.mock.calls) {
      expect(options).toMatchObject({ redirect: "error", cache: "no-store", credentials: "omit" });
      expect(options?.signal).toBeInstanceOf(AbortSignal);
    }
    expect(fetcher.mock.calls[1][1]?.headers).toMatchObject({ Authorization: "Bearer access" });
    expect(result).not.toHaveProperty("id_token");
  });

  it("uses the verified Graph ID for Microsoft, never email as identity", async () => {
    const microsoft = createMailboxOAuthConfig({ provider: "MICROSOFT", clientId: "client", applicationOrigin: "https://props.example.test" });
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ ...grant, scope: "User.Read Mail.Read" }))
      .mockResolvedValueOnce(Response.json({ id: "graph-opaque", mail: "mail@example.test" }));
    const result = await exchangeMailboxAuthorization(microsoft, input, fetcher);
    expect(result.identity.providerAccountId).toBe("graph-opaque");
    expect(fetcher.mock.calls[1][0]).toBe("https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName");
  });

  it.each([400, 401, 429, 500, 302])("fails HTTP %i without returning or echoing provider body", async (status) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("PRIVATE TOKEN", { status }));
    await expect(exchangeMailboxAuthorization(config, input, fetcher)).rejects.toThrow("Mailbox provider request failed.");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("never uses a decoded ID token when identity lookup fails", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ ...grant, id_token: "forged-provider-claims" }))
      .mockResolvedValueOnce(new Response("PRIVATE", { status: 401 }));
    await expect(exchangeMailboxAuthorization(config, input, fetcher)).rejects.toThrow("Mailbox provider request failed.");
  });

  it("bounds response bodies even without Content-Length", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("x".repeat(131073)));
    await expect(exchangeMailboxAuthorization(config, input, fetcher)).rejects.toThrow("Mailbox provider response exceeded its limit.");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("masks network errors and invalid JSON without exposing tokens", async () => {
    const failed = vi.fn<typeof fetch>().mockRejectedValue(new Error("PRIVATE SECRET network error"));
    await expect(exchangeMailboxAuthorization(config, input, failed)).rejects.toThrow("Mailbox provider request failed.");
    const malformed = vi.fn<typeof fetch>().mockResolvedValue(new Response("PRIVATE malformed json"));
    await expect(exchangeMailboxAuthorization(config, input, malformed)).rejects.toThrow("Invalid mailbox provider JSON.");
  });

  it("stops before identity lookup on partial or overprivileged grants", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ...grant, scope: "openid email" }));
    await expect(exchangeMailboxAuthorization(config, input, fetcher)).rejects.toThrow("read-only scopes");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("preserves an existing refresh token when the provider omits rotation", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ ...grant, access_token: "new-access", refresh_token: undefined }))
      .mockResolvedValueOnce(Response.json(identity));
    const result = await refreshMailboxAuthorization(config, { refreshToken: "old-refresh", clientSecret: "secret", expectedProviderAccountId: "opaque" }, fetcher);
    expect(result.credential).toMatchObject({ accessToken: "new-access", refreshToken: "old-refresh" });
    expect(new URLSearchParams(fetcher.mock.calls[0][1]?.body as string).get("grant_type")).toBe("refresh_token");
  });

  it("accepts rotated refresh credentials only for the same verified account", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ ...grant, refresh_token: "rotated" }))
      .mockResolvedValueOnce(Response.json({ ...identity, email: "changed@example.test" }));
    const result = await refreshMailboxAuthorization(config, { refreshToken: "old-refresh", clientSecret: "secret", expectedProviderAccountId: "opaque" }, fetcher);
    expect(result.credential.refreshToken).toBe("rotated");
    const wrongAccount = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(grant))
      .mockResolvedValueOnce(Response.json({ ...identity, sub: "different-account" }));
    await expect(refreshMailboxAuthorization(config, { refreshToken: "old-refresh", clientSecret: "secret", expectedProviderAccountId: "opaque" }, wrongAccount)).rejects.toThrow("Mailbox provider account changed.");
  });

  it("rejects a refresh with lost read access before another identity call", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ...grant, scope: "openid email" }));
    await expect(refreshMailboxAuthorization(config, { refreshToken: "old-refresh", clientSecret: "secret", expectedProviderAccountId: "opaque" }, fetcher)).rejects.toThrow("read-only scopes");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
