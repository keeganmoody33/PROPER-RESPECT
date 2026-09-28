import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const validEnvironment = {
  PUBLIC_SITE_ORIGIN: "https://public.example",
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

test("deployment preflight requires an explicit HTTPS public origin", () => {
  for (const origin of ["", "http://public.example", "https://public.example/path", "https://secret@public.example", "https://public.example?secret=value"]) {
    const result = runPreflight({ ...validEnvironment, PUBLIC_SITE_ORIGIN: origin });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /PUBLIC_SITE_ORIGIN/);
    assert.doesNotMatch(result.stderr, /secret/);
  }
});

test("GitHub consolidation cannot automatically deploy Vercel or Convex", () => {
  const configuration = JSON.parse(readFileSync("vercel.json", "utf8"));
  assert.equal(configuration.git?.deploymentEnabled, false);
  assert.match(configuration.buildCommand, /npm run deploy:check/);
  assert.match(configuration.buildCommand, /convex deploy/);
});

test("every runtime and CI job uses the same Node major (R13)", () => {
  // Vercel runs Node 24.x; CI, local development and Convex "use node" actions match it.
  assert.equal(readFileSync(".nvmrc", "utf8").trim(), "24");
  assert.equal(JSON.parse(readFileSync("package.json", "utf8")).engines?.node, "24.x");
  assert.equal(JSON.parse(readFileSync("convex.json", "utf8")).node?.nodeVersion, "24");
  const workflows = readdirSync(".github/workflows").filter(name => /\.ya?ml$/.test(name));
  assert.ok(workflows.length > 0);
  for (const name of workflows) {
    const text = readFileSync(`.github/workflows/${name}`, "utf8");
    assert.doesNotMatch(text, /node-version:/, `${name} pins a Node version itself`);
    const setups = text.match(/uses: actions\/setup-node@/g)?.length ?? 0;
    const pinned = text.match(/node-version-file: \.nvmrc/g)?.length ?? 0;
    assert.equal(pinned, setups, `${name} must read .nvmrc in every setup-node step`);
  }
});

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
