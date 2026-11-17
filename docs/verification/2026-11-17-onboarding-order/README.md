# Onboarding order, 17 Nov 2026

Full-page screenshots of the signed-in collection page, taken by
`tests/e2e/first-result.spec.ts` ("signed in, the page reads stack, collection,
handle, sharing, then sources") with
`ONBOARDING_ORDER_SCREENSHOTS=docs/verification/2026-11-17-onboarding-order`
under `tests/e2e/components.config.ts`.

**All data is synthetic.** The page runs against the fresh-user fixture
(`tests/e2e/fixtures/fresh-user-backend.js`) with two made-up saved tools,
"Field Notes" and "Sketchpad", and a synthetic owner. No account, backend or
real usage was read, and nothing was published.
The fixture renders without a public origin, so the with-handle shots show
the page address as a path (`/synthetic-stack`); the live site shows the full
address.

| File | Viewport | Handle |
| --- | --- | --- |
| `collection-no-handle-390x844.png` | 390 x 844 | none chosen yet |
| `collection-with-handle-390x844.png` | 390 x 844 | `synthetic-stack`, not published |
| `collection-no-handle-1280x900.png` | 1280 x 900 | none chosen yet |
| `collection-with-handle-1280x900.png` | 1280 x 900 | `synthetic-stack`, not published |

Order as rendered, top to bottom: Your collection, Build your stack, My
collection, Add a tool, Choose your handle (or Your page address), Choose what
to share, Bring in supporting context, Download your data.

The same test checks, at both widths: no sideways scroll, every visible
control in the page at least 44px tall, measuring a checkbox or radio by its
label (links inside a sentence excepted), and
the handle field visible without opening anything when no handle is chosen.
