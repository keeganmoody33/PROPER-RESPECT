import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:http";
import { appendFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";

async function unusedPort() {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  await new Promise<void>(resolve => server.close(() => resolve()));
  if (!address || typeof address === "string") throw new Error("Temporary fixture port unavailable.");
  return address.port;
}
async function launch(directory: string) {
  const port = await unusedPort();
  const child = spawn(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--disable-warning=ExperimentalWarning", resolve("scripts/collector-fixture-server.mjs"), "--directory", directory, "--port", String(port)], { stdio: ["ignore", "pipe", "pipe"] });
  let diagnostics = "";
  child.stderr?.on("data", chunk => { diagnostics += chunk.toString(); });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("Fixture readiness timed out.")); }, 15000);
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("exit", () => { clearTimeout(timer); reject(new Error("Fixture exited before readiness.")); });
    child.stdout?.on("data", chunk => { if (chunk.toString().includes("Synthetic durable fixture ready")) { clearTimeout(timer); resolve(); } });
  });
  expect(diagnostics).toBe("");
  const origin = `http://127.0.0.1:${port}`;
  const bootstrap = await fetch(origin);
  const cookie = bootstrap.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("Synthetic owner bootstrap failed.");
  return { child, origin, cookie, post: async (path: string, body: unknown) => {
    const response = await fetch(`${origin}${path}`, { method: "POST", headers: { "content-type": "application/json", cookie, origin }, body: JSON.stringify(body) });
    expect(response.status).toBe(200); return response.json();
  }, state: async () => {
    const response = await fetch(`${origin}/fixture/state`, { headers: { cookie } });
    expect(response.status).toBe(200); return response.json();
  } };
}
async function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("Fixture did not stop cleanly.")); }, 5000);
    child.once("exit", (code, signal) => { clearTimeout(timer); if (code === 0 && signal === null) resolve(); else reject(new Error("Fixture exit failed.")); });
    child.kill("SIGTERM");
  });
}

it("keeps pairing, updates, private history and revocation across actual Node process restarts", async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "collector-process-")));
  let running: Awaited<ReturnType<typeof launch>> | undefined;
  try {
    running = await launch(directory);
    const pairing = await running.post("/fixture/connect", { provider: "codex", context: "PERSONAL" });
    const claimed = await running.post("/fixture/approve", { pairingId: pairing.pairingId });
    await running.post("/fixture/sync", claimed);
    expect((await running.state()).connections[0].metrics.modernTotalTokens).toBe("30");
    await stop(running.child);
    await appendFile(join(directory, "synthetic-sources/codex/sessions/2026/10/02/rollout-fixture-modern.jsonl"), JSON.stringify({
      timestamp: "2026-10-04T00:00:00.000Z", type: "token_usage_record", payload: {
        thread_id: "11111111-1111-4111-8111-111111111111", response_id: "fixture-background-response",
        usage: { input_tokens: 55, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: 55 },
      },
    }) + "\n");
    running = await launch(directory);
    const reopened = running;
    await expect.poll(async () => (await reopened.state()).connections[0].metrics.modernTotalTokens, { timeout: 8000, interval: 100 }).toBe("85");
    await running.post("/fixture/update", claimed);
    expect((await running.state()).connections[0].metrics.modernTotalTokens).toBe("125");
    await running.post("/fixture/disconnect", claimed);
    await stop(running.child); running = await launch(directory);
    const retained = (await running.state()).connections[0];
    expect(retained.status).toBe("REVOKED"); expect(retained.metrics.modernTotalTokens).toBe("125");
    const response = await fetch(`${running.origin}/fixture/sync`, { method: "POST", headers: { "content-type": "application/json", cookie: running.cookie, origin: running.origin }, body: JSON.stringify(claimed) });
    expect(response.status).toBe(400);
  } finally { if (running) await stop(running.child); await rm(directory, { recursive: true, force: true }); }
}, 30000);

it("exits cleanly after a failed companion initialization instead of leaking its listener", async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "collector-startup-failure-")));
  await mkdir(join(directory, "companion"), { mode: 0o700 });
  const original = join(directory, "companion/private.sqlite");
  await writeFile(original, "SYNTHETIC_INVALID_SQLITE", { mode: 0o600 });
  execFileSync(process.execPath, [resolve("scripts/build-codex-rollout-reader.mjs"), "--output", join(directory, "reader")]);
  const port = await unusedPort();
  const child = spawn(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--disable-warning=ExperimentalWarning", resolve("scripts/collector-fixture-server.mjs"), "--directory", directory, "--port", String(port)], { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  child.stdout?.on("data", chunk => { stdout += chunk.toString(); });
  child.stderr?.on("data", chunk => { stderr += chunk.toString(); });
  try {
    await expect(new Promise<number | null>((resolve, reject) => {
      const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("Failed startup kept its listener alive.")); }, 5000);
      child.once("exit", code => { clearTimeout(timer); resolve(code); });
    })).resolves.toBe(1);
    expect(stdout).toBe(""); expect(stderr).not.toContain(directory); expect(stderr).not.toContain("SYNTHETIC_INVALID_SQLITE");
    expect(stderr).toContain("Could not start the synthetic collector fixture");
    expect(await readFile(original, "utf8")).toBe("SYNTHETIC_INVALID_SQLITE");
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await rm(directory, { recursive: true, force: true });
  }
}, 15000);
