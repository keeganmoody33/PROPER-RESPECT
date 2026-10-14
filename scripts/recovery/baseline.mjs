#!/usr/bin/env node
// Read-only snapshot of git state for the recovery program.
// Usage: node scripts/recovery/baseline.mjs [repo-path] > docs/recovery/baseline.md
import { execFileSync } from "node:child_process";

const repo = process.argv[2] ?? process.cwd();
const git = (...args) =>
  execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trimEnd();
const lines = (text) => (text ? text.split("\n") : []);
const cell = (value) => String(value ?? "").replaceAll("|", "\\|");
const row = (values) => `| ${values.map(cell).join(" | ")} |`;

const mainCheckout = git("rev-parse", "--path-format=absolute", "--git-common-dir").replace(/\/\.git$/, "");
const mainSha = git("rev-parse", "refs/heads/main");
const originMainSha = git("rev-parse", "refs/remotes/origin/main");

const [behindMain, aheadMain] = git("rev-list", "--left-right", "--count", "origin/main...main").split(/\s+/);

function divergence(ref) {
  const [behind, ahead] = git("rev-list", "--left-right", "--count", `origin/main...${ref}`).split(/\s+/);
  return { ahead, behind };
}

function refs(pattern) {
  return lines(
    git(
      "for-each-ref",
      pattern,
      "--sort=-committerdate",
      "--format=%(refname:short)%09%(objectname:short)%09%(committerdate:short)%09%(subject)",
    ),
  ).map((line) => {
    const [name, sha, date, subject] = line.split("\t");
    return { name, sha, date, subject };
  });
}

function worktrees() {
  const blocks = git("worktree", "list", "--porcelain").split("\n\n");
  return blocks.filter(Boolean).map((block) => {
    const entry = { flags: [] };
    for (const line of block.split("\n")) {
      const [key, ...rest] = line.split(" ");
      const value = rest.join(" ");
      if (key === "worktree") entry.path = value;
      else if (key === "HEAD") entry.sha = value.slice(0, 7);
      else if (key === "branch") entry.branch = value.replace("refs/heads/", "");
      else if (key === "detached") entry.flags.push("detached");
      else if (key === "prunable" || key === "locked") entry.flags.push(key);
    }
    if (!entry.flags.includes("prunable")) {
      try {
        entry.dirty = lines(execFileSync("git", ["-C", entry.path, "status", "--porcelain=v1"], { encoding: "utf8" }).trimEnd()).length;
      } catch {
        entry.dirty = "unreadable";
      }
    }
    return entry;
  });
}

const tags = lines(
  git("for-each-ref", "refs/tags", "--sort=-creatordate", "--count=5", "--format=%(refname:short)%09%(*objectname:short)%(objectname:short)%09%(creatordate:short)"),
);
const status = git("-C", mainCheckout, "status", "--porcelain=v1");
const stashes = lines(git("stash", "list"));
const trees = worktrees();
const local = refs("refs/heads");
const remote = refs("refs/remotes/origin").filter((ref) => ref.name !== "origin/HEAD" && ref.name !== "origin");

const out = [];
out.push("# Recovery baseline");
out.push("");
out.push(`Generated: ${new Date().toISOString()} by \`node scripts/recovery/baseline.mjs\`. Read-only; rerun to refresh.`);
out.push("");
out.push("## Main");
out.push("");
out.push(`- Main checkout: \`${mainCheckout}\``);
out.push(`- \`main\`: \`${mainSha}\``);
out.push(`- \`origin/main\` (as of the last fetch): \`${originMainSha}\` (local main ahead ${aheadMain}, behind ${behindMain})`);
out.push(`- Main checkout status: ${status ? "uncommitted entries below" : "clean"}`);
for (const line of lines(status)) out.push(`  - \`${line}\``);
out.push(`- Stashes: ${stashes.length || "none"}`);
for (const line of stashes) out.push(`  - \`${line}\``);
out.push("");
out.push("## Latest tags");
out.push("");
out.push(row(["Tag", "Commit", "Date"]));
out.push(row(["---", "---", "---"]));
for (const line of tags) out.push(row(line.split("\t").map((value, index) => (index === 1 ? value.slice(0, 7) : value))));
out.push("");
const prunable = trees.filter((tree) => tree.flags.includes("prunable")).length;
out.push(`## Worktrees (${trees.length}; ${prunable} prunable, meaning the directory is gone)`);
out.push("");
out.push("Recorded only. The recovery program never removes or prunes worktrees.");
out.push("");
out.push(row(["Path", "HEAD", "Branch", "Flags", "Uncommitted entries"]));
out.push(row(["---", "---", "---", "---", "---"]));
for (const tree of trees) out.push(row([tree.path, tree.sha, tree.branch ?? "", tree.flags.join(", "), tree.dirty ?? ""]));
out.push("");
out.push(`## Local branches (${local.length})`);
out.push("");
out.push(row(["Branch", "Head", "Date", "Ahead of origin/main", "Behind", "Subject"]));
out.push(row(["---", "---", "---", "---", "---", "---"]));
for (const ref of local) {
  const { ahead, behind } = divergence(ref.name);
  out.push(row([ref.name, ref.sha, ref.date, ahead, behind, ref.subject]));
}
out.push("");
out.push(`## Remote branches on origin (${remote.length})`);
out.push("");
out.push(row(["Branch", "Head", "Date", "Ahead of origin/main", "Behind", "Subject"]));
out.push(row(["---", "---", "---", "---", "---", "---"]));
for (const ref of remote) {
  const { ahead, behind } = divergence(ref.name);
  out.push(row([ref.name, ref.sha, ref.date, ahead, behind, ref.subject]));
}
out.push("");
process.stdout.write(out.join("\n"));
