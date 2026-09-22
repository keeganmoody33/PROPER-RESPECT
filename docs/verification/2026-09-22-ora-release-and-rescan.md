# Ora discovery release and rescan

Verified September 22, 2026. The owner authorized release and rescan of the merged discovery fixes.

## Source and release

- Source/main: `32a851f18632af984e56ab2d761ebc47be870340`.
- PR45 merge: `adbb35f252acc5bf431abc9e0f22ae13215a8bba`.
- PR46 merge: `32a851f18632af984e56ab2d761ebc47be870340`.
- Production deployment: `dpl_6FusAAPv2fKjRrDJgRNBfZWJZX5t`.
- Candidate: https://proper-respect-dljtbpzkv-groundskeep.vercel.app.
- Promoted domain: https://proper-respect.com/.
- Previous production retained for rollback: `dpl_DMN6tx3AuZpJ8wk1kfeb3QHwaCXX`.

An isolated deployment package changed only `vercel.json` to use `npm run deploy:check && npm run build`. Both the uploaded project settings and actual remote build log confirmed that command. The candidate was READY and passed its public HTTP checks before domain promotion. This release ran no Convex deployment and changed no Clerk, OAuth or DNS configuration.

## Observed behavior

Candidate HTTP checks passed 41/41. The promoted domain passed 41/41, including public discovery documents, both plugin manifests, the exact skill digest, authentication/private noindex, and public page continuity.

In the native browser on `/keegan`, WebMCP discovered `get_current_public_profile`; invoking it with `{}` returned the four published cards, GitHub, Wispr Flow, NotebookLM and Devin Desktop. Navigating home removed the tool. The homepage had no WebMCP tool. This exercised only anonymous published data and made no collection changes.

## Measured Ora result

`POST https://ora.ai/api/scan` with `{"url":"proper-respect.com"}` completed at `2026-09-22T13:25:54.174Z`, with score **66/100, C**, API contract `1.25.0`, and no pending checks. The preceding complete score was 64. A refreshed score GET agreed with the POST; the first GET briefly returned the older cached result.

| Check | Before | After |
| --- | --- | --- |
| ARD catalog | 0/1, warning | 1/1, pass |
| Agent skills discovery index | 0/2, not applicable | 2/2, pass |
| Agent instructions | 3/3, pass | 2/3, warning |
| WebMCP detection | 0/5 | 0/5 |
| Agent Plugins repository manifest | Not detected | Not detected |

Current aggregates are Discovery 5/8, Access 30/39, Usability 15/25 and Payments 0/0. The overall result is supplied by Ora; summing these denominators does not reproduce its weighted score.

The instruction warning selects `/.well-known/agent-skills/`, which production serves as the same JSON bytes as `index.json`. The existing `/agents.md` still contains its explicit when-to-use section. A separate correction will define that directory landing response while preserving the explicit index. No recovered score credit is claimed here.

The scanner inspects homepage bundles, while the working WebMCP tool belongs to public profile pages. Native invocation proves the tool works on its supported page; it does not resolve homepage detection. Both plugin manifests are publicly reachable, but the scan does not disclose enough probe detail to establish whether nested package discovery or stale repository data caused its miss.

## Remote Codex distribution

With Codex 0.153.4, the actual remote-main marketplace was installed using:

```sh
codex plugin marketplace add keeganmoody33/PROPER-RESPECT --ref main --json
codex plugin add proper-respect@proper-respect-official --json
```

A fresh Codex app-server skill listing discovered the enabled `proper-respect:read-public-profile` skill. The temporary plugin and marketplace were then removed. Before/after marketplace and plugin registration JSON were identical. Existing registrations were preserved.

This establishes remote Codex installation and fresh-process discovery. It does not establish external skills.sh directory presence, ranking, or Ora manifest acceptance.

The skills CLI 1.7.0 separately discovered and installed `read-public-profile` from the remote package URL into an isolated temporary project. The installed Markdown SHA-256 was `61ff667f9a8e3bb4620e537cdafc39f9097d797740ae7da8f3d0721fe0bd7c56`, matching production. Cleanup removed that verified temporary copy, and the CLI subsequently reported no project skills. The initial skills.sh page showed unavailable-skill content despite HTTP 200; a successful HTTP status alone is not evidence of a listing. No artificial repeat installs or ranking claims were made.

## Remaining acceptance

The 90+ Ora goal remains open. Public HTTP and WebMCP checks do not establish fresh-user onboarding, two-user isolation, reconnect/revocation, or private collection acceptance. No paid service, remote MCP transport, agent OAuth flow, or in-chat UI was introduced by this release. Private command, deployment and HTTP receipts are retained outside Git; this receipt contains no credentials or account evidence.
