# Second-user acceptance record

Updated: 2026-11-17. Written for R21, extended for the R27 first-result path,
and rewritten for public sign-up and the onboarding order of 2026-11-17: build
your stack, check your collection, choose a handle, share. Run it with one
outside person, after the release that contains the public-ready work. The
steps are still the Phase 2 gate in `docs/remediation/CODEX-BRIEF.md`,
Section 8. Nobody has run it on production yet: every result below is blank.

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

### 1. Sign-up, account and sign-in

Sign-up is public today, so the tester starts at `proper-respect.com` with no
invitation. If the owner has switched to a waitlist by the time this runs,
note that here and admit the tester first.

- [ ] From the homepage, "Start your collection" leads to sign-up, and the
      tester creates an account with Google, GitHub or email.
- [ ] After sign-up the tester lands on their collection, with "Build your
      stack" first on the page.
- [ ] The tester signs out, then signs back in and sees the same collection.
- [ ] An email code, if the tester used email, arrives within 2 minutes.

| Result | Evidence | Notes |
|---|---|---|
| Pass / Fail | | |

### 2. Empty private collection

- [ ] At `/app/collection`, **Build your stack** is first on the page and the
  collection under it is empty.
- [ ] The tester adds three tools by name, picks how often they use each, and
  saves. No mailbox or handle is asked for. The three tools appear in the
  collection.
- [ ] A source selected before sign-in is still selected afterward, and opens
  under **Bring in supporting context**, below sharing.

| Result | Evidence | Notes |
|---|---|---|
| Pass / Fail | | |

### 3. Private result and three kinds of product

- [ ] One manual product added under **Add a tool**, with **Save tool privately**.
- [ ] One GitHub card, with **Connect GitHub** (only if the tester has GitHub
  linked under Connected accounts). If not, mark this check "skipped" and say
  why.
- [ ] One screenshot added under **Upload an export or screenshot**, with
  **Upload privately**.

| Result | Evidence | Notes |
|---|---|---|
| Pass / Fail | | |

### 4. Private save persists

- [ ] Import one authorized genuine sanitized measurement file. The exact private
  result opens without asking for a public identity or mailbox.
- [ ] Its native value, unit, scope, period and coverage match the source. Unknown
  remains distinct from zero; synthetic or unverified origin is labeled honestly.
- [ ] A malformed import leaves the previous result unchanged and no blank card.
- [ ] Reimporting the same file does not duplicate its measurements.

- [ ] The tester saves each product with **Confirm and save privately** (the
  button reads **Save privately** on later edits).
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

- [ ] Each card the tester wants to share has a line in "What it helps you do":
  the suggested line kept with **Use this line**, or their own words. A card
  with no line is named by **Share every confirmed tool** and stays private.
- [ ] The **Choose your handle** step is visible right before sharing, not in
  a collapsed box. The tester picks a handle and a display name, then
  **Save public identity**.
- [ ] Review selected measurements privately, then explicitly include that source
  in the sharing preview. No raw original or private account alias appears.

- [ ] The tester ticks **Share this saved card** on one saved card, previews it ("Your visitor's view"),
  ticks the approval box and clicks **Publish this preview**.
- [ ] Signed out, `proper-respect.com/<tester-handle>` shows only that card,
  with the tester's own line and no text the app wrote for them.

| Result | Evidence | Notes |
|---|---|---|
| Pass / Fail | | |

### 7. Unpublish

- [ ] The tester removes the card: either unticks **Share this saved card** on
  it, then previews and clicks **Publish this preview**, or uses **Unpublish all
  cards** and approves that preview. Leaving the card out of a later preview
  does not remove it.
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
