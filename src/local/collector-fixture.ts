import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFile, cp, lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { z } from "zod";
import { CODEX_METRICS, CURSOR_METRICS } from "../domain/collector-contract.ts";
import { CollectorCompanion } from "./collector-companion.ts";
import { CollectorService } from "./collector-service.ts";
import { createCollectorFixtureTransport, startCollectorFixtureHttp } from "./collector-fixture-http.ts";
import { collectCodexRolloutHistory } from "./codex-history-collector.ts";
import { readCodexRolloutDirectoryNative } from "./codex-rollout-native.ts";
import { parseCursorCompleteReportCsv } from "./cursor-report-adapter.ts";

const owner = { issuer: "https://fixture-auth.invalid", subject: "synthetic-owner" };
const window = { start: "2026-10-01T00:00:00.000Z", end: "2026-10-08T00:00:00.000Z" };
const idSchema = z.strictObject({ connectionId: z.string().min(1).max(128) });
const connectSchema = z.strictObject({ provider: z.enum(["codex", "cursor"]), context: z.enum(["PERSONAL", "WORK"]) });
const cursorSource = { provider: "cursor", kind: "owner-supplied-report", accountAlias: null, sample: "unknown" } as const;
const cursorCsv = "timestamp,model,requests,input_tokens,cached_input_tokens,output_tokens,total_tokens,usage_cost_usd\n2026-10-02T12:00:00.000Z,SYNTHETIC_PRIVATE_MODEL,2,80,20,20,100,0.0125\n";
const CODEX_SOURCE_MARKER = "sessions/2026/10/02/rollout-fixture-modern.jsonl";

function isNodeError(error: unknown, code: string) {
  return error instanceof Error && "code" in error && error.code === code;
}
async function isRegularFile(path: string) {
  try {
    const stat = await lstat(path);
    return stat.isFile() && !stat.isSymbolicLink();
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return false;
    throw error;
  }
}

/** Completes missing Codex and Cursor artifacts independently so a partial first start can recover. */
export async function ensureCollectorFixtureSources(input: { sourceDirectory: string; repository: string }) {
  await mkdir(input.sourceDirectory, { recursive: true, mode: 0o700 });
  const codexDirectory = join(input.sourceDirectory, "codex");
  const codexMarker = join(codexDirectory, CODEX_SOURCE_MARKER);
  if (!await isRegularFile(codexMarker)) {
    await cp(join(input.repository, "tests/fixtures/codex-rollouts"), codexDirectory, { recursive: true, force: true });
  }
  const cursorPath = join(input.sourceDirectory, "cursor.csv");
  if (!await isRegularFile(cursorPath)) {
    try { await writeFile(cursorPath, cursorCsv, { flag: "wx", mode: 0o600 }); }
    catch (error) { if (!isNodeError(error, "EEXIST")) throw error; }
  }
  if (!await isRegularFile(codexMarker) || !await isRegularFile(cursorPath)) throw new Error("Synthetic fixture sources are incomplete.");
}

const sum = (values: (string | null)[]) => values.length === 0 || values.some(value => value === null) ? null : String(values.reduce((total, value) => total + BigInt(value ?? "0"), BigInt(0)));
function sumDecimals(values: (string | null)[]) {
  if (values.length === 0 || values.some(value => value === null)) return null;
  const scale = 18;
  const total = values.reduce((total, value) => {
    const [whole, fraction = ""] = (value ?? "0").split(".");
    return total + BigInt(whole + fraction.padEnd(scale, "0"));
  }, BigInt(0));
  const text = total.toString().padStart(scale + 1, "0");
  return `${text.slice(0, -scale)}.${text.slice(-scale)}`.replace(/0+$/, "").replace(/\.$/, "");
}

