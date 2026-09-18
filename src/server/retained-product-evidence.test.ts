import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { prepareRetainedProductEvidenceFiles, readRetainedProductEvidencePacket } from "./retained-product-evidence";

const temporaryDirectories: string[] = [];
afterEach(async () => { await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
const preparedAt = "2025-01-05T10:11:12.000Z";

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "retained-product-test-"));
  temporaryDirectories.push(directory);
  const sourceDirectory = join(directory, "sources");
  await mkdir(sourceDirectory);
  // This entire source set is synthetic and generated only under the OS temp directory.
  const originals = {
    wispr: "Wispr Flow > Insights > Your usage\n120\nWORDS PER MINUTE\n40\nFIXES MADE BY FLOW\n30 words corrected\n10 dictionary fixes\n1,200\nTOTAL WORDS DICTATED\nDesktop Mobile\nDesktop usage\nTOTAL APPS USED | 6\n50 % 600 AI PROMPTS\n20 % 240 OTHER TASKS\n10 % 120 WORK MESSAGES\n10 % 120 PERSONAL MESSAGES\n5 % 60 DOCUMENTS\n5 % 60 EMAILS\n3 day streak\nLONGEST STREAK | 7 DAYS\n",
    review: JSON.stringify({ recordedAt: "2025-01-02T10:00:00Z", source: "Synthetic conversation", question: "Synthetic question", answer: "SYNTHETIC_OWNER_ANSWER", interpretation: { purpose: "Synthetic interpretation", valueJudgment: "Synthetic interpretation" }, costControlRequest: "Synthetic private", costPublicationDecision: "Synthetic private" }),
    github: JSON.stringify({ data: { viewer: { login: "synthetic-account", createdAt: "2020-01-02T03:04:05Z", contributionsCollection: { contributionCalendar: { totalContributions: 2, weeks: [{ contributionDays: [{ date: "2025-01-02", contributionCount: 2, contributionLevel: "FIRST_QUARTILE" }] }] } } } } }),
  };
  const entries: Record<string, { path: string; sha256: string; bytes: number }> = {};
  for (const [name, payload] of Object.entries(originals)) {
    const path = join(sourceDirectory, `${name}.txt`);
    await writeFile(path, payload, { mode: 0o600 });
    entries[name] = { path, sha256: createHash("sha256").update(payload).digest("hex"), bytes: Buffer.byteLength(payload) };
  }
  const manifest = { recordedAt: "2025-01-03T10:00:00Z", sources: { "Wispr Flow": { original: entries.wispr, review: entries.review }, GitHub: { original: entries.github } } };
  const recoveryManifestPath = join(directory, "manifest.json");
  await writeFile(recoveryManifestPath, JSON.stringify(manifest));
  const options = { sourceDirectory, recoveryManifestPath, outputDirectory: join(directory, "prepared"), sourceCapturedDate: "2025-01-02", preparedAt };
  return { directory, manifest, entries, originals, options };
}

describe("file-only retained evidence preparation", () => {
  it("checks originals against the recovery manifest and writes dated private packets with restricted modes", async () => {
    const { options, entries } = await fixture();
    const result = await prepareRetainedProductEvidenceFiles(options);
    expect(result.files).toHaveLength(3);
    expect((await stat(options.outputDirectory)).mode & 0o777).toBe(0o700);
    for (const file of result.files) {
      expect(file.path).toContain("2025-01-05T10-11-12.000Z");
      expect((await stat(file.path)).mode & 0o777).toBe(0o600);
      const packet = await readRetainedProductEvidencePacket(file.path);
      expect(packet.artifact.preparedAt).toBe(preparedAt);
      expect(packet.artifact.sourceCapturedDate).toBe("2025-01-02");
    }
    const receipt = JSON.parse(await readFile(result.receiptPath, "utf8"));
    expect(receipt.execution).toBe("FILE_PREPARATION_ONLY");
    expect(receipt.preparedAt).toBe(preparedAt);
    for (const entry of Object.values(entries)) {
      expect(createHash("sha256").update(await readFile(entry.path)).digest("hex")).toBe(entry.sha256);
    }
    expect(await readdir(options.outputDirectory)).toHaveLength(4);
  });

  it("fails before creating output when a source differs from the retained recovery hash", async () => {
    const { options, entries } = await fixture();
    await writeFile(entries.wispr.path, "SYNTHETIC_CHANGED_SOURCE");
    await expect(prepareRetainedProductEvidenceFiles(options)).rejects.toThrow("manifest");
    await expect(stat(options.outputDirectory)).rejects.toThrow();
  });

  it("never overwrites an existing preparation directory", async () => {
    const { options } = await fixture();
    await mkdir(options.outputDirectory);
    const marker = join(options.outputDirectory, "marker");
    await writeFile(marker, "preserve me");
    await expect(prepareRetainedProductEvidenceFiles(options)).rejects.toThrow();
    expect(await readFile(marker, "utf8")).toBe("preserve me");
    expect(await readdir(options.outputDirectory)).toEqual(["marker"]);
  });

  it("rejects an output inside a Git checkout, including through a parent symlink", async () => {
    const { directory, options } = await fixture();
    const repo = join(directory, "repo");
    await mkdir(repo); await writeFile(join(repo, ".git"), "gitdir: synthetic\n");
    await expect(prepareRetainedProductEvidenceFiles({ ...options, outputDirectory: join(repo, "private") })).rejects.toThrow("outside Git");
    const alias = join(directory, "alias"); await symlink(repo, alias);
    await expect(prepareRetainedProductEvidenceFiles({ ...options, outputDirectory: join(alias, "private") })).rejects.toThrow("outside Git");
  });

  it("rejects symlinked originals and manifest paths outside the selected source directory", async () => {
    const { directory, entries, manifest, options } = await fixture();
    const alias = join(options.sourceDirectory, "alias.txt"); await symlink(entries.wispr.path, alias);
    manifest.sources["Wispr Flow"].original.path = alias;
    await writeFile(options.recoveryManifestPath, JSON.stringify(manifest));
    await expect(prepareRetainedProductEvidenceFiles(options)).rejects.toThrow();
    const outside = join(directory, "outside.txt"); await writeFile(outside, await readFile(entries.wispr.path));
    manifest.sources["Wispr Flow"].original.path = outside;
    await writeFile(options.recoveryManifestPath, JSON.stringify(manifest));
    await expect(prepareRetainedProductEvidenceFiles(options)).rejects.toThrow("source directory");
  });

  it("rejects an edited packet on reread and bounds file reads", async () => {
    const { options, directory } = await fixture();
    const result = await prepareRetainedProductEvidenceFiles(options);
    const packet = JSON.parse(await readFile(result.files[0].path, "utf8"));
    packet.signal.observations[0].value += 1;
    await writeFile(result.files[0].path, JSON.stringify(packet));
    await expect(readRetainedProductEvidencePacket(result.files[0].path)).rejects.toThrow();
    const large = join(directory, "large.json"); await writeFile(large, "x".repeat(256_001));
    await expect(readRetainedProductEvidencePacket(large)).rejects.toThrow("bounds");
  });
});
