import { canonicalJson } from "../domain/canonical-json.ts";
import {
  CONNECTION_LIMITS, connectionDescriptorSchema, historyBatchSchema, historyWindowSchema,
  mergeConnectionObservations, reconcileConnectionHistory,
  type ConnectionDescriptor, type ConnectionHistory, type HistoryObservation, type HistoryWindow,
} from "../domain/connection-history.ts";

export type CollectionRequest = { descriptor: ConnectionDescriptor; window: HistoryWindow; signal: AbortSignal };
export type HistoryCollector = (request: CollectionRequest) => Promise<unknown>;
export type ConnectionView = {
  phase: "disconnected" | "awaiting-approval" | "connected" | "syncing" | "error" | "expired";
  descriptor: ConnectionDescriptor; window: HistoryWindow; expiresAt: string | null;
  error: string | null; history: ConnectionHistory; lastSyncedAt: string | null;
};
type Session =
  | { kind: "disconnected" }
  | { kind: "awaiting-approval" }
  | { kind: "active"; expiresAt: number; request: AbortController | null; error: string | null };

/** In-memory fixture prototype. It grants no filesystem, provider or hosted access. */
export class UsageConnection {
  private readonly descriptor: ConnectionDescriptor;
  private readonly window: HistoryWindow;
  private readonly collect: HistoryCollector;
  private readonly now: () => number;
  private readonly monotonicNow: () => number;
  private session: Session = { kind: "disconnected" };
  private generation = 0;
  private observations: HistoryObservation[] = [];
  private replays = 0;
  private lastSyncedAt: string | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(input: { descriptor: ConnectionDescriptor; window: HistoryWindow; collect: HistoryCollector; now?: () => number; monotonicNow?: () => number }) {
    this.descriptor = connectionDescriptorSchema.parse(input.descriptor);
    this.window = historyWindowSchema.parse(input.window);
    this.collect = input.collect;
    this.now = input.now ?? Date.now;
    this.monotonicNow = input.monotonicNow ?? (() => performance.now());
  }

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private notify() { for (const listener of this.listeners) listener(); }
  getSnapshot = (): ConnectionView => {
    const session = this.session;
    return {
      phase: session.kind !== "active" ? session.kind : this.now() >= session.expiresAt ? "expired" : session.request ? "syncing" : session.error ? "error" : "connected",
      descriptor: { ...this.descriptor }, window: { ...this.window },
      expiresAt: session.kind === "active" ? new Date(session.expiresAt).toISOString() : null,
      error: session.kind === "active" ? session.error : null,
      history: reconcileConnectionHistory(this.observations, this.replays), lastSyncedAt: this.lastSyncedAt,
    };
  };

  requestConnection() {
    if (this.session.kind === "active" && this.now() < this.session.expiresAt) return;
    this.disconnect();
    this.session = { kind: "awaiting-approval" };
    this.notify();
  }
  cancelConnection() {
    if (this.session.kind !== "awaiting-approval") return;
    this.session = { kind: "disconnected" };
    this.notify();
  }
  async approve() {
    if (this.session.kind !== "awaiting-approval") return;
    this.session = { kind: "active", expiresAt: this.now() + CONNECTION_LIMITS.approvalMs, request: null, error: null };
    this.notify();
    await this.sync();
  }
  async sync() {
    const session = this.session;
    if (session.kind !== "active" || session.request) return;
    const startedAt = this.now();
    if (startedAt >= session.expiresAt) { this.notify(); return; }
    // Clock adjustments cannot extend the elapsed budget or its initial approval cap.
    const deadlineAt = this.monotonicNow() + Math.min(5000, session.expiresAt - startedAt);
    const request = new AbortController(), generation = this.generation;
    const checkDeadline = () => {
      const now = this.now();
      if (this.monotonicNow() >= deadlineAt || now >= session.expiresAt) { request.abort(); throw new Error("acquisition-timeout"); }
      return now;
    };
    session.request = request;
    session.error = null;
    this.notify();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const deadline = new Promise<never>((_resolve, reject) => {
        const scheduleTimeout = () => {
          timeout = setTimeout(() => {
            try {
              // Timer resolution can cause an early wake. Keep the original deadline.
              checkDeadline();
              scheduleTimeout();
            } catch (error) { reject(error); }
          }, Math.ceil(Math.max(0, deadlineAt - this.monotonicNow())));
        };
        scheduleTimeout();
      });
      const value = await Promise.race([this.collect({ descriptor: { ...this.descriptor }, window: { ...this.window }, signal: request.signal }), deadline]);
      if (generation !== this.generation || request.signal.aborted) return;
      checkDeadline();
      const text = JSON.stringify(value);
      if (typeof text !== "string" || new TextEncoder().encode(text).length > CONNECTION_LIMITS.bytes) throw new Error();
      const batch = historyBatchSchema.parse(value);
      if (canonicalJson(batch.descriptor) !== canonicalJson(this.descriptor)) throw new Error();
      if (batch.observations.some(row => Date.parse(row.at) < Date.parse(this.window.start) || Date.parse(row.at) >= Date.parse(this.window.end))) throw new Error();
      const merged = mergeConnectionObservations(this.observations, batch.observations);
      if (generation !== this.generation || request.signal.aborted) return;
      // Validation shares the acquisition budget; a delayed timer cannot allow a late commit.
      const committedAt = checkDeadline();
      // Commit the entire validated batch at once. Failed reads cannot replace prior history.
      this.observations = merged.observations;
      this.replays += merged.replays;
      this.lastSyncedAt = new Date(committedAt).toISOString();
    } catch {
      if (generation === this.generation) session.error = "Sync could not be verified. Retained history is unchanged. Retry within the approved window.";
    } finally {
      clearTimeout(timeout);
      if (generation === this.generation) { session.request = null; this.notify(); }
    }
  }
  disconnect() {
    if (this.session.kind === "active") this.session.request?.abort();
    this.generation++;
    this.session = { kind: "disconnected" };
    this.notify();
  }
}
