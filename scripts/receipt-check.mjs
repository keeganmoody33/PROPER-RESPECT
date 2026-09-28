#!/usr/bin/env node
// The 30-day receipt's outside witness (R11, docs/runbooks/receipt.md). Reads
// the public profile the way any visitor's browser would, finds the GitHub
// contribution calendar card, and prints one JSON line. Exits 1 unless the
// card is FRESH and captured at most 36 hours ago.
//
// Usage: PUBLIC_CONVEX_URL=https://<deployment>.convex.cloud RECEIPT_HANDLE=<handle> \
//   node scripts/receipt-check.mjs

import { pathToFileURL } from "node:url";

const MAX_AGE_HOURS = 36;
// The same rule as handleSchema in src/domain/public-profile.ts.
const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/;

function baseLine({ handle, now, env }) {
  return {
    checkedAt: now.toISOString(),
    event: env.GITHUB_EVENT_NAME ?? null,
    runId: env.GITHUB_RUN_ID ?? null,
    sha: env.GITHUB_SHA ?? null,
    handle,
  };
}

function failure(context, reason) {
  return { ...baseLine(context), capturedAt: null, freshness: null, ageHours: null, ok: false, reason };
}

/** Judges one getByHandleV2 result. Pure, so the tests can pin every outcome. */
export function evaluateReceipt(profile, context) {
  if (profile === null || profile === undefined) return failure(context, "NOT_PUBLISHED");
  const card = (profile.cards ?? []).find(
    // The receipt is the owner's personal calendar: the refresh renews only
    // PERSONAL GitHub cards (convex/connectors.ts), so no other scope counts.
    candidate => candidate?.product?.slug === "github"
      && candidate?.activity?.kind === "contributionCalendar"
      && candidate?.activity?.attributionScope === "PERSONAL",
  );
  if (!card) return failure(context, "MISSING_CARD");
  const { capturedAt, freshness } = card.activity;
  const captured = Date.parse(capturedAt);
  const ageMs = Number.isNaN(captured) ? null : context.now.getTime() - captured;
  // The limit uses the exact age; rounding is only for the printed field. A
  // capture time in the future is as untrustworthy as a stale one.
  const ok = freshness === "FRESH" && ageMs !== null && ageMs >= 0 && ageMs <= MAX_AGE_HOURS * 3_600_000;
  const ageHours = ageMs === null ? null : Math.round((ageMs / 3_600_000) * 100) / 100;
  return { ...baseLine(context), capturedAt, freshness, ageHours, ok };
}

/** Runs one check and returns the exit code. Every path prints exactly one line. */
export async function checkReceipt({ env, now, query, print }) {
  const handle = env.RECEIPT_HANDLE ?? "";
  const context = { handle, now, env };
  let url;
  try {
    url = new URL(env.PUBLIC_CONVEX_URL ?? "");
  } catch {
    url = null;
  }
  if (url === null || url.protocol !== "https:" || !HANDLE_PATTERN.test(handle)) {
    print(JSON.stringify(failure(context, "BAD_CONFIGURATION")));
    return 1;
  }
  let line;
  try {
    line = evaluateReceipt(await query("publicProfiles:getByHandleV2", { handle }), context);
  } catch {
    // Provider text stays out of the public receipt; the run log has the detail.
    line = failure(context, "UNREACHABLE");
  }
  print(JSON.stringify(line));
  return line.ok ? 0 : 1;
}

async function main() {
  const [{ ConvexHttpClient }, { makeFunctionReference }] = await Promise.all([
    import("convex/browser"),
    import("convex/server"),
  ]);
  const code = await checkReceipt({
    env: process.env,
    now: new Date(),
    query: async (name, args) => {
      const client = new ConvexHttpClient(process.env.PUBLIC_CONVEX_URL);
      try {
        return await client.query(makeFunctionReference(name), args);
      } catch (error) {
        console.error(`Query failed: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    },
    print: line => console.log(line),
  });
  process.exitCode = code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
