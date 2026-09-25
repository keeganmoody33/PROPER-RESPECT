import assert from "node:assert/strict";
import test from "node:test";
import {
  CODEX_BOT, codexAsk, decide, findingsOnHead, mergeMessage, mergeTitle, parseMarkers, protectedChanges,
  shouldStartRun, startPrompt, taskIdOf,
} from "./remediation-autopilot.mjs";

const HEAD = "a".repeat(40);
const NOW = Date.parse("2026-09-26T12:00:00Z");
const minutesAgo = minutes => new Date(NOW - minutes * 60_000).toISOString();
const check = (name, status = "completed", conclusion = "success", app = "github-actions") => ({ name, app, status, conclusion, startedAt: minutesAgo(45) });
const green = [check("verify"), check("Native Chrome WebMCP")];
const reviewAsk = (minutes = 20) => ({ kind: "review", sha: HEAD, key: null, createdAt: minutesAgo(minutes), id: 7 });
const cleanReply = (minutes = 10) => ({ body: "Codex Review: Didn't find any major issues. Nice work.", createdAt: minutesAgo(minutes) });
const comment = (login, extra = {}) => ({ login, type: login.endsWith("[bot]") || login === "Copilot" ? "Bot" : "User", association: "NONE", inReplyTo: null, originalCommitId: HEAD, url: `https://example/${login}`, ...extra });

function facts(overrides = {}) {
  const { pr, ...rest } = overrides;
  return {
    now: NOW,
    trustedAuthors: ["keeganmoody33", "github-actions[bot]", CODEX_BOT],
    pr: {
      number: 81, title: "fix: reserve route-shadowed handles (R01)", body: "", draft: false,
      headRef: "remediate/R01-handles", headSha: HEAD, baseRef: "main", author: "keeganmoody33",
      createdAt: minutesAgo(120), changedFiles: 1, labels: [], sameRepo: true, mergeableState: "clean",
      ...pr,
    },
    files: [{ filename: "src/domain/onboarding.ts", deletions: 1 }],
    checks: green,
    statusState: "success",
    reviews: [],
    reviewComments: [],
    markers: [reviewAsk()],
    codexComments: [cleanReply()],
    pushedAt: minutesAgo(45),
    commitAuthors: ["keeganmoody33"],
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
  assert.equal(taskIdOf({ title: "fix: caps", body: "## Task\n\n- Remediation task, if any: R02 (see", headRef: "x" }), "R02");
  assert.equal(taskIdOf({ title: "fix: caps", body: "", headRef: "remediate/R02-caps" }), "R02");
  assert.equal(taskIdOf({ title: "chore: bump", body: "Release notes quote Remediation task, if any: R12", headRef: "dependabot/x" }), null);
  assert.equal(taskIdOf({ title: "docs: brief", body: "- Remediation task, if any: R__", headRef: "claude/brief" }), null);
});

test("owner-only paths include every workflow file", () => {
  assert.deepEqual(protectedChanges([{ filename: "vercel.json" }]), ["vercel.json"]);
  assert.deepEqual(protectedChanges([{ filename: "x.md", previous_filename: "AGENTS.md" }]), ["x.md"]);
  assert.deepEqual(protectedChanges([{ filename: ".github/workflows/verify.yml", deletions: 0 }]), [".github/workflows/verify.yml"]);
  assert.deepEqual(protectedChanges([{ filename: "src/app.ts" }]), []);
});

test("review findings count only top-level comments on the head from trusted reviewers", () => {
  const comments = [
    comment("copilot-pull-request-reviewer[bot]"),
    comment("Copilot"),
    comment(CODEX_BOT),
    comment("keeganmoody33", { association: "OWNER" }),
    comment("stranger"),
    comment("vercel[bot]", { inReplyTo: 5 }),
    comment(CODEX_BOT, { originalCommitId: "b".repeat(40) }),
  ];
  const reviews = [
    { login: "stranger", association: "NONE", state: "CHANGES_REQUESTED", commitId: HEAD },
    { login: "keeganmoody33", association: "OWNER", state: "CHANGES_REQUESTED", commitId: HEAD },
  ];
  const result = findingsOnHead(comments, reviews, HEAD);
  assert.deepEqual([result.total, result.blocking, result.urls.length], [5, 3, 4]);
});

