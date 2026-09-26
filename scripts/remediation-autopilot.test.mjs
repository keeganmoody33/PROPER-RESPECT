import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CODEX_BOT, cleanReviewer, codexAsk, codexReviewStatus, createGitHub, decide, findingsOnHead, latestChecks, main, mergeMessage,
  mergeTitle, parseMarkers, protectedChanges, recentClosedPulls, shouldStartRun, startPrompt, taskIdOf, taskIdsOf,
} from "./remediation-autopilot.mjs";

const HEAD = "a".repeat(40);
const NOW = Date.parse("2026-09-26T12:00:00Z");
const minutesAgo = minutes => new Date(NOW - minutes * 60_000).toISOString();
const check = (name, status = "completed", conclusion = "success", app = "github-actions") => ({ name, app, status, conclusion, startedAt: minutesAgo(45) });
const green = [check("verify"), check("Native Chrome WebMCP")];
const reviewAsk = (minutes = 20, key = null) => ({ kind: "review", sha: HEAD, key, createdAt: minutesAgo(minutes), id: 7 });
const summary = (status, minutes = 10, sha = HEAD) => ({
  body: `<!-- codex-pull-request-review-summary -->\n\n## Codex Review Summary\n\n| Review | Status | Commit | Review trigger |\n| --- | --- | --- | --- |\n| 📝 **Code Review** | ${status === "Completed" ? "✅" : status === "Failed" ? "⚠️" : "🔄"} **${status}** <relative-time datetime="x">x</relative-time> | \`${sha.slice(0, 7)}\` | Manual request |\n`,
  createdAt: minutesAgo(40), updatedAt: minutesAgo(minutes),
});
const somethingWrong = minutes => ({ body: "Codex Review: Something went wrong. Try again later by commenting “@codex review”.", createdAt: minutesAgo(minutes), updatedAt: minutesAgo(minutes) });
const comment = (login, extra = {}) => ({ login, type: login.endsWith("[bot]") || login === "Copilot" ? "Bot" : "User", association: "NONE", inReplyTo: null, originalCommitId: HEAD, url: `https://example/${login}`, ...extra });
const copilotReview = (body = "Copilot reviewed 3 files and generated no comments.", extra = {}) => ({
  login: "copilot-pull-request-reviewer[bot]", type: "Bot", association: "NONE", state: "COMMENTED", commitId: HEAD, body,
  url: "https://example/copilot-review", ...extra,
});
const OPEN_FINDINGS = "<!-- ccr-overview-v2 -->\n### 🟡 Changes recommended\n<details open>\n<summary><strong>Open (2)</strong></summary>\n";

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
    statuses: [{ context: "Devin Review", state: "success" }],
    reviews: [],
    copilotPending: false,
    reviewComments: [],
    markers: [reviewAsk()],
    codexComments: [summary("Completed")],
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

test("only queued task IDs count", () => {
  assert.equal(taskIdOf({ title: "fix: caps (R30)", body: "", headRef: "x" }), "R30");
  for (const id of ["R00", "R31", "R99"]) assert.equal(taskIdOf({ title: `fix: unrelated (${id})`, body: "", headRef: "x" }), null);
  assert.equal(taskIdOf({ title: "fix: caps", body: "- Remediation task, if any: R45", headRef: "remediate/R99-x" }), null);
  assert.equal(decide(facts({ pr: { title: "fix: unrelated change (R99)", headRef: "fix/x" } })).type, "skip");
  assert.equal(mergeTitle({ title: "fix: caps (R99)", number: 81 }, "R02"), "fix: caps (R99) (#81) (R02)");
});

test("owner-only paths include every workflow file", () => {
  assert.deepEqual(protectedChanges([{ filename: "vercel.json" }]), ["vercel.json"]);
  assert.deepEqual(protectedChanges([{ filename: "x.md", previous_filename: "AGENTS.md" }]), ["x.md"]);
  assert.deepEqual(protectedChanges([{ filename: ".github/workflows/verify.yml", deletions: 0 }]), [".github/workflows/verify.yml"]);
  assert.deepEqual(protectedChanges([{ filename: "src/app.ts" }]), []);
  // Claude reviews Codex's tasks, so its script and pinned CLI are the owner's too.
  for (const filename of ["scripts/claude-review.mjs", "scripts/claude-review.test.mjs", ".github/claude-review/package-lock.json"]) {
    assert.deepEqual(protectedChanges([{ filename }]), [filename]);
  }
});

test("trusted top-level review findings survive new heads until disposition", () => {
  const comments = [
    comment("copilot-pull-request-reviewer[bot]"),
    comment("Copilot"),
    comment(CODEX_BOT),
    comment("keeganmoody33", { association: "OWNER" }),
    comment("stranger"),
    comment("vercel[bot]", { inReplyTo: 5 }),
    comment(CODEX_BOT, { originalCommitId: "b".repeat(40) }),
    // Made on an earlier commit; GitHub has moved its commit_id to the head.
    comment(CODEX_BOT, { originalCommitId: "b".repeat(40), commitId: HEAD }),
  ];
  const reviews = [
    { login: "stranger", type: "User", association: "NONE", state: "CHANGES_REQUESTED", commitId: HEAD, url: "https://example/r1" },
    { login: "keeganmoody33", type: "User", association: "OWNER", state: "CHANGES_REQUESTED", commitId: HEAD, url: "https://example/r2" },
    { login: "cursor[bot]", type: "Bot", association: "NONE", state: "CHANGES_REQUESTED", commitId: HEAD, url: "https://example/r3" },
    copilotReview(OPEN_FINDINGS),
  ];
  const result = findingsOnHead(comments, reviews, HEAD);
  // Six comments, two requested-changes reviews and the overview count;
  // prior-head Codex comments still block.
  assert.deepEqual([result.total, result.blocking], [9, 5]);
  for (const url of ["https://example/r2", "https://example/r3", "https://example/copilot-review"]) assert.ok(result.urls.includes(url), url);
});

test("a Copilot review that lists open findings without commenting on the commit is a finding", () => {
  const found = findingsOnHead([], [copilotReview(OPEN_FINDINGS)], HEAD);
  assert.deepEqual([found.total, found.blocking, found.urls], [1, 0, ["https://example/copilot-review"]]);
  const decision = decide(facts({ reviews: [copilotReview(OPEN_FINDINGS)] }));
  assert.deepEqual([decision.type, decision.kind, decision.urls], ["request-fix", "review", ["https://example/copilot-review"]]);
  assert.equal(findingsOnHead([], [copilotReview(OPEN_FINDINGS, { commitId: "b".repeat(40) })], HEAD).total, 1);
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
  const thirdParty = decide(facts({ checks: [...green, check("Snyk", "completed", "failure", "snyk")] }));
  assert.equal(thirdParty.label, "needs-owner");
  assert.equal(decide(facts({ checks: [...green, check("Vercel Agent Review", "completed", "failure", "vercel")], reviews: [copilotReview()] })).type, "merge");
});

test("failed commit statuses go to the owner, never to Codex; reviewer statuses don't count", () => {
  const vercel = decide(facts({ statuses: [{ context: "Vercel", state: "failure" }] }));
  assert.deepEqual([vercel.type, vercel.label], ["label-owner", "needs-owner"]);
  assert.match(vercel.reason, /Vercel failed/);
  assert.equal(decide(facts({ statuses: [{ context: "Vercel", state: "error" }] })).label, "needs-owner");
  assert.equal(decide(facts({ statuses: [{ context: "Devin Review", state: "failure" }], reviews: [copilotReview()] })).type, "merge");
  assert.equal(decide(facts({ statuses: [{ context: "Devin Review", state: "pending" }] })).type, "wait");
  // Devin reports success even when it skipped the review for lack of
  // credits, so its status never clears a PR.
  assert.equal(decide(facts({ statuses: [{ context: "Devin Review", state: "success" }] })).type, "wait");
});

