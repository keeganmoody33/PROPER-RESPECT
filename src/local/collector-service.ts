import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { DatabaseSync, SQLOutputValue } from "node:sqlite";
import { z } from "zod";
import {
  assembleReview, assertGrantActive, assertManifestIdentity, assertReviewAuthorized, CODEX_METRICS, collectorDigest, connectionDescriptorSchema,
  grantSchema, manifestSchema, chunkSchema, deliveryStatusSchema, receiptSchema, reviewRowSchema, reviewSchema,
  type CollectorGrant, type CommitReceipt, type ReviewManifest,
} from "../domain/collector-contract.ts";
import { historyWindowSchema } from "../domain/connection-history.ts";
import { openCollectorPrivateStore } from "./collector-private-store.ts";

/** Fixture caller authentication is supplied by its boundary, never the helper. */
export const collectorOwnerSchema = z.strictObject({
  issuer: z.string().url().max(256), subject: z.string().min(1).max(256),
});
export type CollectorOwner = z.infer<typeof collectorOwnerSchema>;
const PAIRING_MS = 10 * 60_000;
const MAX_GRANT_MS = 30 * 86400_000;
const MAX_PENDING = 64;
const MAX_STAGED_BYTES = 16 * 1024 * 1024;
const secretSchema = z.string().min(32).max(256).regex(/^[A-Za-z0-9_-]+$/);
const identifierSchema = z.string().min(1).max(128);
type SqlRow = Record<string, SQLOutputValue>;
type StoredConnection = { grant: CollectorGrant; owner: CollectorOwner; state: "ACTIVE" | "REVOKED"; credentialHash: string | null };
const hashSecret = (value: string) => createHash("sha256").update(value).digest("hex");
function matchesSecret(secret: string, expected: string) {
  return timingSafeEqual(Buffer.from(hashSecret(secret), "hex"), Buffer.from(expected, "hex"));
}
function column(row: SqlRow | undefined, key: string): string {
  if (!row || typeof row[key] !== "string") throw new Error("Private collector state is unavailable.");
  return row[key];
}

/** Durable private fixture receiver. This class supplies no real owner authentication. */
export class CollectorService {
  private readonly database: DatabaseSync;
  private readonly now: () => number;
  private readonly seed: string;
  private closed = false;

