import assert from "node:assert/strict";
import test from "node:test";
import {
  CODEX_BOT, decide, findingsOnHead, mergeMessage, mergeTitle, parseMarkers, protectedChanges,
  shouldStartRun, startPrompt, taskIdOf,
} from "./remediation-autopilot.mjs";

const HEAD = "a".repeat(40);
const NOW = Date.parse("2026-09-26T12:00:00Z");
const minutesAgo = minutes => new Date(NOW - minutes * 60_000).toISOString();
const green = [
  { id: 1, name: "verify", status: "completed", conclusion: "success" },
  { id: 2, name: "Native Chrome WebMCP", status: "completed", conclusion: "success" },
];

function facts(overrides = {}) {
  const { pr, ...rest } = overrides;
  return {
    now: NOW,
    pr: {
      number: 81, title: "fix: reserve route-shadowed handles (R01)", body: "", draft: false,
      headRef: "remediate/R01-handles", headSha: HEAD, labels: [], sameRepo: true, mergeableState: "clean",
      ...pr,
    },
    files: [{ filename: "src/domain/onboarding.ts", deletions: 1 }],
    checks: green,
    statusState: "success",
    reviews: [],
    markers: [],
    codexAcks: [{ sha: HEAD, at: "1970-01-01T00:00:00Z" }],
    pushedAt: minutesAgo(45),
    commitSubjects: ["fix: reserve route-shadowed handles (R01)"],
    commitMessages: ["fix: reserve route-shadowed handles (R01)"],
    ...rest,
  };
}
const fixMarkers = count => Array.from({ length: count }, (_, index) => ({
  kind: "fix", sha: `${index}`.repeat(40), key: null, createdAt: minutesAgo(300 - index), id: index,
}));

test("task IDs come from the title, the template line or the branch", () => {
  assert.equal(taskIdOf({ title: "fix: caps (R02)", body: "", headRef: "x" }), "R02");
  assert.equal(taskIdOf({ title: "fix: caps", body: "- Remediation task, if any: R02 (see", headRef: "x" }), "R02");
  assert.equal(taskIdOf({ title: "fix: caps", body: "", headRef: "remediate/R02-caps" }), "R02");
  assert.equal(taskIdOf({ title: "docs: brief", body: "- Remediation task, if any: R__", headRef: "claude/brief" }), null);
});

test("owner-only paths are detected, including removed lines in verify.yml", () => {
  assert.deepEqual(protectedChanges([{ filename: "vercel.json", deletions: 0 }]), ["vercel.json"]);
  assert.deepEqual(protectedChanges([{ filename: "x.md", previous_filename: "AGENTS.md", deletions: 0 }]), ["x.md"]);
  assert.deepEqual(protectedChanges([{ filename: ".github/workflows/verify.yml", deletions: 2 }]), [".github/workflows/verify.yml (lines removed)"]);
  assert.deepEqual(protectedChanges([{ filename: ".github/workflows/verify.yml", deletions: 0 }]), []);
});

test("review findings on the head commit split into blocking and advisory", () => {
  const reviews = [
    { login: "copilot-pull-request-reviewer[bot]", type: "Bot", state: "COMMENTED", commitId: HEAD, commentCount: 2 },
    { login: CODEX_BOT, type: "Bot", state: "COMMENTED", commitId: HEAD, commentCount: 1 },
    { login: "keeganmoody33", type: "User", state: "COMMENTED", commitId: HEAD, commentCount: 1 },
    { login: CODEX_BOT, type: "Bot", state: "COMMENTED", commitId: "b".repeat(40), commentCount: 5 },
  ];
  assert.deepEqual(findingsOnHead(reviews, HEAD), { total: 4, blocking: 2 });
});

