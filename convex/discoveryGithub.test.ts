// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
afterEach(() => vi.unstubAllGlobals());

test.each(["", "../repos", "owner/repos", "owner?x=y", "owner#fragment", "owner\\repos", "owner%2Frepos", " owner", "owner\n", "https://github.com/owner", "-owner", "owner-", "a".repeat(40)])("rejects malformed login %j before a request or ingestion", async (githubLogin) => {
  const t = convexTest(schema, modules);
  const http = vi.fn(async () => { throw new Error("Unexpected provider request"); });
  vi.stubGlobal("fetch", http);
  await expect(t.action(internal.discovery.syncGithub, { handle: "owner", githubLogin })).rejects.toThrow("Invalid GitHub login.");
  expect(http).not.toHaveBeenCalled();
  expect(await t.run(ctx => ctx.db.query("evidenceSources").collect())).toEqual([]);
});

test.each(["a", "Owner-123", "a".repeat(39)])("preserves valid login %s in the fixed-host request and retained label", async (githubLogin) => {
  const t = convexTest(schema, modules);
  await t.run(ctx => ctx.db.insert("users", { authSubject: "owner", handle: "owner", displayName: "Owner", bio: "" }));
  const http = vi.fn(async () => Response.json([]));
  vi.stubGlobal("fetch", http);
  const result = await t.action(internal.discovery.syncGithub, { handle: "owner", githubLogin });
  expect(result.ingestedSignals).toBe(0);
  expect(http).toHaveBeenCalledWith(`https://api.github.com/users/${githubLogin}/repos?sort=pushed&per_page=25`, { headers: { Accept: "application/vnd.github+json" } });
  expect((await t.run(ctx => ctx.db.query("evidenceSources").collect())).map(source => source.label)).toEqual([`github.com/${githubLogin}`]);
});
