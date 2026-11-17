# Filling search after a deploy

Updated: 2026-11-17. Written for Phase C (search). The owner runs these commands.

Search, the tool pages and the sitemap read three tables (`listedPages`, `listedCards`, `listedTools`). Every publish, unpublish, takedown, restore and handle move keeps them current. Pages published before Phase C have no rows until this rebuild runs once.

## Before you run it: one decision

The rebuild lists every page already published, unless its owner turned "List my page in search" off, and none of them has been asked yet. A page with no account at its handle is never listed: nobody could turn it off. If existing owners should be asked first, don't run it: their pages enter search the next time each one publishes.

## Order

A `v*` tag deploys the backend and then the frontend with no pause between them (`docs/DEPLOYMENT.md`, "Release a tagged version"), so the new tables and functions are there before any page calls them.

1. Push the release tag as usual and let both jobs finish.
2. Run the rebuild below until it says it is done.

Between the two steps search works and is nearly empty: it holds only pages published since the deploy. Nothing shows an error. If the frontend is ever deployed by hand ahead of the backend, `/search` and `/tools/{slug}` show the error page until the backend catches up.

## The rebuild

Run from a checkout of the deployed release, logged in to the Convex team that owns production:

```sh
npx convex run --prod publicProfiles:rebuildSearch '{}'
```

Each call does one batch and returns `next`. Pass `next` back as the arguments, for example:

```sh
npx convex run --prod publicProfiles:rebuildSearch '{"phase":"pages","cursor":null}'
```

Stop when `next` is `null`. It goes through four phases: `publications` (every published page), `pages` and `cards` (rows whose page is gone, unlisted or taken down are removed) and `tools` (each tool's counts are checked). It changes no other data, and running it again writes nothing.

## Changing a default

The defaults live in `src/domain/search-listing.ts`: `LISTED_BY_DEFAULT` (a page whose owner never answered is listed) and `SHOW_PAST_USERS` (people who stopped, paused or only tried a tool show under "Used before"). After changing either, deploy and run the rebuild again; rows already written keep the old rule until then.
