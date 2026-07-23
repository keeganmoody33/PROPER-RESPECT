# Domain docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root.
- **`docs/adr/`** for decisions that touch the area being changed.

If a referenced document does not exist, proceed silently. Do not suggest creating documentation upfront. The `domain-modeling` skill, reached through skills such as `grill-with-docs`, creates or updates domain documentation when terms or decisions are actually resolved.

## File structure

PROPER-RESPECT is a single-context repository:

```text
/
├── CONTEXT.md
├── docs/
│   └── adr/
└── src/
```

## Use the glossary's vocabulary

When output names a domain concept—in an issue title, specification, refactor proposal, hypothesis, test name, or implementation—use the term defined in `CONTEXT.md`.

Core terms include **Linker**, **Visitor**, **Product Stack**, **Prop**, **Proof**, **Lineage**, and **Put On By**. Do not drift to synonyms that the glossary explicitly rejects.

If a needed concept is absent from the glossary, reconsider whether the language belongs to the product or note the gap for `domain-modeling`.

## Flag ADR conflicts

If proposed work contradicts an existing ADR, surface the conflict explicitly rather than silently overriding the decision.
