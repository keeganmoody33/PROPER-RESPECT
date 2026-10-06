import { toSnapshot, type TallyCategory, type TallySnapshot } from "@/src/server/request-tally";

/**
 * Running totals for the footer tally in Upstash Redis, over its REST API.
 * Production writes `pr:tally:v1`; every other environment writes
 * `pr:preview:tally:v1`. The synthetic public fixture disables the store.
 * The store holds category counts and a start timestamp: no IPs, paths or user agents.
 */
type Env = Record<string, string | undefined>;

function config(env: Env = process.env) {
  if (env.PROPER_RESPECT_E2E_REFERENCE === "1") return null;
  const url = (env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL)?.trim();
  const token = (env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN)?.trim();
  if (!url || !token) return null;
  const prefix = env.VERCEL_ENV === "production" ? "pr:" : "pr:preview:";
  return { url: url.replace(/\/+$/, ""), token, counts: `${prefix}tally:v1`, since: `${prefix}tally:v1:since` };
}

async function pipeline(commands: unknown[][], env?: Env): Promise<unknown[] | null> {
  const c = config(env);
  if (!c) return null;
  const response = await fetch(`${c.url}/pipeline`, {
    method: "POST",
    headers: { authorization: `Bearer ${c.token}`, "content-type": "application/json" },
    body: JSON.stringify(commands.map(cmd => cmd.map(part => (part === "$counts" ? c.counts : part === "$since" ? c.since : part)))),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`tally store ${response.status}`);
  const results = (await response.json()) as Array<{ result?: unknown; error?: string }>;
  const failed = results.find(r => r.error);
  if (failed) throw new Error(`tally store command failed: ${failed.error}`);
  return results.map(r => r.result);
}

/** Adds one page request to the running total. Never throws: counting must not break a page. */
export async function recordHit(category: TallyCategory, env?: Env): Promise<void> {
  try {
    await pipeline([["HINCRBY", "$counts", category, 1], ["SETNX", "$since", new Date().toISOString()]], env);
  } catch {
    return;
  }
}

export async function readTally(env?: Env): Promise<TallySnapshot | null> {
  const results = await pipeline([["HGETALL", "$counts"], ["GET", "$since"]], env);
  if (!results) return null;
  const flat = Array.isArray(results[0]) ? (results[0] as unknown[]) : [];
  const raw: Record<string, unknown> = {};
  for (let i = 0; i + 1 < flat.length; i += 2) raw[String(flat[i])] = flat[i + 1];
  return toSnapshot(raw, typeof results[1] === "string" ? results[1] : null);
}
