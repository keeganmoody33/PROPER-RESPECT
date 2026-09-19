# Hosted release and Clay branding

Verified September 18, 2026 (America/New_York; provider timestamps extend into September 19 UTC).

## Released code and targets

- Application commit: `adfc813268eb0c90a85b6440982315a94a83ab8a`, following merged main `cdbff637947af1d009212e8b5a3853fcdd782d0d`.
- Vercel: `groundskeep/proper-respect`, deployment `dpl_7Um2KmrvNPajDaUyFPgudX6stvn5`, READY.
- Production Convex: `striped-chicken-693`; development: `utmost-mongoose-374`. Both have the Clay correction. Composio WIP was excluded.
- Release upload used a Git archive of the committed source, excluding local credentials and private operator receipts. Git-triggered deployments remain disabled.
- [Collection](https://proper-respect.com/onboarding); [existing public profile](https://proper-respect.com/keegan).

## Domain and authentication

Cloudflare's active `proper-respect.com` zone now has a DNS-only apex CNAME to Vercel's recommended `f71236f5a65331eb.vercel-dns-016.com`. Vercel reports no DNS misconfiguration. HTTPS returns 307 to the same path on `props.lecturesfrom.com`.

This is a working entrance, not a Clerk domain migration. Production Clerk and Convex both use `clerk.props.lecturesfrom.com`. The existing authenticated owner session loads the new collection after reload. Moving the primary authentication host remains separate work.

## Clay diagnosis and fix

Clay was absent from the verified catalog. Manual intake therefore retained an owner-scoped product identity, which the slug-only brand gate rejected. The appearance control silently disappeared for that status.

The catalog now verifies Clay against https://www.clay.com. Existing manual products can use a subsequently verified catalog name plus an exact canonical domain for presentation, without rewriting product IDs, evidence, relationships or history. Mismatched domains/names remain rejected. Unverified products now show an explanation.

The existing private Clay card completed real Context.dev brand, fonts and styleguide requests, all HTTP 200: three logos, five colors, `Roobertvf` typography and a styleguide; no partial result. The retained v2 snapshot reaches the actual card, including its logo. This is brand verification only, not evidence of Clay use.

The existing authorized Context.dev credential is also configured on production without changing encryption keys or Clerk credentials. A production Wispr retrieval completed READY; its retained brand reaches the public-profile projection. Brand retrieval does not change personal claims.

## Checks and preservation

- 36 focused catalog/manual-intake/brand regressions; full suite 404 Vitest passed, one optional private-file skip, plus six Node tests.
- ESLint, strict root TypeScript (including Convex), local production build and Vercel build passed.
- Production schema dry run passed with additive indexes and no index deletion. Convex's optional separate tsconfig is absent; its default `try` mode was used after root TypeScript passed.
- Private production backups before and after synchronization: every existing application table is byte-identical, including the published profile. Subsequent brand retrieval adds presentation records only.
- Real authenticated hosted collection reload passed. Anonymous public query returns exactly four curated cards; anonymous curl retrieves the public page successfully.

## Remaining delivery work

The newer development-only evidence, saved go-to selections and Clay relationship have **not** been copied into production. Preserve both collections. Prepare a scoped, replay-safe transfer bound to the actual production owner, excluding OAuth secrets/cursors and preserving existing curated publication; verify owner choices after hosted reload. Do not copy a development Clerk subject, seed, or replace the database.

No new mailbox read, recurring collection activation, private publication, or Composio activation occurred. Hosted Gmail consent/configuration and an explicitly authorized unattended refresh proof remain open. This release is running software, not closure of the full personal-release acceptance checklist.
