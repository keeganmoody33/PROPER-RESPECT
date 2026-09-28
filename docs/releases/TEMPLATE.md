# Release vX.Y.Z

Copy this file to `docs/releases/vX.Y.Z.md` for each release. The owner runs
every step. Setup (GitHub environments, secrets, `PUBLIC_HANDLE`) is in
[v0.2.0.md](v0.2.0.md#one-time-setup).

1. **Undo a rollback first.** If production was rolled back since the last
   release, promote the deployment you want live before tagging, or the new
   deployment won't take the production domain:

   Use the pinned CLI from `release-tools/`, the same version the release
   workflow runs, not one fetched at run time:

   ```sh
   npm ci --ignore-scripts --prefix release-tools
   release-tools/node_modules/.bin/vercel promote <deployment-url>
   ```

2. **Tag the release** on a commit that is on `main`:

   ```sh
   git fetch origin && git checkout origin/main
   git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z
   ```

3. **Approve `backend`** in the Actions run. It deploys Convex and records
   `DEPLOYED_SHA`.
4. **Run any migration this release lists** (none by default), dry run first.
5. **Approve `frontend`.** It deploys, checks the production alias, and smoke
   tests `/`, `/$PUBLIC_HANDLE` and `/sitemap.xml`.
6. **Verify** signed out, then signed in as the owner.
7. **Check the refresh receipt.** Decide whether this release restarts the
   30-day receipt count (brief Section 10) and note it here.

If the frontend fails, use Vercel Instant Rollback and keep the backend. Never
reseed or run a destructive backend rollback.
