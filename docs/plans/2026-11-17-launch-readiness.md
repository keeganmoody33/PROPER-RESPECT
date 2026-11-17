# Proper Respect: launch readiness

Written 2026-11-17 from a read of `keeganmoody33/proper-respect` at main `a44b840`, the open PRs and issues, and two public reads of production (the `/lecturesfrom` page and Clerk's public environment endpoint). Read only: nothing was signed up for, pushed, merged, deployed or changed. The app was not run locally (it needs Clerk and Convex keys this session doesn't have), so the sign-up journey below is traced in code, not clicked through.

Builds on [`2026-11-17-positioning-brief.md`](2026-11-17-positioning-brief.md) in this folder. Keegan picked hero option B there and wants every drift fixed.

## 1. Straight answer

**Your own page: yes, it's live today.** `proper-respect.com/lecturesfrom` returned 200 on 2026-11-17 with 4 cards: Wispr Flow, NotebookLM, Devin Desktop and GitHub. You already have the owner account, so you don't sign up. You edit at `/app/collection` and republish. Two things are off on it: the GitHub card says "last updated 9 Oct 2026" (the daily refresh isn't landing), and the page still wears the pre-redesign build (see "Shipping" below).

**A new person: technically yes, but not tight.**

- **Sign-up is open right now.** Clerk's public endpoint reports sign-up mode `public` on 2026-11-17, with legal consent off and no allowlist. The docs say it was set to `restricted` on 2026-09-26 (`docs/DEVELOPMENT.md`, brief Section 9, K01). Someone changed it back, or the docs are stale. Either way, anyone can create an account today.
- **Nobody outside has ever run the full journey on production.** `docs/acceptance/second-user.md` is a blank template, and #24 still lists "complete new-user first private save" as open.
- **The fastest path publishes robotic text.** Build your stack, then Share every confirmed tool, publishes every card with the headline **"Relationship note not supplied."** Details in section 3.

### What a new person goes through today, step by step

1. **Home, then Start your page, then `/sign-up`.** Clerk's own form (`app/sign-up/[[...sign-up]]/page.tsx`). Options: Google, GitHub, or email plus a **required password** plus an email code. Turnstile captcha. No terms checkbox.
2. **Redirect to `/onboarding`**, which renders the same page as `/app/collection` (`app/onboarding/page.tsx`). The redirect depends on `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` in Vercel; its value can't be read from here.
3. **A private account is created** with a placeholder handle `pending-<id>` (`convex/onboarding.ts`, `ensureAccount`).
4. **One long page with six sections** (`components/onboarding-client.tsx`): a five-way "where do you start" picker (GitHub, Claude Code file, Codex file, another tool's file, add by name), Build your stack, the collection, Add a tool, Sources (Gmail for listed testers only, GitHub, a Devin token form, a file upload that isn't read), and Sharing.
5. **Fastest route: Build your stack.** Type tool names, pick how often, save (`components/stack-builder.tsx`, `convex/stack.ts`). Each tool is saved as confirmed with an empty headline and note.
6. **Claim a handle.** It sits in a collapsed "Public identity" box inside Sharing: handle, display name, bio, links.
7. **Share every confirmed tool,** preview, approve. The page is live at `/{handle}`.

### Where it breaks or drags

| Friction | Evidence |
| --- | --- |
| Every quick-path card reads "Relationship note not supplied." | `convex/stack.ts:133` saves `headline: ""`; `src/domain/share-all.ts` doesn't skip empty headlines; `src/domain/visible-public-profile.ts:152` fills the placeholder |
| Password required to sign up by email | Clerk environment: `password.required: true` |
| Five-way source picker plus a six-section page before anything is visible | `components/onboarding-client.tsx:452-560`, `src/client/first-result-intent.ts` |
| Handle hidden in a collapsed box | `components/onboarding-client.tsx`, `#collection-profile` |
| GitHub connect fails for a Google sign-up until GitHub is linked in the Clerk profile | `connectGithub()` opens the profile instead |
| Uploads are kept but not read, from a fixed list of six products | upload form in `components/onboarding-client.tsx` |
| Known bugs on this path | #162 (blank name blocks sharing, PR open), #105 (every validation message becomes "Server Error"), #104 (no error boundary), #222 (`app` and `about` handles claimable) |

### Shipping

The last release is `v0.3.4` (9eb44a6, 2026-11-15, release run succeeded). Main is three commits past it: props credit (#221), the "Earn your respect" redesign (#225) and a docs change (#223). Production still serves the old share image (`v=20260922`, alt "Your tools. Your track record.") while main has `v=20261116`, alt "Earn your respect.". So props credit and the redesign are merged, not live. Shipping is you pushing a `v*` tag (`docs/DEPLOYMENT.md`).

## 2. Blockers

| # | Blocker | Evidence | Kind |
| --- | --- | --- | --- |
| 1 | Sign-up is public while the docs say restricted, and the fresh journey is unverified | Clerk environment `sign_up.mode: public`, 2026-11-17; `docs/acceptance/second-user.md` blank; #24 | **Decision (yours)**, then a Clerk dashboard setting only you can change |
| 2 | Quick path publishes "Relationship note not supplied." | section 3 | Code |
| 3 | Main isn't released: props credit and redesign aren't live | release runs end at v0.3.4; share image mismatch | **You:** push a tag |
| 4 | GitHub card stale since 9 Oct; daily receipt failing | live page; issue #175 | Code, then config to confirm |
| 5 | Error handling hides real messages | #105, #104 | Code |
| 6 | Small path bugs | #162 (PR ready), #222, #186 (alias host breaks Clerk) | Code; #162 and #186 need review and your merge |
| 7 | Clerk sign-up settings add friction | password required, legal consent off (K05 never done) | **Config (yours)**, Clerk dashboard |
| 8 | No search, no directory, no tool pages | `app/sitemap.ts` lists no profiles; no route or query lists published pages | Code, plus a privacy **decision** |
| 9 | Search routes aren't reserved as handles | `src/domain/handle.ts` has no `search`, `tools`, `people`; sign-up is open, so anyone could claim them | Code, small, time sensitive |
| 10 | Agent-first sign-up (#224) | issue says it needs your go | **Decision (yours)** |

## 3. Reasonable language

### How card and page text are written today

- **The headline is the owner's words, up to 240 characters.** The field is "What it helps you do (optional)", blank, with no example or placeholder (`components/private-inventory.tsx:143`).
- **Nothing drafts it.** There is no AI or template writer in the app.
- **When it's empty, the public card falls back to the note, then to "Relationship note not supplied."** (`src/domain/visible-public-profile.ts:152-155`, `components/product-card.tsx:614`).
- **Some paths write system text that can go public unchanged:**
  - GitHub connect: headline "GitHub is in my stack.", note "Connected activity is private until I approve this card." (`convex/connectors.ts:251`). That note would publish as the card's quote.
  - Other connectors: "{Product} is in my stack." (`convex/connectors.ts:392`).
  - Upload: "{Product}: uploaded evidence to review." (`convex/onboarding.ts:507`).
  - Email discovery: "{Product} may be in your stack." (`src/domain/discovery.ts:68`).
- **What already reads well:** level and time ("Using · since 2025", "Stopped using · started 2022"), the "What I use it for" list from hand-written choices for 18 products (`src/domain/product-use-options.ts`, each finishing "I use it to …"), and the GitHub activity summary ("1,304 contributions from 9 Oct 2025 to 9 Oct 2026, on 122 of 366 days").
- **Your live headlines read well** because you wrote them ("Talking is faster than typing.", "Where the receipts live."). That's the bar.

### What would fix it

1. **Never publish a placeholder.** Share every confirmed tool skips a card with no headline and names it ("3 tools need a line first"), the same way it already skips bad links. The GitHub note above stops being a default.
2. **Suggest a first line from what the person already picked.** No model needed. Level, picked uses and start year give a draft like "I use Claude Code daily to build features and review code before it merges." or "Used Clay from 2022 to 2025 for list building." It shows in the field marked as a suggestion; the owner keeps or edits it before it counts. For products without use choices, a placeholder example instead.
3. **Later, if you want it: AI-drafted lines** from the person's own notes and usage summary. That needs a model provider key, a cost line, and a decision on what text leaves the app. Same rule: drafted, never published without the owner's yes.

## 4. Build plan

One PR per step, each on its own branch from main, RED test first where code changes, `needs-owner` label, Codex review, you merge, you ship with a tag (AGENTS.md). Sizes: S up to 2 agent-hours, M 2 to 8, L 8 to 24.

### Phase A: your page live and tight

| Step | Scope | Size | Needs | You decide or do |
| --- | --- | --- | --- | --- |
| A1 | No placeholder ever publishes: share-all skips empty headlines and names them; drop the GitHub default note; public fallback becomes "no line" instead of "not supplied" | S | none | nothing |
| A2 | Suggested first line from level, uses and dates, pre-filled and marked as a suggestion; example placeholder for other products | M | A1 | OK the template approach (decision 3) |
| A3 | Ship main: push the next tag so props credit and the redesign go live; merge #226 first if you like the screenshot | S | A1 ideally | push the tag |
| A4 | Fix the stale GitHub refresh behind #175 and confirm a capture under 36 hours old | S to M | none | confirm the scheduled refresh is on |
| A5 | Your cards: Claude Code with props to Jordan Crawford, Clay as Stopped using with why, Codex, Cursor, Clerk or Convex if you want; a line on each | you, in the app | A1 to A3 | do it in `/app/collection` |

### Phase B: open sign-up properly

| Step | Scope | Size | Needs | You decide or do |
| --- | --- | --- | --- | --- |
| B0 | Set sign-up mode to match your decision (Restricted, Waitlist or Public) and correct the docs | S | none | **Clerk dashboard, yours** |
| B1 | Path bugs: merge #162, fix #105, #104, #222, review #186 | M (several S PRs) | none | merge each |
| B2 | One clear first screen: sign in with Google or GitHub, then Build your stack first, handle asked inline right before sharing, Sources and uploads moved below; mobile checked | M | A1 | approve the screenshots |
| B3 | Clerk settings: drop the required password (email code plus Google and GitHub), turn on legal consent (K05) | S | none | **Clerk dashboard, yours** |
| B4 | One real outside person runs the Phase 2 script (`docs/acceptance/second-user.md`) | M | B1, B2 | pick the person, sit with them |
| B5 | Agent-first sign-up (#224): your coding agent reports your tools, you approve | L | B2 | give it a go or park it |

### Phase C: search people and tools

| Step | Scope | Size | Needs | You decide or do |
| --- | --- | --- | --- | --- |
| C1 | Reserve `search`, `tools`, `people`, `explore` as handles; check none is taken | S | none | nothing. Do this now, sign-up is open |
| C2 | A read model of published cards (handle, tool, level, listed or not), written on publish, unpublish and takedown; Convex search index on names; backfill existing pages | M | C1 | choose the listing rule (decision 2); ship with a tag |
| C3 | `/search` with one box and two tabs, People and Tools | M | C2 | approve the screenshots |
| C4 | `/tools/{slug}`: the tool, people who use it now, people who used it before, each linking to their page | M | C2 | whether past users show (decision 2) |
| C5 | Link the graph: a card's tool name opens its tool page; sitemap lists listed pages and tool pages | S | C3, C4 | whether pages get indexed by Google |

Notes on C: private by default holds because only published, listed cards enter the read model; takedowns drop out. "How many people use this tool" is a count of people per tool, not a score on a person, but flag it against the no-score rule in `docs/002-v2-product-motion.md`. Seeing Mitchell Keller's page still needs him to sign up; there's no "suggest someone" feature.

### Phase E: scan, then ask one tool at a time

Added 2026-11-17 for the go-live test Keegan described. Full detail in section 6. Order: after A1 and A2, before or alongside B2, because E1 becomes the first screen B2 is reaching for.

| Step | Scope | Size | Needs | You decide or do |
| --- | --- | --- | --- | --- |
| E1 | Text-first walkthrough: one tool per screen from everything already found, taps for how you use it, uses checkboxes, suggested line, then the share preview | M | A1, A2 | approve the screenshots |
| E2 | A "finding your tools" screen that starts every source the person has connected and shows progress, then hands off to E1 | M | E1 | nothing |
| E3 | Wider email clues: sender domains for more of the 209 directory products (38 have them today) | S to M per batch | E1 | nothing; Gmail stays testers-only until Google review |
| E4 | Local scan through the person's own agent (#224's `build-my-collection`), feeding the same queue | L | E1, B5 decision | give #224 a go |
| E5 | Voice layer over E1 | M to L | E1 working well in text | decision 4 below |

### Phase D: drift fixes and option B

| Step | Scope | Size | Needs | You decide or do |
| --- | --- | --- | --- | --- |
| D1 | Hero option B in `app/page.tsx`: "Every tool you've used counts." with "Even the ones you stopped. One page for what you run, what you've tested and what you've moved on from, with the usage behind it." | S | A3 | approve the screenshot |
| D2 | One meaning each: respect is what usage earns, props is credit to who put you on (homepage line, Origins in `src/server/trust-pages.ts`, `CONTEXT.md`) | S | none | nothing |
| D3 | Past tools up front: lead example a stopped tool (Clay if you OK it), Paused and Stopped featured, the referral example out of the featured five (`src/data/homepage-examples.ts`) | S | D1 | Clay as the lead, yes or no |
| D4 | Call it a tooling page: "SHARED PRODUCT COLLECTION" becomes the tooling page label on `app/[handle]/page.tsx`, README matches | S | none | nothing |
| D5 | Affiliate demoted: onboarding's "My affiliate link" moves behind more options; #78 parked or closed | S | none | #78 keep or close |
| D6 | Homepage "see what other people run" section points at search | S | C3 | nothing |

## 5. Decisions to make first

1. **Sign-up mode right now.** It's public today, against the docs, and nobody outside has run the journey. Recommendation: switch to Clerk's Waitlist mode until A1, B1 and B2 land and one outside person passes the Phase 2 script, then open it. You change this in the Clerk dashboard.
2. **What publishing means for search.** Does a published page show in search automatically, or only with a "list my page" switch? And do people who stopped using a tool appear on its tool page as past users? Recommendation: a separate switch, asked once at publish; past users shown, labelled "used before", since that's your whole pitch.
3. **How cards get their words.** Template suggestions from what people pick (no AI, no key, ships fast), or AI-drafted lines (needs a provider key and a call on what text leaves the app). Recommendation: templates now, AI later if templates read flat.

Smaller ones that can wait a day: push the tag to ship main, OK naming Jordan Crawford on the homepage, Clay as the lead example, and #78.

## 6. Scan, then a voice walks you through it

Keegan's go-live test, 2026-11-17, in short: the app reads everything it can reach (connected sources, email, logs on the computer), takes as long as it needs, then a voice agent pops up and goes tool by tool. "How do you use Devin? How do you use Clay? Do you use Findymail or Hunter, have you tested it, or do you not use it anymore?" The person says yay or nay, and that fills the page and its words.

The shape is right, and most of the pieces exist. The missing piece isn't voice. It's the **one-tool-at-a-time queue** that every source feeds and every answer writes back to. Build that in text first; voice is a second way to answer the same questions.

### What the repo already detects

| Source | What it finds | State today | Evidence |
| --- | --- | --- | --- |
| Build your stack | Whatever the person types | Live for everyone | `components/stack-builder.tsx`, `convex/stack.ts` |
| GitHub | One card with contributions | Live; needs GitHub linked in Clerk | `convex/connectors.ts`, `/api/connect/github` |
| Gmail | Candidate tools from sender domains, labelled "may be in your stack" | Invited testers only (allowlist); bounded runs with a budget and resume; Google restricted-scope review not filed | `src/domain/discovery.ts`, `src/domain/mailbox-testers.ts`, `components/mailbox-discovery-run.tsx` |
| Email matching coverage | Sender domains exist for 38 of the 209 products in the directory | Data gap | `src/domain/product-directory-entries.ts` (`evidence.domains`) |
| Claude Code | Usage totals from a sanitized file the person makes and uploads | Live as an upload; the person runs a script first | `scripts/claude-native-report.mjs`, `docs/usage-measurement.md` |
| Codex | Usage from a metadata capture the person uploads; a local reader exists for Linux | Upload live; no automatic collection | `src/domain/codex-usage.ts`, `docs/codex-local-history.md` |
| Any other tool | A measurement file in the `proper-measurements-v1` shape | Live as an upload | `src/domain/measurements.ts` |
| Devin | Organization sessions, searches, PRs from a pasted token | Live | `convex/connectors.ts` |
| Cursor | A supplied CSV, fixture format only | Not accepted from a real export yet | `docs/cursor-connection-source.md` |
| Logs on the computer | Nothing reads them on its own | Proposed in #224 (agent scans, person approves, packet pasted in the browser) | issue #224 |
| Review of found tools | A discovery review screen to attach a found tool to a card | Live, but it's a list, not a walkthrough | `components/discovery-review.tsx`, `convex/discoveryReview.ts` |

### What's missing for the flow you described

1. **One queue.** Today each source drops its finds in a different place: stack picks are saved confirmed, email finds wait as drafts, GitHub opens its own card. Nothing gathers them into "here are the 14 tools we think you've touched, let's go through them."
2. **A "we're looking" screen.** Mailbox runs already show progress and budget. Nothing starts all sources at once and says when it's done.
3. **The question per tool.** The answers already exist as data: seven levels from Daily to Tried, didn't adopt (`src/domain/relationship-level.ts`), plus "I use it to …" choices for 18 products. There's no screen that asks them one tool at a time.
4. **Words from the answers.** That's A2 (suggested first line). Without it, a fast walkthrough just produces faster "Relationship note not supplied." cards. This is why E can't jump ahead of A1 and A2.
5. **The local scan.** Reading logs on someone's computer can't happen from a website. It has to be their own agent or a small app on their machine. #224 already designs it so nothing leaves without the person seeing the exact list first.

### Text-first version (E1), shippable before voice

One tool per screen, phone first.

1. **Header:** the tool's logo and name, and why it's here in a few words ("Found in your email", "You added it", "Your Claude Code usage").
2. **One tap for how you use it:** Daily · Weekly · Testing · Stopped · Never used it. "More" opens the other two levels (Occasionally, Paused). Never used it removes the find; nothing is saved about it.
3. **If it's a tool you use or used:** up to five "I use it to …" checkboxes where the product has them, plus "Something else". Optional "Since" year. Optional "Who put you on?" for props.
4. **Suggested line** built from those answers (A2), editable, marked as a suggestion.
5. **Next tool.** A progress line ("6 of 14"). Skip is always there.
6. **End:** "Here's your page" preview with every card you said yes to, then the existing approve step. Nothing goes public before that.

Every answer writes through the same save the collection already uses, so history, private by default and the publish preview don't change. Answers are owner statements; measured numbers stay labelled as measured.

### Voice layer (E5): what it would need

**Where it plugs in.** The voice agent drives E1, it doesn't replace it. It reads the tool name, listens, and maps the answer to the same fields: level, uses, since, props. The screen updates as it hears, and the person can tap to correct. The save and the publish approval stay on screen, never by voice alone.

**Options**, with rates as published or reported on 2026-11-17 (vendor pages and comparison articles; check again before building, they move):

| Option | How it works | Rate | Fit |
| --- | --- | --- | --- |
| Browser speech recognition plus a model call per answer | The browser turns speech to text; one small model call maps it to the fields | No per-minute fee; only the model call | Cheapest; support and quality vary by browser, weakest on iPhone |
| OpenAI Realtime | One model hears, talks and calls tools in one session | Audio billed per token; one article estimates about $0.06 to $0.11 a minute on the full model, $0.02 to $0.05 on mini | Most natural conversation; you own the prompt and tool calls |
| ElevenLabs Agents | Hosted agent, strong voices | $0.08 a minute plus the model | Best voice quality, least plumbing |
| Vapi | Hosted orchestrator, pick your own parts | $0.05 a minute plus each part at cost | Most control without owning the media pipeline |
| Deepgram Voice Agent | One flat rate | $0.075 a minute | Simple bill |

**Cost per person.** Say 15 tools at about 10 seconds each is roughly 3 minutes, so about $0.15 to $0.40 a person on the hosted options. That's an estimate from the rates above, not a measurement.

**What else it needs.**
- A server-side key for the provider, kept out of the browser, and a short-lived session token per person.
- A privacy page update: audio goes to a third party. Decide whether transcripts are kept (recommend: not kept; only the answers are saved).
- A rate limit per account, the same pattern as `consumeWriteLimit`.
- A text fallback on every screen, for people who can't or won't talk.
- Your earlier voice research (Chief of Staff, 2026-08-20) was about phone calls. This is in-browser, so no phone numbers or carriers are needed.

### Where it fits

1. A1: never publish the placeholder.
2. A2: suggested first line.
3. E1: the text walkthrough, fed by stack picks, GitHub, uploads and tester email finds.
4. B2 becomes "sign in, then E1".
5. E2 and E3: start every source at once; widen email matching.
6. E4: the local scan through #224, once you give it a go.
7. E5: voice on top, once E1 reads well in text.

### Decision 4

**Voice provider and transcript policy.** Not needed until E1 works. When it is: pick the cheapest that sounds good to you (try ElevenLabs and OpenAI Realtime on the same five tools), and decide whether any transcript is kept. Recommendation: keep only the answers.
