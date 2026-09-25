#!/usr/bin/env node
// Remediation autopilot. Runs from main on a schedule
// (.github/workflows/remediation-autopilot.yml). For each open remediation task
// pull request it asks Codex to fix failing checks or review comments, asks
// for a re-review after each fix, and merges the pull request once it is green
// and reviewed. It can also start the next task. It never deploys anything.
// The rules are in docs/remediation/CODEX-BRIEF.md, Section 4, "Autopilot".

import process from "node:process";
import { pathToFileURL } from "node:url";

export const MARKER = "remediation-autopilot";
export const RUN_LABEL = "remediation-run";
export const OWNER_LABELS = ["needs-owner", "needs-owner-approval"];
export const CODEX_BOT = "chatgpt-codex-connector[bot]";
export const ACTIONS_BOT = "github-actions[bot]";
export const REQUIRED_CHECKS = ["verify", "Native Chrome WebMCP"];

// Changes to these paths always wait for the owner.
export const PROTECTED_PATHS = [
  ".github/workflows/remediation-autopilot.yml",
  ".github/workflows/release.yml",
  "scripts/remediation-autopilot.mjs",
  "scripts/remediation-autopilot.test.mjs",
  "vercel.json",
  "convex.json",
  "AGENTS.md",
  "docs/remediation/CODEX-BRIEF.md",
];
// Lines may be added to these paths, never removed, without the owner.
export const ADD_ONLY_PATHS = [".github/workflows/verify.yml"];
// Tasks whose result the owner approves before merge (R07: the Terms wording).
export const OWNER_TASKS = ["R07"];

export const LIMITS = {
  fixRounds: 3,
  quietMinutes: 30,
  reviewWaitMinutes: 60,
  runnerWaitHours: 6,
  runnerCooldownHours: 12,
  runnersPerDay: 6,
};

const FAILED = new Set(["failure", "timed_out", "action_required", "startup_failure"]);
const TITLE_TASK = /\((R\d{2})\)\s*$/;
const MARKER_PATTERN = /<!-- remediation-autopilot:(start|fix|review|note) sha=([0-9a-f]{7,40})(?: key=([\w-]+))? -->/;

const minutesBetween = (later, earlier) => (later - earlier) / 60_000;

export function taskIdOf(pr) {
  const fromTitle = pr.title.match(TITLE_TASK);
  if (fromTitle) return fromTitle[1];
  const fromBody = (pr.body ?? "").match(/Remediation task, if any:\s*(R\d{2})\b/);
  if (fromBody) return fromBody[1];
  const fromBranch = pr.headRef.match(/^remediate\/(R\d{2})-/);
  return fromBranch ? fromBranch[1] : null;
}

export function protectedChanges(files) {
  const touched = [];
  for (const file of files) {
    const names = [file.filename, file.previous_filename].filter(Boolean);
    if (names.some(name => PROTECTED_PATHS.includes(name))) touched.push(file.filename);
    else if (names.some(name => ADD_ONLY_PATHS.includes(name)) && (file.deletions > 0 || file.status === "removed")) {
      touched.push(`${file.filename} (lines removed)`);
    }
  }
  return touched;
}

export function latestChecks(checkRuns) {
  const byName = new Map();
  for (const run of checkRuns) {
    const seen = byName.get(run.name);
    if (!seen || run.id > seen.id) byName.set(run.name, run);
  }
  return [...byName.values()];
}

export function failedChecks(checks, statusState) {
  const failed = checks.filter(check => check.status === "completed" && FAILED.has(check.conclusion)).map(check => check.name);
  if (statusState === "failure" || statusState === "error") failed.push("commit status");
  return failed;
}

// Reviews on the head commit. Comments from the Codex reviewer, from people,
// and any "changes requested" review block a merge. Comments from other review
// bots are advisory once the fix rounds run out.
export function findingsOnHead(reviews, headSha) {
  let total = 0;
  let blocking = 0;
  for (const review of reviews) {
    if (review.commitId !== headSha) continue;
    const count = review.commentCount + (review.state === "CHANGES_REQUESTED" ? 1 : 0);
    total += count;
    if (review.login === CODEX_BOT || review.type !== "Bot" || review.state === "CHANGES_REQUESTED") blocking += count;
  }
  return { total, blocking };
}

