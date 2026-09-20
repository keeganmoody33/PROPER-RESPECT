import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const require = createRequire(import.meta.url);
// Use Convex's own bundler dependency to exercise its non-Node runtime boundary.
const { build } = createRequire(require.resolve("convex/server"))("esbuild");

it("bundles retained mailbox mutations without Node-only provider dependencies", async () => {
  await expect(build({
    entryPoints: [fileURLToPath(new URL("../../convex/mailboxDiscovery.ts", import.meta.url))],
    bundle: true,
    platform: "browser",
    format: "esm",
    write: false,
    logLevel: "silent",
  })).resolves.toBeDefined();
});
