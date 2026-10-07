import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { open, rename, unlink, lstat, realpath } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { digest, digestSchema, grantScopeSchema, secretSchema, usagePacketSchema, packetId, numericEvidenceSchema,
  type GrantScope, type UsagePacket } from "../domain/usage-sync.ts";
import { canonicalJson } from "../domain/canonical-json.ts";
import { collectCodexRolloutHistory } from "./codex-history-collector.ts";
import { readNativeCodexPage } from "./codex-native-reader.ts";
import { devicePrivateKeySchema, deviceDigest, devicePublicKey } from "../domain/device-proof.ts";
import { createDeviceKey } from "./device-signature.ts";

export const stateSchema = z.strictObject({ version: z.literal(1), privateKey: devicePrivateKeySchema, sourceKey: digestSchema, sourceSalt: secretSchema,
  directory: z.string().startsWith("/").max(4096), grantId: z.string().nullable(), scope: grantScopeSchema.nullable(),
  sequence: z.number().int().nonnegative(), pending: z.array(usagePacketSchema).max(400),
});
export type CompanionState = z.infer<typeof stateSchema>;
export type SyncTransport = {
  status: () => Promise<{ scope: GrantScope; sequence: number }>;
  send: (packet: UsagePacket) => Promise<{ packetId: string; sequence: number }>;
};
export function createCompanionState(directory: string): CompanionState {
  const sourceSalt = randomBytes(32).toString("hex");
  return stateSchema.parse({ version: 1, privateKey: createDeviceKey(), sourceKey: digest(`codex-source\0${sourceSalt}\0${directory}`), sourceSalt,
    directory, grantId: null, scope: null, sequence: 0, pending: [] });
}

/** Explicit private state location. Atomic write + fsync before any network send. */
export async function saveCompanionState(path: string, state: CompanionState) {
  const parent = dirname(resolve(path));
  const stat = await lstat(parent);
  if (!stat.isDirectory() || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.() || await realpath(parent) !== parent) throw new Error("Use a private state directory with mode 0700.");
  const temporary = `${path}.${randomBytes(12).toString("hex")}.pending`;
  const serialized = canonicalJson(stateSchema.parse(state));
  if (Buffer.byteLength(serialized) > 40 * 1024 * 1024) throw new Error("Private pending state exceeds its safety limit.");
  try {
    const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { await handle.writeFile(serialized); await handle.sync(); } finally { await handle.close(); }
    await rename(temporary, path);
    const directory = await open(parent, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try { await directory.sync(); } finally { await directory.close(); }
  } finally { await unlink(temporary).catch(() => undefined); }
}
export async function loadCompanionState(path: string): Promise<CompanionState> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 40 * 1024 * 1024 || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.()) throw new Error("Unsafe state file.");
    return stateSchema.parse(JSON.parse(await handle.readFile("utf8")));
  } finally { await handle.close(); }
}

export async function syncCompanion(input: { state: CompanionState; save: (state: CompanionState) => Promise<void>;
  transport: SyncTransport; signal: AbortSignal; now?: () => number;
  read?: typeof readNativeCodexPage }): Promise<CompanionState> {
  let state = stateSchema.parse(input.state);
  const now = input.now ?? Date.now;
  const check = async () => {
    if (input.signal.aborted || !state.grantId || !state.scope || now() >= Date.parse(state.scope.expiresAt)) throw new Error("Approval expired or disconnected.");
    const remote = await input.transport.status();
    if (canonicalJson(remote.scope) !== canonicalJson(state.scope) || state.scope.deviceDigest !== deviceDigest(devicePublicKey(state.privateKey))
      || state.sourceKey !== digest(`codex-source\0${state.sourceSalt}\0${state.directory}`)
      || state.scope.sourceKey !== state.sourceKey) throw new Error("Approval changed.");
    if (input.signal.aborted) throw new Error("Disconnected.");
    return remote;
  };
  const flush = async () => {
    while (state.pending.length) {
      await check();
      const packet = state.pending[0];
      const ack = await input.transport.send(packet);
      if (input.signal.aborted || ack.packetId !== packetId(packet) || ack.sequence !== packet.sequence) throw new Error("Acknowledgment could not be verified.");
      const next = { ...state, sequence: packet.sequence, pending: state.pending.slice(1) };
      await input.save(next); state = next;
    }
  };
  await check();
  await flush();
  const remote = await check();
  if (remote.sequence !== state.sequence) throw new Error("Checkpoint requires recovery.");
  const scope = state.scope;
  if (!scope) throw new Error("Approval required.");
  const end = Math.min(Date.parse(scope.end), now());
  let fileOffset: number | null = 0;
  while (fileOffset !== null) {
    await check();
    const remaining = Math.min(5000, Date.parse(scope.expiresAt) - now());
    if (remaining <= 0) throw new Error("Approval expired.");
    const signal = AbortSignal.any([input.signal, AbortSignal.timeout(Math.ceil(remaining))]);
    const directory = await (input.read ?? readNativeCodexPage)({ directory: state.directory, signal, offset: fileOffset });
    await check();
    for (let start = Date.parse(scope.start); start < end; start += 7 * 86400_000) {
      const packets: UsagePacket[] = [];
      const window = { start: new Date(start).toISOString(), end: new Date(Math.min(end, start + 7 * 86400_000)).toISOString() };
      const history = collectCodexRolloutHistory({ window, signal: input.signal }, directory.files);
      const rows = [...history.responses.rows.map(row => ({ ...row, kind: "response" })), ...history.legacy.rows.map(row => ({ ...row, kind: "legacy" }))]
        .map(row => numericEvidenceSchema.parse(row));
      for (let offset = 0; offset < Math.max(1, rows.length); offset += 200) packets.push(usagePacketSchema.parse({
        version: "proper-respect-codex-sync-v1", sourceKey: state.sourceKey, sequence: state.sequence + packets.length + 1,
        ...window, coverage: "partial", rows: rows.slice(offset, offset + 200),
      }));
      await check();
      const pending = stateSchema.parse({ ...state, pending: packets });
      await input.save(pending); state = pending;
      await flush();
    }
    fileOffset = directory.nextOffset;
  }
  return state;
}
