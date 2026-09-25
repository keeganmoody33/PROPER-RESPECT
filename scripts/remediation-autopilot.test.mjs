import assert from "node:assert/strict";
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
  assert.equal(mergeTitle({ title: "fix: caps (R99)", number: 81 }, "R02"), "fix: caps (R99) (R02) (#81)");
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
    { login: "stranger", type: "User", association: "NONE", state: "CHANGES_REQUESTED", commitId: HEAD, url: "https://example/r1" },
    { login: "keeganmoody33", type: "User", association: "OWNER", state: "CHANGES_REQUESTED", commitId: HEAD, url: "https://example/r2" },
    { login: "cursor[bot]", type: "Bot", association: "NONE", state: "CHANGES_REQUESTED", commitId: HEAD, url: "https://example/r3" },
    copilotReview(OPEN_FINDINGS),
  ];
  const result = findingsOnHead(comments, reviews, HEAD);
  // Four comments, two "changes requested" reviews and the Copilot overview
  // count; Codex's and the owner's block.
  assert.deepEqual([result.total, result.blocking], [7, 3]);
  for (const url of ["https://example/r2", "https://example/r3", "https://example/copilot-review"]) assert.ok(result.urls.includes(url), url);
});

test("a Copilot review that lists open findings without commenting on the commit is a finding", () => {
  const found = findingsOnHead([], [copilotReview(OPEN_FINDINGS)], HEAD);
  assert.deepEqual([found.total, found.blocking, found.urls], [1, 0, ["https://example/copilot-review"]]);
  const decision = decide(facts({ reviews: [copilotReview(OPEN_FINDINGS)] }));
  assert.deepEqual([decision.type, decision.kind, decision.urls], ["request-fix", "review", ["https://example/copilot-review"]]);
  assert.equal(findingsOnHead([], [copilotReview(OPEN_FINDINGS, { commitId: "b".repeat(40) })], HEAD).total, 0);
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
  assert.equal(decide(facts({ checks: [...green, check("Vercel Agent Review", "completed", "failure", "vercel")] })).type, "merge");
});

test("failed commit statuses go to the owner, never to Codex; reviewer statuses don't count", () => {
  const vercel = decide(facts({ statuses: [{ context: "Vercel", state: "failure" }] }));
  assert.deepEqual([vercel.type, vercel.label], ["label-owner", "needs-owner"]);
  assert.match(vercel.reason, /Vercel failed/);
  assert.equal(decide(facts({ statuses: [{ context: "Vercel", state: "error" }] })).label, "needs-owner");
  assert.equal(decide(facts({ statuses: [{ context: "Devin Review", state: "failure" }] })).type, "merge");
  assert.equal(decide(facts({ statuses: [{ context: "Devin Review", state: "pending" }] })).type, "wait");
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
  assert.equal(decide(facts({ reviewComments: copilot, markers: [...fixMarkers(3), reviewAsk()] })).type, "merge");
  const codex = [comment(CODEX_BOT)];
  assert.equal(decide(facts({ reviewComments: codex, markers: fixMarkers(3) })).label, "needs-owner");
});

test("merging waits for checks and the quiet window", () => {
  assert.equal(decide(facts({ checks: [check("verify", "in_progress", null), green[1]] })).type, "wait");
  assert.equal(decide(facts({ checks: [green[0]] })).type, "wait");
  assert.equal(decide(facts({ checks: [check("verify", "completed", "skipped"), green[1]] })).label, "needs-owner");
  assert.equal(decide(facts({ statuses: [{ context: "Vercel", state: "pending" }] })).type, "wait");
  assert.equal(decide(facts({ pushedAt: minutesAgo(10) })).type, "wait");
  assert.equal(decide(facts({ pr: { mergeableState: "blocked" } })).type, "wait");
});

test("Codex's review summary is read per commit", () => {
  assert.equal(codexReviewStatus([summary("Running")], HEAD).status, "Running");
  assert.equal(codexReviewStatus([summary("Completed", 10, "b".repeat(40))], HEAD), null);
  assert.equal(codexReviewStatus([somethingWrong(5)], HEAD), null);
});

