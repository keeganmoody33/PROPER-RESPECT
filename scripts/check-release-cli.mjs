import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const manifest = JSON.parse(readFileSync("release-tools/package.json", "utf8"));
const lock = JSON.parse(readFileSync("release-tools/package-lock.json", "utf8"));
const version = manifest.dependencies.vercel;
assert.equal(lock.packages["node_modules/vercel"].version, version);
const executable = resolve("release-tools/node_modules/vercel/dist/vc.js");
const scratch = mkdtempSync(join(tmpdir(), "proper-respect-cli-"));

try {
  for (const mode of ["default", "javascript"]) {
    const environment = {
      PATH: process.env.PATH,
      CI: "1",
      NO_COLOR: "1",
      VERCEL_TELEMETRY_DISABLED: "1",
      XDG_CACHE_HOME: scratch,
      XDG_CONFIG_HOME: scratch,
      ...(mode === "javascript" ? { VERCEL_CLI_USE_NATIVE_BINARY: "0" } : {}),
    };
    const run = (args, expectedStatus = 0) => {
      const result = spawnSync(process.execPath, [executable, "--global-config", scratch, ...args], {
        cwd: scratch,
        env: environment,
        encoding: "utf8",
        timeout: 30_000,
      });
      assert.equal(result.status, expectedStatus, result.error?.message ?? result.stderr);
      return result;
    };
    assert.equal(run(["--version"]).stdout.trim(), version);
    const help = run(["deploy", "--help"], 2);
    for (const flag of ["--prod", "--yes", "--build-env", "--env", "--meta"]) {
      assert.ok(`${help.stdout}\n${help.stderr}`.includes(flag), `${mode}: missing ${flag}`);
    }
    console.log(`${mode}: Vercel ${version} starts and lists every release-used flag`);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