test("markers count only from the owner and the workflow bot", () => {
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
  assert.equal(decide(facts({ pr: { baseRef: "release" } })).type, "skip");
  assert.equal(decide(facts({ pr: { author: "dependabot[bot]" } })).type, "skip");
  assert.equal(decide(facts({ pr: { labels: ["needs-owner-approval"] } })).type, "skip");
});

test("owner-only files, owner-approved tasks, Devin commits and unchecked files go to the owner", () => {
  const workflow = decide(facts({ files: [{ filename: ".github/workflows/verify.yml" }] }));
  assert.deepEqual([workflow.type, workflow.label], ["label-owner", "needs-owner-approval"]);
  const terms = decide(facts({ pr: { title: "feat: add Terms page (R07)", headRef: "remediate/R07-terms" } }));
  assert.deepEqual([terms.type, terms.label], ["label-owner", "needs-owner-approval"]);
  assert.equal(decide(facts({ commitAuthors: ["devin-ai-integration[bot]"] })).label, "needs-owner");
  assert.equal(decide(facts({ pr: { changedFiles: 2 } })).label, "needs-owner-approval");
});

test("failing checks ask Codex for a fix once per commit, up to the round limit", () => {
  const failing = [check("verify", "completed", "failure"), green[1]];
  assert.deepEqual([decide(facts({ checks: failing })).type, decide(facts({ checks: failing })).kind], ["request-fix", "ci"]);
  const cancelled = [check("verify", "completed", "cancelled"), green[1]];
  assert.equal(decide(facts({ checks: cancelled })).kind, "ci");
  const asked = [{ kind: "fix", sha: HEAD, key: null, createdAt: minutesAgo(10), id: 9 }];
  assert.equal(decide(facts({ checks: failing, markers: asked, codexComments: [] })).type, "wait");
  const exhausted = decide(facts({ checks: failing, markers: fixMarkers(3) }));
  assert.deepEqual([exhausted.type, exhausted.label], ["label-owner", "needs-owner"]);
  const thirdParty = decide(facts({ checks: [...green, check("Vercel Agent Review", "completed", "failure", "vercel")] }));
  assert.equal(thirdParty.label, "needs-owner");
});

test("a fix request that Codex answers without pushing goes to the owner", () => {
  const failing = [check("verify", "completed", "failure"), green[1]];
  const asked = [{ kind: "fix", sha: HEAD, key: null, createdAt: minutesAgo(120), id: 9 }];
  const answered = decide(facts({ checks: failing, markers: asked, codexComments: [{ body: "I couldn't reproduce it.", createdAt: minutesAgo(90) }] }));
  assert.equal(answered.label, "needs-owner");
});

test("conflicts ask for a fix; a stale branch asks for an update outside the fix rounds", () => {
  assert.equal(decide(facts({ pr: { mergeableState: "dirty" } })).kind, "conflict");
  assert.equal(decide(facts({ pr: { mergeableState: "behind" }, markers: fixMarkers(3) })).type, "request-update");
  const updates = Array.from({ length: 5 }, (_, index) => ({ kind: "update", sha: `${index}`.repeat(40), key: null, createdAt: minutesAgo(60), id: index }));
  assert.equal(decide(facts({ pr: { mergeableState: "behind" }, markers: updates })).label, "needs-owner");
});

test("review comments ask for a fix that lists them; advisory ones stop blocking after the round limit", () => {
  const copilot = [comment("copilot-pull-request-reviewer[bot]")];
  const decision = decide(facts({ reviewComments: copilot }));
  assert.deepEqual([decision.kind, decision.urls], ["review", ["https://example/copilot-pull-request-reviewer[bot]"]]);
  assert.match(codexAsk(decision, HEAD), /ignore any other comment/);
  assert.match(codexAsk(decision, HEAD), /example\/copilot/);
  assert.equal(decide(facts({ reviewComments: copilot, markers: [...fixMarkers(3), reviewAsk()] })).type, "merge");
  const codex = [comment(CODEX_BOT)];
  assert.equal(decide(facts({ reviewComments: codex, markers: fixMarkers(3) })).label, "needs-owner");
});