test("only the newest attempt of each check counts", () => {
  const run = (id, conclusion, startedAt, name = "verify") => ({ id, name, app: { slug: "github-actions" }, status: "completed", conclusion, started_at: startedAt });
  const latest = latestChecks([run(1, "failure", "2026-09-26T10:00:00Z"), run(2, "success", "2026-09-26T10:30:00Z"), run(3, "success", "2026-09-26T09:00:00Z", "Native Chrome WebMCP")]);
  assert.deepEqual(latest.map(entry => [entry.name, entry.conclusion]), [["verify", "success"], ["Native Chrome WebMCP", "success"]]);
  assert.equal(latestChecks([run(5, "success", null), run(4, "failure", null)])[0].id, 5);
});

test("paged lists are read to the end or not at all", async () => {
  const original = globalThis.fetch;
  const full = Array.from({ length: 100 }, (_, index) => ({ index }));
  try {
    globalThis.fetch = async url => ({ ok: true, status: 200, text: async () => JSON.stringify(url.includes("page=3") ? [{ index: 1 }] : full) });
    assert.equal((await createGitHub("t", "o/r").all("/repos/{repo}/pulls/1/comments", data => data, 3)).length, 201);
    globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify(full) });
    await assert.rejects(createGitHub("t", "o/r").all("/repos/{repo}/pulls/1/comments", data => data, 3), error => error.code === "TRUNCATED" && /o\/r\/pulls\/1\/comments/.test(error.message));
  } finally {
    globalThis.fetch = original;
  }
});

test("a fix request that Codex answers without pushing goes to the owner", () => {
  const failing = [check("verify", "completed", "failure"), green[1]];
  const asked = [{ kind: "fix", sha: HEAD, key: null, createdAt: minutesAgo(120), id: 9 }];
  const answered = decide(facts({ checks: failing, markers: asked, codexComments: [{ body: "I couldn't reproduce it.", createdAt: minutesAgo(95), updatedAt: minutesAgo(95) }] }));
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
  // After the round limit, bots' findings stop asking for fixes. Copilot is the
  // only outside reviewer, and it left them, so nothing can clear the PR.
  assert.equal(decide(facts({ reviewComments: copilot, markers: [...fixMarkers(3), reviewAsk()] })).type, "wait");
  const held = decide(facts({ reviewComments: copilot, reviews: [copilotReview()], markers: [...fixMarkers(3), reviewAsk()] }));
  assert.deepEqual([held.type, held.label], ["label-owner", "needs-owner"]);
  const codex = [comment(CODEX_BOT)];
  assert.equal(decide(facts({ reviewComments: codex, markers: fixMarkers(3) })).label, "needs-owner");
});

test("merging waits for checks and the quiet window", () => {
  assert.equal(decide(facts({ checks: [check("verify", "in_progress", null), green[1]] })).type, "wait");
  assert.equal(decide(facts({ checks: [green[0]] })).type, "wait");
  assert.equal(decide(facts({ checks: [check("verify", "completed", "skipped"), green[1]] })).label, "needs-owner");
  assert.equal(decide(facts({ statuses: [{ context: "Vercel", state: "pending" }] })).type, "wait");
  assert.equal(decide(facts({ pushedAt: minutesAgo(10) })).type, "wait");
  const blocked = decide(facts({ pr: { mergeableState: "blocked" }, reviews: [copilotReview()] }));
  assert.deepEqual([blocked.type, blocked.reason], ["wait", "GitHub merge state is blocked"]);
});

test("Codex's review summary is read per commit", () => {
  assert.equal(codexReviewStatus([summary("Running")], HEAD).status, "Running");
  assert.equal(codexReviewStatus([summary("Completed", 10, "b".repeat(40))], HEAD), null);
  assert.equal(codexReviewStatus([somethingWrong(5)], HEAD), null);
});

test("a clean review comes only from a finished, finding-free Copilot review, or Codex's summary on a PR Codex didn't write", () => {
  const base = facts({ codexComments: [] });
  assert.equal(cleanReviewer(base), null);
  // Codex writes every task, so its own completed review never clears one.
  assert.equal(cleanReviewer({ ...base, codexComments: [summary("Completed")] }), null);
  assert.equal(cleanReviewer({ ...base, codexComments: [summary("Completed")] }, "Claude"), "Codex");
  assert.equal(cleanReviewer({ ...base, codexComments: [summary("Completed", 10, "b".repeat(40))] }, "Claude"), null);
  const copilot = copilotReview();
  assert.equal(cleanReviewer({ ...base, reviews: [copilot] }), "Copilot");
  assert.equal(cleanReviewer({ ...base, reviews: [copilotReview("<!-- ccr-overview-v2 -->\n### ✅ No changes recommended\n")] }), "Copilot");
  const quota = copilotReview("Copilot was unable to review this pull request because the user who requested the review has reached their quota limit.");
  assert.equal(cleanReviewer({ ...base, reviews: [quota] }), null);
  assert.equal(cleanReviewer({ ...base, reviews: [copilotReview(OPEN_FINDINGS)] }), null);
  assert.equal(cleanReviewer({ ...base, reviews: [copilotReview("### 🟡 Changes recommended\n")] }), null);
  assert.equal(cleanReviewer({ ...base, reviews: [copilotReview("**Review effort:** Lite\n**Findings:** 2 high")] }), null);
  assert.equal(cleanReviewer({ ...base, reviews: [copilotReview("", { state: "CHANGES_REQUESTED" })] }), null);
  assert.equal(cleanReviewer({ ...base, reviews: [copilotReview("", { state: "PENDING" })] }), null);
  // Unknown formats fail closed; resolved findings don't block.
  assert.equal(cleanReviewer({ ...base, reviews: [copilotReview("Looks fine to me.")] }), null);
  assert.equal(cleanReviewer({ ...base, reviews: [copilotReview("")] }), null);
  const overview = (section, verdict = "### 🟢 Looks good") => copilotReview(`<!-- ccr-overview-v2 -->\n## Copilot review overview\n\n${verdict}\n\n<details>\n<summary><strong>${section}</strong></summary>\n</details>`);
  assert.equal(cleanReviewer({ ...base, reviews: [overview("Previously missed (1)")] }), null);
  assert.equal(cleanReviewer({ ...base, reviews: [overview("Resolved since last review (3)")] }), "Copilot");
  // The overview's verdict has to say it found nothing. "Needs a closer look"
  // with no listed findings is neither clean nor a finding. Copilot is the
  // only outside reviewer wired so far, so the owner decides.
  const closerLook = overview("Resolved since last review (3)", "### 🔵 Needs a closer look");
  assert.equal(cleanReviewer({ ...base, reviews: [closerLook] }), null);
  assert.equal(findingsOnHead([], [closerLook], HEAD).total, 0);
  const held = decide(facts({ reviews: [closerLook] }));
  assert.deepEqual([held.type, held.label], ["label-owner", "needs-owner"]);
  assert.match(held.reason, /Copilot reviewed aaaaaaa without a clean verdict/);
  assert.equal(decide(facts({ reviews: [closerLook], codexComments: [], markers: [] })).label, "needs-owner");
  assert.equal(findingsOnHead([], [overview("Previously missed (1)", "### 🔵 Needs a closer look")], HEAD).total, 1);
  assert.equal(cleanReviewer({ ...base, reviews: [overview("Resolved since last review (3)", "### 🟣 Something new")] }), null);
  assert.equal(findingsOnHead([], [overview("Resolved since last review (3)", "### 🟣 Something new")], HEAD).total, 0);
  assert.equal(cleanReviewer({ ...base, reviews: [copilotReview("<!-- ccr-overview-v2 -->\n**Findings:** None\n")] }), null);
  assert.equal(cleanReviewer({ ...base, reviews: [copilotReview("Copilot reviewed 2 of 2 files. Adds quota handling; generated no comments.")] }), null);
  assert.deepEqual(findingsOnHead([comment("Copilot")], [overview("Previously missed (1)")], HEAD).urls, ["https://example/Copilot", "https://example/copilot-review"]);
  // A later clean review is not an explicit dismissal of earlier findings.
  assert.equal(cleanReviewer({ ...base, reviews: [copilotReview(OPEN_FINDINGS), copilot] }), null);
  assert.equal(cleanReviewer({ ...base, codexComments: [summary("Completed")], reviewComments: [comment(CODEX_BOT)] }), null);
});