export function parseMarkers(comments, trustedLogins) {
  const markers = [];
  for (const comment of comments) {
    if (!trustedLogins.includes(comment.login)) continue;
    const match = comment.body.match(MARKER_PATTERN);
    if (match) markers.push({ kind: match[1], sha: match[2], key: match[3] ?? null, createdAt: comment.createdAt, id: comment.id });
  }
  return markers;
}

// Decides the next step for one open pull request. Pure, so it can be tested.
export function decide(facts, limits = LIMITS) {
  const { pr, now } = facts;
  const taskId = taskIdOf(pr);
  if (pr.labels.includes(RUN_LABEL) && !taskId) {
    const subject = facts.commitSubjects.find(line => TITLE_TASK.test(line));
    if (subject) return { type: "retitle", title: subject, reason: "Codex pushed a task" };
    const start = facts.markers.find(marker => marker.kind === "start");
    const waited = start ? minutesBetween(now, Date.parse(start.createdAt)) / 60 : 0;
    if (waited >= limits.runnerWaitHours) return { type: "close-runner", reason: `no task commit after ${limits.runnerWaitHours} hours` };
    return { type: "wait", reason: "waiting for Codex to push the next task" };
  }
  if (!taskId) return { type: "skip", reason: "not a remediation task" };
  if (!pr.sameRepo) return { type: "skip", reason: "branch is on a fork" };
  if (pr.draft) return { type: "skip", reason: "draft" };
  const ownerLabel = pr.labels.find(label => OWNER_LABELS.includes(label));
  if (ownerLabel) return { type: "skip", reason: `labeled ${ownerLabel}` };
  const guarded = protectedChanges(facts.files);
  if (guarded.length) return { type: "label-owner", label: "needs-owner-approval", reason: `it changes ${guarded.join(", ")}` };
  if (OWNER_TASKS.includes(taskId)) return { type: "label-owner", label: "needs-owner-approval", reason: `the brief has the owner approve ${taskId}` };

  const rounds = facts.markers.filter(marker => marker.kind === "fix").length;
  const askedThisHead = facts.markers.some(marker => marker.kind === "fix" && marker.sha === pr.headSha);
  const askForFix = (kind, reason) => {
    if (askedThisHead) return { type: "wait", reason: "a fix is already requested for this commit" };
    if (rounds >= limits.fixRounds) return { type: "label-owner", label: "needs-owner", reason: `${reason}, after ${rounds} fix rounds` };
    return { type: "request-fix", kind, reason };
  };

  const failed = failedChecks(facts.checks, facts.statusState);
  if (failed.length) return askForFix("ci", `failing: ${failed.join(", ")}`);
  if (pr.mergeableState === "dirty") return askForFix("conflict", "conflicts with main");
  if (pr.mergeableState === "behind") return askForFix("update", "behind main");
  const findings = findingsOnHead(facts.reviews, pr.headSha);
  if (findings.total > 0 && (rounds < limits.fixRounds || findings.blocking > 0)) {
    return askForFix("review", `${findings.total} review comments on this commit`);
  }

  const running = facts.checks.filter(check => check.status !== "completed").map(check => check.name);
  if (running.length) return { type: "wait", reason: `checks running: ${running.join(", ")}` };
  const missing = REQUIRED_CHECKS.filter(name => !facts.checks.some(check => check.name === name && check.conclusion === "success"));
  if (missing.length) return { type: "wait", reason: `required checks not passed: ${missing.join(", ")}` };
  if (facts.statusState === "pending") return { type: "wait", reason: "commit statuses pending" };
  const quiet = minutesBetween(now, Date.parse(facts.pushedAt));
  if (quiet < limits.quietMinutes) return { type: "wait", reason: `letting reviewers finish, ${Math.ceil(limits.quietMinutes - quiet)} minutes left` };

  const reviewed = facts.codexAcks.some(ack => ack.sha === pr.headSha || Date.parse(ack.at) > Date.parse(facts.pushedAt));
  if (!reviewed) {
    const asked = facts.markers.find(marker => marker.kind === "review" && marker.sha === pr.headSha);
    if (!asked) return { type: "request-review", reason: "no Codex review of this commit yet" };
    if (minutesBetween(now, Date.parse(asked.createdAt)) < limits.reviewWaitMinutes) {
      return { type: "wait", reason: "waiting for the Codex review" };
    }
  }
  if (pr.mergeableState !== "clean" && pr.mergeableState !== "has_hooks") {
    return { type: "wait", reason: `GitHub merge state is ${pr.mergeableState}` };
  }
  return { type: "merge", taskId, reason: reviewed ? "green and reviewed" : "green; the review request timed out" };
}

