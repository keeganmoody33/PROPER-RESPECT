import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { currentReview, loadContext, main, post, prepare, readVerdict, requestedPins, reviewBody } from "../../scripts/claude-review.mjs";

const REPO = "o/r";
const HEAD = "a".repeat(40), BASE = "b".repeat(40), DEP = "c".repeat(40), MAIN = "d".repeat(40), ANCESTOR = "e".repeat(40);
const pins = { headSha: HEAD, baseSha: BASE, mainSha: MAIN, ancestorSha: ANCESTOR, baseRef: "review/dependencies", headRef: "feat/history", number: 88, repo: REPO };
const pull = () => ({ state: "open", title: "Private history", body: "", user: { login: "owner" },
  head: { ref: pins.headRef, sha: HEAD, repo: { full_name: REPO } },
  base: { ref: pins.baseRef, sha: BASE, repo: { full_name: REPO } } });
const commit = (sha, claude = false) => ({ sha, author: { login: claude ? "claude" : "owner" }, commit: { message: "fix: preserve history" } });
function fake({ later = null, dependencyWriter = false, reviewStatus = 200, mainSha = MAIN } = {}) {
  let reads = 0;
  const posted = [];
  return { posted,
    async request(path, options = {}) {
      if (options.method === "POST") {
        if (path.endsWith("/reviews") && reviewStatus !== 200) throw Object.assign(new Error("review refused"), { status: reviewStatus });
        posted.push(options.body); return { id: 9 };
      }
      if (path === "/repos/{repo}/pulls/88") return reads++ && later ? later : pull();
      if (path === "/repos/{repo}/git/ref/heads/main") return { object: { sha: mainSha } };
      if (path === `/repos/{repo}/commits/${DEP}`) return commit(DEP, dependencyWriter);
      throw new Error(`unexpected path ${path}`);
    },
    async all(path) {
      if (path.endsWith("/commits")) return [commit(HEAD)];
      if (path.endsWith("/files")) return [];
      throw new Error(`unexpected list ${path}`);
    },
  };
}
function contextBuilder({ reviewDir, ...requested }) {
  assert.equal(requested.headSha, HEAD);
  assert.equal(requested.baseSha, BASE);
  assert.equal(requested.mainSha, MAIN);
  const dir = join(reviewDir, "context");
  mkdirSync(dir, { recursive: true });
  const manifest = JSON.stringify({ ...pins, commitShas: [DEP, HEAD] });
  writeFileSync(join(dir, "trees.json"), manifest);
  for (const name of ["diff.patch", "dependencies.patch", "full.patch"]) writeFileSync(join(dir, name), `pinned ${name}\n`);
  return { ...pins, commitShas: [DEP, HEAD], manifestDigest: createHash("sha256").update(manifest).digest("hex") };
}
const options = github => ({ github, repo: REPO, number: 88,
  dir: join(mkdtempSync(join(tmpdir(), "claude-stack-runner-")), "review/context"),
  hasToken: true, mainSha: MAIN, repositoryDir: "/trusted/main", expectedHeadSha: HEAD, expectedBaseSha: BASE, contextBuilder });

test("stack review pins the base, head and introduced dependency authorship", async () => {
  const args = options(fake());
  const result = await prepare(args);
  assert.equal(result.skip, undefined);
  const context = JSON.parse(readFileSync(join(args.dir, "pr.json"), "utf8"));
  for (const key of ["headSha", "baseSha", "mainSha", "ancestorSha"]) assert.equal(context[key], pins[key]);
  assert.match(readFileSync(join(args.dir, "commits.txt"), "utf8"), new RegExp(DEP));
  assert.equal((await prepare(options(fake({ dependencyWriter: true })))).skip, "writer");
});

test("stack review refuses missing or mismatched owner pins and base movement", async () => {
  for (const override of [{ expectedBaseSha: "" }, { expectedHeadSha: "f".repeat(40) }, { expectedBaseSha: "f".repeat(40) }]) {
    assert.equal((await prepare({ ...options(fake()), ...override })).skip, "pins");
  }
  const later = pull(); later.base.sha = "f".repeat(40);
  assert.equal((await prepare(options(fake({ later })))).skip, "moved");
});

test("stack review stale clean becomes no verdict while findings retain their old context", async () => {
  const later = pull(); later.base.sha = "f".repeat(40);
  for (const verdict of ["clean", "findings"]) {
    const github = fake({ later });
    await github.request("/repos/{repo}/pulls/88");
    const findings = verdict === "findings" ? [{ severity: "P1", file: "removed.txt", revision: "base", line: 1, problem: "Deletion loses evidence", why: "History lost", fix: "Retain evidence" }] : [];
    const result = await post({ github, repo: REPO, number: 88, sha: HEAD, runId: "123", conclusion: "success", context: pins,
      raw: JSON.stringify({ verdict, summary: "Review", findings, notes: [] }) });
    assert.equal(result.verdict, verdict === "clean" ? "none" : "findings");
    assert.match(github.posted[0].body, /base.*changed|context.*changed/i);
    if (findings.length) assert.match(github.posted[0].body, new RegExp(`/blob/${BASE}/removed.txt`));
  }
});