test("markers count only from trusted authors", () => {
  const comments = [
    { id: 1, login: "github-actions[bot]", body: `x <!-- remediation-autopilot:note sha=${HEAD} key=merge-failed -->`, createdAt: minutesAgo(5) },
    { id: 2, login: "stranger", body: `<!-- remediation-autopilot:fix sha=${HEAD} -->`, createdAt: minutesAgo(4) },
    { id: 3, login: "keeganmoody33", body: `@codex review\n\n<!-- remediation-autopilot:review sha=${HEAD} -->`, createdAt: minutesAgo(3) },
  ];
  const markers = parseMarkers(comments, ["github-actions[bot]", "keeganmoody33"]);
  assert.deepEqual(markers.map(marker => [marker.kind, marker.key]), [["note", "merge-failed"], ["review", null]]);
});

test("pull requests the autopilot must leave alone are skipped", () => {
  assert.equal(decide(facts({ pr: { title: "docs: brief", headRef: "claude/brief" } })).type, "skip");
  assert.equal(decide(facts({ pr: { draft: true } })).type, "skip");
  assert.equal(decide(facts({ pr: { sameRepo: false } })).type, "skip");
  assert.equal(decide(facts({ pr: { labels: ["needs-owner-approval"] } })).type, "skip");
});

test("owner-only files and owner-approved tasks send the pull request to the owner", () => {
  const decision = decide(facts({ files: [{ filename: ".github/workflows/release.yml", deletions: 0 }] }));
  assert.deepEqual([decision.type, decision.label], ["label-owner", "needs-owner-approval"]);
  const terms = decide(facts({ pr: { title: "feat: add Terms page (R07)", headRef: "remediate/R07-terms" } }));
  assert.deepEqual([terms.type, terms.label], ["label-owner", "needs-owner-approval"]);
});

test("failing checks ask Codex for a fix once per commit, up to the round limit", () => {
  const failing = [{ id: 1, name: "verify", status: "completed", conclusion: "failure" }, green[1]];
  assert.deepEqual([decide(facts({ checks: failing })).type, decide(facts({ checks: failing })).kind], ["request-fix", "ci"]);
  const asked = [{ kind: "fix", sha: HEAD, key: null, createdAt: minutesAgo(10), id: 9 }];
  assert.equal(decide(facts({ checks: failing, markers: asked })).type, "wait");
  const exhausted = decide(facts({ checks: failing, markers: fixMarkers(3) }));
  assert.deepEqual([exhausted.type, exhausted.label], ["label-owner", "needs-owner"]);
});

test("conflicts and stale branches ask Codex to merge main", () => {
  assert.equal(decide(facts({ pr: { mergeableState: "dirty" } })).kind, "conflict");
  assert.equal(decide(facts({ pr: { mergeableState: "behind" } })).kind, "update");
});

test("review comments ask for a fix; advisory ones stop blocking after the round limit", () => {
  const copilot = [{ login: "copilot-pull-request-reviewer[bot]", type: "Bot", state: "COMMENTED", commitId: HEAD, commentCount: 2 }];
  assert.equal(decide(facts({ reviews: copilot })).kind, "review");
  assert.equal(decide(facts({ reviews: copilot, markers: fixMarkers(3) })).type, "merge");
  const codex = [{ login: CODEX_BOT, type: "Bot", state: "COMMENTED", commitId: HEAD, commentCount: 1 }];
  assert.equal(decide(facts({ reviews: codex, markers: fixMarkers(3) })).label, "needs-owner");
});

