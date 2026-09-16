# Local Lighthouse measurements

Measured 2026-09-16 using Lighthouse against the standalone production build served at 127.0.0.1:4320. Default mobile lab configuration; local Chrome, not a deployed production service.

| Variant | Performance | Accessibility | LCP | CLS | Total blocking time |
| --- | ---: | ---: | ---: | ---: | ---: |
| Connection studio | 96 | 100 | 2.1 s | 0.07 | 0 ms |
| Living collection | 96 | 100 | 2.3 s | 0.01 | 0 ms |

Raw records: `lighthouse-studio-build-2026-09-16.json` and `lighthouse-collection-build-2026-09-16.json`.

The earlier development-server runs are retained as `*-dev-*`. They scored 50 and 54 for performance under mobile throttling with unbundled development dependencies; they do not represent the built artifact. Their accessible-name mismatch on the wordmark was corrected so its visible text is included in its accessible name. Both build reports confirm that check passes.

Lighthouse is a single local lab run per variant, not a guarantee of field performance, real-user interaction latency, or full accessibility conformance.
