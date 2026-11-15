# Homepage product examples

The homepage carousel shows sample product cards, each rendered through the real `components/product-card.tsx` with the product's brand look. Five are featured; nine more sit behind "More examples". Each card flips to a back with notes, cost, links and a "How this was measured" disclosure. Data is in `src/data/homepage-examples.ts` and `src/data/homepage-sample-usage.json`; brand data in `src/data/homepage-brands/`.

## Sub-features

- `examples-chooser` picks a featured example; one tab stop, arrow keys move, Enter picks and stops the slideshow.
- `examples-more` reveals the nine other examples, which mount only when picked.
- `examples-slideshow` advances every 8 s only while the carousel is on screen, pauses on hover and focus, never runs under reduced motion.
- `card-front` shows the brand header, headline band, what the owner uses it for, the data block (chart, calendar, table or linked works), any props line and the footer.
- `card-credit` is the sample props line above the footer on Clay (a linked Proper Respect handle), n8n (a linked GitHub username) and Spider (plain text). Samples have no report link.
- `card-flip` turns to the back; focus moves to the back's heading; Escape or "Close details" returns focus to "Details".
- `card-measured` is the "How this was measured" disclosure on the back.

## How to get to it (user POV)

- Open `/`. At 1440 the carousel sits beside the heading; on a phone it should sit directly under the heading.
- Choose a product name in the chooser, or "More examples" then a name.
- Choose "Details" on a card to flip it, "Close details" to flip back.

## Driving it with Playwright

Preconditions: doctor exits 0; the slideshow is paused before captures.

- **Find the carousel.** `page.getByRole("region", { name: "Product usage examples" })`. The current slide is `[data-current="true"]`; its card is `getByRole("article", { name: "<Name> card" })`.
- **Pause.** `carousel.getByRole("button", { name: "Pause slideshow" })`. The button then reads "Play slideshow".
- **Pick.** `carousel.getByRole("button", { name: "Clay", exact: true })` inside the group named "Choose a product example". Previous and next are "Previous example" and "Next example".
- **More.** `carousel.getByRole("button", { name: "More examples" })`, then a name such as `"Spider"`.
- **Flip.** `card.getByRole("button", { name: "Details" })`. Expect focus on the back's `h2`, and the page scroll position to change by 20 px or less on a phone.
- **Disclosure.** On the back, `getByRole("button", { name: "How this was measured" })`; `aria-expanded` toggles.
- **Back.** `getByRole("button", { name: "Close details" })` or Escape. Expect focus on "Details".
- **Proof.** Screenshot the article front and back at 1440 and 390, run the floors snippet in SKILL.md on `[data-current="true"] .product-card`, and record what a screen reader gets for the data block (`getByRole("table", ...)` for charts and the Clay table).

## Rubric floors the owner's homepage must meet

- A card's top inside the first screen on a phone (390×844 at scroll 0) and the whole featured card, footer included, inside 1440×1000.
- Text at least 12 px on every card, featured or not; tap targets at least 44 px at 390.
- No sideways page scroll; no cut text without a way to read it (Clay's table cells especially).
- Text contrast at least 4.5:1, bars and fills at least 3:1.
- Each featured front draws a different kind of thing; no front leads with "0".
- Every number says its unit and period and matches the series beside it; every sample says it is a sample.
- No raw ISO dates, "stale", "observ" or "artifact" outside the closed disclosure.
- The page makes no off-site requests.

## Gotchas

- A dev server serves the working tree. Note doctor's changed-file count with every capture.
- `next dev` logs two `/api/tally` 503 errors in reference mode; the footer tally is off there. They are not caused by the carousel.
- The slideshow restarts its 8 s turn each time the carousel comes on screen; use Playwright's clock (`page.clock`) to test timing, not real waits.
- Brand fonts for a hidden slide load only when it is shown or next. Wait for `document.fonts.ready` after picking.
- Sample data is invented. Do not "fix" a number by making it look more real without the matching data test in `src/data/homepage-examples.test.ts`.