test("a PR whose commits name another task goes to the owner", () => {
  const mixed = decide(facts({ commitSubjects: ["fix: reserve route-shadowed handles (R01)", "fix: cap published text (R02)"] }));
  assert.deepEqual([mixed.type, mixed.label], ["label-owner", "needs-owner"]);
  assert.match(mixed.reason, /R02/);
  const loose = ["chore: start a remediation run", "fix: reserve route-shadowed handles (R01)", "wip", "Merge branch 'main' into remediate/run-1"];
  assert.equal(decide(facts({ commitSubjects: loose, reviews: [copilotReview()] })).type, "merge");
});

test("merging needs an outside review of the head commit, asked for and retried through an outage", () => {
  const ask = decide(facts({ markers: [], codexComments: [] }));
  assert.deepEqual([ask.type, ask.copilot, ask.codex], ["request-review", true, false]);
  assert.equal(decide(facts({ codexComments: [] })).type, "wait");
  assert.equal(decide(facts({ codexComments: [summary("Running")] })).type, "wait");
  const silent = decide(facts({ markers: [reviewAsk(61)], codexComments: [] }));
  assert.deepEqual([silent.type, silent.retry, silent.copilot, silent.codex], ["request-review", true, true, false]);
  // Copilot out of quota after the ask: ask again at once, then an hour after
  // each failure, up to the limit.
  const quota = minutes => copilotReview("Copilot was unable to review this pull request because the user who requested the review has reached their quota limit.", { submittedAt: minutesAgo(minutes) });
  const outOfQuota = decide(facts({ reviews: [quota(5)] }));
  assert.deepEqual([outOfQuota.type, outOfQuota.retry], ["request-review", true]);
  // That answer ends Copilot's review even while GitHub still shows it
  // pending, so the first retry isn't held for the review wait.
  const stillPending = decide(facts({ copilotPending: true, reviews: [quota(5)] }));
  assert.deepEqual([stillPending.type, stillPending.retry], ["request-review", true]);
  assert.equal(decide(facts({ markers: [reviewAsk(30), reviewAsk(15, "retry")], reviews: [quota(5)] })).type, "wait");
  assert.equal(decide(facts({ markers: [reviewAsk(130), reviewAsk(70, "retry")], reviews: [quota(65)] })).retry, true);
  const retries = Array.from({ length: 6 }, (_, index) => reviewAsk(400 - index * 60, "retry"));
  const exhausted = decide(facts({ markers: [reviewAsk(460), ...retries], reviews: [quota(65)] }));
  assert.deepEqual([exhausted.type, exhausted.label], ["label-owner", "needs-owner"]);
  assert.match(exhausted.reason, /Copilot failed 7 times/);
  // A quota answer from before the latest ask isn't a new failure.
  assert.equal(decide(facts({ reviews: [quota(30)] })).type, "wait");
  // Codex's own reviews of a task it wrote neither retry nor clear.
  assert.equal(decide(facts({ codexComments: [summary("Failed", 5)] })).type, "wait");
  assert.equal(decide(facts({ codexComments: [somethingWrong(5)] })).type, "wait");
  assert.equal(decide(facts()).type, "wait");
  const merge = decide(facts({ reviews: [copilotReview()] }));
  assert.deepEqual([merge.type, merge.taskId, merge.reviewer], ["merge", "R01", "Copilot"]);
  assert.match(merge.reason, /Copilot/);
});

test("the outside review is asked of Copilot alone and waited for", () => {
  assert.equal(decide(facts({ markers: [], codexComments: [], copilotPending: true })).type, "wait");
  assert.equal(decide(facts({ codexComments: [], copilotPending: true })).reason, "Copilot reviewing");
  // An old quota answer with no ask since gets a fresh ask.
  const quota = copilotReview("Copilot was unable to review this pull request because the user who requested the review has reached their quota limit.", { submittedAt: minutesAgo(90) });
  const fresh = decide(facts({ markers: [], reviews: [quota] }));
  assert.deepEqual([fresh.type, fresh.copilot, fresh.codex], ["request-review", true, false]);
  const byCopilot = decide(facts({ codexComments: [summary("Failed", 5)], markers: [reviewAsk(30), reviewAsk(15, "retry")], reviews: [copilotReview()] }));
  assert.deepEqual([byCopilot.type, byCopilot.reviewer], ["merge", "Copilot"]);
  // A Codex review in progress, such as an automatic one, holds a merge until
  // the review wait runs out, since its findings would still block.
  assert.equal(decide(facts({ codexComments: [summary("Running")], reviews: [copilotReview()] })).type, "wait");
  assert.equal(decide(facts({ codexComments: [summary("Running")], markers: [reviewAsk(61)], reviews: [copilotReview()] })).reviewer, "Copilot");
  assert.equal(decide(facts({ codexComments: [summary("Running")], markers: [reviewAsk(61)] })).type, "request-review");
});

test("reviewer checks never count as CI", () => {
  const copilotCheck = check("copilot-pull-request-reviewer", "completed", "failure");
  assert.equal(decide(facts({ checks: [...green, copilotCheck], reviews: [copilotReview()] })).type, "merge");
  assert.equal(decide(facts({ checks: [...green, check("copilot-pull-request-reviewer", "in_progress", null)] })).type, "wait");
});

test("a failed fix attempt is retried through an outage; Codex's summary comment isn't a reply", () => {
  const failing = [check("verify", "completed", "failure"), green[1]];
  const fixAsk = (minutes, key = null) => ({ kind: "fix", sha: HEAD, key, createdAt: minutesAgo(minutes), id: minutes });
  const asked = [fixAsk(40)];
  assert.equal(decide(facts({ checks: failing, markers: asked, codexComments: [somethingWrong(20)] })).retry, true);
  assert.equal(decide(facts({ checks: failing, markers: asked, codexComments: [{ ...summary("Completed", 5), createdAt: minutesAgo(35) }] })).type, "wait");
  const retried = [...asked, fixAsk(30, "retry")];
  assert.equal(decide(facts({ checks: failing, markers: retried, codexComments: [somethingWrong(10)] })).type, "wait");
  const hourLater = decide(facts({ checks: failing, markers: [fixAsk(140), fixAsk(80, "retry")], codexComments: [somethingWrong(70)] }));
  assert.deepEqual([hourLater.type, hourLater.kind, hourLater.retry], ["request-fix", "ci", true]);
  const retries = Array.from({ length: 6 }, (_, index) => fixAsk(420 - index * 60, "retry"));
  // Retries don't use up fix rounds.
  assert.equal(decide(facts({ checks: failing, markers: [fixAsk(480), ...retries], codexComments: [somethingWrong(70)] })).label, "needs-owner");
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
  assert.equal(decide(facts({ pr: run, markers: start, commitSubjects: [...only, "fix: something else (R99)"] })).type, "wait");
  // A failed start is asked again, then an hour after each failure.
  const failedStart = decide(facts({ pr: run, markers: start, commitSubjects: only, codexComments: [somethingWrong(20)] }));
  assert.deepEqual([failedStart.type, failedStart.retry], ["request-start", true]);
  const restarted = [...start, { ...start[0], key: "retry", createdAt: minutesAgo(15) }];
  assert.equal(decide(facts({ pr: run, markers: restarted, commitSubjects: only, codexComments: [somethingWrong(10)] })).type, "wait");
});