test("merging waits for checks, the quiet window and the Codex review", () => {
  const running = [{ id: 1, name: "verify", status: "in_progress", conclusion: null }, green[1]];
  assert.equal(decide(facts({ checks: running })).type, "wait");
  assert.equal(decide(facts({ checks: [green[0]] })).type, "wait");
  assert.equal(decide(facts({ statusState: "pending" })).type, "wait");
  assert.equal(decide(facts({ pushedAt: minutesAgo(10) })).type, "wait");
  assert.equal(decide(facts({ codexAcks: [] })).type, "request-review");
  const asked = minutes => [{ kind: "review", sha: HEAD, key: null, createdAt: minutesAgo(minutes), id: 7 }];
  assert.equal(decide(facts({ codexAcks: [], markers: asked(20) })).type, "wait");
  const timedOut = decide(facts({ codexAcks: [], markers: asked(61) }));
  assert.deepEqual([timedOut.type, timedOut.taskId], ["merge", "R01"]);
  assert.equal(decide(facts({ codexAcks: [{ sha: null, at: minutesAgo(5) }], markers: asked(20) })).type, "merge");
  assert.equal(decide(facts({ codexAcks: [{ sha: null, at: minutesAgo(90) }] })).type, "request-review");
  assert.equal(decide(facts({ pr: { mergeableState: "blocked" } })).type, "wait");
  assert.equal(decide(facts()).type, "merge");
});

test("a run pull request is renamed after its task, or closed if Codex never pushes", () => {
  const run = { title: "Remediation run 20260926", headRef: "remediate/run-20260926T1200", labels: ["remediation-run"] };
  const start = [{ kind: "start", sha: HEAD, key: null, createdAt: minutesAgo(30), id: 1 }];
  assert.equal(decide(facts({ pr: run, markers: start, commitSubjects: ["chore: start a remediation run"] })).type, "wait");
  const late = [{ ...start[0], createdAt: minutesAgo(7 * 60) }];
  assert.equal(decide(facts({ pr: run, markers: late, commitSubjects: ["chore: start a remediation run"] })).type, "close-runner");
  const renamed = decide(facts({ pr: run, markers: start, commitSubjects: ["chore: start a remediation run", "fix: cap published text (R02)"] }));
  assert.deepEqual([renamed.type, renamed.title], ["retitle", "fix: cap published text (R02)"]);
});

test("a new run starts only when nothing is in flight", () => {
  const task = { number: 81, title: "fix: caps (R02)", body: "", headRef: "x", draft: false, labels: [] };
  const waitingRun = { number: 82, title: "Remediation run 20260926", body: "", headRef: "remediate/run-1", draft: false, labels: ["remediation-run"] };
  assert.equal(shouldStartRun({ open: [waitingRun], recentRuns: [], now: NOW }).start, false);
  assert.equal(shouldStartRun({ open: [task], recentRuns: [], now: NOW }).start, false);
  assert.equal(shouldStartRun({ open: [{ ...task, labels: ["needs-owner-approval"] }], recentRuns: [], now: NOW }).start, true);
  const many = Array.from({ length: 6 }, (_, index) => ({ number: index, createdAt: minutesAgo(60 * index), closedAt: minutesAgo(30), merged: true }));
  assert.equal(shouldStartRun({ open: [], recentRuns: many, now: NOW }).start, false);
  const stalled = [{ number: 5, createdAt: minutesAgo(600), closedAt: minutesAgo(120), merged: false }];
  assert.equal(shouldStartRun({ open: [], recentRuns: stalled, now: NOW }).start, false);
  assert.equal(shouldStartRun({ open: [], recentRuns: [], now: NOW }).start, true);
});

test("merge commits carry the task ID and Codex's commit messages", () => {
  assert.equal(mergeTitle({ title: "fix: caps", number: 81 }, "R02"), "fix: caps (R02) (#81)");
  assert.equal(mergeTitle({ title: "fix: caps (R02)", number: 81 }, "R02"), "fix: caps (R02) (#81)");
  const message = mergeMessage(["chore: start a remediation run", "fix: caps (R02)\n\nQuestion: which limit?"]);
  assert.match(message, /Question: which limit\?/);
  assert.doesNotMatch(message, /start a remediation run/);
});

test("the start prompt names the tasks to skip", () => {
  assert.match(startPrompt(["R07", "R10"]), /skip them: R07, R10\./);
  assert.doesNotMatch(startPrompt([]), /skip them/);
});
