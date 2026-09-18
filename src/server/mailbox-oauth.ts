import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Provider contracts checked 2026-09-16:
// https://developers.google.com/identity/protocols/oauth2/web-server
// https://developers.google.com/identity/openid-connect/openid-connect
// https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
// https://learn.microsoft.com/en-us/graph/api/user-get?view=graph-rest-1.0

export type MailboxProvider = "GOOGLE" | "MICROSOFT";

const GOOGLE_MAIL = "https://www.googleapis.com/auth/gmail.readonly";
const providers = {
  GOOGLE: {
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    identity: "https://openidconnect.googleapis.com/v1/userinfo",
    scopes: ["openid", "email", GOOGLE_MAIL],
  },
  MICROSOFT: {
    authorize: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    token: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    identity: "https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName",
    scopes: ["offline_access", "User.Read", "Mail.Read"],
  },
} as const;

export type MailboxOAuthConfig = Readonly<{
  provider: MailboxProvider;
  clientId: string;
  redirectUri: string;
}>;

// Request descriptors contain secrets. Callers must never log or return them to clients.
type ProviderRequest = {
  url: string;
  method: "POST" | "GET";
  headers: Record<string, string>;
  body?: string;
  redirect: "error";
  cache: "no-store";
};

function providerContract(provider: MailboxProvider) {
  if (provider !== "GOOGLE" && provider !== "MICROSOFT") throw new Error("Unsupported mailbox provider.");
  return providers[provider];
}

function boundedText(value: unknown, name: string, max = 4096): string {
  if (typeof value !== "string" || !value || value.length > max || value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`Invalid ${name}.`);
  }
  return value;
}

function bearerToken(value: unknown): string {
  const token = boundedText(value, "access token", 32768);
  if (/\s/.test(token)) throw new Error("Invalid access token.");
  return token;
}

function objectResponse(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid provider response.");
  const response = value as Record<string, unknown>;
  if ("error" in response) throw new Error("Mailbox provider rejected the request.");
  return response;
}

/** applicationOrigin comes only from trusted server configuration, never request headers. */
export function createMailboxOAuthConfig(input: {
  provider: MailboxProvider; clientId: string; applicationOrigin: string; allowLoopbackHttp?: boolean;
}): MailboxOAuthConfig {
  providerContract(input.provider);
  const origin = new URL(boundedText(input.applicationOrigin, "application origin"));
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash ||
      (origin.protocol !== "https:" && !(input.allowLoopbackHttp && loopback && origin.protocol === "http:"))) {
    throw new Error("OAuth requires a fixed HTTPS application origin (or explicitly enabled loopback HTTP).");
  }
  return Object.freeze({
    provider: input.provider,
    clientId: boundedText(input.clientId, "client ID", 512),
    redirectUri: `${origin.origin}/api/connect/mailboxes/${input.provider.toLowerCase()}/callback`,
  });
}

export function createOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export function createPkce(verifier = randomBytes(32).toString("base64url")) {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) throw new Error("Invalid PKCE verifier.");
  return { verifier, challenge: createHash("sha256").update(verifier, "ascii").digest("base64url") };
}

function validateState(state: string) {
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(state)) throw new Error("Invalid OAuth state.");
}

export function buildAuthorizationUrl(config: MailboxOAuthConfig, input: { state: string; verifier: string }): string {
  const provider = providerContract(config.provider);
  validateState(input.state);
  const url = new URL(provider.authorize);
  url.search = new URLSearchParams({
    client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code",
    scope: provider.scopes.join(" "), state: input.state,
    code_challenge: createPkce(input.verifier).challenge, code_challenge_method: "S256",
    prompt: config.provider === "GOOGLE" ? "select_account consent" : "select_account",
    ...(config.provider === "GOOGLE" ? { access_type: "offline", include_granted_scopes: "false" } : { response_mode: "query" }),
  }).toString();
  return url.toString();
}

function tokenRequest(config: MailboxOAuthConfig, clientSecret: string, fields: Record<string, string>): ProviderRequest & { body: string } {
  return {
    url: providerContract(config.provider).token, method: "POST", redirect: "error", cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: boundedText(clientSecret, "client secret"), ...fields }).toString(),
  };
}

export function buildCodeExchangeRequest(config: MailboxOAuthConfig, input: { code: string; verifier: string; clientSecret: string }) {
  createPkce(input.verifier);
  return tokenRequest(config, input.clientSecret, {
    grant_type: "authorization_code", code: boundedText(input.code, "authorization code"),
    redirect_uri: config.redirectUri, code_verifier: input.verifier,
  });
}