test("run limits read every PR closed or changed in the last day", async () => {
  const page = updatedMinutesAgo => Array.from({ length: 100 }, () => ({ updated_at: minutesAgo(updatedMinutesAgo) }));
  const pages = [page(60), page(600), [...page(1200).slice(0, 99), { updated_at: minutesAgo(25 * 60) }], page(30 * 60)];
  const asked = [];
  const github = { request: async path => { asked.push(path); return pages[Number(path.match(/&page=(\d+)/)[1]) - 1]; } };
  assert.equal((await recentClosedPulls(github, NOW)).length, 300);
  assert.equal(asked.length, 3);
  assert.match(asked[0], /sort=updated&direction=desc/);
  const endless = { request: async () => page(10) };
  await assert.rejects(recentClosedPulls(endless, NOW, 3), error => error.code === "TRUNCATED");
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
  assert.equal(mergeTitle({ title: "fix: caps", number: 81 }, "R02"), "fix: caps (#81) (R02)");
  assert.equal(mergeTitle({ title: "fix: caps (R02)", number: 81 }, "R02"), "fix: caps (#81) (R02)");
  const message = mergeMessage(["chore: start a remediation run", "fix: caps (R02)\n\nQuestion: which limit?"], "Copilot");
  assert.match(message, /Question: which limit\?/);
  assert.match(message, /reviewed cleanly by Copilot/);
  assert.doesNotMatch(message, /start a remediation run/);
});

test("Codex prompts name what to do", () => {
  assert.match(startPrompt(["R07", "R10"]), /skip them: R07, R10\./);
  assert.doesNotMatch(startPrompt([]), /skip them/);
  assert.equal(codexAsk({ type: "request-review" }, HEAD), "@codex review");
  assert.match(codexAsk({ type: "request-update" }, HEAD), /behind main/);
  assert.match(codexAsk({ type: "request-fix", kind: "ci", reason: "failing: verify" }, HEAD), /\(verify\)/);
});

test("PRs naming two different tasks go to the owner", () => {
  assert.deepEqual(taskIdsOf({ title: "fix: caps (R01)", body: "", headRef: "remediate/R02-caps" }), ["R01", "R02"]);
  assert.equal(taskIdOf({ title: "fix: caps (R01)", body: "", headRef: "remediate/R02-caps" }), null);
  assert.equal(taskIdOf({ title: "fix: caps (R02)", body: "- Remediation task, if any: R02", headRef: "remediate/R02-caps" }), "R02");
  const mixed = decide(facts({ pr: { title: "fix: caps (R01)", headRef: "remediate/R02-caps" } }));
  assert.deepEqual([mixed.type, mixed.label], ["label-owner", "needs-owner"]);
  assert.match(mixed.reason, /R01, R02/);
});

test("Copilot's changes-recommended verdict counts with or without an emoji", () => {
  const base = facts({ codexComments: [] });
  for (const verdict of ["### Changes recommended", "## 🔴 Changes recommended", "### ⚠️ Some changes recommended"]) {
    const review = copilotReview(`<!-- ccr-overview-v2 -->\n${verdict}\n`);
    assert.equal(cleanReviewer({ ...base, reviews: [review] }), null, verdict);
    assert.equal(findingsOnHead([], [review], HEAD).total, 1, verdict);
  }
  assert.equal(cleanReviewer({ ...base, reviews: [copilotReview("<!-- ccr-overview-v2 -->\n### No changes recommended\n")] }), "Copilot");
});

// A fake GitHub API for main(): one clean task PR, with review comments that
// can change between the autopilot's two looks. With copilotClean, Copilot has
// reviewed the head commit and found nothing.
const CLAUDE_RUN = { path: ".github/workflows/claude-review.yml", head_branch: "main", event: "issue_comment", repository: { full_name: "o/r" } };

function fakeGitHub({ laterComments = [], issueComments = null, mergeFails = false, copilotClean = false, claudeClean = false, claudeRun = CLAUDE_RUN } = {}) {
  const sha = "c".repeat(40);
  const ago = minutes => new Date(Date.now() - minutes * 60_000).toISOString();
  const reviews = copilotClean ? [{
    user: { login: "copilot-pull-request-reviewer[bot]", type: "Bot" }, author_association: "NONE", state: "COMMENTED",
    commit_id: sha, body: "Copilot reviewed 1 of 1 changed files and generated no comments.", html_url: "https://example/copilot", submitted_at: ago(15),
  }] : [];
  if (claudeClean) reviews.push({
    user: { login: "github-actions[bot]", type: "Bot" }, author_association: "NONE", state: "COMMENTED", commit_id: sha,
    body: `### Claude review of \`${sha.slice(0, 7)}\`: clean\n\n<!-- claude-review verdict=clean sha=${sha} run=77 -->`,
    html_url: "https://example/claude", submitted_at: ago(12),
  });
  const pull = {
    number: 81, title: "fix: reserve route-shadowed handles (R01)", body: "", draft: false, created_at: ago(120),
    head: { ref: "remediate/R01-handles", sha, repo: { full_name: "o/r" } }, base: { ref: "main", repo: { full_name: "o/r" } },
    user: { login: "owner" }, labels: [], changed_files: 1, commits: 1, mergeable_state: "clean", requested_reviewers: [],
  };
  const calls = [];
  let reviewCommentReads = 0;
  const routes = {
    "GET /user": () => ({ login: "owner" }),
    "GET /repos/o/r/pulls": () => [pull],
    "GET /repos/o/r/pulls/81": () => pull,
    "GET /repos/o/r/pulls/81/files": () => [{ filename: "src/domain/onboarding.ts" }],
    [`GET /repos/o/r/commits/${sha}/check-runs`]: () => ({ check_runs: ["verify", "Native Chrome WebMCP"].map((name, id) => ({
      id, name, app: { slug: "github-actions" }, status: "completed", conclusion: "success", started_at: ago(45) })) }),
    [`GET /repos/o/r/commits/${sha}/status`]: () => ({ state: "success", total_count: 0, statuses: [] }),
    "GET /repos/o/r/pulls/81/reviews": () => reviews,
    "GET /repos/o/r/pulls/81/comments": () => (reviewCommentReads++ === 0 ? [] : laterComments),
    "GET /repos/o/r/issues/81/comments": () => issueComments ?? [
      { id: 1, user: { login: "owner" }, body: `@codex review\n\n<!-- remediation-autopilot:review sha=${sha} -->`, created_at: ago(20), updated_at: ago(20) },
      { id: 2, user: { login: CODEX_BOT }, created_at: ago(18), updated_at: ago(10),
        body: `<!-- codex-pull-request-review-summary -->\n| 📝 **Code Review** | ✅ **Completed** | \`${sha.slice(0, 7)}\` | Manual request |` },
    ],
    "GET /repos/o/r/pulls/81/commits": () => [{ commit: { message: "fix: reserve route-shadowed handles (R01)" }, author: { login: "owner" }, committer: { login: "owner" } }],
    [`GET /repos/o/r/commits/${sha}`]: () => ({ commit: { committer: { date: ago(50) } } }),
    "PUT /repos/o/r/pulls/81/merge": () => (mergeFails ? { merged: false, message: "Base branch policy prohibits the merge" } : { merged: true, sha: "d".repeat(40) }),
    "POST /repos/o/r/labels": () => ({ name: "needs-owner" }),
    "POST /repos/o/r/issues/81/labels": () => [{ name: "needs-owner" }],
    "POST /repos/o/r/issues/81/comments": () => ({ id: 9 }),
    "PATCH /repos/o/r/issues/comments/9": () => ({ id: 9 }),
    "POST /repos/o/r/pulls/81/requested_reviewers": () => pull,
    "DELETE /repos/o/r/git/refs/heads/remediate/R01-handles": () => null,
    "GET /repos/o/r/actions/runs/77": () => claudeRun,
  };
  const fetch = async (url, { method = "GET", body, headers = {} } = {}) => {
    const { pathname } = new URL(url);
    const key = `${method} ${pathname}`;
    calls.push({ key, body: body ? JSON.parse(body) : null, token: headers.authorization });
    if (!routes[key]) return { ok: false, status: 404, text: async () => JSON.stringify({ message: `no fake for ${key}` }) };
    const data = routes[key]();
    return { ok: true, status: data === null ? 204 : 200, text: async () => (data === null ? "" : JSON.stringify(data)) };
  };
  return { fetch, calls, sha };
}

