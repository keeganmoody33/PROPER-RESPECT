# Second-user acceptance record

Updated: 2026-09-29. Written for R21. Run it together with the tester (K07),
after the release that contains R12 to R21 (K06). The eight steps are the
Phase 2 gate in `docs/remediation/CODEX-BRIEF.md`, Section 8.

## How to fill this in

- Mark each step **Pass** or **Fail**. A step with any failed check fails.
- **Evidence** is a screenshot file name or a one-line observation. Never
  paste private data: no email addresses, codes, tokens, file contents,
  account IDs or collection details. Keep screenshots outside Git unless
  they show only public pages.
- On a fail, write what happened in **Notes** and file a `bug` issue linked
  from #24. Keep going with the next step when you safely can.
- The tester uses the guide in [`docs/tester-guide.md`](../tester-guide.md).

## Run details

| Field | Value |
|---|---|
| Date (UTC) | |
| Release tag and commit | |
| Owner's browser and device | |
| Tester's browser and device | |
| Tester's public handle, once claimed | |

## Steps

### 1. Invitation, account and email-code sign-in

- [ ] The tester accepts the Clerk invitation and creates the account.
- [ ] The tester signs out, then signs back in with an email code.
- [ ] The code arrives within 2 minutes.

| Result | Evidence | Notes |
|---|---|---|
| Pass / Fail | | |

### 2. Empty private collection

- [ ] At `/app/collection`, the tester sees an empty private collection.
- [ ] The first-tool prompt ("Start with one tool") is shown.

| Result | Evidence | Notes |
|---|---|---|
| Pass / Fail | | |

### 3. Handle and three kinds of product

- [ ] The tester claims a handle under **Choose what to share → Public
  identity**, then **Save public identity**.
- [ ] One manual product added with **Add a product**.
- [ ] One GitHub card, with **Connect GitHub** (only if the tester has GitHub
  linked under Connected accounts). If not, mark this check "skipped" and say
  why.
- [ ] One screenshot added with **Upload an export or screenshot**.

| Result | Evidence | Notes |
|---|---|---|
| Pass / Fail | | |

### 4. Private save persists

- [ ] The tester saves with **Save privately**.
- [ ] After a page reload, everything is still there.
- [ ] After signing out and back in, everything is still there.

| Result | Evidence | Notes |
|---|---|---|
| Pass / Fail | | |

### 5. Each person sees only their own collection

- [ ] Signed in as the owner, the owner's collection shows none of the
  tester's products or uploads.
- [ ] Signed in as the tester, the tester's collection shows none of the
  owner's.

The UI check above is the acceptance step. The API side is covered by the
automated ownership tests, for example `convex/ownerAuth.test.ts`.

| Result | Evidence | Notes |
|---|---|---|
| Pass / Fail | | |

### 6. Preview and publish exactly one card

- [ ] The tester includes one saved card, previews it ("Your visitor's view"),
  ticks the approval box and clicks **Publish this preview**.
- [ ] Signed out, `proper-respect.com/<tester-handle>` shows only that card.

| Result | Evidence | Notes |
|---|---|---|
| Pass / Fail | | |

### 7. Unpublish

- [ ] The tester removes the card: either unselects it and publishes a new
  preview, or uses **Unpublish all cards** and approves that preview.
- [ ] Signed out, the card no longer appears on the tester's profile. The
  handle, name and bio remain, as the guide explains.

| Result | Evidence | Notes |
|---|---|---|
| Pass / Fail | | |

### 8. Delete the upload, disconnect GitHub, history remains

- [ ] The tester deletes the uploaded screenshot with **Delete original**,
  then **Delete permanently**.
- [ ] The tester clicks **Disconnect GitHub**. It then shows as
  "Disconnected". Skip this check if step 3 skipped GitHub.
- [ ] The saved relationships and their history are still in the collection.
- [ ] The owner confirms in the Convex dashboard (production, Data,
  `connectorSecrets`) that no stored secret remains for the tester's GitHub
  connection. Record only "none found", never the row contents.

| Result | Evidence | Notes |
|---|---|---|
| Pass / Fail | | |

## Outcome

| Field | Value |
|---|---|
| Steps passed | _ of 8 |
| Bugs filed | |
| Phase 2 gate met (all eight pass) | Yes / No |
| Recorded by | |