export function buildRefreshRequest(config: MailboxOAuthConfig, input: { refreshToken: string; clientSecret: string }) {
  return tokenRequest(config, input.clientSecret, {
    grant_type: "refresh_token", refresh_token: boundedText(input.refreshToken, "refresh token", 32768),
    ...(config.provider === "MICROSOFT" ? { scope: providers.MICROSOFT.scopes.join(" ") } : {}),
  });
}

/** This checks callback shape/state only. Persisted owner/provider/expiry and one-use consumption are mandatory at integration. */
export function parseOAuthCallback(params: URLSearchParams, expectedState: string): { code: string } {
  validateState(expectedState);
  for (const key of ["state", "code", "error", "error_description"]) {
    if (params.getAll(key).length > 1) throw new Error("Duplicate OAuth callback parameter.");
  }
  const received = params.get("state");
  if (!received || !/^[A-Za-z0-9_-]{43,128}$/.test(received) || received.length !== expectedState.length ||
      !timingSafeEqual(Buffer.from(received), Buffer.from(expectedState))) throw new Error("OAuth state mismatch.");
  if (params.has("error")) {
    if (params.has("code")) throw new Error("Invalid OAuth callback.");
    throw new Error(params.get("error") === "access_denied" ? "Mailbox authorization was declined." : "Mailbox authorization failed.");
  }
  return { code: boundedText(params.get("code"), "authorization code") };
}

function grantScopes(provider: MailboxProvider, value: unknown): string[] {
  providerContract(provider);
  // Fail closed when scope is omitted, including Microsoft's permitted omission.
  // A future fallback may only use the exact persisted authorization request.
  const scopes = boundedText(value, "granted scopes", 8192).split(/ +/).map((scope) => {
    if (provider === "GOOGLE" && scope === "https://www.googleapis.com/auth/userinfo.email") return "email";
    if (provider === "GOOGLE" && scope === "https://www.googleapis.com/auth/userinfo.profile") return "profile";
    if (provider === "MICROSOFT" && scope.startsWith("https://graph.microsoft.com/")) return scope.slice("https://graph.microsoft.com/".length);
    return scope;
  });
  const allowed = provider === "GOOGLE" ? ["openid", "email", "profile", GOOGLE_MAIL] : ["openid", "email", "profile", "offline_access", "User.Read", "Mail.Read"];
  const required = provider === "GOOGLE" ? ["openid", "email", GOOGLE_MAIL] : ["User.Read", "Mail.Read"];
  if (scopes.some((scope) => !allowed.includes(scope)) || required.some((scope) => !scopes.includes(scope))) {
    throw new Error("Mailbox authorization requires the configured read-only scopes.");
  }
  return [...new Set(scopes)];
}

export function parseTokenResponse(provider: MailboxProvider, input: unknown, options: { isRefresh?: boolean } = {}) {
  const response = objectResponse(input);
  const scopes = grantScopes(provider, response.scope);
  if (typeof response.token_type !== "string" || response.token_type.toLowerCase() !== "bearer" ||
      !Number.isSafeInteger(response.expires_in) || (response.expires_in as number) <= 0) throw new Error("Invalid provider token response.");
  const refreshToken = response.refresh_token === undefined && options.isRefresh ? undefined : boundedText(response.refresh_token, "refresh token", 32768);
  return { accessToken: bearerToken(response.access_token), refreshToken, expiresInSeconds: response.expires_in as number, scopes };
}

export function buildIdentityRequest(provider: MailboxProvider, accessToken: string): ProviderRequest {
  return { url: providerContract(provider).identity, method: "GET", redirect: "error", cache: "no-store",
    headers: { Authorization: `Bearer ${bearerToken(accessToken)}`, Accept: "application/json" } };
}

/** Parse only a successful HTTPS response from buildIdentityRequest. This parser alone does not authenticate input. Never pass client JSON or decoded JWT claims. */
export function parseProviderIdentity(provider: MailboxProvider, input: unknown) {
  providerContract(provider);
  const response = objectResponse(input);
  const providerAccountId = boundedText(provider === "GOOGLE" ? response.sub : response.id, "provider account identity", provider === "GOOGLE" ? 255 : 256);
  if (/\s/.test(providerAccountId) || (provider === "GOOGLE" && /[^\x21-\x7e]/.test(providerAccountId))) throw new Error("Invalid provider account identity.");
  let label: unknown;
  if (provider === "GOOGLE") {
    if (response.email !== undefined && response.email_verified !== true) throw new Error("Unverified provider email label.");
    label = response.email;
  } else {
    label = response.mail ?? response.userPrincipalName;
  }
  return { providerAccountId, accountLabel: label == null ? providerAccountId : boundedText(label, "account label", 256) };
}
