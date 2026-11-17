# Search and tool pages: screenshots, 17 Nov 2026

Synthetic data: fixture mode (`PROPER_RESPECT_E2E_REFERENCE=1`) with no sign-in and no backend. The listed pages are the reference page at `/lecturesfrom` and two invented people, Synthetic Sam and Synthetic Ria (`src/data/e2e-search-profiles.ts`). Light theme. Captured by `tests/e2e/search.spec.ts`, "screenshots of search and a tool page, light, at 1280 and 390".

| File | What it shows |
| --- | --- |
| `search-people-1280.png`, `search-people-390.png` | `/search` with no search: the People tab, listed people A to Z. |
| `search-1280.png`, `search-390.png` | `/search?q=clay&tab=tools`: the Tools tab with Clay and how many people list it, now and before. |
| `tool-clay-1280.png`, `tool-clay-390.png` | `/tools/clay`: Uses it now (Synthetic Sam, Daily) and Used before (Synthetic Ria, Stopped using), each linking to their page. |

On a 390 phone the site header's own navigation runs past the edge and scrolls sideways inside itself; that header belongs to the site frame, not to these pages.
