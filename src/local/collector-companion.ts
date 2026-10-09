import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { canonicalJson } from "../domain/canonical-json.ts";
import { assembleReview, assertGrantActive, assertMatchingReceipt, buildReviewDelivery, collectorDigest, deliveryStatusSchema, grantSchema, manifestSchema, chunkSchema, receiptSchema, type CollectorGrant, type CommitReceipt, type ReviewChunk, type ReviewManifest } from "../domain/collector-contract.ts";
import { openCollectorPrivateStore } from "./collector-private-store.ts";

export type CollectorAuthentication = { connectionId: string; credential: string; signal?: AbortSignal };
export type CollectorTransport = {
  getGrant(input: CollectorAuthentication): Promise<unknown>;
  stageChunk(input: CollectorAuthentication & { chunk: ReviewChunk }): Promise<unknown>;
  commitReview(input: CollectorAuthentication & { manifest: ReviewManifest }): Promise<unknown>;
  deliveryStatus(input: CollectorAuthentication & { manifest: ReviewManifest }): Promise<unknown>;
};
type Delivery = ReturnType<typeof buildReviewDelivery>;
const credentialSchema = z.string().min(16).max(512).regex(/^[A-Za-z0-9._~-]+$/);
const sessionSchema = z.object({ connectionId: z.string(), grantJson: z.string(), credential: credentialSchema.nullable(), status: z.enum(["ACTIVE", "REVOKED"]), revision: z.number().int().positive(), checkpoint: z.string().nullable() });
type Session = z.infer<typeof sessionSchema>;
const outboxSchema = z.object({ manifestJson: z.string(), chunksJson: z.string() });
const storedCommitSchema = z.object({ digest: z.string().regex(/^[a-f0-9]{64}$/), receiptJson: z.string() });
const parse = (text: string): unknown => JSON.parse(text);

/** Durable sanitized outbox. Receiver authority is required before every new local read. */
export class CollectorCompanion {
  private readonly database: DatabaseSync;
  private readonly transport: CollectorTransport;
  private readonly now: () => number;
  private readonly inFlight = new Map<string, { controller: AbortController; promise: Promise<CommitReceipt> }>();
  private closed = false;

  constructor({ databasePath, transport, now = Date.now }: { databasePath: string; transport: CollectorTransport; now?: () => number }) {
    this.database = openCollectorPrivateStore({ databasePath });
    this.transport = transport;
    this.now = now;
    this.database.exec(`PRAGMA journal_mode = DELETE; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS companion_sessions (
        connectionId TEXT PRIMARY KEY, grantJson TEXT NOT NULL, credential TEXT, status TEXT NOT NULL,
        revision INTEGER NOT NULL, checkpoint TEXT
      );
      CREATE TABLE IF NOT EXISTS companion_outbox (
        connectionId TEXT PRIMARY KEY, manifestJson TEXT NOT NULL, chunksJson TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS companion_last_commit (
        connectionId TEXT PRIMARY KEY, digest TEXT NOT NULL, receiptJson TEXT NOT NULL
      );`);
  }

