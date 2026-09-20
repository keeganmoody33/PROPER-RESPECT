# Retained mailbox recognition

Updated: 2026-09-19. Continues Task 2 in
[the existing Ref](https://plan.ref.tools/oUl8LCIQb32SAicK).

## Observed delivery gap

The deployed catalog recognizes 16 products. The two authorized hosted discovery
runs retained 969 unmatched header records. Later catalog recognition previously
required encountering those messages again during another provider read. The
unmatched inbox could attach individual headers manually, but could not recheck
the retained collection against newly verified catalog identities.

## Implemented path

The catalog gains [20 verified identities](2026-09-19-catalog-identities.md).
An authenticated mutation revisits at most ten owned pending records per page.
One explicit application action processes at most 100 pages, with progress,
stop, retry and continuation controls. This is retained-data processing; it does
not read Gmail or restart either terminal discovery run.

Classification uses the existing separate proposal path. Original payloads,
capture times, source/account identity, attribution and observations remain
unchanged. Source refresh timestamps and provider cursors are not advanced.
Disconnected accounts can still contribute permitted retained history. Dismissed
and owner-linked headers are excluded. Rejected drafts stay rejected; ambiguous
relationships require an owner target. Neither a match nor brand preparation
confirms product use, chooses Go-to, or publishes a card.

The existing brand preparation can retrieve public presentation metadata for new
displayable products. This is separate from mailbox or usage collection. Missing
brand data keeps the existing fallback behavior.

## Verification evidence

An optional local Convex test loads a private snapshot of the real retained
headers into disposable in-memory storage with a synthetic owner. Original
provider payloads and provenance are preserved; database references are remapped.
No production credentials are imported and network access is blocked. Private
inputs and machine receipts remain outside Git.

Command (replace the private path locally):

```sh
PROPER_RESPECT_RETAINED_MAILBOX_TEST_INPUT=/private/path/retained-recheck-local-input.json npx vitest run convex/mailboxRetainedRecheck.local.test.ts
```

The first pass examined 969 retained records, matched 118 headers and produced
20 distinct pending product candidates. A complete replay created zero new
drafts and left candidate/proof contents unchanged. Thirty-four assertions pass,
including original evidence, source freshness, account state, review status,
empty publication/history changes and zero network calls. These are local
results using actual retained metadata, not twenty confirmed owner relationships
or a claim that those candidates already exist on the hosted application.

## Final checks

- `npm test`: 590 Vitest tests pass; two optional private-input tests skip in the
  ordinary run. All six Node checks pass.
- The private retained-mailbox test above passes separately against the final
  implementation, with 969 originals and a full replay.
- `npm run lint`, `npm run typecheck`, and `npm run build` pass.
- `npx playwright test --config tests/e2e/components.config.ts`: all 16 component
  checks pass. Recheck coverage includes 390px/1280px rendering, keyboard start,
  failed-page retry, the 100-page cap and continuation. Screenshots inspected.
- Independent backend review found one unbounded proof scan. It now uses the
  existing exact product/evidence index; a mature-history regression preserves
  201 prior proofs and inserts one new proof once. Follow-up review found no
  remaining blocking issue in its scope. The reviewer shares the parent model.
- A nonempty published fixture snapshot, saved relationship and explicit link
  remain byte-identical after recheck and replay. No live publication was used
  to exercise this test.

## Release boundary

Production remains on `5a0b77f`, development on `a2539b9`. This work has not been
synchronized, deployed or executed against hosted records. Both approved mailbox
runs remain terminal and their authorization is exhausted. Existing saved choices
and the old public snapshot remain authoritative. Any release and hosted retained
recheck require their exact target/scope approval; publication remains separate.

The remaining 851 headers are unresolved by this catalog expansion. They include
non-product correspondence and identities needing more work. They are not 851
missing products. Partial historical coverage, fresh sign-in, final owner review,
selected sharing preview and signed-out publication acceptance remain open.
