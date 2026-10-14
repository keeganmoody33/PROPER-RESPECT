# Recovery state

Updated: 2026-10-14. Labels: VERIFIED-RUNTIME, VERIFIED-TEST, IN-CODE, CLAIMED,
UNKNOWN (definitions in the recovery brief, section 3).

Production runs tag `v0.2.7` (2026-10-06). `main` is 66 commits past it, so
anything verified on `main` is at most VERIFIED-TEST for production.

## Corrections to the brief's ground truth (notes of 2026-10-12)

| Note | Finding | Evidence |
| --- | --- | --- |
| Main is 21 commits past the last release | 66 commits past `v0.2.7` | `git log v0.2.7..origin/main` on 2026-10-14 |
| #173 and #174 are open | Both merged 2026-10-12 | `gh pr list --state merged` |
| ADRs run at least to 028 | They run to 061; 028 is `docs/adr/028-chrome-extension.md` | `ls docs/adr` |
| Releases v0.2.5 to v0.2.7 | Tags only; `gh release list` returns nothing | `git tag`, `gh release list` |
| Affiliate taxonomy doc committed | Not found on any branch; the nearest work is #181, "disclose stored affiliate links and gate props" | `git log --all -- '*affiliate*' '*taxonomy*' '*referral*'` |

## Core usage signal: daily GitHub refresh

- **VERIFIED-RUNTIME: production's GitHub calendar card has been stale since
  2026-10-09 06:00 UTC.** The scheduled freshness check appends one line a day to
  `receipts/github-refresh.jsonl` on the `receipts` branch. It reports
  `ok=false` every day from 2026-10-01 to 2026-10-14 except 2026-10-09. On
  2026-10-14 the card for handle `lecturesfrom` was 127.8 hours old against a
  36-hour limit.
- UNKNOWN: why the refresh fails. Each failure is logged with a category in
  Convex production logs, which this session can't read yet.
- IN-CODE, released: #142 (classifies refresh failures, 2026-10-01) and #150
  (binds refresh consent to account generations, 2026-10-06) are both in `v0.2.7`.
