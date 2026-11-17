# ADR-062: Props credit the person who put you on a tool

## Status

Accepted, 2026-11-15. Owner decision. Supersedes the attribution flow in
[ADR-009](009-manual-put-on-by.md) and the field design in
[ADR-023](023-put-on-by-ui.md) for v1.

## Context

In the owner's words: "You cross someone using something you were in need
of, you check it out, and if you eventually use it or even test, you give
'props' to that handle or person." They "could credit anybody by writing
their handle", choosing the platform the handle is on, and the product
should "encourage them to put their Proper Respect handle".

Until now "Give props" meant something else. A signed-in visitor could
credit a card owner's stored affiliate or referral link, and the profile
listed those credits to signed-in visitors. That gesture is retired.

## Decision

**One credit per card.** The card's owner sets it in the private
collection editor. It is saved with the relationship and its history, is
in the owner's export, and goes out with the card when the owner
publishes it, the same way as the card's uses (#215, #216).

**Data shape.** `src/domain/props-credit.ts` owns it:

```ts
type PropsCredit =
  | { platform: "PROPER_RESPECT"; handle: string; linked?: true }
  | { platform: "X" | "LINKEDIN" | "GITHUB" | "YOUTUBE" | "INSTAGRAM" | "SUBSTACK"; handle: string }
  | { platform: "OTHER"; handle: string; platformName: string };
```

`linked` is set only by publishing. The Convex validators stay permissive
(`platform: v.string()` and so on), so the change is additive and needs no
migration. Every reader checks a stored credit against its platform's rule
and drops one that no longer fits.

**Platforms and handle rules.** Proper Respect is listed first and
preselected. The form's hint says a Proper Respect handle links to their
page here. Each rule, with its source and the date it was checked, sits
beside it in `props-credit.ts`:

| Platform | Link | Rule | Source |
| --- | --- | --- | --- |
| Proper Respect | `https://proper-respect.com/<h>` | the site's `handleSchema`, lowercased | this repo |
| X | `https://x.com/<h>` | 1-15 letters, numbers, underscores. X states no minimum; 1 is our choice. | help.x.com, X username rules |
| LinkedIn | `https://www.linkedin.com/in/<slug>` | 3-100 letters, numbers, hyphens. Hyphens are observed, not listed by LinkedIn. | LinkedIn help a542685 |
| GitHub | `https://github.com/<h>` | the repo's GitHub login rule and reserved paths | `product-destination.ts`, GitHub docs |
| YouTube | `https://www.youtube.com/@<h>` | 3-30 letters and numbers in any script, `_ - . ·` not first or last; a non-Latin handle may be shorter | YouTube help 11585688 |
| Instagram | `https://www.instagram.com/<h>/` | 1-30 letters, numbers, periods, underscores; no period first, last or doubled. Instagram publishes no rule; this follows secondary sources. | secondary |
| Substack | `https://substack.com/@<h>` | 4-32 letters and numbers. Never a publication subdomain. | Substack support, What are Substack Handles |
| Other | none | the owner's words, at most 40 characters, and where, at most 30. Never a link. | n/a |

A pasted leading `@`, or a pasted profile link on one of that platform's
exact hosts, saves as the handle. Anything else is refused with a message
the owner can act on, because the owner chose it. A link is only ever the
platform's fixed host plus the `encodeURIComponent`-ed handle, and it passes
`isHttpUrl` at publish, read, projection and render.

**Proper Respect links.** Publishing looks the handle up. If it names a
published profile, or an alias of one, the card stores that profile's
handle with `linked: true` and links to it. Otherwise the handle shows as
text. The card keeps that answer until it is published again.

**Publishing a credit that no longer fits.** Publishing stops with "Who
put you on <product> no longer fits <platform>'s handle rule." A card left
out of a later publish keeps the credit it was published with.

**The card.** The front shows one line just above the footer: "Props to
@handle · Platform", in the card's own colours, the handle linked where
allowed. On a published profile it adds "Not you? Report", an email to the
existing report address with the subject `Report credit on
proper-respect.com/<handle> · card <N> · <product> · <credit> on
<platform> · "<headline>"`. The card's place on the page names it, since two
cards can share a product, headline and credit; the rest lets the operator
check it. The operator removes a reported
credit by hand ([takedown runbook](../runbooks/takedown.md), step 5).
Homepage samples, the owner's private card and the publish preview have
no report link.

**Agents.** The visitor projection, the WebMCP tool and the MCP prototype
contract carry `credit: { text, platform, handle, url? }`. The agent guide
and the reading skill say in one sentence what a credit is: the owner's
word, one handle on one platform, unconfirmed and uncounted.

**Not in v1.** No count of props received, no reverse lookup of who
credited a handle, and no notifications. The standing rule against a
universal score still holds. Whether a props count can ever fit that rule
is still undecided.

**Retired.** The Give props button, its server action, the credits list,
`convex/linkProps.ts`, `src/domain/link-prop.ts` and
`src/data/get-link-props.ts` are deleted. The `linkCredits` table stays
defined, marked as no longer written or read, because production may hold
rows. Dropping it is a separate owner decision. The line "Give props. Get
props." stays.

## Consequences

- A credit is the owner's word. Nobody confirms it, and a credited person
  who disagrees reports it.
- A Proper Respect credit that was text can become a link only when its
  card is published again.
- Handle rules drift as platforms change them. Each rule's source and date
  is beside it, so a stale one can be rechecked.
- Links to Proper Respect profiles always use the production host, so a
  development or preview deployment links to production pages.

## Later

The owner's direction, not built: "some sort of generative or all-knowing
realtime lookup and call system" for handles. That would find and check a
handle across platforms instead of relying on the owner's typing and our
written rules.

## Related

- [ADR-009](009-manual-put-on-by.md), the original lineage proposal.
- [ADR-023](023-put-on-by-ui.md), the original field design.
- [ADR-032](032-moderation.md), moderation.
