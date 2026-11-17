# Option B hero: verification, 17 Nov 2026

All data here is synthetic: homepage sample cards and the fixture page in reference test mode, with no sign-in, no backend and no owner account.

- **Branch.** `public-ready/phase-d`.
- **Server.** `next dev` on 127.0.0.1:3262 with `PROPER_RESPECT_E2E_REFERENCE=1`, serving the working tree that became this branch.
- **Captures.** deviceScaleFactor 1, reduced motion.

| File | What it shows |
| --- | --- |
| `home-1440.png` | The first screen at 1440x1000. GitHub leads. |
| `home-390.png` | A phone's first screen. The header's last item is cut off here; that is fixed in the onboarding phase. |
| `home-1440-dark.png` | The first screen in dark appearance. |
| `page-1440.png` | The fixture tooling page with its new label. |

## Measured by the build agent, before the one yellow change was merged in

- At 390x844 the card's top is at 264px and its number ends at 475px, above the examples bar at 785px.
- At 320x700 the card's top is at 299px.
- At 1440x1000 the five featured cards end at 867px (GitHub), 843px (Elicit), 865px (Cloudflare), 729px (Clay) and 750px (Docker).
- No sideways scroll at 1440, 390 or 320.

The browser specs that enforce these floors passed again on this branch after the merge: 184 tests across ten spec files.
