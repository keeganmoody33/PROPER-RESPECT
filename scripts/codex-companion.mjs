import { makeFunctionReference } from "convex/server";
import { unlink, open } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { createCompanionState, loadCompanionState, saveCompanionState, syncCompanion } from "../src/local/codex-companion.ts";
import { grantScopeSchema, packetId } from "../src/domain/usage-sync.ts";
import { deviceDigest, devicePublicKey } from "../src/domain/device-proof.ts";
import { signDeviceMessage } from "../src/local/device-signature.ts";
import { acquireCompanionLock } from "../src/local/companion-lock.ts";
import { createCodexDevelopmentClient } from "../src/local/codex-development-client.ts";
import { watchCompanion } from "../src/local/codex-sync-loop.ts";

const destination = "https://utmost-mongoose-374.convex.cloud";
const [command, stateArgument, directoryArgument] = process.argv.slice(2);
if (!["prepare", "identity", "pair", "sync", "watch", "forget"].includes(command) || !stateArgument) {
  process.stderr.write("Usage: node --experimental-strip-types scripts/codex-companion.mjs prepare|identity|pair|sync|watch|forget /absolute/private/state.json [approved-directory]\n");
  process.exit(1);
}
const statePath = resolve(stateArgument), lockPath = `${statePath}.lock`;
let lock;
const controller = new AbortController();
process.on("SIGINT", () => controller.abort()); process.on("SIGTERM", () => controller.abort());
try {
  lock = await acquireCompanionLock(lockPath);
  if (command === "prepare") {
    if (!directoryArgument) throw new Error();
    const state = createCompanionState(directoryArgument);
    // Never overwrite an existing device identity.
    const empty = await open(statePath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
    await empty.close();
    await saveCompanionState(statePath, state);
    process.stdout.write(`Destination ${destination}\nSource ${state.sourceKey}\nDevice digest ${deviceDigest(devicePublicKey(state.privateKey))}\nNo history has been read. Approve these identities in /app/connections.\n`);
  } else if (command === "forget") {
    await unlink(statePath);
    process.stdout.write("Local capability removed. Disconnect in the app to revoke the server grant.\n");
  } else {
    const client = createCodexDevelopmentClient(controller.signal);
    let state = await loadCompanionState(statePath);
    if (command === "identity") {
      process.stdout.write(`Destination ${destination}\nSource ${state.sourceKey}\nDevice digest ${deviceDigest(devicePublicKey(state.privateKey))}\n`);
    } else if (command === "pair") {
      const prompt = createInterface({ input: process.stdin, output: process.stdout });
      const code = await prompt.question("One-use pairing code from the approved development app: "); prompt.close();
      const result = await client.mutation(makeFunctionReference("usageConnections:exchange"), { code: code.trim(), publicKeyJson: JSON.stringify(devicePublicKey(state.privateKey)), ...signDeviceMessage(state.privateKey, { operation: "pair", code: code.trim() }) });
      const scope = grantScopeSchema.parse(result.scope);
      if (scope.sourceKey !== state.sourceKey || scope.deviceDigest !== deviceDigest(devicePublicKey(state.privateKey)) || scope.destination !== destination) throw new Error();
      // Recover a lost pairing response without discarding a same-grant outbox.
      state = result.grantId === state.grantId
        ? { ...state, scope }
        : { ...state, grantId: result.grantId, scope, sequence: result.sequence, pending: [], acknowledgedReviews: [] };
      await saveCompanionState(statePath, state);
      process.stdout.write("Paired. Run sync for the approved history, or watch for foreground recurrence.\n");
    } else {
      const transport = state => ({
        status: () => client.query(makeFunctionReference("usageConnections:status"), { grantId: state.grantId, ...signDeviceMessage(state.privateKey, { operation: "status", grantId: state.grantId }) }),
        send: packet => client.mutation(makeFunctionReference("usageConnections:ingest"), { grantId: state.grantId, packetJson: JSON.stringify(packet), ...signDeviceMessage(state.privateKey, { operation: "ingest", grantId: state.grantId, packetId: packetId(packet) }) }),
      });
      const save = next => saveCompanionState(statePath, next);
      const onSynced = state => process.stdout.write(`Private sync acknowledged through packet ${state.sequence}. Coverage remains partial.\n`);
      if (command === "watch") await watchCompanion({ load: () => loadCompanionState(statePath), save, transport, signal: controller.signal, onSynced,
        onPaused: () => process.stdout.write("Sync paused. Queued numeric history remains on disk; retrying within approval.\n") });
      else onSynced(await syncCompanion({ state, save, transport: transport(state), signal: controller.signal }));
    }
  }
} catch {
  if (controller.signal.aborted) process.stdout.write("Local sync stopped.\n");
  else { process.stderr.write("Connection stopped. Check approval, private state, and development setup. No checkpoint was guessed.\n"); process.exitCode = 1; }
}
finally { if (lock) await lock(); }
