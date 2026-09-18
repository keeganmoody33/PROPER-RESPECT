import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { z } from "zod";
import {
  MAX_RETAINED_SOURCE_BYTES,
  RETAINED_PRODUCT_ADAPTER_VERSION,
  prepareGitHubActivity,
  prepareWisprInsights,
  prepareWisprOwnerReview,
  verifyRetainedProductEvidence,
  type RetainedProductArtifact,
} from "../domain/retained-product-evidence.ts";

const MAX_PACKET_BYTES = 256_000;
const manifestEntrySchema = z.object({ path: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/), bytes: z.number().int().positive().max(MAX_RETAINED_SOURCE_BYTES) });
const recoveryManifestSchema = z.object({
  recordedAt: z.iso.datetime({ offset: true }),
  sources: z.object({
    "Wispr Flow": z.object({ original: manifestEntrySchema, review: manifestEntrySchema }),
    GitHub: z.object({ original: manifestEntrySchema }),
  }),
});
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** Reads a regular file through one no-follow handle and never allocates its unchecked size. */
async function boundedFile(path: string, maxBytes: number): Promise<Buffer> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile() || metadata.size <= 0 || metadata.size > maxBytes) throw new Error("Retained file exceeds read bounds or is not a regular file.");
    const buffer = Buffer.alloc(maxBytes + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (!length || length > maxBytes) throw new Error("Retained file exceeds read bounds.");
    return buffer.subarray(0, length);
  } finally {
    await handle.close();
  }
}
function sourceText(bytes: Uint8Array) {
  // Preserve an actual BOM rather than silently changing the bytes being hashed.
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
}
async function requireOutsideGit(directory: string) {
  let current = directory;
  for (;;) {
    try {
      await lstat(join(current, ".git"));
      throw new Error("Private evidence preparation must stay outside Git checkouts.");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}
function insideDirectory(directory: string, path: string) {
  const local = relative(directory, path);
  return local.length > 0 && local !== ".." && !local.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !isAbsolute(local);
}

export type PrepareRetainedProductEvidenceOptions = {
  sourceDirectory: string;
  recoveryManifestPath: string;
  outputDirectory: string;
  /** Explicit retained-source date; never inferred from a mutable filesystem mtime. */
  sourceCapturedDate: string;
  preparedAt?: string;
};

/** Bounded accepted sources only. No network client, credentials, backend, or publication path. */
export async function prepareRetainedProductEvidenceFiles(options: PrepareRetainedProductEvidenceOptions) {
  const preparedAt = z.iso.datetime().parse(options.preparedAt ?? new Date().toISOString());
  const sourceCapturedDate = z.iso.date().parse(options.sourceCapturedDate);
  const sourceDirectory = await realpath(resolve(options.sourceDirectory));
  const requestedOutput = resolve(options.outputDirectory);
  const outputParent = await realpath(dirname(requestedOutput));
  await requireOutsideGit(sourceDirectory);
  await requireOutsideGit(outputParent);
  const outputDirectory = join(outputParent, basename(requestedOutput));
  const manifestBytes = await boundedFile(resolve(options.recoveryManifestPath), MAX_PACKET_BYTES);
  const manifest = recoveryManifestSchema.parse(JSON.parse(sourceText(manifestBytes)));
  const sources = [
    { kind: "WISPR_INSIGHTS" as const, entry: manifest.sources["Wispr Flow"].original, prepare: prepareWisprInsights, name: "wisprflow-insights" },
    { kind: "WISPR_OWNER_REVIEW" as const, entry: manifest.sources["Wispr Flow"].review, prepare: prepareWisprOwnerReview, name: "wisprflow-owner-review" },
    { kind: "GITHUB_ACTIVITY" as const, entry: manifest.sources.GitHub.original, prepare: prepareGitHubActivity, name: "github-activity" },
  ];
  const stamp = preparedAt.replaceAll(":", "-");
  // Validate all originals before making any output. The recovery manifest pins
  // accepted bytes; dates supplied by the operator retain day-only precision.
  const prepared = [];
  for (const source of sources) {
    if (!isAbsolute(source.entry.path)) throw new Error("Recovery manifest source is outside the selected source directory.");
    // Canonicalize ancestors (macOS /var is an alias) without following the
    // final component, which must still pass the no-follow file open.
    const sourcePath = join(await realpath(dirname(source.entry.path)), basename(source.entry.path));
    if (!insideDirectory(sourceDirectory, sourcePath)) throw new Error("Recovery manifest source is outside the selected source directory.");
    const actualPath = await realpath(sourcePath);
    if (!insideDirectory(sourceDirectory, actualPath)) throw new Error("Recovery manifest source is outside the selected source directory.");
    const bytes = await boundedFile(sourcePath, MAX_RETAINED_SOURCE_BYTES);
    const hash = sha256(bytes);
    if (hash !== source.entry.sha256 || bytes.length !== source.entry.bytes) throw new Error("Retained source does not match its recovery manifest.");
    const artifact: RetainedProductArtifact = {
      kind: source.kind, sourceFile: basename(sourcePath), sha256: hash, byteLength: bytes.length,
      sourceCapturedDate, sourceCaptureBasis: "RETAINED_SOURCE_DATE", preparedAt,
      adapterVersion: RETAINED_PRODUCT_ADAPTER_VERSION,
    };
    const packet = await verifyRetainedProductEvidence(source.prepare({ payload: sourceText(bytes), artifact }));
    const contents = JSON.stringify(packet, null, 2) + "\n";
    if (Buffer.byteLength(contents) > MAX_PACKET_BYTES) throw new Error("Prepared packet exceeds retention bounds.");
    prepared.push({ packet, contents, sourcePath, path: join(outputDirectory, `${source.name}-${stamp}.json`) });
  }
  // A preparation is create-only. Existing output (including symlinks) is never
  // replaced, and the directory protects every packet before it is opened.
  await mkdir(outputDirectory, { mode: 0o700 });
  const files = [];
  for (const item of prepared) {
    await writeFile(item.path, item.contents, { flag: "wx", mode: 0o600 });
    files.push({ kind: item.packet.artifact.kind, productSlug: item.packet.productSlug, path: item.path, sha256: sha256(Buffer.from(item.contents)), sourcePath: item.sourcePath, sourceSha256: item.packet.artifact.sha256 });
  }
  const receiptPath = join(outputDirectory, `preparation-receipt-${stamp}.json`);
  await writeFile(receiptPath, JSON.stringify({
    formatVersion: 1, execution: "FILE_PREPARATION_ONLY", preparedAt, sourceCapturedDate,
    adapterVersion: RETAINED_PRODUCT_ADAPTER_VERSION,
    recoveryManifest: { path: resolve(options.recoveryManifestPath), sha256: sha256(manifestBytes), recordedAt: manifest.recordedAt },
    files,
  }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  return { preparedAt, outputDirectory, files, receiptPath };
}

/** Recheck a prepared private packet before passing it to authenticated intake. */
export async function readRetainedProductEvidencePacket(path: string) {
  const bytes = await boundedFile(path, MAX_PACKET_BYTES);
  return verifyRetainedProductEvidence(JSON.parse(sourceText(bytes)));
}
