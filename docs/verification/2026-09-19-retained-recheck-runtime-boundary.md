# Retained recheck release runtime correction

Verified September 19, 2026, 21:40 EDT.

The owner approved release `0d9a3d7d017551065fffd53e3909328e61f34c6d`
and one retained-only pass of at most 1,000 pending headers. Target inspection
confirmed Vercel `groundskeep/proper-respect` and Convex `striped-chicken-693`.
A production snapshot including file storage was saved privately before mutation.
Rollback remains Vercel `dpl_AJeXca75XZNAhM3NYuhRfYRDcdLX`, source `5a0b77f`.

The exact candidate's Convex dry run failed before deployment: importing
`senderDomain` from the Gmail adapter brought in provider HTTP, OAuth and
`node:crypto` inside a non-Node mutation bundle. Passing Vitest and Next builds
had not covered the Convex bundler boundary.

## Minimal correction

Move the unchanged sender parser into `src/domain/mailbox-sender.ts`. Both the
Gmail adapter and retained recheck import it directly. There is no change to
parsing, evidence interpretation, retention, network behavior or authorization.
No schema, credential, UI or dependency change is required.

`src/server/mailbox-runtime.test.ts` bundles the mutation using Convex's own
esbuild dependency and its non-Node platform. It failed with the same
`node:crypto` error before the move and passes afterward.

## Verification and release boundary

- Focused bundling, Gmail adapter and retained recheck: 46 tests passed.
- Full suite: 591 Vitest tests passed, two optional private-input tests skipped;
  six Node checks passed.
- Optional real retained-input replay separately passed in memory, with no
  provider calls or backend writes.
- ESLint, strict TypeScript, Next production build and diff whitespace check passed.
- Corrected Convex dry run passed against the exact production target, with no
  indexes deleted. This is analysis validation, not function activation.

The frontend and recheck UI did not change; their previously passing 16 browser
checks were not repeated. No deployment or retained production recheck occurred.
The additional source correction requires approval because the release approval
named the exact earlier commit. The retained-only scope and exclusions are
unchanged. Backup and operational details remain outside Git.