async function runMain(fake, env = {}) {
  const original = globalThis.fetch;
  const lines = [];
  globalThis.fetch = fake.fetch;
  try {
    await main({ GITHUB_REPOSITORY: "o/r", GITHUB_REPOSITORY_OWNER: "owner", GH_TOKEN: "t", CODEX_TRIGGER_TOKEN: "t2", AUTOPILOT_ENABLED: "true", ...env }, line => lines.push(line));
  } finally {
    globalThis.fetch = original;
  }
  return lines;
}

test("main merges a clean task PR once, pinned to its commit, and deletes the branch", async () => {
  const fake = fakeGitHub({ copilotClean: true });
  await runMain(fake);
  const merges = fake.calls.filter(call => call.key === "PUT /repos/o/r/pulls/81/merge");
  assert.equal(merges.length, 1);
  assert.equal(merges[0].body.sha, fake.sha);
  assert.equal(merges[0].body.commit_title, "fix: reserve route-shadowed handles (#81) (R01)");
  assert.match(merges[0].body.commit_message, /reviewed cleanly by Copilot/);
  assert.ok(fake.calls.some(call => call.key === "DELETE /repos/o/r/git/refs/heads/remediate/R01-handles"));
});

test("main never merges a Codex task on Codex's own review", async () => {
  const fake = fakeGitHub();
  await runMain(fake);
  assert.equal(fake.calls.filter(call => call.key === "PUT /repos/o/r/pulls/81/merge").length, 0);
});

test("main doesn't merge when a finding lands between its two looks", async () => {
  const late = [{ user: { login: "Copilot", type: "Bot" }, author_association: "NONE", in_reply_to_id: null,
    original_commit_id: "c".repeat(40), html_url: "https://example/late" }];
  const fake = fakeGitHub({ laterComments: late, copilotClean: true });
  const lines = await runMain(fake);
  assert.equal(fake.calls.filter(call => call.key === "PUT /repos/o/r/pulls/81/merge").length, 0);
  assert.ok(lines.some(line => /not merging: a second look says request-fix/.test(line)), lines.join("\n"));
});

test("main asks Copilot, never Codex, to review a Codex task, and marks the ask", async () => {
  const fake = fakeGitHub({ issueComments: [] });
  await runMain(fake);
  const posts = fake.calls.filter(call => call.key === "POST /repos/o/r/issues/81/comments");
  assert.equal(posts.length, 1);
  assert.doesNotMatch(posts[0].body.body, /@codex/);
  assert.match(posts[0].body.body, new RegExp(`<!-- remediation-autopilot:review sha=${fake.sha} key=dispatch-pending -->$`));
  assert.equal(posts[0].token, "Bearer t");
  const finalized = fake.calls.find(call => call.key === "PATCH /repos/o/r/issues/comments/9");
  assert.match(finalized.body.body, new RegExp(`<!-- remediation-autopilot:review sha=${fake.sha} -->$`));
  assert.ok(fake.calls.indexOf(posts[0]) < fake.calls.findIndex(call => call.key.endsWith("requested_reviewers")));
  const copilot = fake.calls.filter(call => call.key === "POST /repos/o/r/pulls/81/requested_reviewers");
  assert.deepEqual([copilot.length, copilot[0]?.body, copilot[0]?.token], [1, { reviewers: ["copilot-pull-request-reviewer[bot]"] }, "Bearer t2"]);
  assert.equal(fake.calls.filter(call => call.key === "PUT /repos/o/r/pulls/81/merge").length, 0);
});

test("without the trigger token, a Codex task's review goes to the owner with a note that names Copilot", async () => {
  const fake = fakeGitHub({ issueComments: [] });
  await runMain(fake, { CODEX_TRIGGER_TOKEN: undefined });
  assert.deepEqual(fake.calls.find(call => call.key === "POST /repos/o/r/issues/81/labels")?.body, { labels: ["needs-owner"] });
  const posts = fake.calls.filter(call => call.key === "POST /repos/o/r/issues/81/comments");
  assert.equal(posts.length, 1);
  assert.match(posts[0].body.body, /needs a Copilot review/);
  assert.doesNotMatch(posts[0].body.body, /@codex/);
  assert.equal(fake.calls.filter(call => call.key === "POST /repos/o/r/pulls/81/requested_reviewers").length, 0);
});

test("a merge that fails twice at the same commit is held for the owner", async () => {
  const sha = "c".repeat(40);
  const ago = minutes => new Date(Date.now() - minutes * 60_000).toISOString();
  const clean = [
    { id: 1, user: { login: "owner" }, body: `@codex review\n\n<!-- remediation-autopilot:review sha=${sha} -->`, created_at: ago(20), updated_at: ago(20) },
    { id: 2, user: { login: CODEX_BOT }, created_at: ago(18), updated_at: ago(10),
      body: `<!-- codex-pull-request-review-summary -->\n| 📝 **Code Review** | ✅ **Completed** | \`${sha.slice(0, 7)}\` | Manual request |` },
  ];
  const first = fakeGitHub({ mergeFails: true, issueComments: clean, copilotClean: true });
  await assert.rejects(runMain(first), /hit errors/);
  const firstNotes = first.calls.filter(call => call.key === "POST /repos/o/r/issues/81/comments").map(call => call.body.body);
  assert.equal(firstNotes.length, 1);
  assert.match(firstNotes[0], /tries once more/);
  assert.equal(first.calls.filter(call => call.key === "POST /repos/o/r/issues/81/labels").length, 0);
  const noted = [...clean, { id: 3, user: { login: "github-actions[bot]" }, body: `x\n\n<!-- remediation-autopilot:note sha=${sha} key=merge-failed -->`, created_at: ago(5), updated_at: ago(5) }];
  const second = fakeGitHub({ mergeFails: true, issueComments: noted, copilotClean: true });
  await assert.rejects(runMain(second), /hit errors/);
  assert.deepEqual(second.calls.find(call => call.key === "POST /repos/o/r/issues/81/labels")?.body, { labels: ["needs-owner"] });
  assert.match(second.calls.filter(call => call.key === "POST /repos/o/r/issues/81/comments").at(-1).body.body, /failed twice/);
});

test("quota retry handles the actual unfinished Copilot check but never bypasses running CI", () => {
  const quota = copilotReview("Copilot was unable to review", { submittedAt: minutesAgo(5) });
  const checks = [...green, check("copilot-pull-request-reviewer", "in_progress", null)];
  const f = facts({ reviews: [quota], copilotPending: true, checks });
  assert.equal(decide(f).type, "request-review");
  assert.equal(decide({ ...f, checks: [...checks, check("build", "in_progress", null)] }).type, "wait");
});

