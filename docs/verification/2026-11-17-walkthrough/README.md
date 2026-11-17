# Walkthrough screenshots, 17 Nov 2026

Synthetic data only. These come from `tests/e2e/walkthrough.spec.ts` running the real onboarding page over the synthetic Convex boundary in `tests/e2e/fixtures/fresh-user-backend.js`. No account, Convex deployment, Clerk session or provider was used, and nothing was published anywhere.

The account picks Claude Code, Clay and Cursor in the stack builder, then goes through them: Claude Code as Daily with two uses and the suggested line kept, Clay as Stopped using with a typed line, Cursor as Never used it.

| File | Screen |
| --- | --- |
| `first-tool-390.png`, `first-tool-1280.png` | The first tool, with the level the stack save gave it already selected |
| `uses-and-line-390.png`, `uses-and-line-1280.png` | Daily, two uses picked, and the suggested line with "Keep this line and go on" |
| `end-390.png`, `end-1280.png` | "Here's your page": the two tools said yes to, their lines, and Cursor removed |

To make them again:

```sh
WALKTHROUGH_SCREENSHOTS=docs/verification/2026-11-17-walkthrough npx playwright test --config tests/e2e/components.config.ts walkthrough.spec.ts
```
