import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

// Reads a shell pattern assigned as name='...' in the workflow.
function workflowPattern(text, name) {
  const match = text.match(new RegExp(`\\b${name}='([^']+)'`));
  assert.ok(match, `${name} is not set in release.yml`);
  return match[1];
}

// Runs scripts/release-gate.sh with a stub curl that answers GitHub's API from `api`.
function runReleaseGate({ actor = "owner", triggeringActor = "owner", releaseOwner = "owner", api = {} } = {}) {
  const bin = mkdtempSync(join(tmpdir(), "release-gate-"));
  const tagOnly = { branch_policies: [{ type: "tag", name: "v*" }] };
  const responses = {
    "environments/production-backend": { deployment_branch_policy: { custom_branch_policies: true } },
    "environments/production-backend/deployment-branch-policies": tagOnly,
    "environments/production-frontend": { deployment_branch_policy: { custom_branch_policies: true } },
    "environments/production-frontend/deployment-branch-policies": tagOnly,
    "rulesets?includes_parents=false&per_page=100": [{ id: 7, target: "tag", enforcement: "active" }],
    "rulesets/7": releaseTagRuleset(),
    ...api,
  };
  writeFileSync(join(bin, "responses.json"), JSON.stringify(responses));
  writeFileSync(join(bin, "curl"), `#!/usr/bin/env node
const { readFileSync, writeFileSync } = require("node:fs");
const args = process.argv.slice(2);
const path = args.at(-1).split("/repos/owner/repo/")[1];
const body = JSON.parse(readFileSync(${JSON.stringify(join(bin, "responses.json"))}, "utf8"))[path];
writeFileSync(args[args.indexOf("--output") + 1], JSON.stringify(body ?? {}));
process.stdout.write(body === undefined || body === null ? "404" : "200");
`, { mode: 0o755 });
  const result = spawnSync("bash", ["scripts/release-gate.sh"], {
    encoding: "utf8",
    env: {
      PATH: `${bin}:${process.env.PATH}`, TMPDIR: tmpdir(), ACTOR: actor, TRIGGERING_ACTOR: triggeringActor, GH_TOKEN: "stub",
      ...(releaseOwner === null ? {} : { RELEASE_OWNER: releaseOwner }),
      // The organization that owns the repository, which never releases.
      GITHUB_REPOSITORY_OWNER: "org", GITHUB_REPOSITORY: "owner/repo", GITHUB_API_URL: "https://api.github.test",
    },
  });
  rmSync(bin, { recursive: true, force: true });
  return { status: result.status, output: result.stdout + result.stderr };
}

const releaseTagRuleset = (change = {}) => ({
  target: "tag", enforcement: "active",
  conditions: { ref_name: { include: ["refs/tags/v*"], exclude: [] } },
  rules: [{ type: "creation" }, { type: "update" }, { type: "deletion" }],
  ...change,
});

test("the release gate passes for the owner's tag with tag-only environments and a v* tag ruleset", () => {
  assert.deepEqual(runReleaseGate(), { status: 0, output: "" });
  const everyTag = releaseTagRuleset({ conditions: { ref_name: { include: ["~ALL"], exclude: [] } } });
  assert.equal(runReleaseGate({ api: { "rulesets/7": everyTag } }).status, 0);
});

