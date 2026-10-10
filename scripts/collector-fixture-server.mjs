#!/usr/bin/env node
// Synthetic fixture service only. Never uses Clerk, Convex, a login or real history.
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === "--help") {
  process.stdout.write("Usage: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=ExperimentalWarning scripts/collector-fixture-server.mjs --directory /absolute/private/fixture-store --port 4188\nNode 24 and a C compiler required. Synthetic sources only. Loopback only. Store persists until explicitly removed.\n");
} else {
  let runtime;
  let timer;
  try {
    if (args.length !== 4 || args[0] !== "--directory" || args[2] !== "--port" || !/^\d{1,5}$/.test(args[3]) || Number(args[3]) < 1 || Number(args[3]) > 65535) throw new Error();
    const { startCollectorFixture } = await import("../src/local/collector-fixture.ts");
    runtime = await startCollectorFixture({ directory: args[1], repository: resolve(fileURLToPath(new URL("..", import.meta.url))), port: Number(args[3]) });
    process.stdout.write(`Synthetic durable fixture ready on port ${Number(args[3])}. No real provider data or hosted backend.\n`);
    let ticking = false;
    timer = setInterval(async () => { if (!ticking) { ticking = true; try { await runtime.tick(); } catch {} finally { ticking = false; } } }, 5000);
    const stop = async () => { clearInterval(timer); await runtime.close(); process.exitCode = 0; };
    process.once("SIGINT", stop); process.once("SIGTERM", stop);
  } catch {
    clearInterval(timer);
    await runtime?.close();
    process.stderr.write("Could not start the synthetic collector fixture. Check the documented private directory, compiler and port.\n");
    process.exitCode = 1;
  }
}
