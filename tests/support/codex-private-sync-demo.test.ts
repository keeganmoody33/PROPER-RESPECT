/// <reference types="vite/client" />
import { test, expect } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtemp, chmod, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import schema from "../../convex/schema";
import { createCompanionState, loadCompanionState, saveCompanionState, syncCompanion } from "../../src/local/codex-companion";
import { grantScopeSchema, packetId } from "../../src/domain/usage-sync";

import { deviceDigest, devicePublicKey } from "../../src/domain/device-proof";
import { signDeviceMessage } from "../../src/local/device-signature";

test("runnable shared UI, native acquisition, durable helper recovery and revocation", async () => {
  const root = await mkdtemp("/tmp/pr-sync-demo-"); await chmod(root, 0o700);
  const directory = join(root, "history"); await mkdir(directory);
  const statePath = join(root, "state.json"), file = join(directory, "rollout-fixture.jsonl");
  const counts = { input_tokens: 30, output_tokens: 10, cached_input_tokens: 0, reasoning_output_tokens: 0, total_tokens: 40 };
  const response = (id: string) => JSON.stringify({ type: "token_usage_record", timestamp: "2026-10-02T00:00:00.000Z", payload: { thread_id: "thread-fixture", response_id: id, usage: counts } });
  await writeFile(file, `${JSON.stringify({ type: "session_meta", payload: { id: "thread-fixture", cwd: "/SYNTHETIC_PRIVATE_PATH", instructions: "SYNTHETIC_PRIVATE_PROMPT" } })}\n${response("first")}\n`);
  await saveCompanionState(statePath, createCompanionState(directory));
  execFileSync(process.execPath, ["scripts/build-codex-reader.mjs"]);
  const priorDestination = process.env.CONVEX_CLOUD_URL; process.env.CONVEX_CLOUD_URL = "https://utmost-mongoose-374.convex.cloud";
  const t = convexTest(schema, import.meta.glob("../../convex/**/*.ts")), owner = t.withIdentity({ subject: "fixture-owner" });
  await t.run(ctx => ctx.db.insert("users", { authSubject: "fixture-owner", handle: "fixture-owner", displayName: "Synthetic owner", bio: "" }));
  const compiled = await build({ entryPoints: ["prototypes/codex-private-sync/entry.tsx"], bundle: true, write: false, outfile: "fixture.js", platform: "browser", format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' } });
  const js = compiled.outputFiles.find(file => file.path.endsWith(".js"))?.contents, css = compiled.outputFiles.find(file => file.path.endsWith(".css"))?.contents;
  const calls: string[] = [];
  const server = createServer(async (request, res) => {
    try {
      if (request.url === "/fixture.js") { res.setHeader("Content-Type", "application/javascript"); res.end(js); return; }
      if (request.url === "/fixture.css") { res.setHeader("Content-Type", "text/css"); res.end(css); return; }
      if (request.method === "GET") { res.setHeader("Content-Type", "text/html"); res.end('<!doctype html><html lang="en"><head><title>Synthetic Codex private sync</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><link rel="icon" href="data:,"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'); return; }
      let body = ""; for await (const chunk of request) { body += chunk; if (body.length > 8192) throw new Error(); }
      const args = JSON.parse(body), operation = request.url?.slice("/fixture/".length); let result: unknown;
      const state = await loadCompanionState(statePath);
      switch (operation) {
        case "identity": result = { sourceKey: state.sourceKey, deviceDigest: deviceDigest(devicePublicKey(state.privateKey)) }; break;
        case "list": result = await owner.query(makeFunctionReference<"query">("usageConnections:list"), {}); break;
        case "approve": result = await owner.mutation(makeFunctionReference<"mutation">("usageConnections:approve"), args); break;
        case "disconnect": result = await owner.mutation(makeFunctionReference<"mutation">("usageConnections:disconnect"), args); break;
        case "erase": result = await owner.mutation(makeFunctionReference<"mutation">("usageConnections:erase"), args); break;
        case "evidence": result = await owner.query(makeFunctionReference<"query">("usageConnections:evidence"), args); break;
        case "pair": {
          const paired = await t.mutation(makeFunctionReference<"mutation">("usageConnections:exchange"), { code: args.code, publicKeyJson: JSON.stringify(devicePublicKey(state.privateKey)), ...signDeviceMessage(state.privateKey, { operation: "pair", code: args.code }) });
          await saveCompanionState(statePath, { ...state, grantId: paired.grantId, scope: grantScopeSchema.parse(paired.scope), sequence: 0, pending: [] }); result = {}; break;
        }
        case "append": await writeFile(file, `${await readFile(file, "utf8")}${response("second")}\n`); result = {}; break;
        case "sync": {
          let loseAck = Boolean(args.loseAck);
          await syncCompanion({ state, save: next => saveCompanionState(statePath, next), signal: new AbortController().signal, transport: {
            status: () => t.query(makeFunctionReference<"query">("usageConnections:status"), { grantId: state.grantId, ...signDeviceMessage(state.privateKey, { operation: "status", grantId: state.grantId ?? "" }) }),
            send: async packet => {
              calls.push(JSON.stringify(packet));
              const ack = await t.mutation(makeFunctionReference<"mutation">("usageConnections:ingest"), { grantId: state.grantId, packetJson: JSON.stringify(packet), ...signDeviceMessage(state.privateKey, { operation: "ingest", grantId: state.grantId ?? "", packetId: packetId(packet) }) });
              if (loseAck) { loseAck = false; throw new Error("Lost synthetic ACK"); } return ack;
            },
          } }); result = {}; break;
        }
        default: throw new Error();
      }
      res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(result));
    } catch { res.statusCode = 400; res.end('{"error":"Fixture operation failed"}'); }
  });
  await new Promise<void>(resolve => server.listen(4179, "127.0.0.1", resolve));
  let browser;
  try {
    if (process.env.PROPER_RESPECT_SYNC_DEMO === "1") {
      process.stdout.write("Synthetic demo ready at http://127.0.0.1:4179. Only /tmp fixture history is read.\n");
      await new Promise<void>(resolve => { process.once("SIGTERM", resolve); process.once("SIGINT", resolve); });
      return;
    }
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? "/usr/bin/chromium", args: ["--no-sandbox"] });
    const artifacts = "docs/verification/2026-10-07-codex-mac-sync/screenshots"; await mkdir(artifacts, { recursive: true });
    for (const [name, width, height] of [["desktop", 1440, 1100], ["mobile", 390, 844]] as const) {
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage();
      if (name === "mobile") { await page.goto("http://127.0.0.1:4179"); await page.getByRole("button", { name: "View private usage" }).click(); await page.getByRole("table").waitFor(); await page.screenshot({ path: `${artifacts}/${name}.png`, fullPage: true }); expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]); await context.close(); continue; }
      await page.goto("http://127.0.0.1:4179");
      await page.getByLabel("Source identity", { exact: true }).fill(await page.getByTestId("fixture-source").innerText());
      await page.getByLabel("Device digest", { exact: true }).fill(await page.getByTestId("fixture-device").innerText());
      await page.getByLabel("History starts, UTC").fill("2026-10-01"); await page.getByLabel("Access expires", { exact: false }).fill("2026-10-15");
      await page.screenshot({ path: `${artifacts}/approval.png`, fullPage: true });
      await page.getByRole("button", { name: "Approve numeric history and pair" }).click();
      await page.locator(".pair-code").waitFor(); await page.getByLabel("Fixture pairing code").fill(await page.locator(".pair-code").innerText());
      await page.getByRole("button", { name: "Pair synthetic helper and backfill" }).click();
      await page.getByText("Synthetic backfill acknowledged.", { exact: true }).waitFor();
      await page.getByRole("button", { name: "View private usage" }).click(); await page.getByRole("table").waitFor();
      expect(await page.getByRole("row", { name: /total tokens/ }).innerText()).toContain("40");
      await page.getByRole("button", { name: "Lose next acknowledgment" }).click(); await page.getByText("Synthetic ACK lost. Pending packet remains on disk.", { exact: true }).waitFor();
      expect((await loadCompanionState(statePath)).pending.length).toBeGreaterThan(0);
      await page.getByRole("button", { name: "Restart helper and sync" }).click(); await page.getByText("Synthetic helper restarted from disk; sync acknowledged.", { exact: true }).waitFor();
      expect((await loadCompanionState(statePath)).pending).toEqual([]);
      await page.getByRole("button", { name: "Add synthetic response" }).click();
      await page.getByText("Synthetic response acknowledged.", { exact: true }).waitFor();
      await page.reload(); await page.getByRole("button", { name: "View private usage" }).click(); await page.getByRole("table").waitFor();
      expect(await page.getByRole("row", { name: /total tokens/ }).innerText()).toContain("80");
      await page.screenshot({ path: `${artifacts}/desktop.png`, fullPage: true });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await context.close();
    }
    const page = await browser.newPage(); await page.goto("http://127.0.0.1:4179");
    await page.getByRole("button", { name: "Disconnect", exact: true }).click();
    await page.getByText("Disconnected. Imported history remains private under your retention approval.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Restart helper and sync" }).click();
    await page.getByText("Synthetic sync rejected, including after revocation.", { exact: true }).waitFor();
    await page.screenshot({ path: `${artifacts}/revoked.png`, fullPage: true });
    expect(calls.join("\n")).not.toMatch(/SYNTHETIC_PRIVATE_|rollout-fixture|\/tmp\/|prompt|instructions|secret/);
  } finally {
    await browser?.close(); await new Promise<void>(resolve => server.close(() => resolve()));
    if (priorDestination === undefined) delete process.env.CONVEX_CLOUD_URL; else process.env.CONVEX_CLOUD_URL = priorDestination;
    await rm(root, { recursive: true, force: true });
  }
}, process.env.PROPER_RESPECT_SYNC_DEMO === "1" ? 24 * 60 * 60 * 1000 : 90_000);