// Whether to open a run pull request that asks Codex for the next task.
export function shouldStartRun({ open, recentRuns, now }, limits = LIMITS) {
  const waitingRun = open.find(pr => pr.labels.includes(RUN_LABEL) && !taskIdOf(pr));
  if (waitingRun) return { start: false, reason: `run #${waitingRun.number} is waiting for Codex` };
  const active = open.find(pr => taskIdOf(pr) && !pr.draft && !pr.labels.some(label => OWNER_LABELS.includes(label)));
  if (active) return { start: false, reason: `task #${active.number} is in flight` };
  const lastDay = recentRuns.filter(run => minutesBetween(now, Date.parse(run.createdAt)) < 24 * 60);
  if (lastDay.length >= limits.runnersPerDay) return { start: false, reason: `${lastDay.length} runs started in the last 24 hours` };
  const stalled = recentRuns.find(run => !run.merged && run.closedAt &&
    minutesBetween(now, Date.parse(run.closedAt)) < limits.runnerCooldownHours * 60);
  if (stalled) return { start: false, reason: `run #${stalled.number} stalled recently` };
  return { start: true, reason: "no task in flight" };
}

export function mergeTitle(pr, taskId) {
  const title = TITLE_TASK.test(pr.title) ? pr.title : `${pr.title} (${taskId})`;
  return `${title} (#${pr.number})`;
}

// Keeps each commit's message, so questions Codex leaves in a commit body reach main.
export function mergeMessage(commitMessages) {
  const kept = commitMessages.filter(message => !message.startsWith("chore: start a remediation run"));
  return [
    "Merged by the remediation autopilot: checks green, review clean, no owner-only files.",
    ...kept.map(message => `* ${message.trim()}`),
  ].join("\n\n");
}

const codexAsk = {
  ci: (sha, reason) => `@codex Checks are failing on this pull request at ${sha.slice(0, 7)} (${reason.replace(/^failing: /, "")}). Fix them, following \`docs/remediation/CODEX-BRIEF.md\`. Push the fix to this branch; don't open a new pull request.`,
  review: sha => `@codex Address every review comment on commit ${sha.slice(0, 7)} of this pull request, following \`docs/remediation/CODEX-BRIEF.md\`. Fix what's valid. List anything you leave unchanged, with the reason, under "Found, not fixed" in the description. Push to this branch; don't open a new pull request.`,
  conflict: () => "@codex This pull request conflicts with main. Merge main into this branch, resolve the conflicts so both sides keep working, run the checks, and push. Don't open a new pull request.",
  update: () => "@codex This branch is behind main. Merge main into it, run the checks, and push. Don't open a new pull request.",
};
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

