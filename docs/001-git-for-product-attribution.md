# 001 - Git For Product Attribution

> The core mental model. PROPER-RESPECT is to product adoption what Git is to code authorship.
> Updated: 2026-06-08.

## The Analogy

Git answered a deceptively simple question: *who changed what, when, and why, and how do we agree on the shared version?* PROPER-RESPECT asks the same question about products instead of code:

- Git tracks **authorship of code changes**.
- PROPER-RESPECT tracks **authorship of product adoption**.

A person's relationship to a product is a record worth versioning: when they started using it, the proof they actually use it, who put them on, and the link they want clicked.

## Mapping Table

| Git | PROPER-RESPECT | Notes |
| --- | --- | --- |
| Commit | A published product card (Prop) | A committed record of a person's relationship to a product. |
| Author / committer | The Linker | The person who owns the adoption record. |
| Working directory (uncommitted) | Raw evidence | Imported/captured data that is not yet shaped into anything public. |
| Staged changes (`git add`) | Draft imports / draft props | Candidates waiting for the user to review and approve. |
| Commit message | Headline + note on a card | Why this product matters to the Linker. |
| `git blame` / authorship lineage | "Put on by" lineage | Attribution of who or what introduced the product. |
| Merge to `main` | Publishing a curated profile | The public, agreed-upon version of the stack. |
| Branch | A private draft profile / work-in-progress curation | Where curation happens before it is public. |
| `.gitignore` / never-committed files | Rejected or private evidence | Raw data the user chooses never to publish. |
| Diff | The change between a draft and what is published | What approval will actually add or change. |
| Remote of record | The published profile | The canonical thing Visitors see. |

## Why This Framing Helps Engineering

1. **A hard staging boundary.** Just as Git separates the working tree, the index, and committed history, PROPER-RESPECT separates raw evidence, staged drafts, and published cards. Nothing crosses a boundary without an explicit user action. This is the manual-first rule expressed as architecture.
2. **Append-only history.** Adoption history is preserved. A product going Archived is like a later commit, not a deletion. Rebrands and sunsets keep history continuous (see `../docs/adr/008-product-rebrand-handling.md`, `../docs/adr/033-product-sunset.md`).
3. **Attribution is first-class.** Lineage ("put on by") is `blame` for adoption. It is allowed to be self-attested, and it can point at people/content that are not on the platform (floating lineage, `../docs/adr/013-floating-lineage.md`).
4. **Transformations, not magic.** Each step is an explicit, testable transformation:

```text
RawEvidence  ->  DraftProp  ->  CuratedProp  ->  PublishedProfile
(working)        (staged)       (committed)      (merged to main)
```

The user is the only actor allowed to advance evidence from one stage to the next. Automation can populate `RawEvidence` and propose `DraftProp`s, but it can never merge to `main`.

## What This Analogy Is NOT

- It does not imply distributed sync, conflict resolution UX, or a literal DAG of commits in V1.
- It does not mean we expose Git-like jargon to users. Users see "drafts" and "publish", not "stage" and "merge".
- It is a design compass for keeping raw data separate from curated data and keeping the user in control of what becomes public.

## Related

- `000-current-product-thesis.md`
- `004-v1-technical-contract.md` - where this pipeline becomes concrete types
