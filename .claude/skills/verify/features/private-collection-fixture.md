# Fixture private collection

The owner's private collection editor, rendered from synthetic data at `/evidence-fixture/inventory` (development and reference test mode only). It exercises review, correction and save flows without an account; saves are recorded in a visible synthetic log, never stored.

## Sub-features

- `collection-focus` opens one relationship for editing.
- `collection-correct` corrects extracted evidence without touching the relationship.
- `collection-date` uses an observed date as the start date.
- `collection-uses` answers "What does <product> do for you?".
- `collection-import` retains a prepared evidence file privately and reviews the discovery.

## How to get to it (user POV)

- Open `/evidence-fixture/inventory`. A signed-in owner reaches the real editor at `/app/collection`, which this skill cannot drive.

## Driving it with Playwright

Preconditions: doctor exits 0.

- **Focus.** `getByRole("button", { name: "Open focused relationship", exact: true })`. Expect `getByRole("region", { name: "Example Tool", exact: true })` with its heading focused.
- **Correct evidence.** In that region, open "Inspect extracted claims and correct evidence", fill `getByRole("textbox", { name: "Corrected observation text" })`, choose "Correct synthetic evidence". Expect "Synthetic evidence corrected. No relationship saved." and an empty `getByLabel("Synthetic save operations")`.
- **Start date.** `getByRole("button", { name: "Use this observed date as my start date" })` fills `getByLabel("Started using (optional)")` and shows "Unsaved".
- **Save.** `getByRole("button", { name: "Confirm and save privately" })`; the synthetic save log records one operation.
- **Import.** Open "Bring in retained evidence", `getByLabel("Prepared evidence files").setInputFiles(...)` with a synthetic JSON file, then "Retain privately" and "Review this discovery".
- **Proof.** Screenshot before and after each save, plus the text of the synthetic save log as the side effect.

## Gotchas

- The appearance control is in the banner: `getByRole("banner").getByRole("combobox", { name: "Appearance" })`. Test light and dark when styling changes.
- Nothing here reaches Convex. A save proven here proves the form and its validation, not storage; say so.
- Use only synthetic file contents for imports. Never upload a real mailbox export or receipt.
