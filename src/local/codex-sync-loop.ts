import { ConvexError } from "convex/values";
import { syncCompanion, type CompanionState, type SyncTransport } from "./codex-companion.ts";

function accessStopped(error: unknown): boolean {
  if (!(error instanceof ConvexError) || typeof error.data !== "object" || error.data === null || !("code" in error.data)) return false;
  return error.data.code === "CODEX_ACCESS_UNAVAILABLE" || error.data.code === "CODEX_DEVICE_PROOF_INVALID";
}

function waitForRetry(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise(resolve => {
    const timer = setTimeout(done, 30_000);
    function done() { clearTimeout(timer); signal.removeEventListener("abort", done); resolve(); }
    signal.addEventListener("abort", done, { once: true });
  });
}

/** Foreground recurrence only. Every attempt reloads the durable outbox and
 * requires fresh receiver authority before reading. Outages pause acquisition. */
export async function watchCompanion(input: {
  load: () => Promise<CompanionState>;
  save: (state: CompanionState) => Promise<void>;
  transport: (state: CompanionState) => SyncTransport;
  signal: AbortSignal;
  onSynced: (state: CompanionState) => void;
  onPaused: () => void;
  now?: () => number;
  wait?: (signal: AbortSignal) => Promise<void>;
}) {
  const now = input.now ?? Date.now;
  while (!input.signal.aborted) {
    const state = await input.load();
    if (!state.scope || !state.grantId || now() >= Date.parse(state.scope.expiresAt)) throw new Error("Approval expired or disconnected.");
    try {
      const synced = await syncCompanion({ state, save: input.save, transport: input.transport(state), signal: input.signal, now });
      input.onSynced(synced);
    } catch (error) {
      if (input.signal.aborted) return;
      if (accessStopped(error)) throw error;
      input.onPaused();
    }
    await (input.wait ?? waitForRetry)(input.signal);
  }
}