  private transaction<T>(operation: () => T): T {
    this.database.exec("BEGIN IMMEDIATE");
    try { const result = operation(); this.database.exec("COMMIT"); return result; }
    catch (error) { this.database.exec("ROLLBACK"); throw error; }
  }
  private session(connectionId: string): Session {
    if (this.closed) throw new Error("Companion is closed.");
    return sessionSchema.parse(this.database.prepare("SELECT * FROM companion_sessions WHERE connectionId = ?").get(connectionId));
  }
  private checkSession(connectionId: string, revision: number, signal: AbortSignal): Session {
    if (signal.aborted) throw new Error("Collector access stopped.");
    const session = this.session(connectionId);
    if (session.status !== "ACTIVE" || session.revision !== revision || session.credential === null) throw new Error("Collector access stopped.");
    return session;
  }
  private checkGrant(grant: CollectorGrant, original: CollectorGrant) {
    assertGrantActive({ grant, now: this.now() });
    if (grant.connectionId !== original.connectionId || grant.generation !== original.generation || collectorDigest(grant.descriptor) !== collectorDigest(original.descriptor) || canonicalJson(grant.window) !== canonicalJson(original.window) || canonicalJson(grant.allowedMetrics) !== canonicalJson(original.allowedMetrics) || grant.expiresAt !== original.expiresAt) throw new Error("Collector authority changed. Pair again for new access.");
  }
  private async receive<T>(operation: (signal: AbortSignal) => Promise<T>, signal: AbortSignal): Promise<T> {
    const request = new AbortController();
    const abort = () => request.abort();
    if (signal.aborted) throw new Error("Collector access stopped.");
    signal.addEventListener("abort", abort, { once: true });
    const started = performance.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { request.abort(); reject(new Error("Receiver request expired.")); }, 5000); });
      const cancellation = new Promise<never>((_resolve, reject) => { request.signal.addEventListener("abort", () => reject(new Error("Receiver request stopped.")), { once: true }); });
      const result = await Promise.race([operation(request.signal), timeout, cancellation]);
      if (request.signal.aborted || performance.now() - started >= 5000) throw new Error("Receiver request expired.");
      return result;
    } finally { clearTimeout(timer); signal.removeEventListener("abort", abort); }
  }

  connect({ grant: input, credential: inputCredential }: { grant: CollectorGrant; credential: string }): void {
    const grant = grantSchema.parse(input), credential = credentialSchema.parse(inputCredential);
    assertGrantActive({ grant, now: this.now() });
    if (this.closed || this.inFlight.has(grant.connectionId)) throw new Error("Companion cannot change pairing during sync.");
    this.transaction(() => {
      const row = this.database.prepare("SELECT * FROM companion_sessions WHERE connectionId = ?").get(grant.connectionId);
      if (row) {
        const previous = sessionSchema.parse(row), priorGrant = grantSchema.parse(parse(previous.grantJson));
        if (collectorDigest(priorGrant.descriptor) !== collectorDigest(grant.descriptor) || grant.generation < priorGrant.generation || previous.status === "REVOKED" && grant.generation === priorGrant.generation) throw new Error("Pair with a fresh generation after disconnection.");
        if (previous.status === "ACTIVE" && grant.generation === priorGrant.generation) {
          this.checkGrant(grant, priorGrant);
          if (credential !== previous.credential) throw new Error("Pairing credential identity changed.");
          return;
        }
        this.database.prepare("DELETE FROM companion_outbox WHERE connectionId = ?").run(grant.connectionId);
        this.database.prepare("DELETE FROM companion_last_commit WHERE connectionId = ?").run(grant.connectionId);
        this.database.prepare("UPDATE companion_sessions SET grantJson = ?, credential = ?, status = 'ACTIVE', revision = revision + 1, checkpoint = ? WHERE connectionId = ?").run(canonicalJson(grant), credential, grant.checkpoint, grant.connectionId);
      } else {
        this.database.prepare("INSERT INTO companion_sessions VALUES (?, ?, ?, 'ACTIVE', 1, ?)").run(grant.connectionId, canonicalJson(grant), credential, grant.checkpoint);
      }
    });
  }

  pending({ connectionId }: { connectionId: string }): Delivery | null {
    this.session(connectionId);
    const row = this.database.prepare("SELECT manifestJson, chunksJson FROM companion_outbox WHERE connectionId = ?").get(connectionId);
    if (!row) return null;
    const stored = outboxSchema.parse(row), manifest = manifestSchema.parse(parse(stored.manifestJson));
    const chunks = z.array(chunkSchema).parse(parse(stored.chunksJson));
    if (manifest.connectionId !== connectionId) throw new Error("Pending review identity changed.");
    assembleReview({ manifest, chunks });
    return { manifest, chunks };
  }
  checkpoint({ connectionId }: { connectionId: string }): string | null { return this.session(connectionId).checkpoint; }
  private lastCommit(connectionId: string): { digest: string; receipt: CommitReceipt } | null {
    const row = this.database.prepare("SELECT digest, receiptJson FROM companion_last_commit WHERE connectionId = ?").get(connectionId);
    if (!row) return null;
    const stored = storedCommitSchema.parse(row);
    const receipt = receiptSchema.parse(parse(stored.receiptJson));
    if (receipt.connectionId !== connectionId || receipt.digest !== stored.digest) throw new Error("Stored commit identity changed.");
    return { digest: stored.digest, receipt };
  }
  private rememberCommit(connectionId: string, receipt: CommitReceipt): void {
    this.database.prepare("INSERT INTO companion_last_commit(connectionId, digest, receiptJson) VALUES(?, ?, ?) ON CONFLICT(connectionId) DO UPDATE SET digest = excluded.digest, receiptJson = excluded.receiptJson")
      .run(connectionId, receipt.digest, canonicalJson(receipt));
  }

  sync(input: { connectionId: string; collect: (grant: CollectorGrant, signal: AbortSignal) => Promise<unknown> }): Promise<CommitReceipt> {
    const existing = this.inFlight.get(input.connectionId);
    if (existing) return existing.promise;
    const controller = new AbortController();
    const promise = this.performSync(input, controller.signal).finally(() => { this.inFlight.delete(input.connectionId); });
    this.inFlight.set(input.connectionId, { controller, promise });
    return promise;
  }

  private async performSync({ connectionId, collect }: { connectionId: string; collect: (grant: CollectorGrant, signal: AbortSignal) => Promise<unknown> }, signal: AbortSignal): Promise<CommitReceipt> {
    try {
      const local = this.session(connectionId), original = grantSchema.parse(parse(local.grantJson));
      this.checkSession(connectionId, local.revision, signal);
      if (!local.credential) throw new Error();
      const authentication = { connectionId, credential: local.credential, signal };
      let grant = grantSchema.parse(await this.receive(requestSignal => this.transport.getGrant({ ...authentication, signal: requestSignal }), signal));
      this.checkSession(connectionId, local.revision, signal); this.checkGrant(grant, original);
      let delivery = this.pending({ connectionId });
      let committed: CommitReceipt | null = null;
      if (delivery && delivery.manifest.expectedCheckpoint !== grant.checkpoint) {
        const pending = delivery;
        const status = deliveryStatusSchema.parse(await this.receive(requestSignal => this.transport.deliveryStatus({ ...authentication, manifest: pending.manifest, signal: requestSignal }), signal));
        this.checkSession(connectionId, local.revision, signal); this.checkGrant(grant, original);
        if (status.kind === "COMMITTED") {
          committed = assertMatchingReceipt({ manifest: pending.manifest, receipt: status.receipt });
        } else {
          if (status.kind === "STALE") {
            if (status.checkpoint === pending.manifest.expectedCheckpoint) throw new Error("Receiver status is inconsistent.");
            this.transaction(() => {
              this.checkSession(connectionId, local.revision, signal);
              const current = this.pending({ connectionId });
              if (!current || current.manifest.batchId !== pending.manifest.batchId) throw new Error("Pending review changed.");
              this.database.prepare("DELETE FROM companion_outbox WHERE connectionId = ?").run(connectionId);
            });
            delivery = null;
          } else if (status.checkpoint !== pending.manifest.expectedCheckpoint) throw new Error("Receiver status is inconsistent.");
          grant = grantSchema.parse(await this.receive(requestSignal => this.transport.getGrant({ ...authentication, signal: requestSignal }), signal));
          this.checkSession(connectionId, local.revision, signal); this.checkGrant(grant, original);
          if (status.kind === "READY" && grant.checkpoint !== status.checkpoint) throw new Error("Receiver authority advanced during retry.");
        }
      }
      if (!delivery) {
        const acquisition = new AbortController();
        const abort = () => acquisition.abort();
        signal.addEventListener("abort", abort, { once: true });
        const started = performance.now();
        let timer: ReturnType<typeof setTimeout> | undefined;
        let review: unknown;
        try {
          const deadline = new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { acquisition.abort(); reject(new Error("Acquisition expired.")); }, 5000); });
          const cancellation = new Promise<never>((_resolve, reject) => { acquisition.signal.addEventListener("abort", () => reject(new Error("Acquisition stopped.")), { once: true }); });
          review = await Promise.race([collect(grant, acquisition.signal), deadline, cancellation]);
          if (acquisition.signal.aborted || performance.now() - started >= 5000) throw new Error();
          this.checkSession(connectionId, local.revision, signal); this.checkGrant(grant, original);
          grant = grantSchema.parse(await this.receive(requestSignal => this.transport.getGrant({ ...authentication, signal: requestSignal }), acquisition.signal));
          this.checkSession(connectionId, local.revision, signal); this.checkGrant(grant, original);
          delivery = buildReviewDelivery({ grant, review });
          if (acquisition.signal.aborted || performance.now() - started >= 5000) throw new Error();
        } finally { clearTimeout(timer); signal.removeEventListener("abort", abort); }
        const acquired = delivery;
        if (!acquired) throw new Error();
        const remembered = this.lastCommit(connectionId);
        if (remembered && remembered.digest === acquired.manifest.digest && remembered.receipt.checkpoint === grant.checkpoint) {
          return remembered.receipt;
        }
        delivery = this.transaction(() => {
          this.checkSession(connectionId, local.revision, signal);
          const pending = this.pending({ connectionId });
          if (pending) return pending;
          this.database.prepare("INSERT INTO companion_outbox VALUES (?, ?, ?)").run(connectionId, canonicalJson(acquired.manifest), canonicalJson(acquired.chunks));
          return acquired;
        });
      }
      if (delivery.manifest.generation !== grant.generation || delivery.manifest.descriptorDigest !== collectorDigest(grant.descriptor)) throw new Error();
      for (const chunk of committed ? [] : delivery.chunks) {
        this.checkSession(connectionId, local.revision, signal); this.checkGrant(grant, original);
        await this.receive(requestSignal => this.transport.stageChunk({ ...authentication, chunk, signal: requestSignal }), signal);
      }
      this.checkSession(connectionId, local.revision, signal); this.checkGrant(grant, original);
      const result = committed ?? await this.receive(requestSignal => this.transport.commitReview({ ...authentication, manifest: delivery.manifest, signal: requestSignal }), signal);
      this.checkSession(connectionId, local.revision, signal); this.checkGrant(grant, original);
      const receipt = assertMatchingReceipt({ manifest: delivery.manifest, receipt: result });
      const accepted = delivery;
      this.transaction(() => {
        this.checkSession(connectionId, local.revision, signal);
        const pending = this.pending({ connectionId });
        if (pending && pending.manifest.batchId !== accepted.manifest.batchId) throw new Error("Pending review changed.");
        if (!pending) {
          if (this.session(connectionId).checkpoint !== receipt.checkpoint) throw new Error("Pending review changed.");
          this.rememberCommit(connectionId, receipt);
          return;
        }
        this.database.prepare("UPDATE companion_sessions SET checkpoint = ?, grantJson = ? WHERE connectionId = ? AND revision = ? AND status = 'ACTIVE'").run(receipt.checkpoint, canonicalJson({ ...grant, checkpoint: receipt.checkpoint }), connectionId, local.revision);
        this.database.prepare("DELETE FROM companion_outbox WHERE connectionId = ?").run(connectionId);
        this.rememberCommit(connectionId, receipt);
      });
      return receipt;
    } catch {
      throw new Error("Collector sync stopped. Check approved access and receiver availability.");
    }
  }

  disconnect({ connectionId }: { connectionId: string }): void {
    this.inFlight.get(connectionId)?.controller.abort();
    this.transaction(() => {
      this.session(connectionId);
      this.database.prepare("UPDATE companion_sessions SET status = 'REVOKED', credential = NULL, revision = revision + 1 WHERE connectionId = ?").run(connectionId);
      this.database.prepare("DELETE FROM companion_outbox WHERE connectionId = ?").run(connectionId);
      this.database.prepare("DELETE FROM companion_last_commit WHERE connectionId = ?").run(connectionId);
    });
  }
  close(): void {
    if (this.closed) return;
    for (const operation of this.inFlight.values()) operation.controller.abort();
    this.closed = true;
    this.database.close();
  }
}
