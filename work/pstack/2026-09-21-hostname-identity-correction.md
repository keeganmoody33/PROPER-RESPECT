# Hostname identity correction — 2026-09-21

Existing issue #24 / PR #28 only. Reviewed head
`bfb0e2eed99288192b1662ec746bd06d51afdfb0`; observed main
`3a1413f3deb34c417cb9bdbdbfa4d34096e47e77`. Work proceeds on the existing PR
history in an isolated checkout; no merge, rebase, data migration or deployment.

pstack Prove It Works steps:

1. Build it (necessary but not sufficient)
2. Run it and exercise the actual feature path
3. Check the full chain: does data flow from input to output?
4. For integrations, test the full communication path end-to-end

Status: two RED regressions at `dc48b20` show DNS-label/hyphen collision and
rejection of a valid long hostname's generated key by the public-card contract.
Correction hashes the normalized full hostname with SHA-256, retaining 128 bits
under a `host-` namespace (37 characters). Catalog identities remain unchanged.
Use pinned @noble/hashes for synchronous isomorphic hashing; avoid a custom hash
or Node-only import in the Convex/browser domain module. Existing stored keys
are not rewritten. This is collision-resistant, not a mathematical uniqueness
guarantee; the existing ingestion domain-conflict guard remains in place.

Focused tests now pass. Full source verification and browser fixtures are
recorded in the receipt. Real provider/hosted persistence is not exercised:
operational authorization is separate from this source correction. No stored
mixed drafts are automatically split, published or attached to different owners.
