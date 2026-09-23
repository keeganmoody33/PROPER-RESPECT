# Exact product logos — 2026-09-22

Base: 19ed17012397c4e2bcca1a8ae9ac59da0fa5314e. Bounded bug-fix workflow; no child delegation per root scope.

1. Reproduce it yourself on the matching surface via the control skill (Non-negotiables). Reproduce both initials in the existing synthetic ProductCard browser harness at localhost:8852 before adding registry entries.
2. Binary-search the cause. Exact product-icons registry has Clay/Wispr only; the larger verified-product-assets registry is Copilot typography/wordmarks. Root cause is absent exact-product icon records, not failed remote rendering.
3. Plan the fix. Compare extending Copilot's font/archive schema against two simple dated app-icon records. Choose existing product-icons structure: slug/domain identity, source URL/page, asset path/dimensions/hash and verification time. Keep its strict matching and existing failed-image fallback. Model the Domain selected an existing registry rather than new branching.
4. Verify on the same surface. Exercise light/dark cards at desktop/mobile high density, exact identities and mismatches, image failure and no external requests.
5. Stage the commits so the failing repro lands before the fix in git history. RED browser/unit evidence captured before the asset registry changes. Stage the browser regression first, then the registry/assets and passing verification in a follow-up commit.
6. Run Opening a PR. Root owns PR creation and independent review; child commits only.

Throughput checkpoint: public provenance research precedes registry mutation. Asset proof and focused browser tests are the next gates. No public source artwork is ownership/usage evidence. No account, provider, backend, deployment or publication operations.

Status: both exact assets verified; RED reproduced; focused units 10/10 and real Chromium fixture 7/7 pass. TypeScript and focused lint pass. Desktop/mobile 3× light/dark screenshots visually inspected. Root owns independent review and hosted acceptance.
