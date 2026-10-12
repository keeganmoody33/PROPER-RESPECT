import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { constants } from "node:fs";
import { appendFile, copyFile, lstat, mkdir, open, readFile, readdir, rename, rm, writeFile, type FileHandle } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { z } from "zod";
import { CODEX_METRICS, CURSOR_METRICS } from "../domain/collector-contract.ts";
import { CollectorCompanion } from "./collector-companion.ts";
import { CollectorService } from "./collector-service.ts";
import { openCollectorPrivateStore } from "./collector-private-store.ts";
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
const CODEX_SOURCE_FILES = [
  "sessions/2026/10/02/rollout-fixture-modern.jsonl",
  "sessions/2026/10/02/rollout-fixture-legacy.jsonl",
  "archived_sessions/rollout-fixture-modern-copy.jsonl",
];
const CODEX_RECORD_TYPES = new Set(["session_meta", "response_item", "token_usage_record", "event_msg", "compacted", "turn_context"]);
const noFollowFile = constants.O_RDONLY | constants.O_NOFOLLOW;
const noFollowDirectory = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW;

function isNodeError(error: unknown, code: string) {
  return error instanceof Error && "code" in error && error.code === code;
}

const bootstraps = new Map<string, Promise<void>>();
const invalidFixture = () => new Error("Synthetic fixture content is incomplete or invalid.");

// Node has no openat API. Linux descriptor paths keep each lookup attached to
// the already-open parent so O_NOFOLLOW applies to every component, not only the leaf.
function descriptorPath(handle: FileHandle, name: string): string {
  return `/proc/self/fd/${handle.fd}/${name}`;
}

async function withHandle<T>(path: string, flags: number, operation: (handle: FileHandle) => Promise<T>): Promise<T> {
  if (!isAbsolute(path) || path.includes("\0") || path.length > 4096) throw invalidFixture();
  const components = path.split("/").filter(component => component !== "");
  if (components.length === 0 || components.some(component => component === "." || component === "..")) throw invalidFixture();
  const ancestors: FileHandle[] = [];
  let leaf: FileHandle | undefined;
  try {
    if (process.platform === "linux") {
      let parent = await open("/", noFollowDirectory);
      ancestors.push(parent);
      for (const [index, component] of components.entries()) {
        const child = await open(descriptorPath(parent, component), index === components.length - 1 ? flags : noFollowDirectory);
        if (index === components.length - 1) leaf = child;
        else {
          ancestors.push(child);
          parent = child;
        }
      }
    } else {
      let prefix = "";
      for (const [index, component] of components.entries()) {
        prefix += `/${component}`;
        const seen = await lstat(prefix);
        if (seen.isSymbolicLink() || index < components.length - 1 && !seen.isDirectory()) throw invalidFixture();
      }
      leaf = await open(path, flags);
    }
    if (!leaf) throw invalidFixture();
    return await operation(leaf);
  } catch (error) {
    if (isNodeError(error, "ELOOP") || isNodeError(error, "EISDIR") || isNodeError(error, "ENOTDIR")) throw invalidFixture();
    throw error;
  } finally {
    await leaf?.close();
    for (const handle of ancestors.reverse()) await handle.close().catch(() => undefined);
  }
}

async function readNoFollowFile(path: string): Promise<Buffer | null> {
  try {
    return await withHandle(path, noFollowFile, async handle => {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.nlink !== 1) throw invalidFixture();
      return handle.readFile();
    });
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return null;
    throw error;
  }
}

async function tightenPrivateMode(path: string, flags: number, mode: number): Promise<void> {
  await withHandle(path, flags, async handle => {
    const stat = await handle.stat();
    if ((stat.mode & 0o777) !== mode) await handle.chmod(mode);
  });
}

async function ensureFixtureDirectory(path: string) {
  try { await mkdir(path, { mode: 0o700 }); }
  catch (error) { if (!isNodeError(error, "EEXIST")) throw error; }
  await tightenPrivateMode(path, noFollowDirectory, 0o700);
}

