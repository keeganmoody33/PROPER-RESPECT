# Codex native account metadata attempt proposal

Dated 2026-09-23. **HOLD: no genuine attempt is executable or authorized by this proposal.**
The installed public binary can be pinned; empty configuration directories cannot
isolate native startup. The source evidence is in
[the startup audit](2026-09-23-codex-native-startup.md). This feature prepares the
adapter boundary and synthetic lifecycle evidence. It does not establish native
startup safety, authenticated account selection or availability.

## Pinned identity

| Item | Observed value |
| --- | --- |
| Package | `@openai/codex@0.153.4-darwin-arm64` |
| Native target | `aarch64-apple-darwin` |
| Size | `220584000` bytes |
| Native SHA-256 | `b973d440acac501fd2594a43e7ca9ce41e0a65b9dfb28d0d7a7837c99e1261e3` |
| Public source | tag `rust-v0.153.4`, commit `3d2ee51ca2d5db578f328aa75e20aa22c0197c9a` |
| Registry SHA-512 integrity | `sha512-B1qhN3fa1ay0R0wGziXqgwSkB5icpYChNKHhtBHff/0UtSTC7z+l8aTtvMlGjH3E8HEvY3+njIJelM9CAAoVWg==` |

The installed executable was compared with the executable member of the
[integrity-verified official npm artifact](https://registry.npmjs.org/@openai/codex/-/codex-0.153.4-darwin-arm64.tgz).
This is byte identity, not a reproducible-build attestation. The native binary
was not executed, including for `--version`. Prior pinned CLI evidence recorded
`codex-cli 0.153.4`; the current package metadata and public artifact match that
version. The npm JavaScript launcher inherits process environment and selects a
platform executable. Any future approved adapter must invoke the verified native
binary directly, without a shell, PATH lookup or that wrapper.

## Exact proposed launch specification

The native API performs file inspection only. It has no spawn operation, ready
variant, execution token or approval Boolean. A successful pin inspection returns
`blocked`; no native launcher is enabled by a matching result.

The candidate argument vector is fixed in `CODEX_NATIVE_SPECIFICATION`:

```json
["app-server","--listen","stdio://","--strict-config",
 "-c","analytics.enabled=false",
 "-c","features.plugins=false",
 "-c","cli_auth_credentials_store=\"file\"",
 "-c","otel.exporter=\"none\"",
 "-c","otel.trace_exporter=\"none\"",
 "-c","otel.metrics_exporter=\"none\""]
```

`-c` is a global option in the pinned
[CLI argument parser](https://github.com/openai/codex/blob/3d2ee51ca2d5db578f328aa75e20aa22c0197c9a/codex-rs/utils/cli/src/config_override.rs#L19-L38).
The strict-config and stdio options are defined by the
[app-server command](https://github.com/openai/codex/blob/3d2ee51ca2d5db578f328aa75e20aa22c0197c9a/codex-rs/cli/src/main.rs#L542-L591).
These overrides reduce selected effects; they do not prevent discovery of
system or managed configuration and do not establish startup containment.
The internal remote-control marker is version-specific, not a stable public
safety contract.

For a newly owned private scratch root `R`, use exactly this environment and
working directory. These are the values supplied to spawn; an operating system
or runtime can add process-visible variables afterward. The synthetic macOS
Node fixture adds `__CF_USER_TEXT_ENCODING`; tests permit only that platform
addition and separately verify the exact supplied environment. This observation
is not native Codex runtime evidence. No inherited keys, PATH, proxy settings, API keys, tracing
variables, npm wrapper variables or shell expansion are included.

| Setting | Exact value |
| --- | --- |
| cwd | `R/cwd` |
| HOME | `R/home` |
| CODEX_HOME | `R/codex` |
| TMPDIR | `R/tmp` |
| XDG_CONFIG_HOME | `R/config` |
| XDG_CACHE_HOME | `R/cache` |
| LANG | `C` |
| LC_ALL | `C` |
| CODEX_INTERNAL_APP_SERVER_REMOTE_CONTROL_DISABLED | `1` |

All six scratch directories begin empty with mode0700. The direct executable
path is absolute and canonical, supplied explicitly to inspection; no default
path discovery searches the user's configuration. Each inspection rejects a
symlink, nonregular/nonexecutable or group/world-writable file, wrong size/hash,
or changed descriptor/path snapshot. It bounds hashed bytes and checks a
five-second deadline between reads. The deadline cannot cancel a blocked OS
filesystem call. A matching inspection is a read-only snapshot, not binding of
future exec to those bytes. The current pin supports only darwin-arm64.

Synthetic tests substitute only a test-owned Node fixture for that executable.
They exercise this argument/environment/cwd contract using actual subprocesses.
They do not establish native support for this configuration or authenticate any
account. Native-generated files and hidden OS reads are not simulated evidence
of real startup containment.

## Proposed single attempt, after the gates below

One dedicated stdio process would send only initialize, initialized, and exactly
one `account/usage/read` request with `{}`. The existing client fixes the request
sequence and notification opt-outs. No retry, account/read, rate-limit query,
thread/list, thread/read, thread/start, turn/start, login, fallback scraping or
external token-refresh response is included.

The request has no account selector, date range, pagination or daily-bucket cap.
It uses the app-server's active account. An opaque local owner/account alias is
caller metadata, not authenticated account identity. An empty isolated auth
store cannot produce a genuine authenticated snapshot. Selecting or introducing
a supported service-backed session is a separate sensitive operation whose exact
mechanism must be reviewed and authorized before execution. No credentials were
read, copied, selected or introduced here.

Normal internal credential refresh may involve network access and persist new
tokens. Startup can also load remote managed configuration, initialize SQLite
and logs, update an installation identifier, refresh a model catalog, and start
conditional plugin/environment services. One client RPC is not a promise of one
upstream HTTP request. The source audit distinguishes conditional paths from
observed behavior; none of these native effects was runtime-tested here.

## Retention and cleanup contract

Only a validated metadata capture may survive in a new mode-0700 directory under
an owner-selected canonical private mode-0700 base outside Git. `capture.json`
is exclusive mode 0600. Existing artifacts are never overwritten. The unchanged
parser/reviewer reads that accepted file twice and requires one snapshot, one
replay and zero conflicts. No console metric formatter is used.

Retained fields: formatVersion:1; source method/version; caller owner/account aliases;
requestedThreadId:null; threadUsage:null; capture
ID/time; nullable lifetimeTokens, currentStreakDays, longestStreakDays,
peakDailyTokens and longestRunningTurnSec; and at most 3660 daily records of
startDate/tokens. Missing remains unknown, and zero remains zero. Non-null
threadUsage and unexpected fields reject. Raw initialization, notifications,
stderr, error strings and rejected payloads are not logged or retained.

Transport limits remain 512000 stdout bytes, 64000 stderr bytes, 260000 bytes per
frame, 128 messages, depth 32, 256000 normalized capture bytes, 27 seconds for
acquisition and 30 seconds total transport. Clean process/stream completion and
successful bounded adapter cleanup must precede retention. The trusted completion
barrier has an additional two-second deadline after transport; a thrown callback,
unknown result or elapsed deadline rejects with termination-unconfirmed. Cleanup
uncertainty has its separate cleanup-unconfirmed status. These are application
deadlines, not hard OS scheduling or filesystem deadlines.

A POSIX process group can clean up descendants that remain in that group. It
cannot contain a descendant that creates another session/group. Native execution
needs a reviewed enforceable containment policy or explicitly accepted narrower
threat boundary. A changed scratch identity or unconfirmed cleanup must return a
fixed uncertainty diagnostic and preserve foreign entries. It must never claim
successful cleanup merely because the direct child exited.

## Gates before asking for genuine execution approval

1. Establish an OS-enforced filesystem and network boundary or independently
   reviewed alternative covering system configuration, managed preferences,
   keychain, executable/package context, config-derived paths and descendants.
   Empty HOME/CODEX_HOME/cwd alone fails this gate.
2. Pin the exact revised adapter source and binary, and independently verify the
   real isolation policy against empty/synthetic environments. A synthetic
   process is not evidence of native behavior.
3. Identify the intended service-backed account through an owner-selected,
   explicitly authorized mechanism. The usage response cannot verify that
   choice, and this proposal does not implicitly add an account identity read.
4. Present the exact private destination, authentication source, permitted
   startup reads/writes/network effects, cleanup behavior and immutable source.
   Obtain explicit approval for one account-wide metadata snapshot attempt,
   including whatever daily buckets arrive within the local limits. No retry.

After those gates, the authorization request must name that exact execution
package and its effects. This document is not an approval request for an
incomplete execution package. Elapsed time, a matching hash or a green synthetic
test never supplies approval.

A successful future capture would establish one accepted response at one time.
It would not establish complete device/history coverage, billing, reporting
timezone, source freshness, human activity, authenticated owner binding or
additive event counts. Hosted saving, public cards, provider expansion,
recurrence and releases remain separate. Issue #24's eight hosted acceptance
gates and Ora 90+ remain open.