test("stack review finding links distinguish base and dependency ancestor", () => {
  for (const [revision, sha, prefix] of [["base", BASE, "pr-base"], ["ancestor", ANCESTOR, "dependency-base"]]) {
    const result = readVerdict(JSON.stringify({ verdict: "findings", summary: "", notes: [], findings: [
      { severity: "P1", file: `${prefix}/removed.txt`, revision, problem: "Lost", why: "Needed", fix: "Keep" },
    ] }));
    assert.equal(result.verdict, "findings");
    assert.match(reviewBody({ result, sha: HEAD, runId: "123", repo: REPO, context: pins }), new RegExp(`/blob/${sha}/removed.txt`));
  }
});


test("owner dispatch pins are full SHA data and both are required together", () => {
  assert.deepEqual(requestedPins(), { expectedHeadSha: "", expectedBaseSha: "" });
  assert.deepEqual(requestedPins(HEAD, BASE), { expectedHeadSha: HEAD, expectedBaseSha: BASE });
  for (const head of ["$(command)", `${HEAD} extra`, `${HEAD}\n`, "aaa"]) {
    assert.throws(() => requestedPins(head, BASE), /Both review pins/);
  }
  assert.throws(() => requestedPins(HEAD, ""), /Both review pins/);
});

test("immediately-before-model validation rejects every moving identity and writer claim", async () => {
  const mutations = [
    p => { p.state = "closed"; }, p => { p.head.sha = DEP; }, p => { p.head.ref = "changed"; },
    p => { p.base.sha = DEP; }, p => { p.base.ref = "changed"; },
    p => { p.head.repo.full_name = "fork/r"; }, p => { p.base.repo.full_name = "fork/r"; },
    p => { p.body = "Generated with [Claude Code]"; }, p => { p.user.login = "claude"; },
  ];
  for (const mutate of mutations) {
    const later = pull(); mutate(later);
    const github = fake({ later }); await github.request("/repos/{repo}/pulls/88");
    assert.equal((await currentReview({ github, repo: REPO, number: 88, context: pins })).ok, false);
  }
  assert.equal((await currentReview({ github: fake({ mainSha: DEP }), repo: REPO, number: 88, context: pins })).ok, false);
  const args = options(fake()); const prepared = await prepare(args);
  const env = { GITHUB_REPOSITORY: REPO, PR_NUMBER: "88", REVIEW_CONTEXT_DIR: args.dir,
    MANIFEST_DIGEST: prepared.manifestDigest, GITHUB_OUTPUT: join(args.dir, "step-output") };
  assert.equal((await main(["check"], env, () => {}, fake())).ok, true);
  assert.match(readFileSync(env.GITHUB_OUTPUT, "utf8"), /ready=true/);
  assert.equal((await main(["check"], env, () => {}, fake({ mainSha: DEP }))).ok, false);
  assert.match(readFileSync(env.GITHUB_OUTPUT, "utf8"), /ready=false/);
});

test("manifest mismatch and wrong PR cannot reach the model or post a result", async () => {
  const args = options(fake()); const prepared = await prepare(args);
  assert.equal(loadContext(args.dir, prepared.manifestDigest, REPO, 88).baseSha, BASE);
  assert.throws(() => loadContext(args.dir, prepared.manifestDigest, REPO, 89), /does not match/);
  assert.throws(() => loadContext(args.dir, prepared.manifestDigest, "fork/r", 88), /does not match/);
  assert.throws(() => loadContext(args.dir, "", REPO, 88), /required/);
  writeFileSync(join(args.dir, "trees.json"), "changed");
  const github = fake();
  await assert.rejects(main(["check"], { GITHUB_REPOSITORY: REPO, PR_NUMBER: "88", REVIEW_CONTEXT_DIR: args.dir,
    MANIFEST_DIGEST: prepared.manifestDigest }, () => {}, github), /manifest changed/);
  assert.equal(github.posted.length, 0);
});

test("a force-push racing post cannot fall back to a clean review comment", async () => {
  const github = fake({ reviewStatus: 422 });
  const result = await post({ github, repo: REPO, number: 88, sha: HEAD, runId: "123", context: pins,
    raw: JSON.stringify({ verdict: "clean", summary: "", findings: [], notes: [] }) });
  assert.deepEqual(result, { verdict: "none", where: "comment" });
  assert.match(github.posted[0].body, /refused the pinned review/);
});

test("context failure and inconsistent dependency metadata stop preparation", async () => {
  const args = options(fake());
  assert.equal((await prepare({ ...args, contextBuilder() { throw new Error("unsafe source tree"); } })).skip, "context");
  const github = fake(); const original = github.request;
  github.request = async (...params) => params[0].endsWith(`/commits/${DEP}`) ? commit(HEAD) : original(...params);
  assert.equal((await prepare(options(github))).skip, "context");
});
