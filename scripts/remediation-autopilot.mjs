#!/usr/bin/env node
// Remediation autopilot. Runs from main on a schedule
// (.github/workflows/remediation-autopilot.yml). For each open remediation task
// pull request it asks Codex to fix failing checks or review findings, asks an
// outside reviewer (Claude when the owner switches it on, else Copilot) to
// review the latest commit, and merges the pull request once it is green and
// cleanly reviewed by a model that didn't write it. It can also start the next
// task. It never deploys.
// The rules are in docs/remediation/CODEX-BRIEF.md, Section 4, "Autopilot"
// and "Review policy".

import process from "node:process";
import { pathToFileURL } from "node:url";

import { verdictMarker } from "./claude-review.mjs";

export const MARKER = "remediation-autopilot";
export const RUN_LABEL = "remediation-run";
export const RUN_BRANCH_PREFIX = "remediate/run-";
export const OWNER_LABELS = ["needs-owner", "needs-owner-approval"];
export const CODEX_BOT = "chatgpt-codex-connector[bot]";
export const ACTIONS_BOT = "github-actions[bot]";
// Who writes remediation tasks (AGENTS.md: "Codex writes"). The writer's own
// review never clears its pull request, so the autopilot doesn't ask for it.
export const TASK_WRITER = "Codex";
export const REQUIRED_CHECKS = ["verify", "Native Chrome WebMCP"];
// Copilot reviews as the first login and comments as the second. Requesting
// the first as a reviewer, with the owner's token, asks for a fresh review.
export const COPILOT_REVIEWERS = ["copilot-pull-request-reviewer[bot]", "Copilot"];
// Review comments count only from these bots, or from the owner and collaborators.
export const REVIEW_BOTS = [CODEX_BOT, ...COPILOT_REVIEWERS, "vercel[bot]", "cursor[bot]", "devin-ai-integration[bot]"];
export const TRUSTED_ASSOCIATIONS = ["OWNER", "MEMBER", "COLLABORATOR"];
// Checks and commit statuses that are reviewers, not CI. The autopilot waits
// for them to finish but never treats their outcome as a CI result.
// Copilot's check runs under GitHub Actions.
export const REVIEW_CHECKS = ["copilot-pull-request-reviewer", "Vercel Agent Review", "Cursor Approval Agent: Pull Request Router and Approver"];
export const REVIEW_STATUSES = ["Devin Review"];
// Claude reviews through this workflow, which posts as the Actions bot and
// starts on an owner's comment that begins with CLAUDE_ASK. Any workflow on
// main posts as the same bot, so a clean verdict counts only when its run is
// this workflow on main.
export const CLAUDE_WORKFLOW = ".github/workflows/claude-review.yml";
export const CLAUDE_ASK = "@claude review";
// The queued Codex tasks (Section 7). Any other ID is not the autopilot's to merge.
export const TASK_IDS = Array.from({ length: 30 }, (_, index) => `R${String(index + 1).padStart(2, "0")}`);

// Changes to these paths always wait for the owner. GitHub also refuses to let
// the workflow token merge changes under .github/workflows/.
// Claude reviews Codex's tasks, so its script and pinned CLI are the owner's too.
export const PROTECTED_PREFIXES = [".github/workflows/", ".github/claude-review/"];
export const PROTECTED_PATHS = [
  "scripts/remediation-autopilot.mjs",
  "scripts/remediation-autopilot.test.mjs",
  "scripts/claude-review.mjs",
  "scripts/claude-review.test.mjs",
  "vercel.json",
  "convex.json",
  "AGENTS.md",
  "docs/remediation/CODEX-BRIEF.md",
];
// Tasks whose result the owner approves before merge (R07: the Terms wording).
export const OWNER_TASKS = ["R07"];

export const LIMITS = {
  fixRounds: 3,
  updates: 5,
  quietMinutes: 30,
  reviewWaitMinutes: 60,
  // The Claude review job times out after 30 minutes.
  claudeWaitMinutes: 40,
  replyWaitMinutes: 90,
  codexRetries: 6,
  retryAfterMinutes: 60,
  stuckHours: 6,
  runnerWaitHours: 6,
  runnerCooldownHours: 12,
  runnersPerDay: 6,
};

