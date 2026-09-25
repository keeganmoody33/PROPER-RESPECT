#!/usr/bin/env node
// Remediation autopilot. Runs from main on a schedule
// (.github/workflows/remediation-autopilot.yml). For each open remediation task
// pull request it asks Codex to fix failing checks or review comments, asks
// for a Codex review of the latest commit, and merges the pull request once it
// is green and reviewed. It can also start the next task. It never deploys.
// The rules are in docs/remediation/CODEX-BRIEF.md, Section 4, "Autopilot".

import process from "node:process";
import { pathToFileURL } from "node:url";

export const MARKER = "remediation-autopilot";
export const RUN_LABEL = "remediation-run";
export const RUN_BRANCH_PREFIX = "remediate/run-";
export const OWNER_LABELS = ["needs-owner", "needs-owner-approval"];
export const CODEX_BOT = "chatgpt-codex-connector[bot]";
export const ACTIONS_BOT = "github-actions[bot]";
export const REQUIRED_CHECKS = ["verify", "Native Chrome WebMCP"];
// Review comments count only from these bots, or from the owner and collaborators.
export const REVIEW_BOTS = [CODEX_BOT, "copilot-pull-request-reviewer[bot]", "Copilot", "vercel[bot]", "cursor[bot]", "devin-ai-integration[bot]"];
export const TRUSTED_ASSOCIATIONS = ["OWNER", "MEMBER", "COLLABORATOR"];

// Changes to these paths always wait for the owner. GitHub also refuses to let
// the workflow token merge changes under .github/workflows/.
export const PROTECTED_PREFIXES = [".github/workflows/"];
export const PROTECTED_PATHS = [
  "scripts/remediation-autopilot.mjs",
  "scripts/remediation-autopilot.test.mjs",
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
  replyWaitMinutes: 60,
  stuckHours: 6,
  runnerWaitHours: 6,
  runnerCooldownHours: 12,
  runnersPerDay: 6,
};