function assertCompleteCodex(bytes: Buffer): void {
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw invalidFixture(); }
  if (!text.endsWith("\n")) throw invalidFixture();
  const lines = text.trimEnd().split("\n");
  if (lines.length === 0) throw invalidFixture();
  const records: { type: string }[] = [];
  for (const line of lines) {
    let row: unknown;
    try { row = JSON.parse(line); } catch { throw invalidFixture(); }
    if (!row || typeof row !== "object" || Array.isArray(row) || !("type" in row) || typeof row.type !== "string" || !CODEX_RECORD_TYPES.has(row.type)) throw invalidFixture();
    records.push({ type: row.type });
  }
  if (records[0]?.type !== "session_meta") throw invalidFixture();
  try { collectCodexRolloutHistory({ window, signal: new AbortController().signal }, [{ lines }]); }
  catch { throw invalidFixture(); }
}

function assertCompleteCursor(bytes: Buffer): void {
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw invalidFixture(); }
  if (!text.endsWith("\n")) throw invalidFixture();
  try { parseCursorCompleteReportCsv({ csv: text, reportId: "fixture-report", source: cursorSource, window, complete: true }); }
  catch { throw invalidFixture(); }
}

function inspectPresent(kind: "codex" | "cursor", present: Buffer | null, expected: Buffer): "keep" | "repair" {
  if (present === null) return "repair";
  if (present.length < expected.length && expected.subarray(0, present.length).equals(present)) return "repair";
  if (kind === "cursor") assertCompleteCursor(present); else assertCompleteCodex(present);
  return "keep";
}

async function writeStagedFile(input: { staged: string; expected: Buffer; source?: string }): Promise<void> {
  if (input.source) {
    await withHandle(input.source, noFollowFile, async handle => {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.nlink !== 1) throw invalidFixture();
    });
    await copyFile(input.source, input.staged, constants.COPYFILE_EXCL);
    await tightenPrivateMode(input.staged, noFollowFile, 0o600);
  } else await writeFile(input.staged, input.expected, { flag: "wx", mode: 0o600 });
  if (!(await readNoFollowFile(input.staged))?.equals(input.expected)) throw invalidFixture();
}

async function recoverInterruptedCodexTree(sourceDirectory: string): Promise<void> {
  const live = join(sourceDirectory, "codex");
  const leftovers = (await readdir(sourceDirectory)).filter(name => /^codex\.prev-[a-f0-9]{32}$/.test(name));
  const livePresent = await (async () => {
    try { await withHandle(live, noFollowDirectory, async () => undefined); return true; }
    catch (error) { if (isNodeError(error, "ENOENT")) return false; throw error; }
  })();
  if (!livePresent && leftovers.length === 1) {
    await rename(join(sourceDirectory, leftovers[0]!), live);
    return;
  }
  for (const name of leftovers) await rm(join(sourceDirectory, name), { recursive: true, force: true });
}

async function publishCodexTree(input: { staged: string; live: string; sourceDirectory: string }): Promise<void> {
  try {
    await withHandle(input.live, noFollowDirectory, async () => undefined);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) { await rename(input.staged, input.live); return; }
    throw error;
  }
  const prev = join(input.sourceDirectory, `codex.prev-${randomBytes(16).toString("hex")}`);
  await rename(input.live, prev);
  try { await rename(input.staged, input.live); }
  catch (error) {
    try { await rename(prev, input.live); } catch { /* Leave prev for the next bootstrap recovery. */ }
    throw error;
  }
  await rm(prev, { recursive: true, force: true });
}