const FAILED = new Set(["failure", "timed_out", "cancelled", "action_required", "startup_failure", "stale"]);
const TITLE_TASK = /\((R\d{2})\)\s*$/;
const REVIEW_SUMMARY = "<!-- codex-pull-request-review-summary -->";
const CODEX_FAILURE = /something went wrong/i;
const COPILOT_UNAVAILABLE = /Copilot was unable to review/i;
// Signs of findings in a Copilot review body: a counted overview section
// other than "Resolved since last review" (such as "Open (2)" or "Previously
// missed (1)"), a "Changes recommended" verdict, or a nonzero "Findings:".
const COPILOT_FINDINGS = [
  /<strong>(?!Resolved)[^<]*\([1-9]\d*\)<\/strong>/,
  // A heading that recommends changes, with or without an emoji, unless it
  // says "no changes". "Needs a closer look" without listed findings names
  // nothing to fix: it isn't a finding, and it isn't a clean review either.
  /^#{1,6}(?![^\n]*\bno changes\b)[^\n]*\bchanges recommended\b/im,
  /\*\*Findings:\*\*\s*[1-9]/,
];
const copilotFindings = review => COPILOT_FINDINGS.some(pattern => pattern.test(review.body ?? ""));
// Only a review that plainly says it found nothing can clear a PR: an
// overview whose verdict (its first "###" heading) says so, or the older
// summary that says Copilot generated no comments. Any other shape or
// verdict, such as "Needs a closer look", fails closed.
const COPILOT_CLEAN_VERDICT = /^(?:✅ |🟢 )?(?:looks good|lgtm|all clear|ready to merge|no changes recommended|no issues|no concerns|no findings|no problems|no action required)[.!]?$/i;
const copilotSaysClean = review => {
  const body = (review.body ?? "").trim();
  if (body.startsWith("<!-- ccr-overview-v2 -->")) {
    const match = body.match(/^<!-- ccr-overview-v2 -->\s*(?:## Copilot review overview\s*)?### ([^\n]+)([\s\S]*)$/);
    if (!match || !COPILOT_CLEAN_VERDICT.test(match[1].trim())) return false;
    // Recognize only supported empty/zero-finding sections. Unknown prose or
    // richer formats require owner review, never substring-based clearance.
    const rest = match[2].replace(/\*\*Findings:\*\* None/g, "")
      .replace(/<details>\s*<summary><strong>Resolved since last review \(\d+\)<\/strong><\/summary>\s*<\/details>/g, "");
    return rest.trim() === "";
  }
  return /^Copilot reviewed \d+(?: of \d+)? (?:changed )?files? and generated (?:no|0) (?:new )?comments\.$/.test(body);
};
const MARKER_PATTERN = /<!-- remediation-autopilot:(start|fix|update|review|claude|note) sha=([0-9a-f]{7,40})(?: key=([\w-]+))?(?: until=(\d+))? -->/;

const minutesSince = (now, iso) => (now - Date.parse(iso)) / 60_000;
const queued = id => (id && TASK_IDS.includes(id) ? id : null);

// The task IDs a PR names: in its title's suffix, the template's task line,
// and a remediate/<ID>- branch name.
export function taskIdsOf(pr) {
  const ids = [
    pr.title.match(TITLE_TASK)?.[1],
    (pr.body ?? "").match(/^\s*-\s*Remediation task, if any:\s*(R\d{2})\b/m)?.[1],
    pr.headRef.match(/^remediate\/(R\d{2})-/)?.[1],
  ];
  return [...new Set(ids.filter(Boolean))];
}

// The PR's task: the one queued ID it names. None when it names none, an ID
// outside the queue, or two different IDs (decide() holds those for the owner).
export function taskIdOf(pr) {
  const ids = taskIdsOf(pr);
  return ids.length === 1 ? queued(ids[0]) : null;
}

export const isRun = pr => pr.labels.includes(RUN_LABEL) || pr.headRef.startsWith(RUN_BRANCH_PREFIX);

export function protectedChanges(files) {
  const touched = [];
  for (const file of files) {
    const names = [file.filename, file.previous_filename].filter(Boolean);
    if (names.some(name => PROTECTED_PATHS.includes(name) || PROTECTED_PREFIXES.some(prefix => name.startsWith(prefix)))) {
      touched.push(file.filename);
    }
  }
  return touched;
}

const latestCopilotReview = (reviews, headSha) =>
  reviews.filter(review => COPILOT_REVIEWERS.includes(review.login) && review.commitId === headSha).at(-1) ?? null;
// A review by the Actions bot whose last line is Claude's verdict.
const claudeVerdictIn = review => (review.login === ACTIONS_BOT && review.state !== "DISMISSED" ? verdictMarker(review.body ?? "") : null);
// Claude's latest verdict on the head commit, reviewed at that commit.
const latestClaudeVerdict = (verdicts, headSha) =>
  (verdicts ?? []).filter(verdict => verdict.sha === headSha && verdict.commitId === headSha).at(-1) ?? null;
// Claude's findings, on any commit: its reviews that list findings, and the
// verdicts it posted as comments because GitHub refused a review of a commit
// the PR no longer had (scripts/claude-review.mjs, post). A comment can't be
// dismissed, so its findings hold until the owner deletes it.
const claudeFindings = (reviews, verdicts = []) => [
  ...reviews.filter(review => claudeVerdictIn(review)?.verdict === "findings"),
  ...(verdicts ?? []).filter(verdict => verdict.source === "comment" && verdict.verdict === "findings")
    .map(verdict => ({ login: ACTIONS_BOT, type: "Bot", commitId: verdict.sha, url: verdict.url })),
];

// A push or a later approval is not a disposition of an earlier finding.
// Native review dismissal is the explicit disposition available from these
// REST facts. Thread resolution is not collected, so unresolved/unknown
// inline state conservatively stays active until its review is dismissed.
const trustedReviewer = entry => REVIEW_BOTS.includes(entry.login) || (entry.type !== "Bot" && TRUSTED_ASSOCIATIONS.includes(entry.association));
const activeComments = (comments, reviews) => {
  const dismissed = new Set(reviews.filter(review => review.state === "DISMISSED" && trustedReviewer(review)).map(review => review.id).filter(Number.isSafeInteger));
  return comments.filter(comment => !dismissed.has(comment.reviewId));
};
export function findingsOnHead(comments, reviews, headSha, claudeVerdicts = []) {
  const inline = activeComments(comments, reviews).filter(comment => comment.inReplyTo === null && trustedReviewer(comment));
  const requested = reviews.filter(review => review.state === "CHANGES_REQUESTED" && trustedReviewer(review));
  const copilotBody = reviews.filter(review => COPILOT_REVIEWERS.includes(review.login) && review.state !== "DISMISSED" && copilotFindings(review) && !requested.includes(review));
  // Claude's findings count on any commit, as Copilot's do, whether or not its
  // clean verdict can clear the PR.
  const claudeBody = claudeFindings(reviews, claudeVerdicts);
  const found = [...inline, ...requested, ...copilotBody, ...claudeBody];
  // Findings from Codex, people, Claude or an earlier commit always block.
  // Other review bots' findings on the latest commit turn advisory after the
  // fix rounds. Claude's never do: it reports only what should stop a merge.
  return {
    total: found.length,
    blocking: found.filter(entry => entry.login === CODEX_BOT || entry.type !== "Bot" || claudeBody.includes(entry) ||
      (entry.originalCommitId ?? entry.commitId) !== headSha).length,
    urls: found.map(entry => entry.url).filter(Boolean),
  };
}

export function parseMarkers(comments, trustedLogins) {
  const markers = [];
  for (const comment of comments) {
    if (!trustedLogins.includes(comment.login)) continue;
    const match = comment.body.match(MARKER_PATTERN);
    if (match) markers.push({ kind: match[1], sha: match[2], key: match[3] ?? null, createdAt: comment.createdAt, id: comment.id, ...(match[4] ? { notBefore: Number(match[4]) } : {}) });
  }
  return markers;
}

// Codex keeps one review summary comment per PR, edited in place. Its Code
// Review row shows Running, Completed or Failed, and the commit reviewed.
export function codexReviewStatus(codexComments, headSha) {
  const summary = [...codexComments].reverse().find(comment => comment.body.includes(REVIEW_SUMMARY));
  const row = summary?.body.split("\n").find(line => line.trim().startsWith("|") && line.includes("Code Review"));
  const status = row?.match(/\*\*(Running|Completed|Failed)\*\*/)?.[1];
  const commit = row?.match(/`([0-9a-f]{7,40})`/)?.[1];
  return status && commit && headSha.startsWith(commit) ? { status, updatedAt: summary.updatedAt } : null;
}

// Who reviewed the head commit cleanly, never counting the writer: Codex,
// when its review summary shows a completed review of that commit and it left
// no comments on it; Claude, when the owner has switched Claude reviews on,
// its latest verdict on the commit is clean, that verdict's run is the Claude
// review workflow on main, and none of its reviews lists findings; or Copilot,
// when its latest review of the commit is finished, says plainly that it
// found nothing, and has no comments or other sign of findings. Nothing else,
// such as a reaction, a commit status or an unfamiliar review format, counts.
export function cleanReviewer(facts, writer = TASK_WRITER) {
  const head = facts.pr.headSha;
  const commented = logins => activeComments(facts.reviewComments, facts.reviews).some(comment => logins.includes(comment.login));
  if (writer !== "Codex" && !commented([CODEX_BOT]) && codexReviewStatus(facts.codexComments, head)?.status === "Completed") return "Codex";
  if (facts.claudeReview && writer !== "Claude") {
    const claude = latestClaudeVerdict(facts.claudeReviews, head);
    const claudeFound = claudeFindings(facts.reviews, facts.claudeReviews).length > 0;
    if (claude?.verdict === "clean" && claude.trusted === true && !claudeFound) return "Claude";
  }
  const copilot = latestCopilotReview(facts.reviews, head);
  const clean = writer !== "Copilot" && copilot && ["COMMENTED", "APPROVED"].includes(copilot.state) && copilotSaysClean(copilot) &&
    !COPILOT_UNAVAILABLE.test(copilot.body ?? "") && !facts.reviews.some(review => COPILOT_REVIEWERS.includes(review.login) && review.state !== "DISMISSED" && copilotFindings(review)) && !commented(COPILOT_REVIEWERS);
  return clean ? "Copilot" : null;
}

// When Copilot last answered an ask without reviewing, such as out of quota.
// Null when it hasn't, or when that answer came before the ask.
function copilotFailureAfter(review, iso) {
  if (!review || !COPILOT_UNAVAILABLE.test(review.body ?? "")) return null;
  return Date.parse(review.submittedAt ?? "") > Date.parse(iso) ? review.submittedAt : null;
}

// When Codex last failed after an ask: a "Something went wrong" reply, or a
// Failed review summary updated after it. Null when it hasn't failed.
function codexFailureAfter(codexComments, iso, summary = null) {
  const times = codexComments
    .filter(comment => !comment.body.includes(REVIEW_SUMMARY) && CODEX_FAILURE.test(comment.body) && Date.parse(comment.createdAt) > Date.parse(iso))
    .map(comment => comment.createdAt);
  if (summary?.status === "Failed" && Date.parse(summary.updatedAt) > Date.parse(iso)) times.push(summary.updatedAt);
  return times.sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1) ?? null;
}

// After Codex or a reviewer fails, ask again at once the first time and then
// an hour after each failure, so an outage or a spent quota doesn't park the
// PR. Give up at the limit.
function retryAfterFailure({ who = "Codex", retries, failedAt, now, limits, what, retry }) {
  if (retries >= limits.codexRetries) return { type: "label-owner", label: "needs-owner", reason: `${who} failed ${retries + 1} times ${what}` };
  if (retries > 0 && minutesSince(now, failedAt) < limits.retryAfterMinutes) {
    return { type: "wait", reason: `${who} failed ${what}; asking again ${limits.retryAfterMinutes} minutes after the last failure`, since: failedAt };
  }
  return retry;
}

function decideRun(facts, limits) {
  const { pr, now } = facts;
  const subject = facts.commitSubjects.find(line => queued(line.match(TITLE_TASK)?.[1]));
  if (subject) return { type: "retitle", title: subject, reason: "Codex pushed a task" };
  const starts = facts.markers.filter(marker => marker.kind === "start");
  const start = starts[0];
  const waitedHours = minutesSince(now, start?.createdAt ?? pr.createdAt) / 60;
  if (waitedHours >= limits.runnerWaitHours) {
    if (facts.commitSubjects.length > 1) {
      return { type: "label-owner", label: "needs-owner", reason: "Codex pushed commits without a task ID" };
    }
    return { type: "close-runner", reason: `no task commit after ${limits.runnerWaitHours} hours` };
  }
  if (!start) return { type: "request-start", reason: "the start comment is missing" };
  const failedAt = codexFailureAfter(facts.codexComments, starts.at(-1).createdAt);
  const retries = starts.filter(marker => marker.key === "retry").length;
  // Out of retries, the run waits to be closed, and the cooldown follows.
  if (failedAt && retries < limits.codexRetries) {
    return retryAfterFailure({ retries, failedAt, now, limits, what: "to start the task",
      retry: { type: "request-start", retry: true, reason: "Codex failed to start the task, so asking again" } });
  }
  return { type: "wait", reason: "waiting for Codex to push the next task", since: start.createdAt };
}

function decideTask(facts, taskId, limits) {
  const { pr, now } = facts;
  if (facts.commitAuthors.some(login => /devin/i.test(login))) {
    return { type: "label-owner", label: "needs-owner", reason: "it has commits from Devin, which AGENTS.md sends to the owner" };
  }
  if (facts.files.length !== pr.changedFiles) {
    return { type: "label-owner", label: "needs-owner-approval", reason: "it changes more files than the autopilot can check" };
  }
  const guarded = protectedChanges(facts.files);
  if (guarded.length) return { type: "label-owner", label: "needs-owner-approval", reason: `it changes ${guarded.join(", ")}` };
  if (OWNER_TASKS.includes(taskId)) return { type: "label-owner", label: "needs-owner-approval", reason: `the brief has the owner approve ${taskId}` };
  // Commit subjects without an ID are fine, since the squash subject carries
  // it. Subjects naming another task mean the PR mixes tasks.
  const others = [...new Set(facts.commitSubjects.map(subject => subject.match(TITLE_TASK)?.[1]).filter(id => id && id !== taskId))];
  if (others.length) {
    return { type: "label-owner", label: "needs-owner", reason: `its commits also name ${others.join(", ")}, so merging it as ${taskId} would hide them` };
  }

  const asksFor = kind => facts.markers.filter(entry => entry.kind === kind && entry.sha === pr.headSha);
  const marker = kind => asksFor(kind).at(-1);
  // Codex's replies after a time, leaving out its review summary comment.
  const repliesAfter = iso => facts.codexComments.filter(comment => !comment.body.includes(REVIEW_SUMMARY) && Date.parse(comment.createdAt) > Date.parse(iso));
  const rounds = facts.markers.filter(entry => entry.kind === "fix" && entry.key !== "retry").length;
  const retriesOf = kind => asksFor(kind).filter(entry => ["retry", "retry-dispatch-pending", "retry-rate-rejected"].includes(entry.key)).length;
  const askForFix = (kind, reason, extra = {}) => {
    const asked = marker("fix");
    if (asked) {
      const failedAt = codexFailureAfter(facts.codexComments, asked.createdAt);
      if (failedAt) {
        return retryAfterFailure({ retries: retriesOf("fix"), failedAt, now, limits, what: "on a fix request",
          retry: { type: "request-fix", kind, retry: true, reason: `${reason}; Codex failed, so asking again`, ...extra } });
      }
      const reply = repliesAfter(asked.createdAt).at(-1);
      if (reply && minutesSince(now, reply.createdAt) >= limits.replyWaitMinutes) {
        return { type: "label-owner", label: "needs-owner", reason: `Codex answered the fix request without pushing: "${reply.body.slice(0, 120)}"` };
      }
      return { type: "wait", reason: "a fix is already requested for this commit", since: asked.createdAt };
    }
    if (rounds >= limits.fixRounds) return { type: "label-owner", label: "needs-owner", reason: `${reason}, after ${rounds} fix rounds` };
    return { type: "request-fix", kind, reason, ...extra };
  };

  // GitHub Actions reports check runs, never commit statuses, so only failed
  // Actions checks go to Codex. Other apps' failures go to the owner.
  const ci = facts.checks.filter(check => !REVIEW_CHECKS.includes(check.name));
  const actionsFailed = ci.filter(check => check.app === "github-actions" && check.status === "completed" && FAILED.has(check.conclusion));
  if (actionsFailed.length) return askForFix("ci", `failing: ${actionsFailed.map(check => check.name).join(", ")}`);
  const otherFailed = [
    ...ci.filter(check => check.app !== "github-actions" && check.status === "completed" && FAILED.has(check.conclusion)).map(check => check.name),
    ...facts.statuses.filter(status => !REVIEW_STATUSES.includes(status.context) && ["failure", "error"].includes(status.state)).map(status => status.context),
  ];
  if (otherFailed.length) {
    return { type: "label-owner", label: "needs-owner", reason: `${otherFailed.join(", ")} failed, which Codex can't fix from here` };
  }
  if (pr.mergeableState === "dirty") return askForFix("conflict", "conflicts with main");
  if (pr.mergeableState === "behind") {
    const asked = marker("update");
    if (asked) return { type: "wait", reason: "an update from main is already requested", since: asked.createdAt };
    const updates = facts.markers.filter(entry => entry.kind === "update").length;
    if (updates >= limits.updates) return { type: "label-owner", label: "needs-owner", reason: `still behind main after ${updates} updates` };
    return { type: "request-update", reason: "behind main" };
  }
  const findings = findingsOnHead(facts.reviewComments, facts.reviews, pr.headSha, facts.claudeReviews);
  if (findings.total > 0 && (rounds < limits.fixRounds || findings.blocking > 0)) {
    return askForFix("review", `${findings.total} outstanding review finding${findings.total === 1 ? "" : "s"}`, { urls: findings.urls });
  }

  const required = REQUIRED_CHECKS.map(name => ({ name, check: facts.checks.find(check => check.app === "github-actions" && check.name === name) }));
  const odd = required.filter(({ check }) => check?.status === "completed" && check.conclusion !== "success");
  if (odd.length) return { type: "label-owner", label: "needs-owner", reason: `${odd.map(({ name, check }) => `${name} ended ${check.conclusion}`).join(", ")}` };
  const asked = marker("review");
  const copilotReview = latestCopilotReview(facts.reviews, pr.headSha);
  const copilotGaveUp = asked ? copilotFailureAfter(copilotReview, asked.createdAt) : null;
  const rateRejected = ["rate-rejected", "retry-rate-rejected"].includes(asked?.key);
  const staleReviewerCheck = check => rateRejected && COPILOT_UNAVAILABLE.test(copilotReview?.body ?? "") &&
    Date.parse(check.startedAt ?? "") <= Date.parse(copilotReview?.submittedAt ?? "") &&
    Date.parse(copilotReview?.submittedAt ?? "") <= Date.parse(asked.createdAt);
  const running = facts.checks.filter(check => check.status !== "completed" &&
    !(check.name === "copilot-pull-request-reviewer" && (copilotGaveUp || staleReviewerCheck(check)))).map(check => check.name);
  if (running.length) return { type: "wait", reason: `checks running: ${running.join(", ")}`, since: facts.pushedAt };
  const missing = required.filter(({ check }) => !check).map(({ name }) => name);
  if (missing.length) return { type: "wait", reason: `required checks not reported: ${missing.join(", ")}`, since: facts.pushedAt };
  if (facts.statuses.some(status => status.state === "pending")) return { type: "wait", reason: "commit statuses pending", since: facts.pushedAt };
  const quiet = minutesSince(now, facts.pushedAt);
  if (quiet < limits.quietMinutes) {
    return { type: "wait", reason: `letting reviewers finish, ${Math.ceil(limits.quietMinutes - quiet)} minutes left`, since: facts.pushedAt };
  }

  // Reviews. The model that wrote a PR never clears it (brief, Section 4,
  // "Review policy"). Codex writes every task, so the outside reviewer is
  // Copilot: ask it, wait for any review in progress (Codex's own included,
  // since its findings still block), and merge on Copilot's clean review.
  const writer = TASK_WRITER;
  const outsideOnly = writer === "Codex";
  const reviewSince = asked?.createdAt ?? facts.pushedAt;
  const codex = codexReviewStatus(facts.codexComments, pr.headSha);
  // Copilot answering the latest ask without reviewing ends its review, even
  // while GitHub still shows it pending, so the retry isn't held back.
  const answered = copilotReview && ["COMMENTED", "APPROVED", "CHANGES_REQUESTED"].includes(copilotReview.state) &&
    Date.parse(copilotReview.submittedAt ?? "") > Date.parse(asked?.createdAt ?? "");
  const reviewer = cleanReviewer(facts, writer);
  // Claude first, when the owner has switched it on (brief, Section 4,
  // "Review policy"): ask it once per commit and wait for its verdict. With
  // no verdict in time, a verdict of none, or one that can't be traced to the
  // Claude review workflow, Copilot reviews as before. Once Copilot is asked
  // about this commit, Claude isn't asked again.
  if (facts.claudeReview && !reviewer && !asked) {
    const claudeAsked = marker("claude");
    if (!latestClaudeVerdict(facts.claudeReviews, pr.headSha)) {
      if (!claudeAsked) return { type: "request-claude", reason: "asking Claude, the first outside reviewer" };
      if (minutesSince(now, claudeAsked.createdAt) < limits.claudeWaitMinutes) {
        return { type: "wait", reason: "waiting for Claude's review", since: claudeAsked.createdAt };
      }
    }
  }
  if (rateRejected && !(answered && reviewer)) {
    const retries = retriesOf("review");
    if (!Number.isSafeInteger(asked.notBefore) || asked.notBefore <= 0) {
      return { type: "label-owner", label: "needs-owner", reason: "rate rejection has no valid retry deadline" };
    }
    if (retries >= limits.codexRetries) return { type: "label-owner", label: "needs-owner", reason: "review dispatch exhausted its retry budget" };
    const nextAttempt = Math.max(asked.notBefore, Date.parse(asked.createdAt) + 60_000 * 2 ** retries);
    if (!Number.isFinite(nextAttempt)) return { type: "label-owner", label: "needs-owner", reason: "rate rejection has no valid attempt timestamp" };
    if (now < nextAttempt) return { type: "wait", reason: "waiting for the rejected review attempt's cooldown", since: asked.createdAt };
    return { type: "request-review", codex: false, copilot: true, retry: true, reason: "retrying a durably recorded rate-limit rejection" };
  }
  const dispatchPending = ["dispatch-pending", "retry-dispatch-pending"].includes(asked?.key);
  if (dispatchPending && !answered) {
    return minutesSince(now, reviewSince) < limits.reviewWaitMinutes
      ? { type: "wait", reason: "review dispatch outcome is unconfirmed", since: reviewSince }
      : { type: "label-owner", label: "needs-owner", reason: "review dispatch outcome is unconfirmed; reconcile the reserved attempt before requesting another review" };
  }
  const reviewing = [codex?.status === "Running" ? "Codex" : null, facts.copilotPending && !copilotGaveUp ? "Copilot" : null].filter(Boolean);
  if (reviewing.length && minutesSince(now, reviewSince) < limits.reviewWaitMinutes) {
    return { type: "wait", reason: `${reviewing.join(" and ")} reviewing`, since: reviewSince };
  }
  if (!reviewer) {
    const copilotOut = Boolean(copilotReview) && COPILOT_UNAVAILABLE.test(copilotReview.body ?? "");
    if (outsideOnly && copilotReview && !copilotOut) {
      return { type: "label-owner", label: "needs-owner",
        reason: `Copilot reviewed ${pr.headSha.slice(0, 7)} without a clean verdict, and it's the only outside reviewer wired so far` };
    }
    const ask = { type: "request-review", codex: !outsideOnly, copilot: outsideOnly || (!copilotReview && !facts.copilotPending) };
    if (!asked) return { ...ask, reason: "no clean review of this commit yet" };
    const who = outsideOnly ? "Copilot" : "Codex";
    const what = outsideOnly ? "to review this commit" : "to review this commit, and Copilot gave no clean review";
    const failedAt = outsideOnly
      ? copilotFailureAfter(copilotReview, asked.createdAt)
      : codexFailureAfter(facts.codexComments, asked.createdAt, codex);
    if (failedAt) {
      return retryAfterFailure({ who, retries: retriesOf("review"), failedAt, now, limits, what,
        retry: { ...ask, retry: true, reason: `the ${who} review failed, so asking again` } });
    }
    // No answer within the review wait counts as a failure at the ask.
    if (minutesSince(now, asked.createdAt) >= limits.reviewWaitMinutes) {
      return retryAfterFailure({ who, retries: retriesOf("review"), failedAt: asked.createdAt, now, limits, what,
        retry: { ...ask, retry: true, reason: `no clean review ${limits.reviewWaitMinutes} minutes after asking, so asking again` } });
    }
    return { type: "wait", reason: "waiting for a review", since: asked.createdAt };
  }
  if (pr.mergeableState !== "clean" && pr.mergeableState !== "has_hooks") {
    return { type: "wait", reason: `GitHub merge state is ${pr.mergeableState}`, since: reviewSince };
  }
  return { type: "merge", taskId, reviewer, reason: `green and reviewed cleanly by ${reviewer}` };
}

// Decides the next step for one open pull request. Pure, so it can be tested.
export function decide(facts, limits = LIMITS) {
  const { pr, now } = facts;
  if (!pr.sameRepo) return { type: "skip", reason: "branch is on a fork" };
  if (pr.baseRef !== "main") return { type: "skip", reason: `targets ${pr.baseRef}, not main` };
  if (!facts.trustedAuthors.includes(pr.author)) return { type: "skip", reason: `opened by ${pr.author}` };
  if (pr.draft) return { type: "skip", reason: "draft" };
  const ownerLabel = pr.labels.find(label => OWNER_LABELS.includes(label));
  if (ownerLabel) return { type: "skip", reason: `labeled ${ownerLabel}` };
  const named = taskIdsOf(pr);
  if (named.length > 1) {
    return { type: "label-owner", label: "needs-owner", reason: `its title, template line and branch name different tasks (${named.join(", ")})` };
  }
  const taskId = taskIdOf(pr);
  const decision = isRun(pr) && !taskId ? decideRun(facts, limits) : taskId ? decideTask(facts, taskId, limits) : { type: "skip", reason: "not a remediation task" };
  if (decision.type === "wait" && decision.since && minutesSince(now, decision.since) >= limits.stuckHours * 60) {
    return { type: "label-owner", label: "needs-owner", reason: `stuck for ${limits.stuckHours} hours: ${decision.reason}` };
  }
  return decision;
}

// Whether to open a run pull request that asks Codex for the next task.
export function shouldStartRun({ open, recentRuns, now }, limits = LIMITS) {
  const waitingRun = open.find(pr => isRun(pr) && !taskIdOf(pr) && !pr.labels.some(label => OWNER_LABELS.includes(label)));
  if (waitingRun) return { start: false, reason: `run #${waitingRun.number} is waiting for Codex` };
  const active = open.find(pr => taskIdOf(pr) && !pr.draft && !pr.labels.some(label => OWNER_LABELS.includes(label)));
  if (active) return { start: false, reason: `task #${active.number} is in flight` };
  const lastDay = recentRuns.filter(run => minutesSince(now, run.createdAt) < 24 * 60);
  if (lastDay.length >= limits.runnersPerDay) return { start: false, reason: `${lastDay.length} runs started in the last 24 hours` };
  const stalled = recentRuns.find(run => !run.merged && run.closedAt && minutesSince(now, run.closedAt) < limits.runnerCooldownHours * 60);
  if (stalled) return { start: false, reason: `run #${stalled.number} stalled recently` };
  return { start: true, reason: "no task in flight" };
}

// The squash subject ends with the task ID, like every task commit, with the
// PR number before it: "fix: reserve route-shadowed handles (#81) (R01)".
export function mergeTitle(pr, taskId) {
  const title = pr.title.match(TITLE_TASK)?.[1] === taskId ? pr.title.replace(TITLE_TASK, "").trimEnd() : pr.title;
  return `${title} (#${pr.number}) (${taskId})`;
}

// Keeps each commit's message, so questions Codex leaves in a commit body reach main.
export function mergeMessage(commitMessages, reviewer = "Codex") {
  const kept = commitMessages.filter(message => !message.startsWith("chore: start a remediation run"));
  return [
    `Merged by the remediation autopilot: checks green, reviewed cleanly by ${reviewer}, no owner-only files.`,
    ...kept.map(message => `* ${message.trim()}`),
  ].join("\n\n");
}

export function startPrompt(openTaskIds) {
  return [
    "@codex Read `docs/remediation/CODEX-BRIEF.md` and run the next eligible task (Section 5).",
    openTaskIds.length ? `These tasks already have open pull requests, so skip them: ${openTaskIds.join(", ")}.` : "",
    "If the next task needs an owner decision, skip to the one after it and put the question in your first commit's message body.",
    "Push the task's commits to this pull request's branch; don't open a new pull request.",
    "End every commit subject with the task ID, for example `fix: reserve route-shadowed handles (R01)`.",
    "If no Codex task is eligible, reply here with the owner tasks that unblock the next ones, and push nothing.",
  ].filter(Boolean).join(" ");
}

export function codexAsk(decision, sha) {
  const short = sha.slice(0, 7);
  const tail = "Follow `docs/remediation/CODEX-BRIEF.md`, stay inside the task's scope, and push to this branch; don't open a new pull request.";
  if (decision.type === "request-review") return "@codex review";
  if (decision.type === "request-start") return null;
  if (decision.type === "request-update") return `@codex This branch is behind main. Merge main into it, run the checks, and push. ${tail}`;
  if (decision.kind === "ci") return `@codex Checks are failing on commit ${short} (${decision.reason.replace(/^failing: /, "")}). Fix them. ${tail}`;
  if (decision.kind === "conflict") return `@codex This pull request conflicts with main. Merge main into this branch and resolve the conflicts so both sides keep working. ${tail}`;
  return [
    `@codex Address these review findings on commit ${short}, and ignore any other comment on this pull request:`,
    ...decision.urls.map(url => `- ${url}`),
    "",
    `Fix what's valid. List anything you leave unchanged, with the reason, under "Found, not fixed" in your commit message body. ${tail}`,
  ].join("\n");
}

// GitHub documents retryable rate-limit failures as403/429 with exhausted
// primary quota or an explicit secondary-limit error. Unknown errors remain
// ambiguous. Respect every supplied timing constraint; malformed ones hold.
// https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api#exceeding-the-rate-limit
function rateLimitRetryAt(response, data) {
  if (![403, 429].includes(response.status)) return null;
  const header = name => response.headers?.get(name) ?? null;
  const primary = header("x-ratelimit-remaining") === "0";
  if (!primary && !/^You have exceeded a secondary rate limit(?:[.!]|$)/i.test(data?.message ?? "")) return null;
  const seconds = value => /^\d+$/.test(value ?? "") && Number.isSafeInteger(Number(value)) ? Number(value) : null;
  const now = Date.now();
  let until = now + 60_000;
  const after = header("retry-after");
  if (after !== null) {
    if (seconds(after) === null) return null;
    until = Math.max(until, now + seconds(after) * 1000);
  }
  if (primary) {
    const reset = seconds(header("x-ratelimit-reset"));
    if (reset === null) return null;
    until = Math.max(until, reset * 1000 + 1000);
  }
  return Number.isSafeInteger(until) && until <= 8.64e15 ? until : null;
}

export function createGitHub(token, repo) {
  async function request(path, { method = "GET", body } = {}) {
    const response = await fetch(`https://api.github.com${path.replace("{repo}", repo)}`, {
      method,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const error = new Error(`${method} ${path} returned ${response.status}: ${data?.message ?? text.slice(0, 200)}`);
      error.status = response.status;
      error.rateLimitRetryAt = rateLimitRetryAt(response, data);
      throw error;
    }
    return data;
  }
  // Every page, or an error: decisions never rest on a partial list.
  async function all(path, pick = data => data, pages = 50) {
    const items = [];
    for (let page = 1; page <= pages; page += 1) {
      const separator = path.includes("?") ? "&" : "?";
      const batch = pick(await request(`${path}${separator}per_page=100&page=${page}`));
      items.push(...batch);
      if (batch.length < 100) return items;
    }
    throw truncated(`${path.replace("{repo}", repo).split("?")[0]} lists more than ${pages * 100} entries`);
  }
  return { request, all };
}

function truncated(message) {
  const error = new Error(message);
  error.code = "TRUNCATED";
  return error;
}

// Every PR closed or changed in the last day: that covers each run started in
// the last 24 hours and each run closed within the cooldown.
export async function recentClosedPulls(github, now, maxPages = 20) {
  const dayAgo = now - 24 * 60 * 60_000;
  const closed = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const batch = await github.request(`/repos/{repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=${page}`);
    closed.push(...batch);
    if (batch.length < 100 || Date.parse(batch.at(-1).updated_at) < dayAgo) return closed;
  }
  throw truncated(`more than ${maxPages * 100} pull requests were closed or changed in the last day`);
}

// The newest run of each check. Reruns leave older attempts on the commit.
export function latestChecks(checkRuns) {
  const newest = new Map();
  const order = run => [Date.parse(run.started_at ?? "") || 0, run.id ?? 0];
  for (const run of checkRuns) {
    const key = `${run.app?.slug ?? ""}/${run.name}`;
    const seen = newest.get(key);
    const [at, id] = order(run);
    if (!seen || at > order(seen)[0] || (at === order(seen)[0] && id > order(seen)[1])) newest.set(key, run);
  }
  return [...newest.values()];
}

// Claude's verdicts, from the reviews the Actions bot posted and from the
// comments it posts instead when GitHub refuses a review of a commit the PR no
// longer has. A comment names no commit GitHub checked, so its verdict never
// clears; its findings still hold. With Claude reviews switched on, a clean
// verdict on the head commit is traced to its run: it counts only when that
// run is the Claude review workflow, started on main by a comment or by hand,
// in this repository.
async function claudeVerdicts(github, reviews, comments, headSha, context) {
  const fromReviews = reviews.flatMap(review => {
    const marker = review.user?.login === ACTIONS_BOT && review.state !== "DISMISSED" ? verdictMarker(review.body ?? "") : null;
    return marker ? [{ ...marker, source: "review", commitId: review.commit_id, url: review.html_url, submittedAt: review.submitted_at ?? null, trusted: false }] : [];
  });
  const fromComments = comments.flatMap(comment => {
    const marker = comment.user?.login === ACTIONS_BOT ? verdictMarker(comment.body ?? "") : null;
    return marker ? [{ ...marker, source: "comment", commitId: null, url: comment.html_url, submittedAt: comment.created_at ?? null, trusted: false }] : [];
  });
  const verdicts = [...fromReviews, ...fromComments];
  if (!context.claudeReview) return verdicts;
  for (const verdict of verdicts) {
    if (verdict.verdict !== "clean" || verdict.sha !== headSha || verdict.commitId !== headSha) continue;
    const run = await github.request(`/repos/{repo}/actions/runs/${verdict.run}`).catch(() => null);
    verdict.trusted = run?.path === CLAUDE_WORKFLOW && run.head_branch === "main" &&
      ["issue_comment", "workflow_dispatch"].includes(run.event) && run.repository?.full_name === context.repo;
  }
  return verdicts;
}

export async function gatherFacts(github, pull, context) {
  const pr = await github.request(`/repos/{repo}/pulls/${pull.number}`);
  const headSha = pr.head.sha;
  const [files, checkRuns, status, reviews, reviewComments, comments, commits, headCommit] = await Promise.all([
    // GitHub lists at most 3,000 files; decide() holds bigger PRs for the owner.
    github.all(`/repos/{repo}/pulls/${pr.number}/files`, data => data, 30),
    github.all(`/repos/{repo}/commits/${headSha}/check-runs?filter=latest`, data => data.check_runs),
    github.request(`/repos/{repo}/commits/${headSha}/status?per_page=100`),
    github.all(`/repos/{repo}/pulls/${pr.number}/reviews`),
    github.all(`/repos/{repo}/pulls/${pr.number}/comments`),
    github.all(`/repos/{repo}/issues/${pr.number}/comments`),
    // GitHub lists at most 250 commits.
    github.all(`/repos/{repo}/pulls/${pr.number}/commits`, data => data, 3),
    github.request(`/repos/{repo}/commits/${headSha}`),
  ]);
  if (status.total_count > status.statuses.length) throw truncated(`commit ${headSha.slice(0, 7)} has more than ${status.statuses.length} statuses`);
  if (pr.commits > commits.length) throw truncated(`the pull request has ${pr.commits} commits and GitHub lists ${commits.length}`);
  const checks = latestChecks(checkRuns).map(run => ({ name: run.name, app: run.app?.slug ?? "", status: run.status, conclusion: run.conclusion, startedAt: run.started_at }));
  const claudeReviews = await claudeVerdicts(github, reviews, comments, headSha, context);
  const starts = checks.filter(check => check.app === "github-actions").map(check => Date.parse(check.startedAt)).filter(Number.isFinite);
  return {
    now: context.now,
    trustedAuthors: context.trustedAuthors,
    pr: {
      number: pr.number, title: pr.title, body: pr.body ?? "", draft: pr.draft, headRef: pr.head.ref, headSha,
      baseRef: pr.base.ref, author: pr.user?.login ?? "", createdAt: pr.created_at, changedFiles: pr.changed_files,
      labels: pr.labels.map(label => label.name), sameRepo: pr.head.repo?.full_name === pr.base.repo.full_name,
      mergeableState: pr.mergeable_state ?? "unknown",
    },
    files,
    checks,
    statuses: status.statuses.map(entry => ({ context: entry.context, state: entry.state })),
    reviews: reviews.map(review => ({
      id: review.id, login: review.user?.login ?? "", type: review.user?.type ?? "User", association: review.author_association,
      state: review.state, commitId: review.commit_id, body: review.body ?? "", url: review.html_url,
      submittedAt: review.submitted_at ?? null,
    })),
    claudeReview: Boolean(context.claudeReview),
    // Claude's verdicts, from its reviews and from the comments it falls back to.
    claudeReviews,
    // GitHub leaves Copilot out of requested_reviewers, so its running check counts too.
    copilotPending: (pr.requested_reviewers ?? []).some(user => COPILOT_REVIEWERS.includes(user.login)) ||
      checks.some(check => check.name === "copilot-pull-request-reviewer" && check.status !== "completed"),
    // Original commit identity is provenance, not resolution. Keep the native
    // review ID so an explicit review dismissal can dispose its comments.
    reviewComments: reviewComments.map(comment => ({
      login: comment.user?.login ?? "", type: comment.user?.type ?? "User", association: comment.author_association,
      reviewId: comment.pull_request_review_id, inReplyTo: comment.in_reply_to_id ?? null, originalCommitId: comment.original_commit_id, url: comment.html_url,
    })),
    markers: parseMarkers(comments.map(comment => ({
      id: comment.id, login: comment.user?.login ?? "", body: comment.body ?? "", createdAt: comment.created_at,
    })), context.trustedMarkers),
    codexComments: comments.filter(comment => comment.user?.login === CODEX_BOT)
      .map(comment => ({ body: comment.body ?? "", createdAt: comment.created_at, updatedAt: comment.updated_at })),
    // No check on this commit can start before it reached the PR, so the
    // earliest start is a safe stand-in for the push time.
    pushedAt: starts.length ? new Date(Math.min(...starts)).toISOString() : headCommit.commit.committer.date,
    commitAuthors: commits.flatMap(commit => [commit.author?.login, commit.committer?.login]).filter(Boolean),
    commitMessages: commits.map(commit => commit.commit.message),
    commitSubjects: commits.map(commit => commit.commit.message.split("\n")[0]),
  };
}

export async function main(env = process.env, log = console.log) {
  const repo = env.GITHUB_REPOSITORY;
  if (!repo || !env.GH_TOKEN) throw new Error("GITHUB_REPOSITORY and GH_TOKEN are required.");
  const owner = env.GITHUB_REPOSITORY_OWNER || repo.split("/")[0];
  const live = env.AUTOPILOT_ENABLED === "true";
  const startTasks = env.AUTOPILOT_START_TASKS === "true";
  // Whether Claude's clean verdict can clear a task PR (brief, Section 4, "Review policy").
  const claudeReview = env.AUTOPILOT_CLAUDE_REVIEW === "true";
  const github = createGitHub(env.GH_TOKEN, repo);
  // The trigger token must be the owner's: Codex answers the people it's
  // linked to, and only the owner's markers count.
  let trigger = env.CODEX_TRIGGER_TOKEN ? createGitHub(env.CODEX_TRIGGER_TOKEN, repo) : null;
  if (trigger) {
    try {
      const login = (await trigger.request("/user")).login;
      if (login !== owner) {
        log(`The trigger token belongs to ${login}, not ${owner}; continuing without it.`);
        trigger = null;
      }
    } catch (error) {
      log(`The trigger token was rejected (${error.message}); continuing without it.`);
      trigger = null;
    }
  }
  const context = { now: Date.now(), repo, claudeReview, trustedMarkers: [ACTIONS_BOT, owner], trustedAuthors: [owner, ACTIONS_BOT, CODEX_BOT] };
  const { now } = context;
  log(`${live ? "Live" : "Dry run (set AUTOPILOT_ENABLED to true to act)"}; Codex trigger token ${trigger ? "ready" : "not available"}; Claude reviews ${claudeReview ? "on" : "off"}.`);

  const write = async (description, action) => {
    log(`  ${live ? "doing" : "would do"}: ${description}`);
    if (live) await action();
  };
  const ensureLabel = name => write(`create label ${name} if missing`, () =>
    github.request("/repos/{repo}/labels", { method: "POST", body: { name, color: name === RUN_LABEL ? "0e8a16" : "d93f0b" } })
      .catch(error => { if (error.status !== 422) throw error; }));
  const addLabel = async (number, name) => {
    await ensureLabel(name);
    await write(`label #${number} ${name}`, () =>
      github.request(`/repos/{repo}/issues/${number}/labels`, { method: "POST", body: { labels: [name] } }));
  };
  const note = (number, sha, key, text) => write(`note on #${number}: ${text}`, () =>
    github.request(`/repos/{repo}/issues/${number}/comments`, { method: "POST", body: { body: `Remediation autopilot: ${text}\n\n<!-- ${MARKER}:note sha=${sha} key=${key} -->` } }));
  const askCodex = (number, kind, sha, text, retry = false) => write(`ask Codex (${kind}${retry ? ", retry" : ""}) on #${number}`, () =>
    trigger.request(`/repos/{repo}/issues/${number}/comments`, { method: "POST", body: { body: `${text}\n\n<!-- ${MARKER}:${kind} sha=${sha}${retry ? " key=retry" : ""} -->` } }));
  // The Claude review workflow starts only on the owner's comment, and each
  // review draws on the owner's Claude plan.
  const askClaude = (number, sha) => write(`ask Claude to review #${number}`, () =>
    trigger.request(`/repos/{repo}/issues/${number}/comments`, { method: "POST", body: { body: `${CLAUDE_ASK}\n\n<!-- ${MARKER}:claude sha=${sha} -->` } }));
  // Copilot bills the person who asks, so this uses the owner's token too.
  const askCopilot = number => write(`ask Copilot to review #${number}`, () =>
    trigger.request(`/repos/{repo}/pulls/${number}/requested_reviewers`, { method: "POST", body: { reviewers: [COPILOT_REVIEWERS[0]] } })
      .catch(error => log(`  Copilot review request failed (${error.message}); the autopilot asks again after the review wait.`)));
  // Reserve before dispatch. A crash, timeout or failed final write leaves a
  // durable pending attempt. Only a subsequent review can reconcile it;
  // otherwise the decision path holds instead of duplicating a paid request.
  const requestOutsideReview = (number, sha, retry) => write(`reserve and request Copilot review on #${number}`, async () => {
    const pendingKey = retry ? "retry-dispatch-pending" : "dispatch-pending";
    const record = await github.request(`/repos/{repo}/issues/${number}/comments`, { method: "POST", body: { body:
      `Remediation autopilot: reserved a Copilot review attempt; dispatch outcome is unconfirmed.\n\n<!-- ${MARKER}:review sha=${sha} key=${pendingKey} -->` } });
    if (!Number.isSafeInteger(record?.id)) throw new Error("Review reservation returned no comment ID; not dispatching.");
    try {
      await trigger.request(`/repos/{repo}/pulls/${number}/requested_reviewers`, { method: "POST", body: { reviewers: [COPILOT_REVIEWERS[0]] } });
    } catch (error) {
      if (error.rateLimitRetryAt) {
        const key = retry ? "retry-rate-rejected" : "rate-rejected";
        await github.request(`/repos/{repo}/issues/comments/${record.id}`, { method: "PATCH", body: { body:
          `Remediation autopilot: GitHub rejected this review attempt due to a rate limit. Retry only after the recorded cooldown.\n\n<!-- ${MARKER}:review sha=${sha} key=${key} until=${error.rateLimitRetryAt} -->` } });
      }
      throw error;
    }
    await github.request(`/repos/{repo}/issues/comments/${record.id}`, { method: "PATCH", body: { body:
      `Remediation autopilot: Copilot review request accepted for commit ${sha.slice(0, 7)}.\n\n<!-- ${MARKER}:review sha=${sha}${retry ? " key=retry" : ""} -->` } });
  });
  const deleteBranch = ref => github.request(`/repos/{repo}/git/refs/heads/${ref}`, { method: "DELETE" }).catch(() => {});

  const open = (await github.all("/repos/{repo}/pulls?state=open"))
    .filter(pr => pr.base.ref === "main" && pr.head.repo?.full_name === repo && context.trustedAuthors.includes(pr.user?.login))
    .map(pr => ({
      number: pr.number, title: pr.title, body: pr.body ?? "", draft: pr.draft, headRef: pr.head.ref, headSha: pr.head.sha,
      labels: pr.labels.map(label => label.name), createdAt: pr.created_at,
    }));
  let failures = 0;
  let merged = 0;
  for (const pull of open) {
    if (!taskIdOf(pull) && !isRun(pull) && taskIdsOf(pull).length < 2) continue;
    const ownerLabel = pull.labels.find(label => OWNER_LABELS.includes(label));
    if (ownerLabel) {
      log(`#${pull.number}: skip (labeled ${ownerLabel})`);
      continue;
    }
    try {
      const facts = await gatherFacts(github, pull, context);
      const decision = decide(facts);
      const sha = facts.pr.headSha;
      log(`#${pull.number} ${taskIdOf(facts.pr) ?? "run"}: ${decision.type} (${decision.reason})`);
      const hasNote = key => facts.markers.some(marker => marker.kind === "note" && marker.key === key && marker.sha === sha);
      if (decision.type === "retitle") {
        await write(`retitle #${pull.number} to "${decision.title}"`, () =>
          github.request(`/repos/{repo}/pulls/${pull.number}`, { method: "PATCH", body: { title: decision.title } }));
      } else if (decision.type === "close-runner") {
        await write(`close run #${pull.number} and delete its branch`, async () => {
          await github.request(`/repos/{repo}/pulls/${pull.number}`, { method: "PATCH", body: { state: "closed" } });
          await deleteBranch(facts.pr.headRef);
        });
      } else if (decision.type === "label-owner") {
        await addLabel(pull.number, decision.label);
        if (!hasNote(decision.label)) {
          const handBack = decision.label === "needs-owner-approval"
            ? "Review it and merge it yourself when it's right."
            : `Remove the \`${decision.label}\` label to hand it back to the autopilot.`;
          await note(pull.number, sha, decision.label, `waiting for the owner, because ${decision.reason}. ${handBack}`);
        }
      } else if (decision.type === "request-claude") {
        if (trigger) {
          await askClaude(pull.number, sha);
        } else {
          await addLabel(pull.number, "needs-owner");
          if (!hasNote("no-trigger")) {
            await note(pull.number, sha, "no-trigger", `this needs Claude's review (${decision.reason}), but the trigger token isn't available, and the Claude review workflow starts only on your comment. Comment \`${CLAUDE_ASK}\` here yourself, or fix the \`CODEX_TRIGGER_TOKEN\` secret.`);
          }
        }
      } else if (["request-fix", "request-update", "request-review", "request-start"].includes(decision.type)) {
        const kind = { "request-fix": "fix", "request-update": "update", "request-review": "review", "request-start": "start" }[decision.type];
        const outsideReview = kind === "review" && !decision.codex;
        if (!trigger) {
          await addLabel(pull.number, "needs-owner");
          if (!hasNote("no-trigger")) {
            await note(pull.number, sha, "no-trigger", outsideReview
              ? `this needs a Copilot review (${decision.reason}), but the trigger token isn't available, and Copilot reviews are requested with your token. Request a review from Copilot here yourself, or fix the \`CODEX_TRIGGER_TOKEN\` secret.`
              : `this needs Codex (${decision.reason}), but the Codex trigger token isn't available. Comment \`@codex\` here yourself, or fix the \`CODEX_TRIGGER_TOKEN\` secret.`);
          }
        } else if (outsideReview) {
          await requestOutsideReview(pull.number, sha, Boolean(decision.retry));
        } else {
          const text = kind === "start" ? startPrompt([...new Set(open.map(taskIdOf).filter(Boolean))].sort()) : codexAsk(decision, sha);
          await askCodex(pull.number, kind, sha, text, Boolean(decision.retry));
          if (decision.copilot) await askCopilot(pull.number);
        }
      } else if (decision.type === "merge") {
        if (merged > 0) {
          log("  skipping: one merge per run, because main has just moved");
          continue;
        }
        // Look again right before merging: a review can land after the first look.
        const again = await gatherFacts(github, pull, { ...context, now: Date.now() });
        const second = decide(again);
        if (second.type !== "merge" || again.pr.headSha !== sha) {
          log(`  not merging: a second look says ${second.type} (${second.reason})`);
          continue;
        }
        await write(`squash-merge #${pull.number} at ${sha.slice(0, 7)}`, async () => {
          try {
            const result = await github.request(`/repos/{repo}/pulls/${pull.number}/merge`, { method: "PUT", body: {
              merge_method: "squash", sha, commit_title: mergeTitle(again.pr, second.taskId),
              commit_message: mergeMessage(again.commitMessages, second.reviewer),
            } });
            if (result?.merged !== true) throw new Error(`GitHub answered without merging: ${result?.message ?? "no reason given"}`);
          } catch (error) {
            // One retry on the next run; a second failure at the same commit
            // is likely to last (branch protection, token rights), so hold it
            // and let the queue move on.
            if (hasNote("merge-failed")) {
              await addLabel(pull.number, "needs-owner");
              await note(pull.number, sha, "merge-failed-again", `waiting for the owner, because the merge failed twice at this commit: ${error.message}. Remove the \`needs-owner\` label to hand it back to the autopilot.`);
            } else {
              await note(pull.number, sha, "merge-failed", `the merge failed: ${error.message}. The autopilot tries once more on its next run.`);
            }
            throw error;
          }
          merged += 1;
          await deleteBranch(facts.pr.headRef);
        });
      }
    } catch (error) {
      failures += 1;
      log(`#${pull.number}: error: ${error.message}`);
      // A list too long to read in full means the PR can't be judged: hold it.
      if (error.code === "TRUNCATED") {
        await addLabel(pull.number, "needs-owner").catch(labelError => log(`  labeling failed: ${labelError.message}`));
        await note(pull.number, pull.headSha, "truncated", `waiting for the owner, because ${error.message}, too many to check. Remove the \`needs-owner\` label to hand it back to the autopilot.`)
          .catch(noteError => log(`  note failed: ${noteError.message}`));
      }
    }
  }

  if (startTasks && merged === 0 && failures === 0) {
    const closed = await recentClosedPulls(github, now);
    const recentRuns = [
      ...open.map(pr => ({ number: pr.number, labels: pr.labels, headRef: pr.headRef, createdAt: pr.createdAt, closedAt: null, merged: false })),
      ...closed.map(pr => ({ number: pr.number, labels: pr.labels.map(label => label.name), headRef: pr.head.ref, createdAt: pr.created_at, closedAt: pr.closed_at, merged: Boolean(pr.merged_at) })),
    ].filter(isRun);
    const plan = shouldStartRun({ open, recentRuns, now });
    log(`Next task: ${plan.start ? "start a run" : "not now"} (${plan.reason})`);
    if (plan.start && !trigger) {
      log("Can't start a run without the Codex trigger token.");
    } else if (plan.start) {
      const openTaskIds = [...new Set(open.map(taskIdOf).filter(Boolean))].sort();
      await write("open a run pull request and ask Codex for the next task", async () => {
        const stamp = new Date(now).toISOString().replace(/[-:]/g, "").slice(0, 13);
        const branch = `${RUN_BRANCH_PREFIX}${stamp}`;
        const base = await github.request("/repos/{repo}/git/ref/heads/main");
        const baseCommit = await github.request(`/repos/{repo}/git/commits/${base.object.sha}`);
        const commit = await github.request("/repos/{repo}/git/commits", { method: "POST", body: {
          message: "chore: start a remediation run", tree: baseCommit.tree.sha, parents: [base.object.sha],
        } });
        await github.request("/repos/{repo}/git/refs", { method: "POST", body: { ref: `refs/heads/${branch}`, sha: commit.sha } });
        let run;
        try {
          run = await github.request("/repos/{repo}/pulls", { method: "POST", body: {
            title: `Remediation run ${stamp.slice(0, 8)}`, head: branch, base: "main",
            body: "The remediation autopilot opened this for Codex's next task. Codex pushes the task to this branch. The autopilot then renames the pull request after the task and steers it to merge.",
          } });
        } catch (error) {
          await deleteBranch(branch);
          throw error;
        }
        await addLabel(run.number, RUN_LABEL);
        await askCodex(run.number, "start", commit.sha, startPrompt(openTaskIds));
        log(`Started run #${run.number} on ${branch}.`);
      });
    }
  }
  if (failures) throw new Error(`${failures} pull request${failures === 1 ? "" : "s"} hit errors; see the log above.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}
