# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues. Use the GitHub connector when available, with the `gh` CLI as the local fallback.

## Conventions

- **Create an issue**: Create a GitHub issue with a clear title and complete Markdown body.
- **Read an issue**: Fetch the issue body, comments, and labels.
- **List issues**: List open issues with the labels and state relevant to the current workflow.
- **Comment on an issue**: Add a top-level issue comment.
- **Apply or remove labels**: Update the issue's labels using the vocabulary in `triage-labels.md`.
- **Close an issue**: Add a closing explanation, then close the issue.

Infer the repository from `git remote -v`. The configured repository is `keeganmoody33/PROPER-RESPECT`.

## Pull requests as a triage surface

**PRs as a request surface: no.**

Pull requests are not included in the triage queue by default. Change this flag to `yes` if PROPER-RESPECT later treats external pull requests as feature requests.

## When a skill says "publish to the issue tracker"

Create a GitHub issue in `keeganmoody33/PROPER-RESPECT`.

## When a skill says "fetch the relevant ticket"

Fetch the referenced GitHub issue together with its comments and labels.

## Wayfinding operations

Used by `wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: A GitHub issue labelled `wayfinder:map`, holding Notes, Decisions-so-far, and Fog.
- **Child ticket**: A GitHub sub-issue linked to the map. If sub-issues are unavailable, add the child to a task list in the map and put `Part of #<map>` at the top of the child body.
- **Ticket types**: Apply `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`.
- **Blocking**: Prefer GitHub's native issue dependencies. If unavailable, add `Blocked by: #<n>, #<n>` near the top of the child body.
- **Frontier**: Select the first open, unblocked, and unassigned child in map order.
- **Claim**: Assign the ticket to the person or agent doing the work before implementation begins.
- **Resolve**: Comment with the result, close the child, and append a context pointer to the map's Decisions-so-far.
