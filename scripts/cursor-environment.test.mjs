import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("the actual cloud entry point isolates its fixture from inherited configuration", () => {
  const root = mkdtempSync(join(tmpdir(), "proper-respect-cursor-"));
  try {
    mkdirSync(join(root, ".cursor"));
    copyFileSync(".cursor/start-fixture.mjs", join(root, ".cursor/start-fixture.mjs"));
    const next = join(root, "node_modules/next/dist/bin");
    mkdirSync(next, { recursive: true });
    const capture = join(root, "capture.json");
    writeFileSync(join(next, "next"), `require("node:fs").writeFileSync(${JSON.stringify(capture)}, JSON.stringify({args:process.argv.slice(2),env:process.env}));`);
    const local = "NEXT_PUBLIC_CONVEX_URL=https://poison.example\nCLERK_SECRET_KEY=synthetic-poison\nNEW_SERVICE_TOKEN=synthetic-local\nNEXT_PUBLIC_POSTHOG_KEY=synthetic-poison\n";
    writeFileSync(join(root, ".env.local"), local);
    const result = spawnSync(process.execPath, [join(root, ".cursor/start-fixture.mjs")], {
      encoding: "utf8", timeout: 10_000,
      env: { PATH: process.env.PATH, PROPER_RESPECT_FIXTURE_PORT: "3037",
        CONVEX_DEPLOY_KEY: "synthetic-poison", CONVEX_DEPLOYMENT: "prod:synthetic-poison",
        CONVEX_SELF_HOSTED_URL: "https://poison.example", CONVEX_SELF_HOSTED_ADMIN_KEY: "synthetic-poison",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "synthetic-poison", CLERK_SECRET_KEY: "synthetic-poison",
        NEXT_PUBLIC_CONVEX_URL: "https://poison.example", NEXT_PUBLIC_POSTHOG_KEY: "synthetic-poison",
        VERCEL_TOKEN: "synthetic-poison", GITHUB_TOKEN: "synthetic-poison" },
    });
    assert.equal(result.status, 0, result.stderr);
    const child = JSON.parse(readFileSync(capture, "utf8"));
    assert.deepEqual(child.args, ["dev", "--hostname", "127.0.0.1", "--port", "3037"]);
    for (const key of ["NEXT_PUBLIC_CONVEX_URL", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY",
      "NEXT_PUBLIC_POSTHOG_KEY", "CONVEX_DEPLOY_KEY", "CONVEX_DEPLOYMENT", "CONVEX_SELF_HOSTED_URL",
      "CONVEX_SELF_HOSTED_ADMIN_KEY", "NEW_SERVICE_TOKEN"]) assert.equal(child.env[key], "", key);
    assert.equal(child.env.VERCEL_TOKEN, undefined);
    assert.equal(child.env.GITHUB_TOKEN, undefined);
    assert.equal(child.env.PROPER_RESPECT_E2E_REFERENCE, "1");
    assert.equal(child.env.PUBLIC_SITE_ORIGIN, "https://public.example");
    assert.equal(child.env.NEXT_TELEMETRY_DISABLED, "1");
    assert.equal(readFileSync(join(root, ".env.local"), "utf8"), local);
    assert.equal(existsSync(join(root, ".convex")), false);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /synthetic-poison|synthetic-local/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
