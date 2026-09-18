import { describe, expect, it } from "vitest";
import {
  createMailboxOAuthConfig, createPkce, createOAuthState, buildAuthorizationUrl,
  buildCodeExchangeRequest, buildRefreshRequest, buildIdentityRequest,
  parseTokenResponse, parseProviderIdentity, parseOAuthCallback,
} from "./mailbox-oauth";

const config = (provider: "GOOGLE" | "MICROSOFT" = "GOOGLE") =>
  createMailboxOAuthConfig({ provider, clientId: "test-client", applicationOrigin: "https://props.example.test" });
const state = "s".repeat(43);
const verifier = "v".repeat(43);
const googleScopes = "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gmail.readonly";
const token = (scope = googleScopes) => ({ access_token: "private-access", refresh_token: "private-refresh", token_type: "Bearer", expires_in: 3600, scope });

describe("mailbox OAuth request contract", () => {
  it("generates fresh state and S256 PKCE with the RFC 7636 test vector", () => {
    expect(createOAuthState()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(createOAuthState()).not.toBe(createOAuthState());
    const pair = createPkce();
    expect(pair.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pair.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(createPkce("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk").challenge)
      .toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    expect(() => createPkce("short")).toThrow();
  });

  it.each(["GOOGLE", "MICROSOFT"] as const)("fixes redirects and uses code + S256 for %s", (provider) => {
    const url = new URL(buildAuthorizationUrl(config(provider), { state, verifier }));
    expect(url.protocol).toBe("https:");
    expect(url.searchParams.get("redirect_uri")).toBe(`https://props.example.test/api/connect/mailboxes/${provider.toLowerCase()}/callback`);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_verifier")).toBeNull();
    expect(url.searchParams.get("state")).toBe(state);
    expect(url.searchParams.get("prompt")).toContain("select_account");
    expect(url.searchParams.get("scope")).not.toMatch(/write|send|modify/i);
  });

  it("requests separate read-only grants and offline access", () => {
    const google = new URL(buildAuthorizationUrl(config(), { state, verifier }));
    expect(google.searchParams.get("access_type")).toBe("offline");
    expect(google.searchParams.get("include_granted_scopes")).toBe("false");
    expect(google.searchParams.get("scope")).toContain("gmail.readonly");
    const microsoft = new URL(buildAuthorizationUrl(config("MICROSOFT"), { state, verifier }));
    expect(microsoft.origin).toBe("https://login.microsoftonline.com");
    expect(microsoft.searchParams.get("scope")).toBe("offline_access User.Read Mail.Read");
  });

  it.each(["https://evil.test/path", "https://evil.test?next=x", "https://evil.test#x", "https://user:pw@evil.test", "http://props.example.test", "javascript:alert(1)"])("rejects unsafe application origin %s", (applicationOrigin) => {
    expect(() => createMailboxOAuthConfig({ provider: "GOOGLE", clientId: "client", applicationOrigin })).toThrow();
  });

  it("allows loopback HTTP only when explicitly enabled", () => {
    const input = { provider: "GOOGLE" as const, clientId: "client", applicationOrigin: "http://localhost:3000" };
    expect(() => createMailboxOAuthConfig(input)).toThrow();
    expect(createMailboxOAuthConfig({ ...input, allowLoopbackHttp: true }).redirectUri).toContain("http://localhost:3000/");
  });

  it("keeps credentials in form POST bodies and uses the exact same callback", () => {
    const request = buildCodeExchangeRequest(config(), { code: "code&value", verifier, clientSecret: "secret&value" });
    const form = new URLSearchParams(request.body);
    expect(request.url).toBe("https://oauth2.googleapis.com/token");
    expect(request.method).toBe("POST");
    expect(request.redirect).toBe("error");
    expect(form.get("code")).toBe("code&value");
    expect(form.get("client_secret")).toBe("secret&value");
    expect(form.get("code_verifier")).toBe(verifier);
    expect(form.get("redirect_uri")).toBe(config().redirectUri);
    const refresh = buildRefreshRequest(config("MICROSOFT"), { refreshToken: "refresh", clientSecret: "secret" });
    expect(new URLSearchParams(refresh.body).get("grant_type")).toBe("refresh_token");
    expect(new URLSearchParams(refresh.body).get("scope")).toContain("Mail.Read");
  });
});

describe("mailbox callback and response validation", () => {
  it("requires one matching state and one code; provider errors never echo private text", () => {
    expect(parseOAuthCallback(new URLSearchParams({ state, code: "ok" }), state)).toEqual({ code: "ok" });
    for (const query of [`state=${state}&code=a&code=b`, `state=${state}&state=${state}&code=a`, `state=wrong&code=a`, `code=a`, `state=${state}&code=a&error=denied`]) {
      expect(() => parseOAuthCallback(new URLSearchParams(query), state)).toThrow();
    }
    expect(() => parseOAuthCallback(new URLSearchParams({ state, error: "access_denied", error_description: "PRIVATE" }), state)).toThrow("Mailbox authorization was declined.");
  });

  it("normalizes actual grant scopes and separates refresh and access credentials", () => {
    expect(parseTokenResponse("GOOGLE", token())).toEqual({ accessToken: "private-access", refreshToken: "private-refresh", expiresInSeconds: 3600, scopes: ["openid", "email", "https://www.googleapis.com/auth/gmail.readonly"] });
    expect(parseTokenResponse("MICROSOFT", token("https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.Read"))).toMatchObject({ scopes: ["User.Read", "Mail.Read"] });
  });

  it.each([
    { ...token(), scope: "openid email" },
    { ...token(), scope: `${googleScopes} https://www.googleapis.com/auth/gmail.modify` },
    { ...token(), scope: undefined }, { ...token(), expires_in: -1 },
    { ...token(), expires_in: "3600" }, { ...token(), token_type: "mac" },
    { ...token(), access_token: "bad\r\nheader" }, { ...token(), refresh_token: undefined },
    { ...token(), error: "invalid_grant" }, null,
  ])("rejects incomplete or overprivileged token response %#", (input) => {
    expect(() => parseTokenResponse("GOOGLE", input)).toThrow();
  });

  it("allows refresh rotation omission only in an explicit refresh response", () => {
    expect(parseTokenResponse("GOOGLE", { ...token(), refresh_token: undefined }, { isRefresh: true }).refreshToken).toBeUndefined();
    expect(() => parseTokenResponse("MICROSOFT", token("User.Read Mail.Read Mail.Send"))).toThrow();
    // Microsoft permits omitted scope; this helper deliberately fails closed until
    // integration can supply a persisted exact authorization request.
    expect(() => parseTokenResponse("MICROSOFT", { ...token(), scope: undefined })).toThrow("Invalid granted scopes.");
    expect(parseTokenResponse("GOOGLE", { ...token(), id_token: "ignored", vendor_extension: true })).toMatchObject({ expiresInSeconds: 3600 });
  });

  it("uses fixed identity endpoints and rejects header injection", () => {
    expect(buildIdentityRequest("GOOGLE", "access").url).toBe("https://openidconnect.googleapis.com/v1/userinfo");
    expect(buildIdentityRequest("MICROSOFT", "access").url).toBe("https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName");
    expect(buildIdentityRequest("GOOGLE", "access").redirect).toBe("error");
    expect(() => buildIdentityRequest("GOOGLE", "access\nsecret")).toThrow();
  });

  it("keeps opaque provider identity stable when email labels change", () => {
    const first = parseProviderIdentity("GOOGLE", { sub: "Opaque-A", email: "first@example.test", email_verified: true });
    const next = parseProviderIdentity("GOOGLE", { sub: "Opaque-A", email: "next@example.test", email_verified: true });
    expect(first.providerAccountId).toBe(next.providerAccountId);
    expect(first.accountLabel).not.toBe(next.accountLabel);
    expect(parseProviderIdentity("MICROSOFT", { id: "Opaque-B", mail: null, userPrincipalName: "work@example.test" })).toEqual({ providerAccountId: "Opaque-B", accountLabel: "work@example.test" });
  });

  it("never derives identity from email, decoded tokens, or display name", () => {
    expect(() => parseProviderIdentity("GOOGLE", { email: "x@example.test", email_verified: true })).toThrow();
    expect(() => parseProviderIdentity("GOOGLE", { sub: " valid ", email: "x@example.test", email_verified: true })).toThrow();
    expect(() => parseProviderIdentity("GOOGLE", { sub: "id", email: "x@example.test", email_verified: false })).toThrow();
    expect(() => parseProviderIdentity("MICROSOFT", { displayName: "Keegan", mail: "x@example.test" })).toThrow();
    expect(() => parseProviderIdentity("GOOGLE", "eyJhbGciOiJub25lIn0.eyJzdWIiOiJmb3JnZWQifQ.")).toThrow();
    expect(parseProviderIdentity("GOOGLE", { sub: "Opaque-A" })).toEqual({ providerAccountId: "Opaque-A", accountLabel: "Opaque-A" });
    expect(parseProviderIdentity("GOOGLE", { sub: "Opaque-B", email: "x@example.test", email_verified: true }).providerAccountId).toBe("Opaque-B");
    for (const id of [123, "", "\nprivate", "contains space"]) {
      expect(() => parseProviderIdentity("MICROSOFT", { id })).toThrow();
    }
  });
});
