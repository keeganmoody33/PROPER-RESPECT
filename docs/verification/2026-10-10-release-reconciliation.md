# Release reconciliation — October 10, 2026

Inspected main: `563e5fd0fc47fbc5163f5145a5ebec81d1003d85`. PR157 merged
at `4b9101d8555d83afee17dbc4ba260e1ea6b47c31`; PR158 merged at current main.
Their code was already present in the former review dependency tree. Merging
current main and original PR162 restored ancestry with an identical tree,
rather than reproducing those fixes. The October9 receipt remains historical;
its old dependency pins and Copilot results do not clear this candidate.

## Existing work and ownership

| Work | Inspected head | Disposition |
| --- | --- | --- |
| PR162, profile name validation | `1b8a44baad03ab4dcae2e9dc0017d3600cfb4c13` | Original commits retained as an unmerged dependency. |
| PR173, Cursor CSV and gate follow-ups | `b0f88036de15c7ab0b363e9368945c0759e195ce` | Original commit retained; no file overlap with either product feature delta. |
| PR174, fixture/SQLite/loopback hardening | `02122394d8772ea1602c22842f48ba12d2617c9f` | Original commits retained with the correction below. This original head remains affected on its own. |
| PR163, receiver | Previously `96ab8cec36321bff49f91d28b04dde317ba56e81` | Refreshed against explicit dependency history; contains the narrow quarantine correction. |
| PR164, private snapshots | Previously `b3c2dc0d43ef0036cb5840d2180340617d0b5c99` | Carries the refreshed receiver; its existing feature delta is preserved. |
| PR165, review policy | Separate main-based candidate | Claude review and safe stack context; no product dependencies copied into that policy delta. |
| PR161 | Earlier receiver candidate | Subsumed by PR163; do not land a duplicate. |
| #123 | Parent reports verified and closed | No account, receipt workflow or recovery action in this pass. |

The explicit dependency tip is `12db13400e57d2957bec8418380d9e5eca884e46`.
The PR163 and PR164 descriptions record their final full head/base pins and
fresh CI URLs. Other authors' branches were not changed. All original commits
remain inspectable; the integration work adds no force push or mass rewrite.

## Fix now: failed acknowledgment must not discard accepted work

PR174 deletes the pending outbox after five send errors. A deterministic real
SQLite test reproduces four transient failures followed by a successful fifth
commit whose acknowledgment is lost. After another writer publishes Cursor
value 2, recovery reacquires old value 1 and replaces the newer accepted view.
Current main retains the pending identity and recovers its receipt instead.

A follow-up loopback HTTP probe also delayed receiver commit beyond the
client's five-second timeout. A status response of READY can precede that
late commit; READY alone therefore cannot justify discarding a batch. The
initial proposed status-check correction was rejected before publication.
The server delay is injected to prove ordering, not an observed production
incident or hardware/account acceptance claim.

The correction bounds send attempts while preserving the pending manifest.
At the failure threshold, retries reconcile receiver status without another
source read or send. COMMITTED recovers the original receipt; STALE permits
reconciliation because the prior expected checkpoint can no longer commit.
READY or unavailable status leaves the pending delivery paused. Persistent
poison requires explicit disconnection and fresh pairing; safe automatic
skipping would need receiver-side atomic retirement and is deferred. Local
revision and batch checks prevent a late failure from affecting a replacement
pairing. The correction adds no schema or protocol migration.

Scope: generic local SQLite collector and fixture transport. The separate
native/Convex Codex companion is unchanged by this correction. Regression
evidence, focused checks and final full-stack results are recorded with the
exact candidate in the PR and release handoff. CI is synthetic evidence;
it does not establish a real Cursor acquisition path or native-account proof.

## Review, landing and rollback boundaries

Claude has not cleared this stack. The only attempted model run stopped before
execution because the reviewers environment lacked its OAuth secret. Owner
credential provisioning remains pending and was not retried. PR165 requires
outside review and owner approval before its stack-review route is available.
Writer tests and green CI are not independent review or merge authorization.

The review dependency branch is not main and is not a deployment target.
Do not land PR174 alone with the known regression. The owner can coordinate
its original author to carry the correction, or authorize a reviewed combined
landing that includes both the original changes and correction. Any retarget,
head/base movement or changed dependency requires fresh context and relevant
checks. No automatic merge follows from these drafts.

This pass performs no production migration, credential/configuration change,
provider read, public-profile write or deployment. Development-only real user
acceptance still requires the approved separate identity, matching Clerk and
`utmost-mongoose-374` target, device/source scope and exact sharing consent.
Production `striped-chicken-693` is excluded. The last verified release remains
v0.2.7 at `51e5224f60fafb141029235fceeb41fa101d701e`; no fresh deployment
claim is made here.

Rollback before landing: keep the existing drafts unlanded. If the corrective
companion change is reverted, the known PR174 regression returns; do not deploy
that combination. Reverting this correction does not undo PR174's separate
SQLite schema/WAL changes. No production rollback or data operation was run.
