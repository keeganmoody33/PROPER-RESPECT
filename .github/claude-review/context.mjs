// Trusted review preparation. Git objects are data: never check them out,
// execute them, apply their filters, or expose their model configuration.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const MiB = 1024 * 1024;
const LIMITS = Object.freeze({ filesPerTree: 2000, fileBytes: 8 * MiB, totalBytes: 160 * MiB, patchBytes: 8 * MiB, configurationBytes: 32 * MiB, commits: 249 });
const SHA = /^[0-9a-f]{40}$/;
const OMIT = new Set(["claude.md", "claude.local.md", ".claude", ".claude.json", ".mcp.json", ".git"]);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

function present(path) {
  try { lstatSync(path); return true; }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
}

function gitReader(repositoryDir) {
  const args = [
    "--no-pager", "--no-optional-locks", "--no-replace-objects", "-C", repositoryDir,
    "-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false",
    "-c", "core.attributesFile=/dev/null", "-c", "protocol.allow=never",
  ];
  // Do not inherit credential variables, injected Git configuration, external
  // diff programs, alternate repositories, or lazy-fetch authorization.
  const env = {
    PATH: process.env.PATH, LANG: "C", LC_ALL: "C",
    GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_ATTR_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0", GIT_NO_LAZY_FETCH: "1", GIT_NO_REPLACE_OBJECTS: "1", GIT_ALLOW_PROTOCOL: "",
  };
  return (command, maxBuffer = 16 * MiB) => {
    try {
      return execFileSync("git", [...args, ...command], {
        env, maxBuffer, timeout: 30_000, stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      // Never echo a command's potentially untrusted output into runner logs.
      throw new Error(`Local Git ${command[0]} failed or exceeded its output/time limit. Required commit objects must already exist.`, { cause: error.code });
    }
  };
}

function safePath(path) {
  const parts = path.split("/");
  if (!path || Buffer.byteLength(path) > 4096 || path.startsWith("/") || /^[A-Za-z]:/.test(path) ||
      /[\\\x00-\x1f\x7f]/.test(path) || parts.some(part => !part || part === "." || part === "..")) {
    throw new Error("Unsafe path in Git tree; review context was not published.");
  }
  return parts;
}

function planTree(git, role, commitSha) {
  const treeSha = git(["rev-parse", `${commitSha}^{tree}`]).toString("ascii").trim();
  if (!SHA.test(treeSha)) throw new Error("Invalid Git tree identity.");
  let listing;
  try { listing = new TextDecoder("utf-8", { fatal: true }).decode(git(["ls-tree", "--full-tree", "-r", "-l", "-z", treeSha])); }
  catch { throw new Error("Could not read a complete UTF-8 Git tree within the context limits."); }
  if (listing && !listing.endsWith("\0")) throw new Error("Incomplete Git tree listing.");
  const records = listing ? listing.slice(0, -1).split("\0") : [];
  if (records.length > LIMITS.filesPerTree) throw new Error("Git tree exceeds the files-per-tree limit.");
  const files = [], omissions = [];
  let bytes = 0;
  for (const record of records) {
    const match = record.match(/^([0-9]{6}) (blob|commit) ([0-9a-f]{40}) +([0-9]+|-)\t(.+)$/);
    if (!match) throw new Error("Unsafe or malformed path/entry in Git tree.");
    const [, mode, type, blobSha, size, path] = match;
    const parts = safePath(path);
    // Check modes before omissions: a configuration-shaped symlink must not
    // provide a path around the same boundary enforced on ordinary files.
    if (type !== "blob" || !["100644", "100755"].includes(mode)) {
      throw new Error("Unsupported Git mode: symlinks and gitlinks/submodules cannot enter review context.");
    }
    const fileBytes = Number(size);
    if (!Number.isSafeInteger(fileBytes) || fileBytes < 0 || fileBytes > LIMITS.fileBytes) {
      throw new Error("Git blob exceeds the file byte limit.");
    }
    bytes += fileBytes;
    const file = { path, blobSha, mode, bytes: fileBytes };
    if (parts.some(part => OMIT.has(part.toLowerCase()))) {
      omissions.push({ ...file, reason: "model configuration or Git metadata; inspect inert configuration.json and patches" });
    } else files.push(file);
  }
  return { role, commitSha, treeSha, fileCount: records.length, bytes, files, omissions };
}

function mergeBase(git, left, right) {
  const bases = git(["merge-base", "--all", left, right]).toString("ascii").trim().split("\n");
  if (bases.length !== 1 || !SHA.test(bases[0])) throw new Error("Review requires a single unambiguous merge base.");
  return bases[0];
}

function patch(git, filename, fromSha, toSha) {
  const bytes = git([
    "diff", "--no-ext-diff", "--no-textconv", "--no-renames", "--no-color", "--no-relative", "--src-prefix=a/", "--dst-prefix=b/",
    fromSha, toSha, "--",
  ], LIMITS.patchBytes + 1);
  if (bytes.length > LIMITS.patchBytes) throw new Error("Review patch exceeds the byte limit.");
  return { filename, fromSha, toSha, bytes, sha256: digest(bytes) };
}

function readBlob(git, file) {
  const bytes = git(["cat-file", "blob", file.blobSha], LIMITS.fileBytes + 1);
  const actualSha = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
  if (bytes.length !== file.bytes || actualSha !== file.blobSha) throw new Error("Git blob content did not match its recorded identity/size.");
  return bytes;
}

function configurationEvidence(git, trees) {
  const prefix = '{"version":1,"files":[\n', suffix = "\n]}\n";
  const entries = [];
  let length = Buffer.byteLength(prefix + suffix);
  for (const tree of trees) {
    for (const file of tree.omissions) {
      const bytes = readBlob(git, file);
      if (bytes.includes(0)) throw new Error("Omitted configuration contains NUL; review requires readable UTF-8 text.");
      let content;
      try { content = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); }
      catch { throw new Error("Omitted configuration is not valid UTF-8 text."); }
      // Encode before applying the bound: control-character escaping can be
      // several times larger than the source bytes already counted above.
      const entry = JSON.stringify({ role: tree.role, path: file.path, blobSha: file.blobSha, mode: file.mode, bytes: file.bytes, content });
      length += Buffer.byteLength(entry) + (entries.length ? 2 : 0);
      if (length > LIMITS.configurationBytes) throw new Error("Encoded configuration evidence exceeds its byte limit.");
      entries.push(entry);
    }
  }
  return Buffer.from(prefix + entries.join(",\n") + suffix);
}

/**
 * Build an immutable, sanitized local context. repositoryDir is the trusted
 * checkout; reviewDir must not exist. Only existing Git objects are read.
 * The caller owns API identity/writer checks and rechecking moving PR refs.
 */
export function buildContext({ repositoryDir, reviewDir, headSha, baseSha, mainSha, baseRef }) {
  for (const [name, value] of Object.entries({ headSha, baseSha, mainSha })) {
    if (typeof value !== "string" || !SHA.test(value)) throw new Error(`${name} must be a full 40-character commit SHA.`);
  }
  if (typeof baseRef !== "string" || !baseRef || /[\x00-\x1f\x7f]/.test(baseRef)) throw new Error("Invalid base ref.");
  const destination = resolve(reviewDir);
  if (present(destination)) throw new Error("Review directory already exists; refusing to replace it.");
  // A real existing parent prevents writes through a caller-supplied symlink.
  const parent = realpathSync(dirname(destination));
  const target = join(parent, basename(destination));
  if (present(target)) throw new Error("Review directory already exists; refusing to replace it.");
  const git = gitReader(realpathSync(repositoryDir));
  for (const sha of new Set([headSha, baseSha, mainSha])) {
    if (git(["cat-file", "-t", sha]).toString("ascii").trim() !== "commit") throw new Error("Review SHA must identify a commit object.");
  }
  if (baseRef !== "main" && mergeBase(git, baseSha, headSha) !== baseSha) {
    throw new Error("A stacked PR base must be an ancestor of its head.");
  }
  const ancestorSha = baseRef === "main" ? mergeBase(git, baseSha, headSha) : mergeBase(git, mainSha, baseSha);
  const commitList = git(["rev-list", "--topo-order", `--max-count=${LIMITS.commits + 1}`, headSha, `^${mainSha}`]).toString("ascii").trim();
  const commitShas = commitList ? commitList.split("\n") : [];
  if (commitShas.length > LIMITS.commits || commitShas.some(sha => !SHA.test(sha))) {
    throw new Error("Introduced commits exceed the review commit limit or have invalid identities.");
  }
  const trees = [planTree(git, "pr-head", headSha), planTree(git, "pr-base", baseSha), planTree(git, "dependency-base", ancestorSha)];
  const totalBytes = trees.reduce((sum, tree) => sum + tree.bytes, 0);
  if (totalBytes > LIMITS.totalBytes) throw new Error("Review trees exceed the combined byte limit.");
  const configuration = configurationEvidence(git, trees);
  const patches = [
    patch(git, "diff.patch", baseRef === "main" ? ancestorSha : baseSha, headSha),
    patch(git, "dependencies.patch", ancestorSha, baseSha),
    patch(git, "full.patch", ancestorSha, headSha),
  ];
  const manifest = {
    version: 1, headSha, baseSha, mainSha, baseRef, ancestorSha, commitShas, limits: LIMITS, totalBytes,
    trees, patches: patches.map(({ filename, fromSha, toSha, bytes, sha256 }) => ({ filename, fromSha, toSha, bytes: bytes.length, sha256 })),
    configuration: { filename: "configuration.json", bytes: configuration.length, sha256: digest(configuration) },
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  const staging = mkdtempSync(join(parent, `.${basename(target)}.staging-`));
  try {
    mkdirSync(join(staging, "context"));
    for (const tree of trees) {
      mkdirSync(join(staging, tree.role));
      for (const file of tree.files) {
        const bytes = readBlob(git, file);
        const output = join(staging, tree.role, file.path);
        mkdirSync(dirname(output), { recursive: true });
        // Executable Git modes are recorded, never applied to review material.
        writeFileSync(output, bytes, { flag: "wx", mode: 0o444 });
      }
    }
    for (const entry of patches) writeFileSync(join(staging, "context", entry.filename), entry.bytes, { flag: "wx", mode: 0o444 });
    writeFileSync(join(staging, "context/configuration.json"), configuration, { flag: "wx", mode: 0o444 });
    writeFileSync(join(staging, "context/trees.json"), manifestBytes, { flag: "wx", mode: 0o444 });
    if (present(target)) throw new Error("Review directory appeared during preparation; refusing to replace it.");
    renameSync(staging, target);
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
  return { headSha, baseSha, mainSha, ancestorSha, commitShas, manifestDigest: digest(manifestBytes) };
}
