import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.platform !== "darwin" || !process.version.startsWith("v24.")) {
  process.stderr.write("Run this synthetic platform check on macOS with Node 24. No history was read.\n");
  process.exit(1);
}
const root = fileURLToPath(new URL("../", import.meta.url));
const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
if (head.status !== 0 || !/^[a-f0-9]{40}\n$/.test(head.stdout)) process.exit(1);
process.stdout.write(`Synthetic Mac check: ${head.stdout.trim()} · ${process.platform} · ${process.arch} · ${process.version}\n`);
const build = spawnSync(process.execPath, ["scripts/build-codex-reader.mjs"], { cwd: root, stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);
const tests = [
  "convex/usageConnections.test.ts", "src/local/codex-native-reader.test.ts", "src/local/codex-native-races.test.ts",
  "src/local/codex-stream-reader.test.ts",
  "src/local/codex-history-windows.test.ts",
  "src/local/companion-lock.test.ts", "src/local/codex-companion.test.ts", "src/local/codex-sync-loop.test.ts",
  "tests/support/codex-companion-cli.test.ts", "src/local/codex-rollout-native.test.ts",
  "tests/support/codex-convex-backfill.test.ts",
  "src/local/codex-rollout-history.test.ts", "tests/support/codex-history-cli.test.ts",
  "src/domain/collector-contract.test.ts", "src/local/collector-companion.test.ts", "src/local/collector-service.test.ts",
];
const result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", ...tests, "--maxWorkers=2"], { cwd: root, stdio: "inherit" });
process.exitCode = result.status ?? 1;