async function initializeCollectorFixtureSources(input: { sourceDirectory: string; repository: string }) {
  await mkdir(input.sourceDirectory, { recursive: true, mode: 0o700 });
  // Reuse the fixture's owned/private/non-link store boundary and crash-released SQLite lock.
  const lock = openCollectorPrivateStore({ databasePath: join(input.sourceDirectory, "bootstrap.sqlite") });
  try {
    lock.exec("BEGIN IMMEDIATE");
    try {
      const stageDirectory = join(input.sourceDirectory, ".bootstrap-staging");
      await ensureFixtureDirectory(stageDirectory);
      await recoverInterruptedCodexTree(input.sourceDirectory);
      try { await withHandle(join(input.sourceDirectory, "codex"), noFollowDirectory, async () => undefined); }
      catch (error) { if (!isNodeError(error, "ENOENT")) throw error; }
      for (const file of await readdir(stageDirectory)) {
        if (/^(codex|cursor)-[a-f0-9]{32}$/.test(file)) {
          const leftover = await readNoFollowFile(join(stageDirectory, file));
          if (leftover === null) throw invalidFixture();
          await rm(join(stageDirectory, file), { force: true });
          continue;
        }
        if (!/^tree-[a-f0-9]{32}$/.test(file)) throw invalidFixture();
        await rm(join(stageDirectory, file), { recursive: true, force: true });
      }
      const planned: { relative: string; kind: "codex" | "cursor"; expected: Buffer; source?: string; action: "keep" | "repair"; present: Buffer | null }[] = [];
      for (const file of CODEX_SOURCE_FILES) {
        const source = join(input.repository, "tests/fixtures/codex-rollouts", file);
        const expected = await (async () => {
          const bytes = await readNoFollowFile(source);
          if (bytes === null) throw invalidFixture();
          return bytes;
        })();
        const target = join(input.sourceDirectory, "codex", file);
        const present = await readNoFollowFile(target);
        planned.push({ relative: file, kind: "codex", expected, source, action: inspectPresent("codex", present, expected), present });
      }
      const cursorExpected = Buffer.from(cursorCsv);
      const cursorPresent = await readNoFollowFile(join(input.sourceDirectory, "cursor.csv"));
      planned.push({ relative: "cursor.csv", kind: "cursor", expected: cursorExpected, action: inspectPresent("cursor", cursorPresent, cursorExpected), present: cursorPresent });
      if (planned.every(item => item.action === "keep")) {
        for (const item of planned) {
          const target = item.kind === "cursor" ? join(input.sourceDirectory, "cursor.csv") : join(input.sourceDirectory, "codex", item.relative);
          await tightenPrivateMode(target, noFollowFile, 0o600);
        }
        await tightenPrivateMode(join(input.sourceDirectory, "codex"), noFollowDirectory, 0o700);
        lock.exec("COMMIT");
        return;
      }
      const stagedRoot = join(stageDirectory, `tree-${randomBytes(16).toString("hex")}`);
      await ensureFixtureDirectory(stagedRoot);
      const stagedCodex = join(stagedRoot, "codex");
      await ensureFixtureDirectory(stagedCodex);
      try {
        for (const item of planned) {
          const bytes = item.action === "keep" && item.present ? item.present : item.expected;
          if (item.kind === "cursor") {
            await writeStagedFile({ staged: join(stagedRoot, "cursor.csv"), expected: bytes });
            continue;
          }
          let parent = stagedCodex;
          for (const part of item.relative.split("/").slice(0, -1)) {
            parent = join(parent, part);
            await ensureFixtureDirectory(parent);
          }
          await writeStagedFile({ staged: join(stagedCodex, item.relative), expected: bytes, source: item.action === "repair" ? item.source : undefined });
        }
        await publishCodexTree({ staged: stagedCodex, live: join(input.sourceDirectory, "codex"), sourceDirectory: input.sourceDirectory });
        const stagedCursor = join(stagedRoot, "cursor.csv");
        const liveCursor = join(input.sourceDirectory, "cursor.csv");
        await rename(stagedCursor, liveCursor);
        await tightenPrivateMode(liveCursor, noFollowFile, 0o600);
      } finally {
        await rm(stagedRoot, { recursive: true, force: true });
      }
      lock.exec("COMMIT");
    } catch (error) { lock.exec("ROLLBACK"); throw error; }
  } finally { lock.close(); }
}

/** Publish complete fixture files; a concurrent caller must wait for readiness. */
export function ensureCollectorFixtureSources(input: { sourceDirectory: string; repository: string }): Promise<void> {
  const previous = bootstraps.get(input.sourceDirectory) ?? Promise.resolve();
  const operation = previous.catch(() => undefined).then(() => initializeCollectorFixtureSources(input));
  bootstraps.set(input.sourceDirectory, operation);
  return operation.finally(() => { if (bootstraps.get(input.sourceDirectory) === operation) bootstraps.delete(input.sourceDirectory); });
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
