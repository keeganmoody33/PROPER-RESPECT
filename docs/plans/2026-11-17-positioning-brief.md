# Proper Respect: positioning brief

Written 2026-11-17 from a read of `keeganmoody33/proper-respect` at main `a44b840` (after #221 and #225), plus open PR #226 and the open issues. Read only. The live site couldn't be reached from here, so nothing below describes production data, only the code and docs.

Source of truth for intent: Keegan's message of 2026-11-17, quoted in his words where it fits.

## 1. One sentence

**Proper Respect is your tooling page: one link that shows every tool you use, test and used before, with the usage behind it, so you earn respect for what you actually run and give props to whoever put you on.**

Shorter, for a subline: *Your tooling page. What you use, what you've tested, what you've moved on from, and the usage to back it.*

## 2. Who it's for

- **Primary:** go-to-market engineers. In his words, people like Mitchell Keller, "who I look up to as a go-to-market engineer." Issue #224 names the same first audience: indie GTM engineers who live in Claude Code, Codex and Cursor.
- **Wider:** anyone whose work runs on tools. "As technology is only becoming more relevant in everybody's job or everybody's life... if you were a YouTube streamer or YouTuber, everything you use." The data model already allows this: a product can be a "tool, app, service, course, community, or physical item" (`CONTEXT.md`), and any tool can be added by name.

## 3. The four jobs

1. **Prove usage, past tools included.** "To show that you use something, you've tested something." And "if you don't use it anymore, that's fine." A stopped tool is still proof you know it.
2. **Browse other people's stacks.** "Where people could go from page to page and look around at people's stuff." "I would love to see what [Mitchell Keller's] page would look like, what he's using."
3. **Show it in an interview.** "Yo, look, I don't use Clay anymore, but I have used it." It "validates a lot of stuff."
4. **Give props.** Credit the person who put you on a tool. "Jordan Crawford put me on to Claude Code back in like June of 2025." Props "would proliferate" once there are more people on it.

## 4. What it is not

- **Not affiliate shilling.** "You get proper respect, not for just shilling an affiliate link, but for your usage." Affiliate links can exist on a card, always disclosed, never the point.
- **Not verified metering.** The code supports source-labelled usage, not verification. GitHub comes through a connector. Claude Code and Codex come in as imports of sanitized captures the person produces themselves, labelled as such (`README.md`, "Measurements keep their native meaning"). Say "backed by your usage," never "verified."
- **Not a score or a ranking.** No universal score, no cross-person comparison, and go-to is the person's own mark, not earned by activity (`docs/002-v2-product-motion.md`, `CONTEXT.md` Usage Levels).
- **Not a résumé.** It sits beside one. The repo already says it well: "A résumé says where you worked. This shows what you run." (`app/page.tsx`)

## 5. Vocabulary: one meaning each

His own words already split the two brand words cleanly. Use them this way everywhere.

| Word | One meaning | Today in the repo |
| --- | --- | --- |
| **Page** | Your public tooling page, `proper-respect.com/{handle}` | Called "profile", "shared collection", "shared product collection" and "page" in different places (`app/[handle]/page.tsx`, `app/page.tsx`, `README.md`) |
| **Collection** | Your private list, where you add and edit tools before sharing | Mostly used this way (`/app/collection`), but "shared collection" also names the public page |
| **Card** | One tool on your page: how you use it, since when, the usage behind it | Consistent |
| **Respect** | What you earn from your usage record | Hero "Earn your respect." (#225). Good. |
| **Props** | Credit you give the person who put you on a tool | Means four things today (see drift 2) |

Drop or keep internal: "linker", "prop" (singular, meaning a relationship), "product stack". Visitors never need them.

## 6. Hero options

Each keeps his phrasing and stays plain. All three keep the two buttons that exist today.

**Option A. Keep the brand line, add what it is (recommended).**
- H1: **Earn your respect.**
- Subline: **Your tooling page. What you use, what you've tested, what you've moved on from, and the usage to back it.**
- Buttons: Start your page · See Keegan's page

Why: #225 just shipped "Earn your respect." and it's the right brand line. The gap the earlier review found is that nothing under it says what the product is. One subline fixes that without a redesign.

**Option B. Lead with the differentiator.**
- H1: **Every tool you've used counts.**
- Subline: **Even the ones you stopped. One page for what you run, what you've tested and what you've moved on from, with the usage behind it.**

Why: no other link-in-bio or stack page treats a dropped tool as proof. This makes that the headline. Costs the "respect" brand line its top spot.

**Option C. Lead with the interview moment.**
- H1: **"I don't use Clay anymore. But I have used it."**
- Subline: **Your tooling page. Show what you run, what you've tested and what you've moved on from, in one link.**

Why: it's his real line and it lands the interview job instantly. Narrower: it speaks to GTM people first and may read as a quote that needs context.

## 7. Homepage section order (short)

1. **Hero:** Option A, with the lead example card showing a past tool, not only a Daily one (see drift 3).
2. **Used it counts:** past tools are proof too. Two or three cards side by side: Daily, Testing, Stopped using with its reason. The interview line goes here if not in the hero.
3. **See what other people run:** a way to browse pages. Doesn't exist yet (drift 1). Until it does, this section is Keegan's page plus a line on what's coming.
4. **Give props to who put you on:** the card's "Props to @handle" line, with a one-sentence example in his words (Jordan Crawford, Claude Code, June 2025, only with his OK to name Jordan).
5. **How it works:** the existing three steps (`src/server/agent-discovery.ts`, `homepageSteps`).
6. **Close:** "Private by default. Shared by choice." Respect for usage, not for an affiliate link.

## 8. Match and drift: his points against the repo

Status key: **built**, **partial**, **missing**, **contradicts**.

| His point | What the repo does today | Status |
| --- | --- | --- |
| "I just want a tooling page" | One public page per handle, `app/[handle]/page.tsx`, with a card per tool. Named inconsistently: "SHARED PRODUCT COLLECTION", "profile", "shared collection". The homepage never uses the words "tooling page". | partial (built, named loosely) |
| "If you don't use it anymore, that's fine" | Seven usage levels include Tried, didn't adopt; Stopped using; Paused (`src/domain/relationship-level.ts`). A past card reads "Stopped using · started 2022" and "What I used it for", and can carry a note on why (`components/product-card.tsx`). These publish like any other card. But the homepage's five featured examples are all Daily or Weekly; the Paused (n8n) and Stopped (Elicit) examples sit behind "More examples" (`src/data/homepage-examples.ts`, `featured` flags). Minor: `noLongerInUse` doesn't count Tried, didn't adopt as past use. | partial (built in the product, hidden in the pitch) |
| "Show that you use something, you've tested something" | Testing is its own level. Usage comes from the GitHub connector and from imports: Claude Code, Codex, and a generic measurement packet for other products (`README.md`). Manual tools need no numbers. | built |
| "Go from page to page and look around at people's stuff" | No directory, search or browse page. `app/sitemap.ts` lists only the homepage and About pages, no profiles. The profile footer links to your own collection, not to other pages. The only page-to-page link is a props credit on platform Proper Respect that names a published page (ADR-062, `linked: true`). | **missing** |
| "See what Mitchell Keller's page would look like" | Needs him to have a page. Sign-up read as restricted in Clerk on 2026-09-26 (`docs/DEVELOPMENT.md`) and stays closed until the brief's Phase 2 gate (`docs/002-v2-product-motion.md`). Second users are invited testers only. No way to request or suggest someone's page. | **missing** |
| "If I was getting interviewed... I don't use Clay anymore, but I have used it" | Homepage: "A résumé says where you worked. This shows what you run." About/Origins: "A record apart from your work history." But the lead homepage example is Clay at Daily since 2023, the opposite of his line. (Those numbers are labelled synthetic samples.) | partial |
| "It validates a lot of stuff" | Each fact keeps its source, period and coverage; owner statements stay separate from measured facts (`docs/000-current-product-thesis.md`). Nothing is independently verified, and the docs say so. | partial (honest, not verified) |
| "Applicable to more than anybody", YouTubers | Model allows any product and manual add by name. But all 14 homepage examples are developer or GTM tools, and the hero names no audience. Open issue #224 would make "let your coding agent set it up" the first screen and drop the five-way source picker, which narrows the front door to coders (GitHub and manual add would remain). | partial (tension with #224) |
| "Respect for your usage, not for shilling an affiliate link" | Affiliate and referral links are optional, one per card, always disclosed (`CONTEXT.md` principle 4). The old "Give props" button that credited a card's affiliate link was retired in #221 (ADR-062). Still reads partly affiliate-led: one of the five featured homepage examples is Firecrawl, captioned "Referral link, disclosed", and Spider's is "Affiliate link, disclosed" (`src/data/homepage-examples.ts`); onboarding offers "My affiliate link" (`components/onboarding-client.tsx:697`); issue #78 proposes finding each person's affiliate links automatically, citing his own 2026-09-25 priority. | partial (tension, his call) |
| "Give someone props" | Built in #221 (ADR-062): one credit per card, set by the owner, shown on the card front as "Props to @handle · Platform". A Proper Respect handle links to that page if it's published; X, LinkedIn, GitHub, YouTube, Instagram and Substack link out; Other shows as text. "Not you? Report" sits beside it. | built (one per card) |
| How props display | One line on the card front, in the card's colours (`components/product-card.tsx`, `card-credit-line`). No props count on a page, no list of who credited you, no notifications (ADR-062, "Not in v1"). | built, minimal |
| "Props would proliferate... once there were more users" | A props count is undecided because of the no-score rule (`docs/002-v2-product-motion.md`). Reverse lookup and notifications are out of v1. More users depends on sign-up opening. | missing by decision |
| "Jordan Crawford put me on to Claude Code, June 2025" | Supported: a Claude Code card can credit a handle on X, LinkedIn or Proper Respect. Whether his own card has it can't be seen from the repo. `CONTEXT.md` already uses "Jordan Crawford showed me Wispr Flow" as its lineage example (a different tool from the one he named today). | built (capability); his card unknown |

### Props: four meanings today

| Where | What "props" means there |
| --- | --- |
| Homepage, "Give props. Get props." (`app/page.tsx`) | "Here the props are for what you run and how long you have run it": recognition for your usage |
| About/Origins (`src/server/trust-pages.ts`) | "Giving props means making recognition specific. Credit the tool": credit to the tool |
| Card and ADR-062 | Credit to the person who put you on |
| `CONTEXT.md` | "Prop: a linker's relationship with one product" |

His message splits it: **respect** is what your usage earns, **props** is what you give the person who put you on. The homepage line "Here the props are for what you run" should become respect, and the Origins line should credit the person, not the tool.

## 9. Top drifts, ranked by how much they hurt clarity

1. **No way to browse from page to page.** Half of what he described (look around at people's stuff, see Mitchell Keller's page) has no path. Even the homepage can't point at more than one page.
2. **"Props" means four things.** A first-time visitor reads three of them on the homepage, card and About page. His own words give the fix: respect for usage, props for who put you on.
3. **Past tools are the differentiator, and the pitch hides them.** All five featured examples are current tools; Paused and Stopped sit behind "More examples"; Clay leads as Daily since 2023, the opposite of his interview line.
4. **The hero doesn't say what it is or who it's for.** "Earn your respect." with no subline, and "tooling page" appears nowhere.
5. **Affiliate still shows up front.** A featured "Referral link, disclosed" example and an "affiliate link" option at onboarding cut against "not for just shilling an affiliate link."

Runner up: the audience. Every example is a developer tool, and #224 would make the first screen coder-only, while he wants it to work for a YouTuber too.

## 10. Open questions for Keegan

- Is browsing (a directory, or links between pages) a now thing or a later thing? It decides whether section 3 of the homepage is real.
- Should the lead homepage example become a past tool? If so, can it be Clay, matching your interview line?
- Is it OK to name Jordan Crawford on the homepage, or keep that example generic?
- Do you still want #78 (auto-finding affiliate links), given "not for just shilling an affiliate link"?
