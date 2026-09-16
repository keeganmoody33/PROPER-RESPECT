# Onboarding design studies

Created 2026-09-16. Mode: Operate. Status: local alternatives for review, neither selected as a production identity.

## Binding user direction

> “Proper Respect will just be what lies outside of these product cards.”

Source: supplied browser annotation 3 on https://props.lecturesfrom.com/onboarding.

> “We need the ability to hook up multiple emails, man. That's straight up.”

Source: supplied browser annotation 2 on the same route.

> “It's more like it's taking us a lot of time to create a profile and shit.”

Source: supplied browser annotation 5 on the same route.

## Shared interaction contract

The first action is connecting a sample account. Identity/profile editing does not precede discovery. Provider consent is distinct from the login. Email signals create candidates; activity evidence is a separate fact. A collection contains only the owner's kept choices. Nothing publishes. The owner can revise status, introducer credit, and an affiliate destination, and can restore dismissed suggestions.

The signature interaction is the transition from source accounts to recognizable product cards, followed by a private keep decision. Collection totals derive from kept records. Observed activity dates never change merely because a sample record is recaptured. Refresh cadence is labeled as a proposal.

## A / Connection studio

A split workspace places the next action beside a legible example of the result. Forest green, a light neutral ground, Manrope, and a compact task sequence keep the mood calm. Personal/work continuity is visible near the connection controls. The secondary column becomes the discovery review surface without sending the user through profile forms.

First viewport: connect accounts at left; GitHub's native vocabulary at right. Risk: on a phone, connecting comes before the sample collection because the task is the priority.

## B / Living collection

A collection workspace makes the future personal artifact the organizing idea. Space Grotesk, cool neutral surfaces, cobalt, a compact source rail, and a wider collection area distinguish it from the guided direction. The GitHub card spans the collection; Notion and Slack sit alongside one another at large widths. A derived kept-tool count changes when a review is saved.

First viewport: the personal collection identity above sources and recognizable product surfaces. Risk: the bigger collection framing adds vertical space before the first phone interaction.

## DesignSystem init and Taste routing

Read the installed entry skills and their routed Impeccable/init and design-taste-frontend references. Product context is recorded in the root PRODUCT.md from the supplied, already-authorized brief; open production decisions remain open. No standing comp/code workflow preference was invented or persisted. The explicit request for two working local UI choices governs this delivery rather than an image-only approval exercise.

Taste was applied to typography, spacing, state coverage, theme contrast, and responsive composition. Its marketing-page motion patterns were not applied to this task flow. Dials: variance 4, motion 2, density 5.

Impeccable concept-seed was run with scope direction and mode operate (key 311007ff; assigned grounded index 5). The explicit product-onboarding brief governs topology and control vocabulary. Dealt catalog imagery was not represented as user-approved direction or used as a vendor brand source. The shipped finish-review role was unavailable in the callable role list; an independent, fresh-context read-only reviewer was requested with the artifact, captures, requirements, and verification evidence.

Mechanical detector ran once against `src/`. It reported one warning: the use of Space Grotesk is common. This is accepted for the finite B comparison; it is not a functional or accessibility defect, and no typography choice is asserted as final brand approval.

## Token and component boundaries

| Area | A | B |
| --- | --- | --- |
| Shell type | Manrope, locally packaged | Manrope controls with Space Grotesk display |
| Shell accent | #24553b | #3156a0 |
| Light ground | #f7f8f6 | #f2f3f7 |
| Card radius | 10px | 10px |
| Control radius | 8px | 8px |
| Layout | Guided split columns | Source rail and collection |
| Dark mode | Semantic forest tokens | Semantic cool tokens |

Product surfaces own their type, palette, and native content grammar. The PROPER-RESPECT footer outside each card owns private-review state. GitHub switches with official light/dark tokens. The Notion and Slack evidence examples retain their light product surfaces inside the dark shell.

## Vendor provenance

Context7 resolve selected `/websites/primer_style` for official GitHub Primer documentation, followed by a query for functional color tokens and contribution graph styling. Installed `@primer/primitives`, `@primer/css`, and `@primer/octicons-react`; the GitHub card imports theme tokens and actual Box/Label CSS. Contribution level fills use `--contribution-default-bgColor-*`; counts derive from a synthetic daily sequence with an accessible table alternative.

Primary source: https://primer.style/product/primitives/ and contribution graph reference https://primer.style/primitives/storybook?path=%2Fstory%2Fcolor-patterns--contribution-graph.

Slack reference: https://slack.com/media-kit. The local card uses its recognizable aubergine header, workspace/channel language, and light content field as an authored reconstruction. No official Slack component package or Context7 coverage is claimed. Notion's monochrome workspace/page-list treatment is an authored reconstruction; the attempted official brand URL did not resolve during this run, so it is not cited as verified design-system guidance.

GitHub, Gmail, and Notion glyphs are packaged Simple Icons assets, not hand-drawn marks. The Slack card uses its name without a substituted logo. Fonts come from locally served Fontsource packages. No remote asset requests are necessary to operate the prototype.

## Accessibility and evidence limits

Native buttons, labels, selects, details, and dialogs support familiar interaction. The dialog explicitly cycles Tab/Shift+Tab inside its focusable controls and restores focus on Escape/close. Focus is visible, dynamic results use a status region, and a skip link reaches onboarding. Reduced motion disables animation. Contribution colors have a text/count alternative.

The saved JSON and screenshots document the tested states. They do not establish usability for every disability, browser, device, or assistive technology. Local lab performance is distinct from deployed performance. No production readiness inference follows from these prototypes.

## Introducer input refinement, 2026-09-16

User browser comment on the review form, verbatim:

> Having the ability to paste a handle or a domain, or whatever you want to, to this would be sick. It would be super dope if there is one, right? You don't have to. I guess that leaves the question of where, what platform, and who, but I guess maybe we could figure that out.

The optional field now accepts arbitrary text, @handles, domains, and web URLs. The original input is stored unchanged. Recognized link hosts suggest a platform using a small local mapping; the owner may override or omit it. Bare handles never select a platform automatically. A name can retain no platform, or expand optional context. Changing the original text clears the previous platform override rather than silently attaching it to a different source.

Link recognition is not identity resolution. No page metadata, profile, avatar, or verification claim is fetched or fabricated. HTTP(S) links without embedded credentials may be opened explicitly from the saved credit; other input remains text. A domain gets an HTTPS destination without changing the stored raw value. The introducer destination remains separate from product and affiliate destinations. Handles do not generate guessed profile links.

Targeted verification is recorded in `checks/introducer-verification-2026-09-16.json`; screenshots use the `introducer-` prefix. The original broad flow report and Lighthouse records predate this refinement.