const FAILED = new Set(["failure", "timed_out", "cancelled", "action_required", "startup_failure", "stale"]);
const TITLE_TASK = /\((R\d{2})\)\s*$/;
const CLEAN_REVIEW = /did(?:n'?t| not) find any major issues/i;
const MARKER_PATTERN = /<!-- remediation-autopilot:(start|fix|update|review|note) sha=([0-9a-f]{7,40})(?: key=([\w-]+))? -->/;

const minutesSince = (now, iso) => (now - Date.parse(iso)) / 60_000;

export function taskIdOf(pr) {
  const fromTitle = pr.title.match(TITLE_TASK);
  if (fromTitle) return fromTitle[1];
  const fromBody = (pr.body ?? "").match(/^\s*-\s*Remediation task, if any:\s*(R\d{2})\b/m);
  if (fromBody) return fromBody[1];
  const fromBranch = pr.headRef.match(/^remediate\/(R\d{2})-/);
  return fromBranch ? fromBranch[1] : null;
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

// Review comments that ask for work: top-level comments on the head commit
// from a review bot or a trusted person. Replies and outsiders don't count.
// Comments from Codex or from people block a merge; other bots' are advisory
// once the fix rounds run out.
export function findingsOnHead(comments, reviews, headSha) {
  const counted = comments.filter(comment => comment.inReplyTo === null && comment.originalCommitId === headSha &&
    (REVIEW_BOTS.includes(comment.login) || (comment.type !== "Bot" && TRUSTED_ASSOCIATIONS.includes(comment.association))));
  const blockingComments = counted.filter(comment => comment.login === CODEX_BOT || comment.type !== "Bot");
  const changesRequested = reviews.filter(review => review.commitId === headSha && review.state === "CHANGES_REQUESTED" &&
    (REVIEW_BOTS.includes(review.login) || TRUSTED_ASSOCIATIONS.includes(review.association)));
  return {
    total: counted.length + changesRequested.length,
    blocking: blockingComments.length + changesRequested.length,
    urls: counted.map(comment => comment.url),
  };
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

function decideRun(facts, limits) {
  const { pr, now } = facts;
  const subject = facts.commitSubjects.find(line => TITLE_TASK.test(line));
  if (subject) return { type: "retitle", title: subject, reason: "Codex pushed a task" };
  const start = facts.markers.find(marker => marker.kind === "start");
  const waitedHours = minutesSince(now, start?.createdAt ?? pr.createdAt) / 60;
  if (waitedHours >= limits.runnerWaitHours) {
    if (facts.commitSubjects.length > 1) {
      return { type: "label-owner", label: "needs-owner", reason: "Codex pushed commits without a task ID" };
    }
    return { type: "close-runner", reason: `no task commit after ${limits.runnerWaitHours} hours` };
  }
  if (!start) return { type: "request-start", reason: "the start comment is missing" };
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

  const marker = kind => facts.markers.find(entry => entry.kind === kind && entry.sha === pr.headSha);
  const codexAfter = iso => facts.codexComments.filter(comment => Date.parse(comment.createdAt) > Date.parse(iso));
  const rounds = facts.markers.filter(entry => entry.kind === "fix").length;
  const askForFix = (kind, reason, extra = {}) => {
    const asked = marker("fix");
    if (asked) {
      const reply = codexAfter(asked.createdAt)[0];
      if (reply && minutesSince(now, reply.createdAt) >= limits.replyWaitMinutes) {
        return { type: "label-owner", label: "needs-owner", reason: `Codex answered the fix request without pushing: "${reply.body.slice(0, 120)}"` };
      }
      return { type: "wait", reason: "a fix is already requested for this commit", since: asked.createdAt };
    }
    if (rounds >= limits.fixRounds) return { type: "label-owner", label: "needs-owner", reason: `${reason}, after ${rounds} fix rounds` };
    return { type: "request-fix", kind, reason, ...extra };
  };

  const actionsFailed = facts.checks.filter(check => check.app === "github-actions" && check.status === "completed" && FAILED.has(check.conclusion));
  if (actionsFailed.length || facts.statusState === "failure" || facts.statusState === "error") {
    const names = [...actionsFailed.map(check => check.name), ...(actionsFailed.length ? [] : ["commit status"])];
    return askForFix("ci", `failing: ${names.join(", ")}`);
  }
  const otherFailed = facts.checks.filter(check => check.app !== "github-actions" && check.status === "completed" && FAILED.has(check.conclusion));
  if (otherFailed.length) {
    return { type: "label-owner", label: "needs-owner", reason: `${otherFailed.map(check => check.name).join(", ")} failed, which Codex can't fix from here` };
  }
  if (pr.mergeableState === "dirty") return askForFix("conflict", "conflicts with main");
  if (pr.mergeableState === "behind") {
    const asked = marker("update");
    if (asked) return { type: "wait", reason: "an update from main is already requested", since: asked.createdAt };
    const updates = facts.markers.filter(entry => entry.kind === "update").length;
    if (updates >= limits.updates) return { type: "label-owner", label: "needs-owner", reason: `still behind main after ${updates} updates` };
    return { type: "request-update", reason: "behind main" };
  }
  const findings = findingsOnHead(facts.reviewComments, facts.reviews, pr.headSha);
  if (findings.total > 0 && (rounds < limits.fixRounds || findings.blocking > 0)) {
    return askForFix("review", `${findings.total} review comments on this commit`, { urls: findings.urls });
  }

  const required = REQUIRED_CHECKS.map(name => ({ name, check: facts.checks.find(check => check.app === "github-actions" && check.name === name) }));
  const odd = required.filter(({ check }) => check?.status === "completed" && check.conclusion !== "success");
  if (odd.length) return { type: "label-owner", label: "needs-owner", reason: `${odd.map(({ name, check }) => `${name} ended ${check.conclusion}`).join(", ")}` };
  const running = facts.checks.filter(check => check.status !== "completed").map(check => check.name);
  if (running.length) return { type: "wait", reason: `checks running: ${running.join(", ")}`, since: facts.pushedAt };
  const missing = required.filter(({ check }) => !check).map(({ name }) => name);
  if (missing.length) return { type: "wait", reason: `required checks not reported: ${missing.join(", ")}`, since: facts.pushedAt };
  if (facts.statusState === "pending") return { type: "wait", reason: "commit statuses pending", since: facts.pushedAt };
  const quiet = minutesSince(now, facts.pushedAt);
  if (quiet < limits.quietMinutes) {
    return { type: "wait", reason: `letting reviewers finish, ${Math.ceil(limits.quietMinutes - quiet)} minutes left`, since: facts.pushedAt };
  }

  const asked = marker("review");
  if (!asked) return { type: "request-review", reason: "no Codex review of this commit yet" };
  const replies = codexAfter(asked.createdAt);
  const clean = replies.some(comment => CLEAN_REVIEW.test(comment.body));
  if (!clean) {
    if (replies.length) return { type: "label-owner", label: "needs-owner", reason: `Codex replied without a clean review: "${replies[0].body.slice(0, 120)}"` };
    if (minutesSince(now, asked.createdAt) >= limits.reviewWaitMinutes) {
      return { type: "label-owner", label: "needs-owner", reason: `no Codex review ${limits.reviewWaitMinutes} minutes after asking` };
    }
    return { type: "wait", reason: "waiting for the Codex review", since: asked.createdAt };
  }
  if (pr.mergeableState !== "clean" && pr.mergeableState !== "has_hooks") {
    return { type: "wait", reason: `GitHub merge state is ${pr.mergeableState}`, since: asked.createdAt };
  }
  return { type: "merge", taskId, reason: "green and reviewed" };
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

export function mergeTitle(pr, taskId) {
  const title = TITLE_TASK.test(pr.title) ? pr.title : `${pr.title} (${taskId})`;
  return `${title} (#${pr.number})`;
}

// Keeps each commit's message, so questions Codex leaves in a commit body reach main.
export function mergeMessage(commitMessages) {
  const kept = commitMessages.filter(message => !message.startsWith("chore: start a remediation run"));
  return [
    "Merged by the remediation autopilot: checks green, Codex review clean, no owner-only files.",
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
    `@codex Address these review comments on commit ${short}, and ignore any other comment on this pull request:`,
    ...decision.urls.map(url => `- ${url}`),
    "",
    `Fix what's valid. List anything you leave unchanged, with the reason, under "Found, not fixed" in your commit message body. ${tail}`,
  ].join("\n");
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
      throw error;
    }
    return data;
  }
  async function all(path, pick = data => data, pages = 10) {
    const items = [];
    for (let page = 1; page <= pages; page += 1) {
      const separator = path.includes("?") ? "&" : "?";
      const batch = pick(await request(`${path}${separator}per_page=100&page=${page}`));
      items.push(...batch);
      if (batch.length < 100) break;
    }
    return items;
  }
  return { request, all };
}

export async function gatherFacts(github, pull, context) {
  const pr = await github.request(`/repos/{repo}/pulls/${pull.number}`);
  const headSha = pr.head.sha;
  const [files, checkRuns, status, reviews, reviewComments, comments, commits, headCommit] = await Promise.all([
    github.all(`/repos/{repo}/pulls/${pr.number}/files`, data => data, 30),
    github.all(`/repos/{repo}/commits/${headSha}/check-runs`, data => data.check_runs),
    github.request(`/repos/{repo}/commits/${headSha}/status`),
    github.all(`/repos/{repo}/pulls/${pr.number}/reviews`),
    github.all(`/repos/{repo}/pulls/${pr.number}/comments`),
    github.all(`/repos/{repo}/issues/${pr.number}/comments`),
    github.all(`/repos/{repo}/pulls/${pr.number}/commits`),
    github.request(`/repos/{repo}/commits/${headSha}`),
  ]);
  const checks = checkRuns.map(run => ({ name: run.name, app: run.app?.slug ?? "", status: run.status, conclusion: run.conclusion, startedAt: run.started_at }));
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
    statusState: status.total_count > 0 ? status.state : null,
    reviews: reviews.map(review => ({ login: review.user?.login ?? "", association: review.author_association, state: review.state, commitId: review.commit_id })),
    reviewComments: reviewComments.map(comment => ({
      login: comment.user?.login ?? "", type: comment.user?.type ?? "User", association: comment.author_association,
      inReplyTo: comment.in_reply_to_id ?? null, originalCommitId: comment.original_commit_id, url: comment.html_url,
    })),
    markers: parseMarkers(comments.map(comment => ({
      id: comment.id, login: comment.user?.login ?? "", body: comment.body ?? "", createdAt: comment.created_at,
    })), context.trustedMarkers),
    codexComments: comments.filter(comment => comment.user?.login === CODEX_BOT)
      .map(comment => ({ body: comment.body ?? "", createdAt: comment.created_at })),
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
  const github = createGitHub(env.GH_TOKEN, repo);
  let trigger = env.CODEX_TRIGGER_TOKEN ? createGitHub(env.CODEX_TRIGGER_TOKEN, repo) : null;
  if (trigger) {
    try {
      const login = (await trigger.request("/user")).login;
      if (login !== owner) log(`Warning: the trigger token belongs to ${login}, not ${owner}.`);
    } catch (error) {
      log(`The trigger token was rejected (${error.message}); continuing without it.`);
      trigger = null;
    }
  }
  const context = { now: Date.now(), trustedMarkers: [ACTIONS_BOT, owner], trustedAuthors: [owner, ACTIONS_BOT, CODEX_BOT] };
  const { now } = context;
  log(`${live ? "Live" : "Dry run (set AUTOPILOT_ENABLED to true to act)"}; Codex trigger token ${trigger ? "ready" : "not available"}.`);

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
  const askCodex = (number, kind, sha, text) => write(`ask Codex (${kind}) on #${number}`, () =>
    trigger.request(`/repos/{repo}/issues/${number}/comments`, { method: "POST", body: { body: `${text}\n\n<!-- ${MARKER}:${kind} sha=${sha} -->` } }));
  const deleteBranch = ref => github.request(`/repos/{repo}/git/refs/heads/${ref}`, { method: "DELETE" }).catch(() => {});

  const open = (await github.all("/repos/{repo}/pulls?state=open"))
    .filter(pr => pr.base.ref === "main" && pr.head.repo?.full_name === repo && context.trustedAuthors.includes(pr.user?.login))
    .map(pr => ({
      number: pr.number, title: pr.title, body: pr.body ?? "", draft: pr.draft, headRef: pr.head.ref,
      labels: pr.labels.map(label => label.name), createdAt: pr.created_at,
    }));
  let failures = 0;
  let merged = 0;
  for (const pull of open) {
    if (!taskIdOf(pull) && !isRun(pull)) continue;
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
      } else if (["request-fix", "request-update", "request-review", "request-start"].includes(decision.type)) {
        const kind = { "request-fix": "fix", "request-update": "update", "request-review": "review", "request-start": "start" }[decision.type];
        if (!trigger) {
          await addLabel(pull.number, "needs-owner");
          if (!hasNote("no-trigger")) await note(pull.number, sha, "no-trigger", `this needs Codex (${decision.reason}), but the Codex trigger token isn't available. Comment \`@codex\` here yourself, or fix the \`CODEX_TRIGGER_TOKEN\` secret.`);
        } else {
          const text = kind === "start" ? startPrompt([...new Set(open.map(taskIdOf).filter(Boolean))].sort()) : codexAsk(decision, sha);
          await askCodex(pull.number, kind, sha, text);
        }
      } else if (decision.type === "merge") {
        if (merged > 0) {
          log("  skipping: one merge per run, because main has just moved");
          continue;
        }
        await write(`squash-merge #${pull.number} at ${sha.slice(0, 7)}`, async () => {
          try {
            await github.request(`/repos/{repo}/pulls/${pull.number}/merge`, { method: "PUT", body: {
              merge_method: "squash", sha, commit_title: mergeTitle(facts.pr, decision.taskId),
              commit_message: mergeMessage(facts.commitMessages),
            } });
          } catch (error) {
            if (!hasNote("merge-failed")) await note(pull.number, sha, "merge-failed", `the merge failed: ${error.message}`);
            throw error;
          }
          merged += 1;
          await deleteBranch(facts.pr.headRef);
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
  if (failures) throw new Error(`${failures} pull requests hit errors; see the log above.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}