test("only complete supported affirmative review bodies clear", () => {
  const bodies = [
    "<!-- ccr-overview-v2 -->\n### Not ready to merge",
    "<!-- ccr-overview-v2 -->\n### Looks good except for a critical bug",
    "<!-- ccr-overview-v2 -->\n### No action taken",
    "<!-- ccr-overview-v2 -->\n### Looks good\nBut a blocker remains.",
    "The old report generated no comments; current review found a blocker.",
    "Copilot reviewed 3 files and generated no comments. But a blocker remains.",
  ];
  for (const body of bodies) assert.notEqual(decide(facts({ reviews: [copilotReview(body)] })).type, "merge", body);
  assert.equal(decide(facts({ reviews: [copilotReview()] })).type, "merge");
  assert.equal(cleanReviewer(facts({ reviews: [copilotReview("<!-- ccr-overview-v2 -->\n### ✅ No changes recommended\n")] })), "Copilot");
});

test("prior-head trusted findings survive pushes and later approvals until native dismissal", () => {
  const old = "b".repeat(40);
  const owner = { id: 100, login: "keeganmoody33", type: "User", association: "OWNER", state: "CHANGES_REQUESTED", commitId: old };
  const writer = comment(CODEX_BOT, { originalCommitId: old, reviewId: 101 });
  assert.notEqual(decide(facts({ reviews: [owner, copilotReview()] })).type, "merge");
  assert.notEqual(decide(facts({ reviews: [copilotReview()], reviewComments: [writer] })).type, "merge");
  assert.notEqual(decide(facts({ reviews: [owner, { ...owner, id: 102, state: "APPROVED", commitId: HEAD }, copilotReview()] })).type, "merge");
  const dismissed = [{ ...owner, state: "DISMISSED" }, { id: 101, login: CODEX_BOT, type: "Bot", state: "DISMISSED", commitId: old }, copilotReview()];
  assert.equal(decide(facts({ reviews: dismissed, reviewComments: [writer] })).type, "merge");
  assert.notEqual(decide(facts({ reviews: dismissed, reviewComments: [{ ...writer, reviewId: undefined }] })).type, "merge");
});

test("earlier Copilot finding bodies are not disposed by a fresh clean review", () => {
  const old = copilotReview(OPEN_FINDINGS, { id: 5, commitId: "b".repeat(40) });
  assert.notEqual(decide(facts({ reviews: [old, copilotReview()], markers: fixMarkers(3) })).type, "merge");
  assert.equal(decide(facts({ reviews: [{ ...old, state: "DISMISSED" }, copilotReview()] })).type, "merge");
});

// Simulate the two independent HTTP boundaries with durable server-side comments.
function attemptFake({ reserveFails = false, reserveResponseLost = false, dispatchResponseLost = false, finalizeFails = false } = {}) {
  const comments = [];
  const fake = fakeGitHub({ issueComments: comments });
  const original = fake.fetch;
  let accepted = 0;
  fake.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname;
    const payload = options.body ? JSON.parse(options.body) : null;
    if (options.method === "POST" && path.endsWith("/issues/81/comments")) {
      if (reserveFails) throw new Error("reservation rejected");
      const result = await original(url, options);
      comments.push({ id: 9, user: { login: "github-actions[bot]" }, body: payload.body, created_at: new Date().toISOString() });
      if (reserveResponseLost) throw new Error("reservation response lost");
      return result;
    }
    if (options.method === "POST" && path.endsWith("/requested_reviewers")) {
      accepted++;
      const result = await original(url, options);
      if (dispatchResponseLost) throw new Error("accepted request response lost");
      return result;
    }
    if (options.method === "PATCH" && path.endsWith("/issues/comments/9")) {
      if (finalizeFails) throw new Error("finalize failed");
      comments[0].body = payload.body;
      return { ok: true, status: 200, text: async () => JSON.stringify(comments[0]) };
    }
    return original(url, options);
  };
  return { fake, comments, accepted: () => accepted };
}

test("reservation failure never dispatches, including a lost successful response", async () => {
  for (const mode of [{ reserveFails: true }, { reserveResponseLost: true }]) {
    const state = attemptFake(mode);
    for (let i = 0; i < 8; i++) await runMain(state.fake).catch(() => {});
    assert.equal(state.accepted(), 0);
  }
});

test("accepted dispatch with lost response or failed finalization is never blindly replayed", async () => {
  for (const mode of [{ dispatchResponseLost: true }, { finalizeFails: true }]) {
    const state = attemptFake(mode);
    await runMain(state.fake).catch(() => {});
    assert.equal(state.accepted(), 1);
    for (let i = 0; i < 8; i++) {
      // Expire the wait: ambiguity must hold, not become a retry.
      for (const entry of state.comments) entry.created_at = new Date(Date.now() - 90 * 60_000).toISOString();
      await runMain(state.fake).catch(() => {});
    }
    assert.equal(state.accepted(), 1);
  }
});

test("pending attempts reconcile only with a subsequent review and consume retry budget", () => {
  const pending = { ...reviewAsk(90), key: "dispatch-pending" };
  assert.equal(decide(facts({ markers: [pending], reviews: [] })).type, "label-owner");
  assert.equal(decide(facts({ markers: [pending], reviews: [copilotReview(undefined, { submittedAt: minutesAgo(100) })] })).type, "label-owner");
  assert.equal(decide(facts({ markers: [pending], reviews: [copilotReview(undefined, { submittedAt: minutesAgo(5) })] })).type, "merge");
  const retries = Array.from({ length: 6 }, (_, i) => ({ ...reviewAsk(100 - i), key: "retry-dispatch-pending" }));
  assert.equal(decide(facts({ markers: [pending, ...retries], reviews: [copilotReview("Copilot was unable to review", { submittedAt: minutesAgo(5) })] })).type, "label-owner");
});

// HTTP responses here model GitHub's documented rate-limit error contract.
function rejectedAttemptFake({ status = 429, headers = {}, message = "You have exceeded a secondary rate limit.", persistFailure = null, acceptAfter = Infinity } = {}) {
  const comments = [];
  const fake = fakeGitHub({ issueComments: comments });
  const original = fake.fetch;
  let attempts = 0, accepted = 0;
  const json = data => ({ ok: true, status: 200, text: async () => JSON.stringify(data) });
  fake.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname;
    const payload = options.body ? JSON.parse(options.body) : null;
    if (options.method === "POST" && path.endsWith("/issues/81/comments")) {
      const entry = { id: 100 + comments.length, user: { login: "github-actions[bot]" }, body: payload.body, created_at: new Date(Date.now()).toISOString() };
      comments.push(entry);
      return json(entry);
    }
    if (options.method === "PATCH" && path.includes("/issues/comments/")) {
      if (persistFailure === "before") throw new Error("outcome write rejected");
      const entry = comments.find(comment => comment.id === Number(path.split("/").at(-1)));
      entry.body = payload.body;
      if (persistFailure === "after") throw new Error("outcome write response lost");
      return json(entry);
    }
    if (options.method === "POST" && path.endsWith("/requested_reviewers")) {
      attempts++;
      if (attempts > acceptAfter) { accepted++; throw new Error("accepted dispatch response lost"); }
      return { ok: false, status, headers: new Headers(headers), text: async () => JSON.stringify({ message }) };
    }
    return original(url, options);
  };
  return { fake, comments, counts: () => ({ attempts, accepted }) };
}

async function withClock(action) {
  const real = Date.now;
  let now = NOW;
  Date.now = () => now;
  try { await action(minutes => { now += minutes * 60_000; }); }
  finally { Date.now = real; }
}

