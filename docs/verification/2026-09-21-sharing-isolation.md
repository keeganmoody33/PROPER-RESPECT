# Authenticated sharing isolation

Verified September 21, 2026 UTC.

- Base and merged main: `6de87e75888e020fd42c4d8ac0cfd9c1353b9d0d`.
- Tested application/test commit: `7c907de6e99d432987670a9cc56403b47e82a1ef`.
- This receipt follows that commit. Application behavior and configuration files are unchanged.

## Missing regression coverage

The existing owner-only sharing test checked an anonymous caller and the legitimate
owner. It did not check a second authenticated owner with a different public handle.
The existing server guards already rejected the tested misuse. No application bug
was found.

Three new cases call the actual handlers through `convex-test`:

1. Another owner cannot preview or publish a private foreign relationship.
2. Another owner cannot preview or remove a published foreign relationship.
3. Another owner's preview hash cannot approve valid owned selections at the same
   publication revision. The correct own hash succeeds with those selections.

Both owners successfully publish their own cards before the denial checks.
Every denial preserves both owners' records across users, props, publishedProfiles,
sites, links, draftImports and metricSubscriptions. The assertions compare complete
stored rows for those tables before and after each denied operation.

## Verification

| Check | Result |
| --- | --- |
| Existing six-suite identity/manual-entry/collection/sharing baseline | 61 passed |
| Updated publication suite | 17 passed |
| Full `npm test` | 752 Vitest tests passed, 2 existing skipped; 7 script tests passed |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `git diff --check` | Passed |
| Independent read-only review | No blocking findings; no added comments or suppressions |

Mutation sensitivity ran in separate temporary copies. Removing the relationship
owner guard caused the two foreign-selection cases to fail. Removing the preview
hash check caused the borrowed-hash case to fail. The tested checkout's application
source remained unchanged. `convex/onboarding.ts` SHA-256 remained
`2bb7f58c373cef1f13da305d49c5724b4b37b029fea3e0f75e087cabfc8e0e08`.

The expected mutation failures included:

```text
Tests  2 failed | 15 skipped (17)
Tests  1 failed | 16 skipped (17)
AssertionError: promise resolved "{ cards: 1, handle: 'other' }" instead of rejecting
```

These are synthetic authenticated-handler checks. They do not establish hosted
signup, a real fresh login, two real accounts, provider reconnect/revocation, or
owner approval to publish. No new browser/build run was needed for this test-only
diff; the existing application tree is unchanged.

## CI enforcement

At 18:09 UTC, GitHub returned no repository rulesets and `Branch not protected`
for main. Workflow execution alone did not require a green result before merge.

Main branch protection now requires `verify` and `Native Chrome WebMCP`, both bound
to GitHub Actions app 15368. Branches must be up to date, and the checks apply to
administrators. An independent API readback confirmed each value. No required
reviewer count was added. These repository settings are separate from this test PR.

Both jobs passed on exact merged main in
[run 35635690707](https://github.com/keeganmoody33/PROPER-RESPECT/actions/runs/35635690707).
Raw before/request/readback JSON and local test logs are retained in the private
September 21 CI-readiness receipt directory. No failing merge was attempted.

## Release state and remaining acceptance

Live Vercel inspection and its deployment API still identify production as
`dpl_2xbwn5HCERYBCLNuh4UX9F69au8d`, source
`6cc9533367759892973784438075f8ef14ee1709`. PRs 40, 41 and 42 are merged but not
deployed. The diff from deployed source to merged main changes no Convex source,
package manifest/lockfile, Next configuration or Vercel configuration. The retained
default build command still invokes a Convex deployment and must not be mistaken
for a frontend-only build.

Current unauthenticated HTTP probes returned 200 for the homepage, collection and
signup page. The collection includes noindex; the sitemap lists only the homepage.
The old public host returned 307 for `/keegan?readiness=20260921`, preserved the path
and query, and reached the canonical profile with 200 after one redirect. This
proves public-link continuity, not authenticated old-host rollback. `/robots.txt`
still returned 404.

The release queue remains [issue 24](https://github.com/keeganmoody33/PROPER-RESPECT/issues/24).
Fresh-user signup, first saved card across a real new session, exact sharing preview,
and two-user hosted acceptance remain open. Private metadata-only usage import and
provider lifecycle verification remain separate gates. The owner has no second
test account; no new account was requested or created during this pass.

No merge, deployment, Clerk/OAuth/domain change, provider read or publication
occurred during this continuation.
