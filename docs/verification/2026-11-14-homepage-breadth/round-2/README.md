# Homepage breadth, round 2

Captured 2026-11-14 from this checkout's own `next dev` on port 3217, at commit
`0e47483c0c3b72cb43e9ff6de3c08c9790111fd3`, with no uncommitted changes under
`app`, `components`, `src` or `next.config.ts`. `capture.mjs` checked that the
listening process's working directory is this checkout before it took any
picture, and `capture.json` holds that proof with each value it read off the
page. Every picture is at deviceScaleFactor 2, with reduced motion. Each was
looked at by eye before it was marked below.

Rerun: `node docs/verification/2026-11-14-homepage-breadth/round-2/capture.mjs --base http://127.0.0.1:<port>`
against a dev server started from this checkout.

| Target | File | Result | What it shows |
| --- | --- | --- | --- |
| Chooser at 1440 | `chooser-1440.png` | passed | GitHub, then Clay, then Claude Code |
| Chooser at 390 | `chooser-390.png` | passed | GitHub, then Clay, then Claude Code |
| Clay front at 1440 | `clay-front-1440.png` | passed | "Enriched", "2,140,000", "Rows": the unit said once |
| Clay front at 390 | `clay-front-390.png` | passed | The same, with no sideways scroll |
| Clay back at 1440 | `clay-back-1440.png` | passed | 2,140,000 Rows, 86 Tables, 48,500 Credits |
| Clay back at 390 | `clay-back-390.png` | passed | The same three rows |
| Docker front at 1440 | `docker-front-1440.png` | passed | "3 artifacts", then three linked works, then coverage |
| Docker front at 390 | `docker-front-390.png` | passed | The same; the first title wraps onto two lines |

The round dot at the bottom left of the 390 pictures is Next's development
indicator. It is not part of the page.