test("documented rate rejection is durable, observes cooldown, and can retry without replaying later ambiguity", async () => {
  await withClock(async advance => {
    const state = rejectedAttemptFake({ headers: { "retry-after": "120" }, acceptAfter: 1 });
    await assert.rejects(() => runMain(state.fake));
    assert.match(state.comments[0].body, /key=rate-rejected until=/);
    await runMain(state.fake);
    assert.equal(state.counts().attempts, 1);
    advance(3);
    await assert.rejects(() => runMain(state.fake));
    assert.deepEqual(state.counts(), { attempts: 2, accepted: 1 });
    for (let i = 0; i < 8; i++) { advance(90); await runMain(state.fake); }
    assert.deepEqual(state.counts(), { attempts: 2, accepted: 1 });
  });
});

test("primary rate-limit403 respects reset and repeated rejections consume the shared retry cap", async () => {
  await withClock(async advance => {
    const state = rejectedAttemptFake({ status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(NOW / 1000 + 7200) }, message: "API rate limit exceeded" });
    await assert.rejects(() => runMain(state.fake));
    advance(90); await runMain(state.fake); assert.equal(state.counts().attempts, 1);
    for (let i = 0; i < 9; i++) { advance(130); await runMain(state.fake).catch(() => {}); }
    assert.deepEqual(state.counts(), { attempts: 7, accepted: 0 });
    const markers = parseMarkers(state.comments.map(c => ({ login: c.user.login, body: c.body, createdAt: c.created_at, id: c.id })), ["github-actions[bot]"]);
    assert.equal(markers.filter(m => m.kind === "review").length, 7);
    assert.equal(markers.filter(m => m.key === "retry-rate-rejected").length, 6);
  });
});

test("failed rejection persistence holds; persisted rejection with lost acknowledgement remains bounded", async () => {
  for (const persistFailure of ["before", "after"]) await withClock(async advance => {
    const state = rejectedAttemptFake({ persistFailure });
    for (let i = 0; i < 9; i++) { await runMain(state.fake).catch(() => {}); advance(130); }
    assert.deepEqual(state.counts(), { attempts: persistFailure === "before" ? 1 : 7, accepted: 0 });
  });
});

test("unknown statuses, malformed rate evidence and timing never authorize dispatch replay", async () => {
  const modes = [
    { status: 503, headers: { "retry-after": "60" } },
    { status: 429, message: "unclassified response" },
    { status: 429, message: "Not a secondary rate limit" },
    { status: 403, message: "Resource not accessible" },
    { status: 422, message: "Validation Failed" },
    { headers: { "retry-after": "later" } },
    { headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "invalid" } },
  ];
  for (const mode of modes) await withClock(async advance => {
    const state = rejectedAttemptFake(mode);
    await assert.rejects(() => runMain(state.fake));
    assert.match(state.comments[0].body, /key=dispatch-pending/);
    advance(130); await runMain(state.fake);
    assert.deepEqual(state.counts(), { attempts: 1, accepted: 0 });
  });
});

test("rate rejection markers fail closed without a valid deadline and back off exponentially", () => {
  const rejected = { ...reviewAsk(20), key: "rate-rejected", notBefore: NOW + 60_000 };
  assert.equal(decide(facts({ markers: [rejected] })).type, "wait");
  assert.equal(decide(facts({ markers: [rejected], reviews: [copilotReview("Copilot was unable to review", { submittedAt: minutesAgo(5) })] })).type, "wait");
  assert.equal(decide(facts({ markers: [rejected], reviews: [copilotReview(undefined, { submittedAt: minutesAgo(5) })] })).type, "merge");
  assert.equal(decide(facts({ markers: [{ ...rejected, notBefore: undefined }] })).type, "label-owner");
  assert.equal(decide(facts({ markers: [{ ...rejected, notBefore: NOW - 1 }] })).type, "request-review");
  const retry = { ...rejected, key: "retry-rate-rejected", createdAt: minutesAgo(1), notBefore: NOW - 1 };
  assert.equal(decide(facts({ markers: [rejected, retry] })).type, "wait");
  assert.equal(decide(facts({ markers: [rejected, { ...retry, createdAt: minutesAgo(3) }] })).type, "request-review");
});

test("a rejected retry ignores only reviewer checks known stale before a terminal quota response", () => {
  const rejected = { ...reviewAsk(20), key: "rate-rejected", notBefore: NOW - 1 };
  const quota = copilotReview("Copilot was unable to review", { submittedAt: minutesAgo(25) });
  const stale = check("copilot-pull-request-reviewer", "in_progress", null);
  const f = facts({ markers: [rejected], reviews: [quota], copilotPending: true, checks: [...green, stale] });
  assert.equal(decide(f).type, "request-review");
  for (const startedAt of [minutesAgo(10), undefined, "invalid"]) {
    assert.equal(decide({ ...f, checks: [...green, { ...stale, startedAt }] }).type, "wait");
  }
  assert.equal(decide({ ...f, checks: [...f.checks, check("build", "in_progress", null)] }).type, "wait");
});


// Claude, the first outside reviewer once the owner switches it on with
// AUTOPILOT_CLAUDE_REVIEW. Its reviews come from the Actions bot and end in a
// verdict line (scripts/claude-review.mjs).
const claudeBody = (verdict, sha = HEAD) => `### Claude review of \`${sha.slice(0, 7)}\`: ${verdict}\n\n<!-- claude-review verdict=${verdict} sha=${sha} run=55 -->`;
const claudeReviewOf = (verdict, extra = {}) => ({
  login: "github-actions[bot]", type: "Bot", association: "NONE", state: "COMMENTED", commitId: HEAD,
  body: claudeBody(verdict, extra.commitId ?? HEAD), url: `https://example/claude-${verdict}`, submittedAt: minutesAgo(5), ...extra,
});
const claudeVerdictOf = (verdict, extra = {}) => ({
  verdict, sha: HEAD, run: 55, commitId: HEAD, url: `https://example/claude-${verdict}`, submittedAt: minutesAgo(5), trusted: true, ...extra,
});
const claudeAsk = minutes => ({ kind: "claude", sha: HEAD, key: null, createdAt: minutesAgo(minutes), id: 8 });
const withClaude = (overrides = {}) => facts({ claudeReview: true, markers: [], ...overrides });

test("with Claude reviews on, the autopilot asks Claude first and merges on its clean verdict", () => {
  const ask = decide(withClaude());
  assert.deepEqual([ask.type, ask.reason], ["request-claude", "asking Claude, the first outside reviewer"]);
  assert.deepEqual([decide(withClaude({ markers: [claudeAsk(10)] })).type, decide(withClaude({ markers: [claudeAsk(10)] })).reason], ["wait", "waiting for Claude's review"]);
  const clean = withClaude({ markers: [claudeAsk(10)], claudeReviews: [claudeVerdictOf("clean")], reviews: [claudeReviewOf("clean")] });
  assert.equal(cleanReviewer(clean), "Claude");
  assert.deepEqual(decide(clean), { type: "merge", taskId: "R01", reviewer: "Claude", reason: "green and reviewed cleanly by Claude" });
  // Switched off, the same verdict clears nothing, and Copilot is asked as before.
  assert.equal(cleanReviewer({ ...clean, claudeReview: false }), null);
  assert.equal(decide({ ...clean, claudeReview: false }).type, "request-review");
  // The writer never clears its own PR: on one Claude wrote, only another model's review can.
  assert.equal(cleanReviewer({ ...clean, codexComments: [] }, "Claude"), null);
});

