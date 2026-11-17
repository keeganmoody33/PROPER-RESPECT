# Taking down a reported public profile

Updated: 2026-11-17. Written for R06; step 5 added for props; search added for Phase C. The owner runs these commands.

A takedown hides a published profile at its handle and at every old handle
that redirects to it. The page then returns the same 404 as an unpublished
handle. The owner can't republish while it lasts: publishing fails with
"This profile is under review." Approved activity refreshes skip the
hidden snapshot, and `seed:seedKeegan` refuses to replace a taken-down
`keegan` profile. The page also leaves search, its tools' pages and the
sitemap at once, and a restore lists it again.

The takedown doesn't delete or change anything else. The published snapshot,
the owner's private collection and their account stay as they are, so a
restore brings back exactly what was taken down.

## Before you start

- **The backend must include R06.** These functions exist only after a
  Convex deploy that includes R06, which ships with the next tagged release
  (K03). Before that, `npx convex run` reports that the function doesn't
  exist.
- **Reports arrive by email.** Every public profile has a "Report this page"
  link. It opens an email to `33@lecturesfrom.com` with the subject
  `Report proper-respect.com/<handle>`.
- **Run commands from a checkout of the deployed release**, logged in to the
  Convex team that owns production. `--prod` targets the production
  deployment.
- **Record the report** before acting: the date, the reporter's address, the
  URL, and what they say is wrong. The reason you pass below is stored with
  the takedown. Keep it factual, at most 500 characters, and free of the
  reporter's personal details.

## 1. Dry run

Replace `<handle>` with the handle from the reported URL. An old handle works
too; the command finds the profile it now redirects to.

```sh
npx convex run --prod publicProfiles:takeDownHandle '{"handle":"<handle>","reason":"Report <YYYY-MM-DD>: <short factual summary>","dryRun":true}'
```

The command changes nothing. Check its result:

- `"status": "ready"`: the `handle`, `revision` and `cardCount` name the profile
  that will be hidden. Confirm it's the reported page.
- `"status": "already-taken-down"`: an earlier takedown is still in place. Its
  `takenDownAt` and `takedownReason` are shown. Stop here.
- An error saying no published profile has that handle means nothing is
  published at that URL. Check the URL with the reporter.

## 2. Take the profile down

Run the same command with `"dryRun":false`:

```sh
npx convex run --prod publicProfiles:takeDownHandle '{"handle":"<handle>","reason":"Report <YYYY-MM-DD>: <short factual summary>","dryRun":false}'
```

Expect `"status": "taken-down"`. Then open `https://proper-respect.com/<handle>`
in a private window. It should show "Nothing is published here." Check any
old handle from the report the same way.

## 3. Restore, when the review clears the profile

Dry run first:

```sh
npx convex run --prod publicProfiles:restoreHandle '{"handle":"<handle>","dryRun":true}'
```

Expect `"status": "ready"`, with the recorded `takenDownAt` and
`takedownReason`. Then restore:

```sh
npx convex run --prod publicProfiles:restoreHandle '{"handle":"<handle>","dryRun":false}'
```

Expect `"status": "restored"`. The page returns exactly as it was published,
and the owner can publish again. `"status": "not-taken-down"` means there was
nothing to restore.

To remove content for good instead, ask the profile's owner to unpublish or
change it. This runbook never edits or deletes their content.

## 4. Reply to the reporter

> Subject: Re: Report proper-respect.com/<handle>
>
> Thank you for your report about proper-respect.com/<handle>. We've
> [taken the page down while we review it / reviewed it and found it within
> our rules, so it stays up]. [If taken down: we'll let you know when the
> review is finished.]
>
> — proper-respect.com

Keep the reply to what was done. Don't share the profile owner's details or
the stored reason.

## 5. Remove one credit from a card

Added 2026-11-15 with props ([ADR-062](../adr/062-props-credit.md)). A
published credit has a "Not you? Report" link. Its email's subject is
`Report credit on proper-respect.com/<handle> · card <N> · <product> · <credit> on <platform> · "<headline>"`,
with a headline over 80 characters cut short with "…". Removing a
credit leaves the rest of the profile up, so there is no takedown and no
command: the owner edits the published snapshot by hand in the Convex
dashboard for production.

1. Record the report, as in "Before you start".
2. In **Data → publishedProfiles**, open the document whose `handle` is the
   reported handle. Card N is `profile.cards[N-1]` (the dashboard counts
   from 0). Check that its `product.name`, `credit` and `headline` match the
   report; the headline only has to start with the reported one, after
   dropping a trailing "…" that marks where it was cut. If they don't match,
   the owner has republished since the report: find the card by those three
   instead, and if two cards match, ask the reporter which before removing
   anything. Delete that card's `credit` field and leave everything else as
   it is.
3. Open `https://proper-respect.com/<handle>` in a private window. The card
   should show no "Props to" line.
4. Email the owner what was removed and why. Ask them to remove or change
   the credit in their collection. The private credit is theirs, so leave it
   alone: until they change it, publishing that card again sends it again.
5. Reply to the reporter as in step 4, saying the credit was removed.
