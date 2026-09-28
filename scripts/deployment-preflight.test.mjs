import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
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

test("the Vercel build is frontend-only and no Git push deploys anything", () => {
  const configuration = JSON.parse(readFileSync("vercel.json", "utf8"));
  assert.equal(configuration.git?.deploymentEnabled, false);
  assert.match(configuration.buildCommand, /npm run deploy:check/);
  assert.match(configuration.buildCommand, /npm run build/);
  // The backend deploys only from the tagged release workflow (R10).
  assert.doesNotMatch(configuration.buildCommand, /convex\s+deploy/);
});

// The release workflow is read as text: these pin its safety checks (R10).
const releaseWorkflow = () => readFileSync(".github/workflows/release.yml", "utf8");

test("the release verifies both deploy environments require a reviewer before deploying", () => {
  const workflow = releaseWorkflow();
  const verify = workflow.slice(workflow.indexOf("\n  verify:"), workflow.indexOf("\n  backend:"));
  assert.match(verify, /actions: read/);
  assert.match(verify, /environments\/\$name/);
  assert.match(verify, /required_reviewers/);
  assert.match(verify, /for name in production-backend production-frontend/);
});

test("the release checks the smoke-test handle before anything deploys", () => {
  const workflow = releaseWorkflow();
  const verify = workflow.slice(workflow.indexOf("\n  verify:"), workflow.indexOf("\n  backend:"));
  assert.match(verify, /PUBLIC_HANDLE: \$\{\{ vars\.PUBLIC_HANDLE \}\}/);
  assert.match(verify, /\[\[ "\$PUBLIC_HANDLE" =~/);
});

test("the release pins every action to a commit SHA", () => {
  const uses = releaseWorkflow().split("\n").filter(line => /^\s*(- )?uses:/.test(line));
  assert.ok(uses.length > 0);
  for (const line of uses) assert.match(line, /@[0-9a-f]{40} # v\d/);
});

test("the release requires the repository owner as the only reviewer", () => {
  const workflow = releaseWorkflow();
  const verify = workflow.slice(workflow.indexOf("\n  verify:"), workflow.indexOf("\n  backend:"));
  assert.match(verify, /--arg owner "\$GITHUB_REPOSITORY_OWNER"/);
  assert.match(verify, /\.reviewer\.login == \$owner/);
});

test("the frontend smoke test uses the handle verify checked", () => {
  const workflow = releaseWorkflow();
  const frontend = workflow.slice(workflow.indexOf("\n  frontend:"));
  assert.doesNotMatch(frontend, /vars\.PUBLIC_HANDLE/);
  assert.match(frontend, /needs\.verify\.outputs\.public_handle/);
});

test("the backend deploys only with a key for the checked production deployment", () => {
  const workflow = releaseWorkflow();
  const verify = workflow.slice(workflow.indexOf("\n  verify:"), workflow.indexOf("\n  backend:"));
  const backend = workflow.slice(workflow.indexOf("\n  backend:"), workflow.indexOf("\n  frontend:"));
  assert.match(verify, /CONVEX_PRODUCTION_DEPLOYMENT: \$\{\{ vars\.CONVEX_PRODUCTION_DEPLOYMENT \}\}/);
  assert.match(backend, /needs\.verify\.outputs\.convex_deployment/);
  assert.doesNotMatch(backend, /vars\.CONVEX_PRODUCTION_DEPLOYMENT/);
  assert.match(backend, /"prod:\$\{CONVEX_PRODUCTION_DEPLOYMENT\}\|"\?\*\)/);
});

test("the release docs never run an unpinned Vercel CLI", () => {
  for (const file of ["docs/releases/TEMPLATE.md", "docs/releases/v0.2.0.md", "docs/DEPLOYMENT.md"]) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /npx[^\n`]*vercel/, file);
  }
});

test("the release runs a pinned Vercel CLI, never one fetched at deploy time", () => {
  const workflow = releaseWorkflow();
  assert.doesNotMatch(workflow, /npx[^\n]*vercel/);
  assert.match(workflow, /npm ci --ignore-scripts --prefix release-tools/);
  const manifest = JSON.parse(readFileSync("release-tools/package.json", "utf8"));
  const pinned = manifest.dependencies?.vercel;
  assert.match(pinned ?? "", /^\d+\.\d+\.\d+$/);
  const lock = JSON.parse(readFileSync("release-tools/package-lock.json", "utf8"));
  assert.equal(lock.packages?.["node_modules/vercel"]?.version, pinned);
});

test("the release accepts only a vercel.app deployment URL from the CLI", () => {
  assert.match(releaseWorkflow(), /\^https:\/\/\[a-z0-9-\]\+\\\.vercel\\\.app\$/);
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
