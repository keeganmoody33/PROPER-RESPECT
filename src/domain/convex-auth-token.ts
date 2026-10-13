type ConvexTokenSession = {
  sessionClaims?: unknown;
  getToken: (options?: { template: "convex" }) => Promise<string | null | undefined>;
};

function audience(sessionClaims: unknown): unknown {
  if (!sessionClaims || typeof sessionClaims !== "object" || !("aud" in sessionClaims)) return undefined;
  return sessionClaims.aud;
}

/**
 * Convex accepts either a native Clerk session (audience "convex") or the
 * named JWT template. Mailbox routes and the GitHub connection route each
 * grew this branch; a later caller copied one of them and missed the other.
 */
export async function convexAuthToken(auth: ConvexTokenSession): Promise<string | null> {
  const token = audience(auth.sessionClaims) === "convex"
    ? await auth.getToken()
    : await auth.getToken({ template: "convex" });
  return token ?? null;
}