/** Creates and scans only checked-in synthetic sources, never a caller's Codex directory. */
export async function startCollectorFixture(input: { directory: string; repository: string; port?: number }) {
  if (!isAbsolute(input.directory) || !isAbsolute(input.repository)) throw new Error("Explicit absolute fixture directories are required.");
  await mkdir(input.directory, { recursive: true, mode: 0o700 });
  const privateDirectory = await lstat(input.directory);
  if (!privateDirectory.isDirectory() || privateDirectory.isSymbolicLink() || (privateDirectory.mode & 0o077) !== 0 || process.getuid && privateDirectory.uid !== process.getuid()) throw new Error("The fixture needs a private owned directory.");
  const source = join(input.directory, "synthetic-sources");
  await ensureCollectorFixtureSources({ sourceDirectory: source, repository: input.repository });
  const reader = join(input.directory, "reader");
  try { await lstat(reader); } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
    execFileSync(process.execPath, [join(input.repository, "scripts/build-codex-rollout-reader.mjs"), "--output", reader], { stdio: "pipe", timeout: 30_000 });
  }
  const servicePath = join(input.directory, "receiver", "private.sqlite");
  const companionPath = join(input.directory, "companion", "private.sqlite");
  let service = new CollectorService({ databasePath: servicePath });
  let companion: CollectorCompanion | null = null;
  let restartVerified = false;
  let closed = false;
  let operation: Promise<unknown> = Promise.resolve();
  const pairings = new Map<string, string>();
  const companionInstance = () => { if (!companion || closed) throw new Error("Fixture companion unavailable."); return companion; };
  const state = async () => {
    const connections = await service.listConnections({ owner });
    return { fixture: true, persistence: { kind: "sqlite", restartVerified }, connections: await Promise.all(connections.map(async ({ grant, state, expired }) => {
      const history = await service.privateHistory({ owner, connectionId: grant.connectionId });
      const cursor = history.cursorViews.find(review => review.window.start === grant.window.start && review.window.end === grant.window.end);
      const legacy = history.legacyViews.find(review => review.window.start === grant.window.start && review.window.end === grant.window.end);
      return { id: grant.connectionId, provider: grant.descriptor.provider, context: grant.descriptor.context,
        status: state === "REVOKED" ? "REVOKED" : expired ? "EXPIRED" : "ACTIVE", window: grant.window,
        identity: "UNVERIFIED", coverage: "partial", sample: "synthetic", checkpoint: history.checkpoint,
        receiptCount: history.receiptCount, lastSyncedAt: history.lastReceipt?.committedAt ?? null,
        metrics: { modernTotalTokens: grant.descriptor.provider === "codex" ? history.responses.totals.find(row => row.metric === "total_tokens")?.value ?? null : null,
          legacyObservedIncrease: legacy?.legacy.totals.find(row => row.metric === "total_tokens")?.value ?? null,
          cursorTokens: cursor ? sum(cursor.rows.filter(row => row.metric === "total_tokens").map(row => row.value)) : null,
          cursorRequests: cursor ? sum(cursor.rows.filter(row => row.metric === "requests").map(row => row.value)) : null,
          cursorSourceCostUsd: cursor ? sumDecimals(cursor.rows.filter(row => row.metric === "usage_cost_usd").map(row => row.value)) : null },
      };
    })) };
  };
  const sync = (connectionId: string) => companionInstance().sync({ connectionId, collect: async (grant, signal) => {
    if (grant.descriptor.sample !== "synthetic") throw new Error("Only synthetic fixture collection is enabled.");
    if (grant.descriptor.provider === "codex") {
      const scanned = await readCodexRolloutDirectoryNative({ directory: join(source, "codex"), executablePath: reader, signal });
      return collectCodexRolloutHistory({ window: grant.window, signal }, scanned.files);
    }
    return parseCursorCompleteReportCsv({ csv: await readFile(join(source, "cursor.csv"), "utf8"), reportId: "fixture-report", source: cursorSource, window: grant.window, complete: true });
  } });
  const action = (path: string, body: unknown) => {
    const result = operation.then(async () => {
      if (closed) throw new Error("Fixture closed.");
      switch (path) {
        case "/fixture/connect": {
          const { provider, context } = connectSchema.parse(body);
          const verifier = randomBytes(32).toString("hex");
          const sourceDescriptor = { sourceId: `fixture-${provider}-${context.toLowerCase()}`, deviceId: "fixture-device", collectorVersion: "fixture-v1", context, account: { kind: "UNKNOWN" }, sample: "synthetic" } as const;
          const descriptor = provider === "codex" ? { ...sourceDescriptor, provider, kind: "codex-local-history" as const } : { ...sourceDescriptor, provider, kind: "cursor-complete-export" as const };
          const pairing = await service.requestPairing({ descriptor, window, verifier });
          pairings.set(pairing.pairingId, verifier);
          return { ...pairing, provider, context, window, sample: "synthetic" };
        }
        case "/fixture/approve": {
          const { pairingId } = z.strictObject({ pairingId: z.string().uuid() }).parse(body);
          const verifier = pairings.get(pairingId); if (!verifier) throw new Error("Fixture pairing unavailable.");
          const request = await service.pairingRequest({ pairingId });
          await service.approvePairing({ pairingId, owner, expiresAt: new Date(Date.now() + 86400_000).toISOString(), allowedMetrics: [...(request.descriptor.provider === "codex" ? CODEX_METRICS : CURSOR_METRICS)] });
          const claimed = await service.claimPairing({ pairingId, verifier });
          companionInstance().connect(claimed); pairings.delete(pairingId);
          return { connectionId: claimed.grant.connectionId };
        }
        case "/fixture/sync": { const { connectionId } = idSchema.parse(body); await sync(connectionId); return state(); }
        case "/fixture/disconnect": {
          const { connectionId } = idSchema.parse(body);
          await service.disconnectOwner({ owner, connectionId }); companionInstance().disconnect({ connectionId });
          return state();
        }
        case "/fixture/restart": {
          z.strictObject({}).parse(body);
          companionInstance().close(); service.close();
          service = new CollectorService({ databasePath: servicePath });
          companion = new CollectorCompanion({ databasePath: companionPath, transport });
          restartVerified = true; pairings.clear(); return state();
        }
        case "/fixture/update": {
          const { connectionId } = idSchema.parse(body);
          const connection = (await service.listConnections({ owner })).find(item => item.grant.connectionId === connectionId);
          if (!connection || connection.state !== "ACTIVE" || connection.expired) throw new Error("Fixture connection unavailable.");
          if (connection.grant.descriptor.provider === "codex") {
            const file = join(source, "codex", "sessions/2026/10/02/rollout-fixture-modern.jsonl");
            const row = { timestamp: "2026-10-03T00:00:00.000Z", type: "token_usage_record", payload: { thread_id: "11111111-1111-4111-8111-111111111111", response_id: "fixture-new-response", usage: { input_tokens: 40, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: 40 } } };
            if (!(await readFile(file, "utf8")).includes("fixture-new-response")) await appendFile(file, JSON.stringify(row) + "\n");
          } else await writeFile(join(source, "cursor.csv"), cursorCsv + "2026-10-03T12:00:00.000Z,SYNTHETIC_PRIVATE_MODEL,1,40,0,10,50,0.0075\n", { mode: 0o600 });
          await sync(connectionId); return state();
        }
        default: throw new Error("Unknown fixture action.");
      }
    });
    operation = result.catch(() => undefined); return result;
  };
  const initialized = await (async () => {
    let http: Awaited<ReturnType<typeof startCollectorFixtureHttp>> | undefined;
    try {
      http = await startCollectorFixtureHttp({ service: () => service, owner, ownerToken: randomBytes(32).toString("hex"), port: input.port,
        assetsDirectory: join(input.repository, "prototypes/collector-connection"), action, state });
      const transport = createCollectorFixtureTransport({ origin: http.origin });
      companion = new CollectorCompanion({ databasePath: companionPath, transport });
      return { http, transport };
    } catch (error) {
      companion?.close(); service.close(); await http?.close(); throw error;
    }
  })();
  const { http, transport } = initialized;
  return { origin: http.origin, state,
    tick: () => {
      const result = operation.then(async () => {
      if (closed) throw new Error("Fixture closed.");
      for (const connection of await service.listConnections({ owner })) if (connection.state === "ACTIVE" && !connection.expired && connection.grant.descriptor.sample === "synthetic") {
        try { await sync(connection.grant.connectionId); } catch { /* Retry on the next fixture tick; no source or credential diagnostics. */ }
      }
      });
      operation = result.catch(() => undefined); return result;
    },
    close: async () => { await operation; closed = true; await http.close(); companion?.close(); service.close(); },
  };
}
