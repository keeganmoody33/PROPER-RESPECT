import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeDevelopmentEnvironment } from "./codex-development-preflight.mjs";
test("configuration report excludes credentials and never claims a matching app from presence", () => {
  const secret = "sk_test_SYNTHETIC_PRIVATE_KEY";
  const result = summarizeDevelopmentEnvironment({ CONVEX_DEPLOYMENT: "dev:utmost-mongoose-374", NEXT_PUBLIC_CONVEX_URL: "https://utmost-mongoose-374.convex.cloud",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_" + Buffer.from("fixture.clerk.accounts.dev$").toString("base64"), CLERK_SECRET_KEY: secret });
  assert.equal(result.targetMatches, true); assert.equal(result.clerkSecretIsDevelopment, true); assert.equal(result.matchingClerkAppVerified, false);
  assert.equal(JSON.stringify(result).includes(secret), false);
});
test("production configuration fails the intended development target", () => {
  const result = summarizeDevelopmentEnvironment({ CONVEX_DEPLOYMENT: "prod:striped-chicken-693", NEXT_PUBLIC_CONVEX_URL: "https://striped-chicken-693.convex.cloud", CLERK_SECRET_KEY: "sk_live_SYNTHETIC_PRIVATE_KEY" });
  assert.equal(result.targetMatches, false); assert.equal(result.urlMatches, false); assert.equal(result.clerkSecretIsDevelopment, false); assert.equal(result.clerkSecretIsProduction, true);
});
test("issuer comparison accepts the configured public app without revealing tooling credentials", () => {
  const publicKey = "pk_test_" + Buffer.from("fixture.clerk.accounts.dev$").toString("base64");
  const result = summarizeDevelopmentEnvironment({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publicKey,
    CLERK_FRONTEND_API_URL: "https://fixture.clerk.accounts.dev", CONVEX_DEPLOY_KEY: "SYNTHETIC_PRIVATE_DEPLOY_KEY" });
  assert.equal(result.clerkIssuerMatchesPublicApp, true); assert.equal(result.convexDeployKeyPresent, true);
  assert.equal(JSON.stringify(result).includes("SYNTHETIC_PRIVATE_DEPLOY_KEY"), false);
  assert.equal(summarizeDevelopmentEnvironment({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publicKey,
    CLERK_JWT_ISSUER_DOMAIN: "https://another.clerk.accounts.dev" }).clerkIssuerMatchesPublicApp, false);
  assert.equal(result.matchingClerkAppVerified, false);
});