  constructor(input: { databasePath: string; now?: () => number }) {
    this.now = input.now ?? Date.now;
    this.database = openCollectorPrivateStore({ databasePath: input.databasePath });
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS service_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS pairings (
        id TEXT PRIMARY KEY, verifier_hash TEXT NOT NULL, descriptor_json TEXT NOT NULL,
        window_json TEXT NOT NULL, expires_at TEXT NOT NULL, approval_json TEXT,
        connection_id TEXT, generation INTEGER, claimed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS connections (
        id TEXT PRIMARY KEY, owner_issuer TEXT NOT NULL, owner_subject TEXT NOT NULL,
        source_key TEXT NOT NULL, grant_json TEXT NOT NULL, state TEXT NOT NULL,
        credential_hash TEXT, UNIQUE(owner_issuer, owner_subject, source_key)
      );
      CREATE TABLE IF NOT EXISTS chunks (
        connection_id TEXT NOT NULL, generation INTEGER NOT NULL, batch_id TEXT NOT NULL,
        chunk_id TEXT NOT NULL, chunk_digest TEXT NOT NULL, chunk_json TEXT NOT NULL,
        byte_size INTEGER NOT NULL, PRIMARY KEY(connection_id, generation, batch_id, chunk_id)
      );
      CREATE TABLE IF NOT EXISTS receipts (
        connection_id TEXT NOT NULL, generation INTEGER NOT NULL, batch_id TEXT NOT NULL,
        manifest_digest TEXT NOT NULL, manifest_json TEXT NOT NULL, receipt_json TEXT NOT NULL,
        PRIMARY KEY(connection_id, generation, batch_id)
      );
      CREATE TABLE IF NOT EXISTS responses (
        connection_id TEXT NOT NULL, identity TEXT NOT NULL, variant_digest TEXT NOT NULL,
        row_json TEXT NOT NULL, quarantined INTEGER NOT NULL,
        PRIMARY KEY(connection_id, identity, variant_digest)
      );
      CREATE TABLE IF NOT EXISTS views (
        connection_id TEXT NOT NULL, window_key TEXT NOT NULL, review_json TEXT NOT NULL,
        PRIMARY KEY(connection_id, window_key)
      );
      CREATE TABLE IF NOT EXISTS accepted_reviews (
        connection_id TEXT NOT NULL, review_digest TEXT NOT NULL, review_json TEXT NOT NULL,
        PRIMARY KEY(connection_id, review_digest)
      );
    `);
    this.seed = this.transaction(() => {
      const saved = this.database.prepare("SELECT value FROM service_meta WHERE key='credential-seed'").get();
      if (saved) return column(saved, "value");
      const seed = randomBytes(32).toString("hex");
      this.database.prepare("INSERT INTO service_meta(key,value) VALUES('credential-seed',?)").run(seed);
      return seed;
    });
  }

  close() {
    if (this.closed) return;
    this.database.close(); this.closed = true;
  }

  private transaction<T>(operation: () => T): T {
    if (this.closed) throw new Error("Collector service is closed.");
    this.database.exec("BEGIN IMMEDIATE");
    try { const result = operation(); this.database.exec("COMMIT"); return result; }
    catch (error) { this.database.exec("ROLLBACK"); throw error; }
  }

  private connection(connectionId: string): StoredConnection {
    identifierSchema.parse(connectionId);
    const row = this.database.prepare("SELECT * FROM connections WHERE id=?").get(connectionId);
    if (!row) throw new Error("Connection unavailable.");
    const state = column(row, "state");
    if (state !== "ACTIVE" && state !== "REVOKED") throw new Error("Connection state unavailable.");
    return { grant: grantSchema.parse(JSON.parse(column(row, "grant_json"))), state,
      owner: collectorOwnerSchema.parse({ issuer: column(row, "owner_issuer"), subject: column(row, "owner_subject") }),
      credentialHash: row.credential_hash === null ? null : column(row, "credential_hash") };
  }

  private authorized(input: { connectionId: string; credential: string }) {
    secretSchema.parse(input.credential);
    const connection = this.connection(input.connectionId);
    if (connection.state !== "ACTIVE" || connection.credentialHash === null || !matchesSecret(input.credential, connection.credentialHash))
      throw new Error("Connection authorization unavailable.");
    assertGrantActive({ grant: connection.grant, now: this.now() });
    return connection;
  }

  private owned(connectionId: string, ownerInput: CollectorOwner) {
    const owner = collectorOwnerSchema.parse(ownerInput), connection = this.connection(connectionId);
    if (connection.owner.issuer !== owner.issuer || connection.owner.subject !== owner.subject) throw new Error("Connection unavailable.");
    return connection;
  }

  async requestPairing(input: { descriptor: z.input<typeof connectionDescriptorSchema>; window: { start: string; end: string }; verifier: string }) {
    const descriptor = connectionDescriptorSchema.parse(input.descriptor), window = historyWindowSchema.parse(input.window);
    const verifier = secretSchema.parse(input.verifier);
    return this.transaction(() => {
      const current = new Date(this.now()).toISOString();
      this.database.prepare("DELETE FROM pairings WHERE connection_id IS NULL AND expires_at<=?").run(current);
      const count = this.database.prepare("SELECT COUNT(*) AS count FROM pairings WHERE connection_id IS NULL").get();
      if (!count || typeof count.count !== "number" || count.count >= MAX_PENDING) throw new Error("Too many pending pairings.");
      const pairingId = randomUUID(), expiresAt = new Date(this.now() + PAIRING_MS).toISOString();
      this.database.prepare("INSERT INTO pairings(id,verifier_hash,descriptor_json,window_json,expires_at) VALUES(?,?,?,?,?)")
        .run(pairingId, hashSecret(verifier), JSON.stringify(descriptor), JSON.stringify(window), expiresAt);
      return { pairingId, expiresAt };
    });
  }

  async pairingRequest(input: { pairingId: string }) {
    identifierSchema.parse(input.pairingId);
    const pairing = this.database.prepare("SELECT * FROM pairings WHERE id=?").get(input.pairingId);
    if (!pairing || Date.parse(column(pairing, "expires_at")) <= this.now()) throw new Error("Pairing unavailable or expired.");
    return { pairingId: input.pairingId, descriptor: connectionDescriptorSchema.parse(JSON.parse(column(pairing, "descriptor_json"))),
      window: historyWindowSchema.parse(JSON.parse(column(pairing, "window_json"))), expiresAt: column(pairing, "expires_at"), approved: pairing.approval_json !== null };
  }

  async approvePairing(input: { pairingId: string; owner: CollectorOwner; expiresAt: string; allowedMetrics: string[] }) {
    const owner = collectorOwnerSchema.parse(input.owner);
    identifierSchema.parse(input.pairingId);
    return this.transaction(() => {
      const pairing = this.database.prepare("SELECT * FROM pairings WHERE id=?").get(input.pairingId);
      if (!pairing || Date.parse(column(pairing, "expires_at")) <= this.now()) throw new Error("Pairing unavailable or expired.");
      const descriptor = connectionDescriptorSchema.parse(JSON.parse(column(pairing, "descriptor_json")));
      const window = historyWindowSchema.parse(JSON.parse(column(pairing, "window_json")));
      const approval = { owner, expiresAt: input.expiresAt, allowedMetrics: [...input.allowedMetrics].sort() };
      if (pairing.approval_json !== null) {
        if (column(pairing, "approval_json") !== JSON.stringify(approval)) throw new Error("Pairing approval already belongs to another request.");
        return { connectionId: column(pairing, "connection_id") };
      }
      const expiration = Date.parse(input.expiresAt);
      if (!Number.isFinite(expiration) || expiration <= this.now() || expiration > this.now() + MAX_GRANT_MS) throw new Error("Invalid grant expiry.");
      const sourceKey = collectorDigest([descriptor.provider, descriptor.sourceId, descriptor.deviceId]);
      const previous = this.database.prepare("SELECT id FROM connections WHERE owner_issuer=? AND owner_subject=? AND source_key=?")
        .get(owner.issuer, owner.subject, sourceKey);
      const connectionId = previous ? column(previous, "id") : randomUUID();
      const existing = previous ? this.connection(connectionId) : null;
      if (existing && collectorDigest(existing.grant.descriptor) !== collectorDigest(descriptor)) throw new Error("Connection source identity changed. Use a distinct source.");
      const grant = grantSchema.parse({ connectionId, descriptor, window, expiresAt: input.expiresAt,
        generation: existing ? existing.grant.generation + 1 : 1, allowedMetrics: approval.allowedMetrics, checkpoint: existing?.grant.checkpoint ?? null });
      assertGrantActive({ grant, now: this.now() });
      this.database.prepare(`INSERT INTO connections(id,owner_issuer,owner_subject,source_key,grant_json,state,credential_hash)
        VALUES(?,?,?,?,?,'ACTIVE',NULL) ON CONFLICT(id) DO UPDATE SET grant_json=excluded.grant_json,state='ACTIVE',credential_hash=NULL`)
        .run(connectionId, owner.issuer, owner.subject, sourceKey, JSON.stringify(grant));
      this.database.prepare("DELETE FROM chunks WHERE connection_id=?").run(connectionId);
      this.database.prepare("UPDATE pairings SET approval_json=?,connection_id=?,generation=? WHERE id=?")
        .run(JSON.stringify(approval), connectionId, grant.generation, input.pairingId);
      return { connectionId };
    });
  }

  async claimPairing(input: { pairingId: string; verifier: string }) {
    identifierSchema.parse(input.pairingId); secretSchema.parse(input.verifier);
    return this.transaction(() => {
      const pairing = this.database.prepare("SELECT * FROM pairings WHERE id=?").get(input.pairingId);
      if (!pairing || !matchesSecret(input.verifier, column(pairing, "verifier_hash"))) throw new Error("Pairing verifier unavailable.");
      if (pairing.approval_json === null || pairing.connection_id === null) throw new Error("Owner approval is required.");
      if (pairing.claimed_at === null && Date.parse(column(pairing, "expires_at")) <= this.now()) throw new Error("Pairing expired.");
      const connectionId = column(pairing, "connection_id"), connection = this.connection(connectionId);
      if (connection.state !== "ACTIVE" || connection.grant.generation !== pairing.generation) throw new Error("Pairing authorization changed.");
      assertGrantActive({ grant: connection.grant, now: this.now() });
      const credential = "prc_" + createHmac("sha256", this.seed).update(JSON.stringify([input.pairingId, input.verifier])).digest("hex");
      const credentialHash = hashSecret(credential);
      if (pairing.claimed_at !== null && connection.credentialHash !== credentialHash) throw new Error("Pairing authorization changed.");
      if (pairing.claimed_at === null) {
        this.database.prepare("UPDATE connections SET credential_hash=? WHERE id=?").run(credentialHash, connectionId);
        this.database.prepare("UPDATE pairings SET claimed_at=? WHERE id=?").run(new Date(this.now()).toISOString(), input.pairingId);
      }
      return { grant: connection.grant, credential };
    });
  }

  async getGrant(input: { connectionId: string; credential: string }) {
    return this.authorized(input).grant;
  }

  private assertConnectionManifest(grant: CollectorGrant, manifest: ReviewManifest) {
    if (manifest.connectionId !== grant.connectionId || manifest.generation !== grant.generation ||
        manifest.descriptorDigest !== collectorDigest(grant.descriptor) ||
        collectorDigest(manifest.window) !== collectorDigest(grant.window) ||
        manifest.review.source.provider !== grant.descriptor.provider) throw new Error("Review connection identity changed.");
  }

  async deliveryStatus(input: { connectionId: string; credential: string; manifest: unknown }) {
    const manifest = assertManifestIdentity({ manifest: input.manifest }), manifestDigest = collectorDigest(manifest);
    return this.transaction(() => {
      const { grant } = this.authorized(input);
      this.assertConnectionManifest(grant, manifest);
      const accepted = this.database.prepare("SELECT manifest_digest,receipt_json FROM receipts WHERE connection_id=? AND generation=? AND batch_id=?")
        .get(input.connectionId, grant.generation, manifest.batchId);
      if (accepted) {
        if (column(accepted, "manifest_digest") !== manifestDigest) throw new Error("Review identity collision.");
        return deliveryStatusSchema.parse({ kind: "COMMITTED", receipt: receiptSchema.parse(JSON.parse(column(accepted, "receipt_json"))) });
      }
      if (manifest.expectedCheckpoint === grant.checkpoint) return deliveryStatusSchema.parse({ kind: "READY", checkpoint: grant.checkpoint });
      // This obsolete unaccepted batch cannot commit. Remove only its staging;
      // its caller can collect a replacement under the current approved grant.
      this.database.prepare("DELETE FROM chunks WHERE connection_id=? AND generation=? AND batch_id=?")
        .run(input.connectionId, grant.generation, manifest.batchId);
      return deliveryStatusSchema.parse({ kind: "STALE", checkpoint: grant.checkpoint });
    });
  }

  async stageChunk(input: { connectionId: string; credential: string; chunk: unknown }) {
    const chunk = chunkSchema.parse(input.chunk), json = JSON.stringify(chunk);
    const bytes = Buffer.byteLength(json), digest = collectorDigest(chunk);
    if (bytes > 256_000) throw new Error("Review chunk exceeds its limit.");
    return this.transaction(() => {
      const { grant } = this.authorized(input);
      const allowed = new Set<string>(grant.allowedMetrics);
      for (const item of chunk.rows) {
        if (item.kind === "codex-response") {
          if (grant.descriptor.provider !== "codex" || Object.entries(item.row.counts).some(([metric, value]) => value !== null && !allowed.has(metric)))
            throw new Error("Chunk exceeds approved provider or native metrics.");
        } else if (item.kind === "codex-legacy") {
          if (grant.descriptor.provider !== "codex" || !allowed.has(item.row.metric)) throw new Error("Chunk exceeds approved provider or native metrics.");
        } else if (grant.descriptor.provider !== "cursor" || !allowed.has(item.row.metric)) throw new Error("Chunk exceeds approved provider or native metrics.");
      }
      const accepted = this.database.prepare("SELECT manifest_json FROM receipts WHERE connection_id=? AND generation=? AND batch_id=?")
        .get(input.connectionId, grant.generation, chunk.batchId);
      if (accepted) {
        const manifest = manifestSchema.parse(JSON.parse(column(accepted, "manifest_json")));
        const expected = manifest.chunks.find(item => item.id === chunk.id);
        if (!expected || expected.index !== chunk.index || expected.digest !== digest || expected.rows !== chunk.rows.length)
          throw new Error("Chunk identity collision with an accepted review.");
        return { duplicate: true };
      }
      const prior = this.database.prepare("SELECT chunk_digest FROM chunks WHERE connection_id=? AND generation=? AND batch_id=? AND chunk_id=?")
        .get(input.connectionId, grant.generation, chunk.batchId, chunk.id);
      if (prior) {
        if (column(prior, "chunk_digest") !== digest) throw new Error("Chunk identity collision.");
        return { duplicate: true };
      }
      const total = this.database.prepare("SELECT COALESCE(SUM(byte_size),0) AS bytes FROM chunks WHERE connection_id=?").get(input.connectionId);
      if (!total || typeof total.bytes !== "number" || total.bytes + bytes > MAX_STAGED_BYTES) throw new Error("Staged review storage limit reached.");
      const count = this.database.prepare("SELECT COUNT(*) AS count FROM chunks WHERE connection_id=? AND generation=? AND batch_id=?")
        .get(input.connectionId, grant.generation, chunk.batchId);
      if (!count || typeof count.count !== "number" || count.count >= 128) throw new Error("Review chunk count limit reached.");
      this.database.prepare("INSERT INTO chunks(connection_id,generation,batch_id,chunk_id,chunk_digest,chunk_json,byte_size) VALUES(?,?,?,?,?,?,?)")
        .run(input.connectionId, grant.generation, chunk.batchId, chunk.id, digest, json, bytes);
      return { duplicate: false };
    });
  }

  async commitReview(input: { connectionId: string; credential: string; manifest: unknown }): Promise<CommitReceipt> {
    const manifest = assertManifestIdentity({ manifest: input.manifest }), manifestDigest = collectorDigest(manifest);
    return this.transaction(() => {
      const { grant } = this.authorized(input);
      this.assertConnectionManifest(grant, manifest);
      const existing = this.database.prepare("SELECT * FROM receipts WHERE connection_id=? AND generation=? AND batch_id=?")
        .get(input.connectionId, grant.generation, manifest.batchId);
      if (existing) {
        if (column(existing, "manifest_digest") !== manifestDigest) throw new Error("Review identity collision.");
        return receiptSchema.parse(JSON.parse(column(existing, "receipt_json")));
      }
      if (manifest.expectedCheckpoint !== grant.checkpoint) throw new Error("Review checkpoint changed. Discard stale concurrent work.");
      const stored = this.database.prepare("SELECT chunk_json FROM chunks WHERE connection_id=? AND generation=? AND batch_id=? ORDER BY chunk_id")
        .all(input.connectionId, grant.generation, manifest.batchId);
      const chunks = stored.map(row => chunkSchema.parse(JSON.parse(column(row, "chunk_json"))));
      const review = assembleReview({ manifest, chunks });
      assertReviewAuthorized({ grant, review });
      assertGrantActive({ grant, now: this.now() });
      // Each distinct sanitized original is immutable. Repeated captures reuse it;
      // current report projections may change without losing older accepted facts.
      this.database.prepare("INSERT OR IGNORE INTO accepted_reviews(connection_id,review_digest,review_json) VALUES(?,?,?)")
        .run(input.connectionId, manifest.digest, JSON.stringify(review));
      if (review.format === "codex-local-history-v1") {
        for (const row of review.responses.rows) {
          const identity = collectorDigest([row.thread, row.response]);
          const variant = collectorDigest({ at: row.at, counts: row.counts });
          this.database.prepare(`INSERT INTO responses(connection_id,identity,variant_digest,row_json,quarantined) VALUES(?,?,?,?,?)
            ON CONFLICT(connection_id,identity,variant_digest) DO UPDATE SET quarantined=MAX(quarantined,excluded.quarantined)`)
            .run(input.connectionId, identity, variant, JSON.stringify({ kind: "codex-response", row }), row.status === "conflict" ? 1 : 0);
        }
      }
      this.database.prepare("INSERT INTO views(connection_id,window_key,review_json) VALUES(?,?,?) ON CONFLICT(connection_id,window_key) DO UPDATE SET review_json=excluded.review_json")
        .run(input.connectionId, collectorDigest(review.window), JSON.stringify(review));
      const commitTime = this.now();
      assertGrantActive({ grant, now: commitTime });
      const receipt: CommitReceipt = { format: "collector-commit-receipt-v1", connectionId: input.connectionId,
        generation: grant.generation, batchId: manifest.batchId, digest: manifest.digest,
        checkpoint: manifest.nextCheckpoint, committedAt: new Date(commitTime).toISOString() };
      this.database.prepare("INSERT INTO receipts(connection_id,generation,batch_id,manifest_digest,manifest_json,receipt_json) VALUES(?,?,?,?,?,?)")
        .run(input.connectionId, grant.generation, manifest.batchId, manifestDigest, JSON.stringify(manifest), JSON.stringify(receipt));
      this.database.prepare("UPDATE connections SET grant_json=? WHERE id=?").run(JSON.stringify({ ...grant, checkpoint: receipt.checkpoint }), input.connectionId);
      this.database.prepare("DELETE FROM chunks WHERE connection_id=? AND generation=? AND batch_id=?").run(input.connectionId, grant.generation, manifest.batchId);
      return receipt;
    });
  }

  async disconnectOwner(input: { connectionId: string; owner: CollectorOwner }) {
    return this.transaction(() => {
      const connection = this.owned(input.connectionId, input.owner);
      if (connection.state === "REVOKED") return { generation: connection.grant.generation, duplicate: true };
      const generation = connection.grant.generation + 1;
      this.database.prepare("UPDATE connections SET state='REVOKED',credential_hash=NULL,grant_json=? WHERE id=?")
        .run(JSON.stringify({ ...connection.grant, generation }), input.connectionId);
      this.database.prepare("DELETE FROM chunks WHERE connection_id=?").run(input.connectionId);
      return { generation, duplicate: false };
    });
  }

  async listConnections(input: { owner: CollectorOwner }) {
    const owner = collectorOwnerSchema.parse(input.owner);
    const rows = this.database.prepare("SELECT id FROM connections WHERE owner_issuer=? AND owner_subject=? ORDER BY id")
      .all(owner.issuer, owner.subject);
    return rows.map(row => { const connection = this.connection(column(row, "id"));
      return { grant: connection.grant, state: connection.state,
        expired: Date.parse(connection.grant.expiresAt) <= this.now() }; });
  }

  async acceptedReview(input: { connectionId: string; owner: CollectorOwner; batchId: string; generation: number }) {
    this.owned(input.connectionId, input.owner);
    z.string().regex(/^[a-f0-9]{64}$/).parse(input.batchId);
    z.number().int().positive().max(Number.MAX_SAFE_INTEGER).parse(input.generation);
    const savedReceipt = this.database.prepare("SELECT receipt_json FROM receipts WHERE connection_id=? AND generation=? AND batch_id=?")
      .get(input.connectionId, input.generation, input.batchId);
    if (!savedReceipt) throw new Error("Accepted review unavailable.");
    const receipt = receiptSchema.parse(JSON.parse(column(savedReceipt, "receipt_json")));
    const archived = this.database.prepare("SELECT review_json FROM accepted_reviews WHERE connection_id=? AND review_digest=?")
      .get(input.connectionId, receipt.digest);
    if (!archived) throw new Error("Accepted review unavailable.");
    const review = reviewSchema.parse(JSON.parse(column(archived, "review_json")));
    if (collectorDigest(review) !== receipt.digest) throw new Error("Accepted review integrity conflict.");
    return { receipt, review };
  }

  async privateHistory(input: { connectionId: string; owner: CollectorOwner }) {
    const connection = this.owned(input.connectionId, input.owner);
    const receiptCountRow = this.database.prepare("SELECT COUNT(*) AS count FROM receipts WHERE connection_id=?").get(input.connectionId);
    if (!receiptCountRow || typeof receiptCountRow.count !== "number") throw new Error("Private receipt history unavailable.");
    const lastReceiptRow = this.database.prepare("SELECT receipt_json FROM receipts WHERE connection_id=? ORDER BY rowid DESC LIMIT 1").get(input.connectionId);
    const lastReceipt = lastReceiptRow ? receiptSchema.parse(JSON.parse(column(lastReceiptRow, "receipt_json"))) : null;
    const views = this.database.prepare("SELECT review_json FROM views WHERE connection_id=? ORDER BY window_key").all(input.connectionId)
      .map(row => reviewSchema.parse(JSON.parse(column(row, "review_json"))));
    const variants = this.database.prepare("SELECT identity,row_json,quarantined FROM responses WHERE connection_id=? ORDER BY identity,variant_digest").all(input.connectionId);
    const counts = new Map<string, number>();
    for (const row of variants) { const key = column(row, "identity"); counts.set(key, (counts.get(key) ?? 0) + 1); }
    const responses = variants.map(saved => {
      const parsed = reviewRowSchema.parse(JSON.parse(column(saved, "row_json")));
      if (parsed.kind !== "codex-response") throw new Error("Private response integrity conflict.");
      return { ...parsed.row, status: saved.quarantined === 1 || (counts.get(column(saved, "identity")) ?? 0) > 1 ? "conflict" as const : "measured" as const };
    }).sort((a, b) => a.at.localeCompare(b.at) || a.thread.localeCompare(b.thread) || a.response.localeCompare(b.response));
    const responseTotals = CODEX_METRICS.map(metric => ({ metric,
      value: !responses.length || responses.some(row => row.status === "conflict" || row.counts[metric] === null) ? null
        : String(responses.reduce((total, row) => total + BigInt(row.counts[metric] ?? "0"), BigInt(0))) }));
    return { connectionId: input.connectionId, descriptor: connection.grant.descriptor, state: connection.state,
      checkpoint: connection.grant.checkpoint, receiptCount: receiptCountRow.count, lastReceipt, responses: { rows: responses, totals: responseTotals },
      legacyViews: views.flatMap(review => review.format === "codex-local-history-v1" ? [{ window: review.window, legacy: review.legacy, coverage: review.coverage }] : []),
      cursorViews: views.flatMap(review => review.format === "cursor-complete-report-v1" ? [review] : []) };
  }
}