test("Copilot reviews when Claude has no verdict in time, answers none, or can't be traced to its workflow", () => {
  const late = decide(withClaude({ markers: [claudeAsk(41)] }));
  assert.deepEqual([late.type, late.copilot], ["request-review", true]);
  const none = withClaude({ markers: [claudeAsk(10)], claudeReviews: [claudeVerdictOf("none")], reviews: [claudeReviewOf("none")] });
  assert.equal(decide(none).type, "request-review");
  const untraced = withClaude({ markers: [claudeAsk(10)], claudeReviews: [claudeVerdictOf("clean", { trusted: false })], reviews: [claudeReviewOf("clean")] });
  assert.equal(cleanReviewer(untraced), null);
  assert.equal(decide(untraced).type, "request-review");
  // Once Copilot is asked about a commit, the autopilot doesn't go back to Claude.
  assert.equal(decide(withClaude({ markers: [claudeAsk(41), reviewAsk(5)] })).type, "wait");
  // A verdict on an older commit doesn't count for the head.
  const old = "b".repeat(40);
  const stale = withClaude({ claudeReviews: [claudeVerdictOf("clean", { sha: old, commitId: old })], reviews: [claudeReviewOf("clean", { commitId: old })] });
  assert.equal(cleanReviewer(stale), null);
  assert.equal(decide(stale).type, "request-claude");
});

test("Claude's findings go to Codex, and an earlier finding outlives a later clean verdict", () => {
  const findings = withClaude({ markers: [claudeAsk(10)], claudeReviews: [claudeVerdictOf("findings")], reviews: [claudeReviewOf("findings")] });
  const fix = decide(findings);
  assert.deepEqual([fix.type, fix.urls], ["request-fix", ["https://example/claude-findings"]]);
  // Findings count with Claude reviews off too: they never wait on a switch.
  assert.equal(findingsOnHead([], [claudeReviewOf("findings")], HEAD).total, 1);
  // A fresh clean verdict isn't a disposition of an earlier finding.
  const old = "b".repeat(40);
  const later = withClaude({
    claudeReviews: [claudeVerdictOf("findings", { sha: old, commitId: old }), claudeVerdictOf("clean")],
    reviews: [claudeReviewOf("findings", { commitId: old }), claudeReviewOf("clean")],
  });
  assert.equal(cleanReviewer(later), null);
  assert.equal(findingsOnHead([], later.reviews, HEAD).blocking, 1);
  assert.notEqual(decide(later).type, "merge");
  // A dismissed review counts for nothing, and another bot's look-alike line isn't Claude's.
  assert.equal(findingsOnHead([], [claudeReviewOf("findings", { state: "DISMISSED" })], HEAD).total, 0);
  assert.equal(findingsOnHead([], [claudeReviewOf("findings", { login: "someone-else[bot]" })], HEAD).total, 0);
});

test("main asks Claude with the owner's token, in a comment the review workflow accepts", async () => {
  const fake = fakeGitHub({ issueComments: [] });
  await runMain(fake, { AUTOPILOT_CLAUDE_REVIEW: "true" });
  const posts = fake.calls.filter(call => call.key === "POST /repos/o/r/issues/81/comments");
  assert.equal(posts.length, 1);
  // .github/workflows/claude-review.yml starts only on an owner's comment that begins with "@claude review".
  assert.match(posts[0].body.body, new RegExp(`^@claude review\\n\\n<!-- remediation-autopilot:claude sha=${fake.sha} -->$`));
  assert.equal(posts[0].token, "Bearer t2");
  assert.equal(fake.calls.filter(call => call.key === "POST /repos/o/r/pulls/81/requested_reviewers").length, 0);
  const noToken = fakeGitHub({ issueComments: [] });
  await runMain(noToken, { AUTOPILOT_CLAUDE_REVIEW: "true", CODEX_TRIGGER_TOKEN: undefined });
  assert.deepEqual(noToken.calls.find(call => call.key === "POST /repos/o/r/issues/81/labels")?.body, { labels: ["needs-owner"] });
  const note = noToken.calls.filter(call => call.key === "POST /repos/o/r/issues/81/comments").at(-1).body.body;
  assert.match(note, /needs Claude's review/);
  assert.doesNotMatch(note, /^@claude/);
});

test("main merges on Claude's clean verdict only when its run is the Claude review workflow on main", async () => {
  const fake = fakeGitHub({ claudeClean: true, issueComments: [] });
  await runMain(fake, { AUTOPILOT_CLAUDE_REVIEW: "true" });
  const merges = fake.calls.filter(call => call.key === "PUT /repos/o/r/pulls/81/merge");
  assert.equal(merges.length, 1);
  assert.match(merges[0].body.commit_message, /reviewed cleanly by Claude/);
  // Any workflow on main posts as the same bot, so the run has to be this one.
  for (const change of [{ path: ".github/workflows/other.yml" }, { head_branch: "remediate/R01-handles" }, { event: "pull_request" }, { repository: { full_name: "x/y" } }]) {
    const forged = fakeGitHub({ claudeClean: true, issueComments: [], claudeRun: { ...CLAUDE_RUN, ...change } });
    await runMain(forged, { AUTOPILOT_CLAUDE_REVIEW: "true" });
    assert.equal(forged.calls.filter(call => call.key === "PUT /repos/o/r/pulls/81/merge").length, 0, JSON.stringify(change));
  }
  // Switched off, the verdict clears nothing and its run isn't even looked up.
  const off = fakeGitHub({ claudeClean: true, issueComments: [] });
  await runMain(off);
  assert.equal(off.calls.filter(call => call.key === "PUT /repos/o/r/pulls/81/merge").length, 0);
  assert.equal(off.calls.filter(call => call.key === "GET /repos/o/r/actions/runs/77").length, 0);
});

test("the autopilot workflow passes the Claude switch and pins its actions to commits", () => {
  const workflow = readFileSync(new URL("../.github/workflows/remediation-autopilot.yml", import.meta.url), "utf8");
  assert.match(workflow, /^\s+AUTOPILOT_CLAUDE_REVIEW: \$\{\{ vars\.AUTOPILOT_CLAUDE_REVIEW \}\}$/m);
  // It holds the owner's trigger token, so a moved tag can't swap in other code.
  const uses = [...workflow.matchAll(/^\s*(?:-\s+)?uses:\s*(\S+)(.*)$/gm)];
  assert.ok(uses.length >= 2, String(uses.length));
  for (const [, ref, comment] of uses) assert.match(`${ref}${comment}`, /@[0-9a-f]{40} # v\d+(\.\d+)*$/, ref);
});


test("Claude's findings on the latest commit hold the merge even after the fix rounds", () => {
  // Other review bots' findings turn advisory after 3 rounds; Claude reports
  // only what should stop a merge, so its findings never do.
  const findings = withClaude({ reviews: [claudeReviewOf("findings"), copilotReview()], markers: [...fixMarkers(3), reviewAsk()] });
  assert.equal(findingsOnHead([], findings.reviews, HEAD).blocking, 1);
  const held = decide(findings);
  assert.deepEqual([held.type, held.label], ["label-owner", "needs-owner"]);
  assert.equal(decide({ ...findings, claudeReview: false }).type, "label-owner");
});

test("the autopilot workflow can read the run behind a Claude verdict", () => {
  const workflow = readFileSync(new URL("../.github/workflows/remediation-autopilot.yml", import.meta.url), "utf8");
  assert.match(workflow, /^\s+actions: read$/m);
});

test("the autopilot also runs when CI finishes, since GitHub drops scheduled runs", () => {
  const workflow = readFileSync(new URL("../.github/workflows/remediation-autopilot.yml", import.meta.url), "utf8");
  const verify = readFileSync(new URL("../.github/workflows/verify.yml", import.meta.url), "utf8").match(/^name: (.+)$/m)[1];
  assert.match(workflow, new RegExp(`^  workflow_run:\\n    workflows: \\["${verify}"\\]\\n    types: \\[completed\\]$`, "m"));
  // A workflow_run run starts from main, so the job's main-only guard still holds.
  assert.match(workflow, /^\s+if: github\.ref == 'refs\/heads\/main'$/m);
});
