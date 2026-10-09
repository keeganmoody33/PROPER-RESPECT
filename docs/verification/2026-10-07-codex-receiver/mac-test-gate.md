# Exact next Mac test step

First review this build, then approve installing it on the named Mac and running
its synthetic platform check. That step compiles two local binaries in `.local-bin`
and creates temporary synthetic fixtures. It reads no real Codex history, installs
no background process and contacts no live receiver. Node 24 and a C compiler are
required; dependency installation needs approval if they are not already present.

On that Mac, in the reviewed checkout:

```sh
npm run codex:mac:check
```

Retain its exact commit/OS/Node/compiler and test results. This cloud cannot execute
Darwin or access the Mac, and no Mac access route has been supplied.

Before a real connection, fill and approve this scope:

| Item | Required decision |
| --- | --- |
| Mac | Device name and owner; installation location for the reviewed build. |
| Local source | Exact canonical selected directory. Typically active history is `~/.codex/sessions`; archives are `~/.codex/archived_sessions`. Confirm actual paths without sharing contents. Prepare each selected root separately; do not select the entire home or `.codex` directory. |
| Local reads | Read-only `rollout-*.jsonl` within the selected root. The local parser reads complete mixed records to establish lineage/baselines; records outside the approved upload window remain local. No auth store, keychain, provider credential or Codex RPC access. |
| Context | Personal or work for each source; authorization for employer history where applicable. Mixed context must be separated or explicitly scoped. |
| History and expiry | UTC start, authorized end and access expiry. The current UI authorizes updates through its selected expiry; confirm that end when approving. Maximum 366-day range and 31-day access. |
| Upload | Only six allowlisted exact token counters, opaque thread/response/stream identities, UTC timestamps, accounting status and partial-coverage metadata. No prompts, code, paths, tool output or credentials. Public device key and signed proofs authorize transport; the private device key stays local. |
| Private state | Exact canonical private directory with mode `0700`; state/key/outbox mode `0600`. Keep separate state for each selected source. |
| Destination | Only `dev:utmost-mongoose-374`, `https://utmost-mongoose-374.convex.cloud`, with the matching Clerk development app. No production target. |
| Retention | Retain accepted private history after disconnect, or erase it. Public sharing is a separate deliberate selection. |
| Recurrence | One `sync` first. Foreground `watch` needs separate approval; no daemon/login item is supplied. |

The live setup also needs the effective network policy to permit the development
Convex cloud/site hosts and the named Clerk development app. Verify matching keys,
backend issuer and Clerk's `convex` JWT template in secure settings. No key values
belong in chat or logs. The session's secret is present but unclassified, issuer
variables are absent, and the backend's configuration remains unverified. Any
push, GitHub merge or deployment of this reviewed build needs explicit approval.

After the reviewed development receiver is approved, deployed and its signed-in
owner flow verified, start the app on `http://localhost:3000/app/connections`.
Use the actual approved paths in these commands:

```sh
node --experimental-strip-types scripts/codex-companion.mjs prepare /approved/private-state/state.json /approved/canonical/history
```

This prints only the source identity and public device digest. Copy them into the
app, approve the bounded context/window/retention, then pair within five minutes:

```sh
node --experimental-strip-types scripts/codex-companion.mjs pair /approved/private-state/state.json
node --experimental-strip-types scripts/codex-companion.mjs sync /approved/private-state/state.json
```

Validate private backfill against a local numeric inspection, unchanged replay,
a new response, process stop/restart, queued acknowledgment recovery, receiver
outage recovery, expiry and owner revocation. Repeat `sync` after disconnect:
the receiver must reject it while preserving only authorized retained history.
These are the real acceptance steps; a synthetic platform pass does not replace them.
