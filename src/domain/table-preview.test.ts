import { expect, test } from "vitest";
import { TABLE_PREVIEW_LIMITS, tablePreview } from "./table-preview";

const cell = (text: string) => ({ text });
const valid = { caption: "Lead list", columns: ["Company", "Status"], rows: [[cell("Northwind Labs"), { text: "Enriched", state: "filled" }]] };
const plainColumn = (label: string) => ({ label, droppable: false, enriched: false });

test("a table preview is a caption, a few named columns and short rows of short cells", () => {
  expect(TABLE_PREVIEW_LIMITS).toEqual({ columns: 4, rows: 6, text: 40 });
  expect(tablePreview(valid)).toEqual({ ...valid, columns: [plainColumn("Company"), plainColumn("Status")] });
});

test("a column can be marked enriched, or droppable on a narrow card; a pending cell can say what it fills in with", () => {
  const table = {
    caption: "Lead list",
    columns: ["Company", { label: "Domain", droppable: true }, { label: "Status", enriched: true }],
    rows: [[cell("Quillon Health"), cell("quillon.example"), { text: "Running", state: "pending", fillsIn: { text: "Enriched", state: "filled" } }]],
  };
  expect(tablePreview(table)).toEqual({
    ...table,
    columns: [plainColumn("Company"), { label: "Domain", droppable: true, enriched: false }, { label: "Status", droppable: false, enriched: true }],
  });
});

test("anything past the caps, a ragged row or an empty cell is refused rather than drawn", () => {
  const refused = [
    { ...valid, columns: ["A", "B", "C", "D", "E"], rows: [["a", "b", "c", "d", "e"].map(cell)] },
    { ...valid, rows: Array.from({ length: 7 }, () => [cell("a"), cell("b")]) },
    { ...valid, rows: [[cell("x".repeat(41)), cell("b")]] },
    { ...valid, rows: [[cell("only one")]] },
    { ...valid, rows: [[cell(""), cell("b")]] },
    { ...valid, rows: [[cell("a"), { text: "b", state: "glowing" }]] },
    { ...valid, caption: "" },
    { ...valid, columns: [{ label: "" }, "Status"] },
    { ...valid, rows: [[cell("a"), { text: "b", state: "pending", fillsIn: { text: "", state: "filled" } }]] },
  ];
  expect(refused.map(tablePreview)).toEqual(refused.map(() => undefined));
});
