# Fixture public profile

The public page a visitor sees for a published collection. In reference test mode `/keegan` serves a fixed projection (`src/data/get-public-profile.ts`) with a GitHub card, so the real published-card path is driven without any account or backend.

## Sub-features

- `profile-view` renders the owner's heading and published cards.
- `profile-flip` flips a card to its back with cost, links and "How this was measured".
- `profile-legacy` redirects an old URL to the canonical profile with matching metadata.
- `profile-missing` gives an unknown handle a privacy-safe not-found page.
- `profile-report` links to a report address for the page.

## How to get to it (user POV)

- Open `/keegan`.
- Open `/legacy-profile-url`; it lands on `/lecturesfrom`.
- Open a handle that does not exist, such as `/no-such-linker`.

## Driving it with Playwright

Preconditions: doctor exits 0.

- **View.** `page.goto("/keegan")`. Expect `getByRole("heading", { level: 1, name: "Keegan Moody" })` and `getByRole("heading", { name: "GitHub" })`.
- **Uses.** The GitHub card's `getByRole("list", { name: "What I use it for" })` lists "host my code and its history" and "review and merge pull requests".
- **Flip.** `getByRole("button", { name: "Details" }).first()`. The back shows the cost with its as-of date in plain words.
- **Disclosure.** On `.card-back:not([hidden])`, `getByRole("button", { name: "How this was measured" })` shows the exact period.
- **Back.** `getByRole("button", { name: "Close details" })`; focus returns to "Details".
- **Legacy.** `page.goto("/legacy-profile-url")`. Expect the URL to end in `/lecturesfrom`, and exactly one `link[rel="canonical"]` with `https://public.example/lecturesfrom`.
- **Missing.** `page.goto("/no-such-linker")` returns the not-found state without revealing whether the handle was ever used.
- **Proof.** Full-page screenshots at 1280 and 390, the axe result (`@axe-core/playwright`), and `document.documentElement.scrollWidth <= innerWidth`.

## Gotchas

- This is the one place the real card rules (big number, cost line, dates) show on a published card. Changes to `components/product-card.tsx` or `src/domain/` must be checked here as well as on the homepage, because the homepage samples are hand-written and the profile is not.
- `PUBLIC_SITE_ORIGIN` is `https://public.example` in this mode; canonical and share URLs use it. That is expected.
- The fixture has a single owner. It cannot prove anything about other owners' data.