export function createGitHub(token, repo) {
  async function request(path, { method = "GET", body, auth = token } = {}) {
    const response = await fetch(`https://api.github.com${path.replace("{repo}", repo)}`, {
      method,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${auth}`,
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
      throw error;
    }
    return data;
  }
  async function all(path, pick = data => data) {
    const items = [];
    for (let page = 1; page <= 10; page += 1) {
      const separator = path.includes("?") ? "&" : "?";
      const batch = pick(await request(`${path}${separator}per_page=100&page=${page}`));
      items.push(...batch);
      if (batch.length < 100) break;
    }
    return items;
  }
  return { request, all };
}

export async function gatherFacts(github, pull, trustedLogins, now) {
  const pr = await github.request(`/repos/{repo}/pulls/${pull.number}`);
  const headSha = pr.head.sha;
  const [files, checkRuns, status, reviews, comments, reactions, commits, headCommit] = await Promise.all([
    github.all(`/repos/{repo}/pulls/${pr.number}/files`),
    github.all(`/repos/{repo}/commits/${headSha}/check-runs`, data => data.check_runs),
    github.request(`/repos/{repo}/commits/${headSha}/status`),
    github.all(`/repos/{repo}/pulls/${pr.number}/reviews`),
    github.all(`/repos/{repo}/issues/${pr.number}/comments`),
    github.all(`/repos/{repo}/issues/${pr.number}/reactions`),
    github.all(`/repos/{repo}/pulls/${pr.number}/commits`),
    github.request(`/repos/{repo}/commits/${headSha}`),
  ]);
  const reviewFacts = await Promise.all(reviews.map(async review => ({
    login: review.user?.login ?? "",
    type: review.user?.type ?? "User",
    state: review.state,
    commitId: review.commit_id,
    commentCount: review.commit_id === headSha
      ? (await github.all(`/repos/{repo}/pulls/${pr.number}/reviews/${review.id}/comments`)).length
      : 0,
  })));
  const markers = parseMarkers(comments.map(comment => ({
    id: comment.id, login: comment.user?.login ?? "", body: comment.body ?? "", createdAt: comment.created_at,
  })), trustedLogins);
  const reviewAsk = [...markers].reverse().find(marker => marker.kind === "review" && marker.sha === headSha);
  const askReactions = reviewAsk ? await github.all(`/repos/{repo}/issues/comments/${reviewAsk.id}/reactions`) : [];
  const codexAcks = [
    ...reviewFacts.filter(review => review.login === CODEX_BOT).map(review => ({ sha: review.commitId, at: "1970-01-01T00:00:00Z" })),
    ...[...reactions, ...askReactions]
      .filter(reaction => reaction.user?.login === CODEX_BOT && reaction.content === "+1")
      .map(reaction => ({ sha: null, at: reaction.created_at })),
  ];
  const checks = latestChecks(checkRuns.map(run => ({ id: run.id, name: run.name, status: run.status, conclusion: run.conclusion, startedAt: run.started_at })));
  const starts = checks.map(check => Date.parse(check.startedAt)).filter(Number.isFinite);
  const pushedAt = starts.length ? new Date(Math.min(...starts)).toISOString() : headCommit.commit.committer.date;
  return {
    now,
    pr: {
      number: pr.number, title: pr.title, body: pr.body ?? "", draft: pr.draft, headRef: pr.head.ref, headSha,
      labels: pr.labels.map(label => label.name), sameRepo: pr.head.repo?.full_name === pr.base.repo.full_name,
      mergeableState: pr.mergeable_state ?? "unknown",
    },
    files, checks, statusState: status.total_count > 0 ? status.state : null, reviews: reviewFacts, markers,
    codexAcks, pushedAt,
    commitMessages: commits.map(commit => commit.commit.message),
    commitSubjects: commits.map(commit => commit.commit.message.split("\n")[0]),
  };
}

export async function main(env = process.env, log = console.log) {
  const repo = env.GITHUB_REPOSITORY;
  if (!repo || !env.GH_TOKEN) throw new Error("GITHUB_REPOSITORY and GH_TOKEN are required.");
  const live = env.AUTOPILOT_ENABLED === "true";
  const startTasks = env.AUTOPILOT_START_TASKS === "true";
  const github = createGitHub(env.GH_TOKEN, repo);
  const trigger = env.CODEX_TRIGGER_TOKEN ? createGitHub(env.CODEX_TRIGGER_TOKEN, repo) : null;
  const triggerLogin = trigger ? (await trigger.request("/user")).login : null;
  const trusted = [ACTIONS_BOT, ...(triggerLogin ? [triggerLogin] : [])];
  const now = Date.now();
  log(`${live ? "Live" : "Dry run (set AUTOPILOT_ENABLED to true to act)"}; Codex trigger ${triggerLogin ? `as ${triggerLogin}` : "not configured"}.`);

  const write = async (description, action) => {
    log(`  ${live ? "doing" : "would do"}: ${description}`);
    if (live) await action();
  };
  const ensureLabel = name => write(`create label ${name} if missing`, () =>
    github.request("/repos/{repo}/labels", { method: "POST", body: { name, color: name === RUN_LABEL ? "0e8a16" : "d93f0b" } })
      .catch(error => { if (error.status !== 422) throw error; }));
  const note = (number, sha, key, text) => write(`note on #${number}: ${text}`, () =>
    github.request(`/repos/{repo}/issues/${number}/comments`, { method: "POST", body: { body: `Remediation autopilot: ${text}\n\n<!-- ${MARKER}:note sha=${sha} key=${key} -->` } }));
  const askCodex = (number, kind, sha, text) => write(`ask Codex (${kind}) on #${number}`, () =>
    trigger.request(`/repos/{repo}/issues/${number}/comments`, { method: "POST", body: { body: `${text}\n\n<!-- ${MARKER}:${kind === "review" ? "review" : kind === "start" ? "start" : "fix"} sha=${sha} -->` } }));

  const open = (await github.all("/repos/{repo}/pulls?state=open")).map(pr => ({
    number: pr.number, title: pr.title, body: pr.body ?? "", draft: pr.draft, headRef: pr.head.ref,
    labels: pr.labels.map(label => label.name), createdAt: pr.created_at,
  }));
  let failures = 0;
  let merged = 0;
  for (const pull of open) {
    if (!taskIdOf(pull) && !pull.labels.includes(RUN_LABEL)) continue;
    try {
      const facts = await gatherFacts(github, pull, trusted, now);
      const decision = decide(facts);
      const sha = facts.pr.headSha;
      log(`#${pull.number} ${taskIdOf(facts.pr) ?? "run"}: ${decision.type} (${decision.reason})`);
      const hasNote = key => facts.markers.some(marker => marker.kind === "note" && marker.key === key && marker.sha === sha);
      if (decision.type === "retitle") {
        await write(`retitle #${pull.number} to "${decision.title}"`, () =>
          github.request(`/repos/{repo}/pulls/${pull.number}`, { method: "PATCH", body: { title: decision.title } }));
      } else if (decision.type === "close-runner") {
        await write(`close run #${pull.number}`, async () => {
          await github.request(`/repos/{repo}/pulls/${pull.number}`, { method: "PATCH", body: { state: "closed" } });
          await github.request(`/repos/{repo}/git/refs/heads/${facts.pr.headRef}`, { method: "DELETE" }).catch(() => {});
        });
      } else if (decision.type === "label-owner") {
        await ensureLabel(decision.label);
        await write(`label #${pull.number} ${decision.label}`, () =>
          github.request(`/repos/{repo}/issues/${pull.number}/labels`, { method: "POST", body: { labels: [decision.label] } }));
        if (!hasNote(decision.label)) {
          await note(pull.number, sha, decision.label, `waiting for the owner, because ${decision.reason}. Remove the \`${decision.label}\` label to hand it back.`);
        }
      } else if (decision.type === "request-fix" || decision.type === "request-review") {
        const kind = decision.type === "request-review" ? "review" : decision.kind;
        if (!trigger) {
          await ensureLabel("needs-owner");
          await write(`label #${pull.number} needs-owner`, () =>
            github.request(`/repos/{repo}/issues/${pull.number}/labels`, { method: "POST", body: { labels: ["needs-owner"] } }));
          if (!hasNote("no-trigger")) await note(pull.number, sha, "no-trigger", `this needs a Codex ${kind === "review" ? "review" : "fix"} (${decision.reason}), but \`CODEX_TRIGGER_TOKEN\` isn't set. Comment \`@codex\` here yourself, or add the secret.`);
        } else {
          const text = kind === "review" ? "@codex review" : codexAsk[kind](sha, decision.reason);
          await askCodex(pull.number, kind, sha, text);
        }
      } else if (decision.type === "merge") {
        await write(`squash-merge #${pull.number} at ${sha.slice(0, 7)}`, async () => {
          try {
            await github.request(`/repos/{repo}/pulls/${pull.number}/merge`, { method: "PUT", body: {
              merge_method: "squash", sha, commit_title: mergeTitle(facts.pr, decision.taskId),
              commit_message: mergeMessage(facts.commitMessages),
            } });
            merged += 1;
            await github.request(`/repos/{repo}/git/refs/heads/${facts.pr.headRef}`, { method: "DELETE" }).catch(() => {});
          } catch (error) {
            if (!hasNote("merge-failed")) await note(pull.number, sha, "merge-failed", `the merge failed: ${error.message}`);
            throw error;
          }
        });
      }
    } catch (error) {
      failures += 1;
      log(`#${pull.number}: error: ${error.message}`);
    }
  }

  if (startTasks && merged === 0 && failures === 0) {
    const closed = await github.request("/repos/{repo}/pulls?state=closed&sort=created&direction=desc&per_page=50");
    const recentRuns = [
      ...open.map(pr => ({ number: pr.number, labels: pr.labels, createdAt: pr.createdAt, closedAt: null, merged: false })),
      ...closed.map(pr => ({ number: pr.number, labels: pr.labels.map(label => label.name), createdAt: pr.created_at, closedAt: pr.closed_at, merged: Boolean(pr.merged_at) })),
    ].filter(pr => pr.labels.includes(RUN_LABEL));
    const plan = shouldStartRun({ open, recentRuns, now });
    log(`Next task: ${plan.start ? "start a run" : "not now"} (${plan.reason})`);
    if (plan.start && !trigger) {
      log("Can't start a run: CODEX_TRIGGER_TOKEN isn't set.");
    } else if (plan.start) {
      const openTaskIds = [...new Set(open.map(taskIdOf).filter(Boolean))].sort();
      await write("open a run pull request and ask Codex for the next task", async () => {
        const stamp = new Date(now).toISOString().replace(/[-:]/g, "").slice(0, 13);
        const branch = `remediate/run-${stamp}`;
        const base = await github.request("/repos/{repo}/git/ref/heads/main");
        const baseCommit = await github.request(`/repos/{repo}/git/commits/${base.object.sha}`);
        const commit = await github.request("/repos/{repo}/git/commits", { method: "POST", body: {
          message: "chore: start a remediation run", tree: baseCommit.tree.sha, parents: [base.object.sha],
        } });
        await github.request("/repos/{repo}/git/refs", { method: "POST", body: { ref: `refs/heads/${branch}`, sha: commit.sha } });
        const run = await github.request("/repos/{repo}/pulls", { method: "POST", body: {
          title: `Remediation run ${stamp.slice(0, 8)}`, head: branch, base: "main",
          body: "The remediation autopilot opened this for Codex's next task. Codex pushes the task to this branch. The autopilot then renames the pull request after the task and steers it to merge.",
        } });
        await ensureLabel(RUN_LABEL);
        await github.request(`/repos/{repo}/issues/${run.number}/labels`, { method: "POST", body: { labels: [RUN_LABEL] } });
        await askCodex(run.number, "start", commit.sha, startPrompt(openTaskIds));
        log(`Started run #${run.number} on ${branch}.`);
      });
    }
  }
  if (failures) throw new Error(`${failures} pull requests hit errors; see the log above.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}