test("a clean review comes only from Codex's summary for the commit or a finished, finding-free Copilot review", () => {
  const base = facts({ codexComments: [] });
  assert.equal(cleanReviewer(base), null);
  assert.equal(cleanReviewer({ ...base, codexComments: [summary("Completed")] }), "Codex");
  assert.equal(cleanReviewer({ ...base, codexComments: [summary("Completed", 10, "b".repeat(40))] }), null);
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
  // The overview's verdict has to say it found nothing; "Needs a closer look" is a finding.
  assert.equal(cleanReviewer({ ...base, reviews: [overview("Resolved since last review (3)", "### 🔵 Needs a closer look")] }), null);
  assert.equal(findingsOnHead([], [overview("Resolved since last review (3)", "### 🔵 Needs a closer look")], HEAD).total, 1);
  assert.equal(cleanReviewer({ ...base, reviews: [overview("Resolved since last review (3)", "### 🟣 Something new")] }), null);
  assert.equal(findingsOnHead([], [overview("Resolved since last review (3)", "### 🟣 Something new")], HEAD).total, 0);
  assert.equal(cleanReviewer({ ...base, reviews: [copilotReview("<!-- ccr-overview-v2 -->\n**Findings:** None\n")] }), null);
  assert.equal(cleanReviewer({ ...base, reviews: [copilotReview("Copilot reviewed 2 of 2 files. Adds quota handling; generated no comments.")] }), "Copilot");
  assert.deepEqual(findingsOnHead([comment("Copilot")], [overview("Previously missed (1)")], HEAD).urls, ["https://example/Copilot", "https://example/copilot-review"]);
  // The latest Copilot review of the commit decides.
  assert.equal(cleanReviewer({ ...base, reviews: [copilotReview(OPEN_FINDINGS), copilot] }), "Copilot");
  assert.equal(cleanReviewer({ ...base, codexComments: [summary("Completed")], reviewComments: [comment(CODEX_BOT)] }), null);
});

test("a PR whose commits name another task goes to the owner", () => {
  const mixed = decide(facts({ commitSubjects: ["fix: reserve route-shadowed handles (R01)", "fix: cap published text (R02)"] }));
  assert.deepEqual([mixed.type, mixed.label], ["label-owner", "needs-owner"]);
  assert.match(mixed.reason, /R02/);
  const loose = ["chore: start a remediation run", "fix: reserve route-shadowed handles (R01)", "wip", "Merge branch 'main' into remediate/run-1"];
  assert.equal(decide(facts({ commitSubjects: loose })).type, "merge");
});

test("merging needs a clean review of the head commit, asked for and retried through an outage", () => {
  assert.equal(decide(facts({ markers: [], codexComments: [] })).type, "request-review");
  assert.equal(decide(facts({ codexComments: [] })).type, "wait");
  assert.equal(decide(facts({ codexComments: [summary("Running")] })).type, "wait");
  const silent = decide(facts({ markers: [reviewAsk(61)], codexComments: [] }));
  assert.deepEqual([silent.type, silent.retry], ["request-review", true]);
  const failedAfterAsk = decide(facts({ codexComments: [summary("Failed", 5)] }));
  assert.deepEqual([failedAfterAsk.type, failedAfterAsk.retry], ["request-review", true]);
  assert.equal(decide(facts({ codexComments: [somethingWrong(5)] })).retry, true);
  // Later retries wait an hour after the last failure, up to the limit.
  assert.equal(decide(facts({ markers: [reviewAsk(30), reviewAsk(15, "retry")], codexComments: [summary("Failed", 5)] })).type, "wait");
  assert.equal(decide(facts({ markers: [reviewAsk(130), reviewAsk(70, "retry")], codexComments: [summary("Failed", 65)] })).retry, true);
  const retries = Array.from({ length: 6 }, (_, index) => reviewAsk(400 - index * 60, "retry"));
  const exhausted = decide(facts({ markers: [reviewAsk(460), ...retries], codexComments: [summary("Failed", 65)] }));
  assert.deepEqual([exhausted.type, exhausted.label], ["label-owner", "needs-owner"]);
  assert.match(exhausted.reason, /Codex failed 7 times/);
  assert.equal(decide(facts({ codexComments: [summary("Failed", 30)] })).type, "wait");
  const merge = decide(facts());
  assert.deepEqual([merge.type, merge.taskId, merge.reviewer], ["merge", "R01", "Codex"]);
  assert.match(merge.reason, /Codex/);
});

test("reviews are asked of Copilot too, waited for, and either reviewer's clean review merges", () => {
  const ask = decide(facts({ markers: [], codexComments: [] }));
  assert.deepEqual([ask.type, ask.copilot], ["request-review", true]);
  assert.equal(decide(facts({ markers: [], codexComments: [], reviews: [copilotReview("unable to review: quota")] })).copilot, false);
  assert.equal(decide(facts({ markers: [], codexComments: [], copilotPending: true })).type, "wait");
  assert.equal(decide(facts({ codexComments: [], copilotPending: true })).reason, "Copilot reviewing");
  const byCopilot = decide(facts({ codexComments: [summary("Failed", 5)], markers: [reviewAsk(30), reviewAsk(15, "retry")], reviews: [copilotReview()] }));
  assert.deepEqual([byCopilot.type, byCopilot.reviewer], ["merge", "Copilot"]);
  // Codex reviewing holds a merge until the review wait runs out.
  assert.equal(decide(facts({ codexComments: [summary("Running")], reviews: [copilotReview()] })).type, "wait");
  assert.equal(decide(facts({ codexComments: [summary("Running")], markers: [reviewAsk(61)], reviews: [copilotReview()] })).reviewer, "Copilot");
  assert.equal(decide(facts({ codexComments: [summary("Running")], markers: [reviewAsk(61)] })).type, "request-review");
});

