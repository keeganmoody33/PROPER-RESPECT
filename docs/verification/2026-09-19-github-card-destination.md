# Private GitHub card destination

Date: 2026-09-19. Starting remote: `origin/main` `f808fc834c7900681d10b043a6bb09d4f8e76314`.
Local SHAs `b028d904` and `6bf69c24` were not present on this checkout and were
not used.

## Problem

Discovery stores a GitHub product-website primary link (`https://github.com`).
The private collection used that link for “Check out GitHub”, so the card
opened the vendor homepage instead of an owned account page.

Retained GitHub packets already record `viewer.login` as
`signal.url` and `captureProvenance.origin.accountId`. Connected GitHub
accounts already record `github.com/{login}` as `accountLabel`.

## Change

`privateCardPrimaryLink` keeps an explicit owner-selected non-homepage link.
When the stored primary is only the product website, it may use owned,
relationship-associated GitHub account evidence. It does not read Clerk,
email, branding, or the product display name. Publication and
`defaultReview` still use stored primary links.

## Checks

- Domain, Convex, and rendered-card tests for owned account destination,
  missing evidence, cross-owner rejection, custom-link preservation, connected
  account labels, and unpublished public projections.
- Full Vitest: 414 passed, 1 skipped. Node script tests: 6 passed.
- `npm run typecheck` and `npm run lint` passed.
- Playwright fixture e2e: 19 passed. Fixture data has no GitHub account
  evidence, so those checks still use generic product websites.
- Signed-in hosted private collection was not exercised here. No Clerk or
  Convex credentials are present in this environment. Production was not
  synchronized or released.

## Hosted observation, not this commit

Signed-out `https://props.lecturesfrom.com/keegan` currently includes a public
GitHub href `https://github.com/keeganmoody33`. That is an existing publication
snapshot. This change does not rewrite it.

## Limits

Git-triggered Vercel/Convex deploy remains disabled. Additional Gmail reads
remain paused. Recurring collection remains off. Development-to-production
private transfer remains unauthorized. The Ref MCP server did not authenticate
in this session, so https://plan.ref.tools/oUl8LCIQb32SAicK was not updated.
