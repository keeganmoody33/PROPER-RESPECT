import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const validEnvironment = {
  NEXT_PUBLIC_CONVEX_URL: "https://proper-respect.convex.cloud",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_public_example",
  CLERK_SECRET_KEY: "sk_live_secret_example",
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/sign-up",
  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: "/onboarding",
  NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: "/onboarding",
  CLERK_FRONTEND_API_URL: "https://clerk.proper-respect.example",
  CONNECTOR_ENCRYPTION_KEY: "example-key-that-is-at-least-32-characters",
};

function runPreflight(environment) {
  return spawnSync(
    process.execPath,
    ["scripts/deployment-preflight.mjs", "--strict", "--no-env-file"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        ...environment,
      },
    },
  );
}

test("deployment preflight accepts a complete production configuration", () => {
  const result = runPreflight(validEnvironment);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Deployment configuration is ready/);
  assert.doesNotMatch(result.stdout, /secret_example/);
});

test("deployment preflight rejects placeholders and mismatched Clerk key modes", () => {
  const result = runPreflight({
    ...validEnvironment,
    NEXT_PUBLIC_CONVEX_URL: "https://your-deployment.convex.cloud",
    CLERK_SECRET_KEY: "sk_test_secret_example",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /NEXT_PUBLIC_CONVEX_URL/);
  assert.match(result.stderr, /same Clerk environment/);
  assert.doesNotMatch(result.stderr, /secret_example/);
});

test("deployment preflight requires server-only Convex variables in strict mode", () => {
  const environment = { ...validEnvironment };
  delete environment.CLERK_FRONTEND_API_URL;
  delete environment.CONNECTOR_ENCRYPTION_KEY;
  const result = runPreflight(environment);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /CLERK_FRONTEND_API_URL/);
  assert.match(result.stderr, /CONNECTOR_ENCRYPTION_KEY/);
});

test("deployment preflight rejects a deploy key for a different Convex deployment", () => {
  const result = runPreflight({
    ...validEnvironment,
    NEXT_PUBLIC_CONVEX_URL: "https://public-profile.convex.cloud",
    CONVEX_DEPLOY_KEY: "prod:different-backend|secret-value",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /targets a different Convex deployment/);
  assert.doesNotMatch(result.stderr, /different-backend/);
  assert.doesNotMatch(result.stderr, /secret-value/);
});