test("reviewer checks never count as CI", () => {
  const copilotCheck = check("copilot-pull-request-reviewer", "completed", "failure");
  assert.equal(decide(facts({ checks: [...green, copilotCheck] })).type, "merge");
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
  assert.equal(mergeTitle({ title: "fix: caps", number: 81 }, "R02"), "fix: caps (R02) (#81)");
  assert.equal(mergeTitle({ title: "fix: caps (R02)", number: 81 }, "R02"), "fix: caps (R02) (#81)");
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
// can change between the autopilot's two looks.
function fakeGitHub({ laterComments = [], issueComments = null } = {}) {
  const sha = "c".repeat(40);
  const ago = minutes => new Date(Date.now() - minutes * 60_000).toISOString();
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
    "GET /repos/o/r/pulls/81/reviews": () => [],
    "GET /repos/o/r/pulls/81/comments": () => (reviewCommentReads++ === 0 ? [] : laterComments),
    "GET /repos/o/r/issues/81/comments": () => issueComments ?? [
      { id: 1, user: { login: "owner" }, body: `@codex review\n\n<!-- remediation-autopilot:review sha=${sha} -->`, created_at: ago(20), updated_at: ago(20) },
      { id: 2, user: { login: CODEX_BOT }, created_at: ago(18), updated_at: ago(10),
        body: `<!-- codex-pull-request-review-summary -->\n| 📝 **Code Review** | ✅ **Completed** | \`${sha.slice(0, 7)}\` | Manual request |` },
    ],
    "GET /repos/o/r/pulls/81/commits": () => [{ commit: { message: "fix: reserve route-shadowed handles (R01)" }, author: { login: "owner" }, committer: { login: "owner" } }],
    [`GET /repos/o/r/commits/${sha}`]: () => ({ commit: { committer: { date: ago(50) } } }),
    "PUT /repos/o/r/pulls/81/merge": () => ({ merged: true, sha: "d".repeat(40) }),
    "POST /repos/o/r/issues/81/comments": () => ({ id: 9 }),
    "POST /repos/o/r/pulls/81/requested_reviewers": () => pull,
    "DELETE /repos/o/r/git/refs/heads/remediate/R01-handles": () => null,
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

async function runMain(fake) {
  const original = globalThis.fetch;
  const lines = [];
  globalThis.fetch = fake.fetch;
  try {
    await main({ GITHUB_REPOSITORY: "o/r", GITHUB_REPOSITORY_OWNER: "owner", GH_TOKEN: "t", CODEX_TRIGGER_TOKEN: "t2", AUTOPILOT_ENABLED: "true" }, line => lines.push(line));
  } finally {
    globalThis.fetch = original;
  }
  return lines;
}

test("main merges a clean task PR once, pinned to its commit, and deletes the branch", async () => {
  const fake = fakeGitHub();
  await runMain(fake);
  const merges = fake.calls.filter(call => call.key === "PUT /repos/o/r/pulls/81/merge");
  assert.equal(merges.length, 1);
  assert.equal(merges[0].body.sha, fake.sha);
  assert.equal(merges[0].body.commit_title, "fix: reserve route-shadowed handles (R01) (#81)");
  assert.match(merges[0].body.commit_message, /reviewed cleanly by Codex/);
  assert.ok(fake.calls.some(call => call.key === "DELETE /repos/o/r/git/refs/heads/remediate/R01-handles"));
});

test("main doesn't merge when a finding lands between its two looks", async () => {
  const late = [{ user: { login: "Copilot", type: "Bot" }, author_association: "NONE", in_reply_to_id: null,
    original_commit_id: "c".repeat(40), html_url: "https://example/late" }];
  const fake = fakeGitHub({ laterComments: late });
  const lines = await runMain(fake);
  assert.equal(fake.calls.filter(call => call.key === "PUT /repos/o/r/pulls/81/merge").length, 0);
  assert.ok(lines.some(line => /not merging: a second look says request-fix/.test(line)), lines.join("\n"));
});

test("main asks Codex and Copilot for a review with the owner's token", async () => {
  const fake = fakeGitHub({ issueComments: [] });
  await runMain(fake);
  const asks = fake.calls.filter(call => call.key === "POST /repos/o/r/issues/81/comments");
  assert.equal(asks.length, 1);
  assert.match(asks[0].body.body, new RegExp(`^@codex review\\n\\n<!-- remediation-autopilot:review sha=${fake.sha} -->$`));
  assert.equal(asks[0].token, "Bearer t2");
  const copilot = fake.calls.filter(call => call.key === "POST /repos/o/r/pulls/81/requested_reviewers");
  assert.deepEqual([copilot.length, copilot[0]?.body, copilot[0]?.token], [1, { reviewers: ["copilot-pull-request-reviewer[bot]"] }, "Bearer t2"]);
  assert.equal(fake.calls.filter(call => call.key === "PUT /repos/o/r/pulls/81/merge").length, 0);
});