test("the release gate stops when a deploy environment accepts more than v* tags", () => {
  for (const name of ["production-backend", "production-frontend"]) {
    for (const [path, body] of [
      [`environments/${name}`, null],
      [`environments/${name}`, { deployment_branch_policy: null }],
      [`environments/${name}`, { deployment_branch_policy: { custom_branch_policies: false } }],
      [`environments/${name}/deployment-branch-policies`, null],
      [`environments/${name}/deployment-branch-policies`, { branch_policies: [] }],
      [`environments/${name}/deployment-branch-policies`, { branch_policies: [{ type: "tag", name: "v*" }, { type: "branch", name: "main" }] }],
      [`environments/${name}/deployment-branch-policies`, { branch_policies: [{ type: "tag", name: "*" }] }],
    ]) {
      const result = runReleaseGate({ api: { [path]: body } });
      assert.equal(result.status, 1, `${path} ${JSON.stringify(body)}`);
      assert.match(result.output, new RegExp(name));
    }
  }
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

test("release Convex commands never download an unlocked CLI", () => {
  for (const file of [".github/workflows/release.yml", "docs/releases/v0.2.0.md"]) {
    const text = readFileSync(file, "utf8");
    assert.match(text, /npx --no-install convex /, file);
    assert.doesNotMatch(text, /npx (?!--no-install )convex/, file);
  }
  assert.match(readFileSync("docs/releases/v0.2.0.md", "utf8"), /git checkout v0\.2\.0\nnpm ci\n/);
});

test("release secrets reach only the steps that run the CLI they authenticate", () => {
  const workflow = releaseWorkflow();
  const steps = job => {
    const start = workflow.indexOf(`\n  ${job}:`);
    const body = workflow.slice(start, job === "frontend" ? undefined : workflow.indexOf("\n  frontend:"));
    return body.split("\n      - ").slice(1);
  };
  const holders = (job, secret) => steps(job).filter(step => step.includes(`secrets.${secret}`));
  const convex = holders("backend", "CONVEX_DEPLOY_KEY");
  assert.equal(convex.length, 2);
  for (const step of convex) assert.match(step, /npx --no-install convex /);
  // The key check runs inside the deploy step, before the CLI.
  assert.ok(convex[0].indexOf('"prod:${CONVEX_PRODUCTION_DEPLOYMENT}|"') < convex[0].indexOf("npx --no-install convex deploy"));
  const vercel = holders("frontend", "VERCEL_TOKEN");
  assert.equal(vercel.length, 2);
  // The deploy runs the pinned CLI; the domain check reads Vercel's API directly and sends the token nowhere else.
  assert.match(vercel[0], /release-tools\/node_modules\/\.bin\/vercel deploy/);
  assert.ok(vercel[0].indexOf('-z "$VERCEL_TOKEN"') < vercel[0].indexOf("vercel deploy"));
  assert.deepEqual([...vercel[1].matchAll(/https:\/\/[a-z][^\s"'?]*/g)].map(m => m[0]), ["https://api.vercel.com/v13/deployments/${host}"]);
});

test("the production-domain check reads the deployment's aliases and says why it fails", () => {
  // v0.2.0: `vercel inspect` exited non-zero under bash -e before its output was printed,
  // so a deployment that did hold proper-respect.com failed the release with no message.
  const workflow = releaseWorkflow();
  const start = workflow.indexOf("- name: Require the production domain on this deployment");
  const step = workflow.slice(start, workflow.indexOf("\n      - name:", start + 1));
  assert.ok(start > 0);
  assert.doesNotMatch(step, /vercel inspect/);
  assert.match(step, /https:\/\/api\.vercel\.com\/v13\/deployments\/\$\{?host\}?\?teamId=\$\{?VERCEL_ORG_ID\}?/);
  assert.match(step, /\.alias/);
  assert.match(step, /"proper-respect\.com"/);
  // Every failure path prints a reason before it exits.
  for (const exit of step.split("exit 1").slice(0, -1)) assert.match(exit.slice(-400), /echo "/);
});

test("the release gate stops unless the release owner pushed the tag and started this attempt", () => {
  // Required reviewers aren't offered on a private repository below Enterprise,
  // so the workflow doesn't read them: the gate has to hold without them (2026-11-12).
  assert.doesNotMatch(releaseWorkflow(), /required_reviewers/);
  assert.match(releaseWorkflow(), /\non:\n  push:\n    tags: \["v\*"\]\npermissions:/);
  const pushedByBot = runReleaseGate({ actor: "devin-ai-integration[bot]" });
  assert.equal(pushedByBot.status, 1);
  assert.match(pushedByBot.output, /Only owner can release\. This run was started by devin-ai-integration\[bot\]\./);
  const rerunByOther = runReleaseGate({ triggeringActor: "collaborator" });
  assert.equal(rerunByOther.status, 1);
  assert.match(rerunByOther.output, /started by collaborator\./);
});

test("the release gate checks the pinned release owner, not the organization that owns the repository", () => {
  // Since 2026-11-23 github.repository_owner is the lecturesfrom organization.
  const byOrganization = runReleaseGate({ actor: "org", triggeringActor: "org" });
  assert.equal(byOrganization.status, 1);
  assert.match(byOrganization.output, /Only owner can release\. This run was started by org\./);
  // null leaves RELEASE_OWNER out of the environment.
  for (const releaseOwner of [null, ""]) {
    const unpinned = runReleaseGate({ releaseOwner });
    assert.equal(unpinned.status, 1, JSON.stringify(releaseOwner));
    assert.match(unpinned.output, /RELEASE_OWNER is not set, so no one can release\./);
  }
  // Every gate step and both deploy conditions name the same account.
  const workflow = releaseWorkflow();
  assert.doesNotMatch(workflow, /\$\{\{[^}]*repository_owner/);
  assert.doesNotMatch(workflow, /\n    if:[^\n]*repository_owner/);
  assert.deepEqual([...workflow.matchAll(/\n          RELEASE_OWNER: (\S+)\n/g)].map(m => m[1]), ["keeganmoody33", "keeganmoody33", "keeganmoody33"]);
});

test("every release job checks the gate itself, so re-running one deploy job can't skip it", () => {
  // A re-run of backend or frontend alone reuses verify's earlier result.
  const workflow = releaseWorkflow();
  const jobs = {
    verify: workflow.slice(workflow.indexOf("\n  verify:"), workflow.indexOf("\n  backend:")),
    backend: workflow.slice(workflow.indexOf("\n  backend:"), workflow.indexOf("\n  frontend:")),
    frontend: workflow.slice(workflow.indexOf("\n  frontend:")),
  };
  for (const [name, job] of Object.entries(jobs)) {
    assert.match(job, /actions: read/, name);
    const gate = job.indexOf("run: bash scripts/release-gate.sh");
    assert.ok(gate > 0, name);
    const step = job.slice(job.lastIndexOf("\n      - ", gate), gate);
    assert.match(step, /RELEASE_OWNER: keeganmoody33\n/, name);
    assert.match(step, /ACTOR: \$\{\{ github\.actor \}\}/, name);
    assert.match(step, /TRIGGERING_ACTOR: \$\{\{ github\.triggering_actor \}\}/, name);
    assert.match(step, /GH_TOKEN: \$\{\{ github\.token \}\}/, name);
    // Before anything is installed, and before any step that holds a secret or a deploy variable.
    for (const later of ["run: npm ci", "${{ secrets.", "${{ vars.VERCEL"]) {
      const at = job.indexOf(later);
      if (at >= 0) assert.ok(gate < at, `${name}: ${later}`);
    }
  }
  for (const name of ["backend", "frontend"]) {
    assert.match(jobs[name], /\n    if: github\.actor == 'keeganmoody33' && github\.triggering_actor == 'keeganmoody33'\n/, name);
  }
});

test("the frontend smoke test uses the handle verify checked", () => {
  const workflow = releaseWorkflow();
  const frontend = workflow.slice(workflow.indexOf("\n  frontend:"));
  assert.doesNotMatch(frontend, /vars\.PUBLIC_HANDLE/);
  assert.match(frontend, /needs\.verify\.outputs\.public_handle/);
});

test("the backend deploys only with a key for the deployment in PUBLIC_CONVEX_URL", () => {
  const workflow = releaseWorkflow();
  const verify = workflow.slice(workflow.indexOf("\n  verify:"), workflow.indexOf("\n  backend:"));
  const backend = workflow.slice(workflow.indexOf("\n  backend:"), workflow.indexOf("\n  frontend:"));
  // K02 sets PUBLIC_CONVEX_URL; the release derives the deployment name from it.
  assert.match(verify, /PUBLIC_CONVEX_URL: \$\{\{ vars\.PUBLIC_CONVEX_URL \}\}/);
  assert.doesNotMatch(workflow, /CONVEX_PRODUCTION_DEPLOYMENT: \$\{\{ vars/);
  assert.match(backend, /needs\.verify\.outputs\.convex_deployment/);
  assert.match(backend, /"prod:\$\{CONVEX_PRODUCTION_DEPLOYMENT\}\|"\?\*\)/);
  const pattern = new RegExp(workflowPattern(verify, "convex_url_pattern"));
  const deployment = url => url.match(pattern)?.[1] ?? null;
  assert.equal(deployment("https://striped-chicken-693.convex.cloud"), "striped-chicken-693");
  for (const bad of ["", "http://striped-chicken-693.convex.cloud", "https://striped-chicken-693.convex.site",
    "https://evil.com/striped-chicken-693.convex.cloud", "https://striped-chicken-693.convex.cloud/", "https://a.b.convex.cloud"]) {
    assert.equal(deployment(bad), null, bad);
  }
});

test("the release accepts only the pinned production Convex deployment", () => {
  const workflow = releaseWorkflow();
  const verify = workflow.slice(workflow.indexOf("\n  verify:"), workflow.indexOf("\n  backend:"));
  // verify has no environment, so vars can fall back to an org variable naming
  // another deployment; the deployment itself is pinned here.
  assert.match(verify, /expected_deployment='striped-chicken-693'/);
  assert.match(verify, /\[ "\$\{BASH_REMATCH\[1\]\}" != "\$expected_deployment" \]/);
});

test("the release gate requires an active ruleset that restricts v* tags", () => {
  // Without it, anyone with write access could tag a commit that rewrites the owner check.
  const refused = [
    releaseTagRuleset({ enforcement: "disabled" }),
    releaseTagRuleset({ enforcement: "evaluate" }),
    releaseTagRuleset({ target: "branch" }),
    releaseTagRuleset({ conditions: { ref_name: { include: ["refs/tags/release-*"], exclude: [] } } }),
    releaseTagRuleset({ conditions: { ref_name: { include: ["refs/tags/v*"], exclude: ["refs/tags/v0*"] } } }),
    releaseTagRuleset({ conditions: undefined }),
    releaseTagRuleset({ rules: [{ type: "update" }, { type: "deletion" }] }),
    releaseTagRuleset({ rules: [{ type: "creation" }, { type: "deletion" }] }),
    releaseTagRuleset({ rules: [{ type: "creation" }, { type: "update" }] }),
    releaseTagRuleset({ rules: undefined }),
  ];
  for (const ruleset of refused) {
    const result = runReleaseGate({ api: { "rulesets/7": ruleset } });
    assert.equal(result.status, 1, JSON.stringify(ruleset));
    assert.match(result.output, /No active tag ruleset restricts creating, updating and deleting v\* tags/);
  }
  assert.equal(runReleaseGate({ api: { "rulesets?includes_parents=false&per_page=100": [] } }).status, 1);
  assert.equal(runReleaseGate({ api: { "rulesets?includes_parents=false&per_page=100": null } }).status, 1);
  assert.equal(runReleaseGate({ api: { "rulesets/7": null } }).status, 1);
});

test("the frontend is built against the same Convex deployment the backend deployed", () => {
  const frontend = releaseWorkflow().slice(releaseWorkflow().indexOf("\n  frontend:"));
  assert.match(frontend, /CONVEX_URL: https:\/\/\$\{\{ needs\.verify\.outputs\.convex_deployment \}\}\.convex\.cloud/);
  assert.match(frontend, /--build-env NEXT_PUBLIC_CONVEX_URL="\$CONVEX_URL"/);
  assert.match(frontend, /--env NEXT_PUBLIC_CONVEX_URL="\$CONVEX_URL"/);
});

test("the frontend reads the Vercel IDs as K02's environment variables", () => {
  const workflow = releaseWorkflow();
  const frontend = workflow.slice(workflow.indexOf("\n  frontend:"));
  assert.match(frontend, /VERCEL_ORG_ID: \$\{\{ vars\.VERCEL_ORG_ID \}\}/);
  assert.match(frontend, /VERCEL_PROJECT_ID: \$\{\{ vars\.VERCEL_PROJECT_ID \}\}/);
  assert.doesNotMatch(frontend, /secrets\.VERCEL_(ORG|PROJECT)_ID/);
});

test("the frontend refuses Vercel IDs other than the proper-respect project's", () => {
  const frontend = releaseWorkflow().slice(releaseWorkflow().indexOf("\n  frontend:"));
  // A missing environment variable falls back to a repository or org one, so
  // non-empty isn't enough: the IDs must be exactly K02's.
  assert.match(frontend, /expected_org='team_MfB5K2Npy5oy5SFJ2g9nbL5W'/);
  assert.match(frontend, /expected_project='prj_yxsUnnPW0ka8mkFr7l66eUSzJgT8'/);
  assert.match(frontend, /\[ "\$VERCEL_ORG_ID" != "\$expected_org" \]/);
  assert.match(frontend, /\[ "\$VERCEL_PROJECT_ID" != "\$expected_project" \]/);
});

test("the deployment URL pattern accepts only a valid vercel.app hostname", () => {
  const pattern = new RegExp(workflowPattern(releaseWorkflow(), "url_pattern"));
  assert.ok(pattern.test("https://proper-respect-abc123-team.vercel.app"));
  for (const bad of ["https://-foo.vercel.app", "https://foo-.vercel.app", "https://evil.com/.vercel.app",
    "https://foo.vercel.app/", "http://foo.vercel.app", "https://Foo.vercel.app", "https://.vercel.app"]) {
    assert.equal(pattern.test(bad), false, bad);
  }
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