test("merging waits for checks and the quiet window", () => {
  assert.equal(decide(facts({ checks: [check("verify", "in_progress", null), green[1]] })).type, "wait");
  assert.equal(decide(facts({ checks: [green[0]] })).type, "wait");
  assert.equal(decide(facts({ checks: [check("verify", "completed", "skipped"), green[1]] })).label, "needs-owner");
  assert.equal(decide(facts({ statusState: "pending" })).type, "wait");
  assert.equal(decide(facts({ pushedAt: minutesAgo(10) })).type, "wait");
  assert.equal(decide(facts({ pr: { mergeableState: "blocked" } })).type, "wait");
});

test("merging needs a clean Codex review requested for the head commit", () => {
  assert.equal(decide(facts({ markers: [] })).type, "request-review");
  assert.equal(decide(facts({ codexComments: [] })).type, "wait");
  assert.equal(decide(facts({ markers: [reviewAsk(61)], codexComments: [] })).label, "needs-owner");
  assert.equal(decide(facts({ codexComments: [{ body: "You've hit your usage limit.", createdAt: minutesAgo(5) }] })).label, "needs-owner");
  assert.equal(decide(facts({ codexComments: [{ body: cleanReply().body, createdAt: minutesAgo(30) }] })).type, "wait");
  const merge = decide(facts());
  assert.deepEqual([merge.type, merge.taskId], ["merge", "R01"]);
});

test("any wait that lasts past the stuck limit goes to the owner", () => {
  const stuck = decide(facts({ checks: [check("verify", "queued", null), green[1]], pushedAt: minutesAgo(7 * 60) }));
  assert.deepEqual([stuck.type, stuck.label], ["label-owner", "needs-owner"]);
});

test("a run pull request is renamed after its task, retried, closed, or paused", () => {
  const run = { title: "Remediation run 20260926", headRef: "remediate/run-20260926T1200", labels: [], author: "github-actions[bot]", createdAt: minutesAgo(30) };
  const start = [{ kind: "start", sha: HEAD, key: null, createdAt: minutesAgo(30), id: 1 }];
  const only = ["chore: start a remediation run"];
  assert.equal(decide(facts({ pr: run, markers: start, commitSubjects: only })).type, "wait");
  assert.equal(decide(facts({ pr: run, markers: [], commitSubjects: only })).type, "request-start");
  const late = [{ ...start[0], createdAt: minutesAgo(7 * 60) }];
  assert.equal(decide(facts({ pr: run, markers: late, commitSubjects: only })).type, "close-runner");
  assert.equal(decide(facts({ pr: run, markers: late, commitSubjects: [...only, "wip"] })).label, "needs-owner");
  assert.equal(decide(facts({ pr: { ...run, labels: ["needs-owner"] }, markers: late, commitSubjects: only })).type, "skip");
  const renamed = decide(facts({ pr: run, markers: start, commitSubjects: [...only, "fix: cap published text (R02)"] }));
  assert.deepEqual([renamed.type, renamed.title], ["retitle", "fix: cap published text (R02)"]);
});

test("a new run starts only when nothing is in flight", () => {
  const task = { number: 81, title: "fix: caps (R02)", body: "", headRef: "x", draft: false, labels: [] };
  const waitingRun = { number: 82, title: "Remediation run 20260926", body: "", headRef: "remediate/run-1", draft: false, labels: [] };
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

test("Codex prompts name what to do", () => {
  assert.match(startPrompt(["R07", "R10"]), /skip them: R07, R10\./);
  assert.doesNotMatch(startPrompt([]), /skip them/);
  assert.equal(codexAsk({ type: "request-review" }, HEAD), "@codex review");
  assert.match(codexAsk({ type: "request-update" }, HEAD), /behind main/);
  assert.match(codexAsk({ type: "request-fix", kind: "ci", reason: "failing: verify" }, HEAD), /\(verify\)/);
});
