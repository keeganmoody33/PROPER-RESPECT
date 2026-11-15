import { expect, test } from "vitest";
import { TABLE_PREVIEW_LIMITS, tablePreview } from "./table-preview";

const cell = (text: string) => ({ text });
const valid = { caption: "Lead list", columns: ["Company", "Status"], rows: [[cell("Northwind Labs"), { text: "Enriched", state: "filled" }]] };
const plainColumn = (label: string) => ({ label, enriched: false });

test("a table preview is a caption, a few named columns and short rows of short cells", () => {
  expect(TABLE_PREVIEW_LIMITS).toEqual({ columns: 4, rows: 8, text: 40, caption: 80 });
  // A caption can say where the list came from, past a cell's length.
  expect(tablePreview({ ...valid, caption: "Lead list · from a job-change signal · invented sample rows" })?.caption).toBe("Lead list · from a job-change signal · invented sample rows");
  expect(tablePreview(valid)).toEqual({ ...valid, columns: [plainColumn("Company"), plainColumn("Status")] });
});

test("a column can be marked enriched; a cell can carry a second line; a pending cell can say what it fills in with", () => {
  const table = {
    caption: "Lead list",
    columns: [{ label: "Person" }, { label: "Status", enriched: true }],
    rows: [[{ text: "Mo Okafor", detail: "Sales Director, Quillon" }, { text: "Running", state: "pending", fillsIn: { text: "Found", state: "filled" } }]],
  };
  expect(tablePreview(table)).toEqual({ ...table, columns: [plainColumn("Person"), { label: "Status", enriched: true }] });
  // A column written for an older card that left it out on a narrow screen still reads; every column now shows.
  expect(tablePreview({ ...table, columns: [{ label: "Person", droppable: true }, "Status"] })?.columns).toEqual([plainColumn("Person"), plainColumn("Status")]);
});

test("anything past the caps, a ragged row or an empty cell is refused rather than drawn", () => {
  const refused = [
    { ...valid, columns: ["A", "B", "C", "D", "E"], rows: [["a", "b", "c", "d", "e"].map(cell)] },
    { ...valid, rows: Array.from({ length: 9 }, () => [cell("a"), cell("b")]) },
    { ...valid, columns: [{ label: "Company", kind: "spreadsheet" }, "Status"] },
    { ...valid, rows: [[cell("a"), { text: "Enriched", state: "filled", waterfall: { step: 4, of: 3 } }]] },
    { ...valid, frontRows: 2 },
    { ...valid, totalRows: 0 },
    { ...valid, rows: [[cell("x".repeat(41)), cell("b")]] },
    { ...valid, rows: [[cell("only one")]] },
    { ...valid, rows: [[cell(""), cell("b")]] },
    { ...valid, rows: [[cell("a"), { text: "b", state: "glowing" }]] },
    { ...valid, caption: "" },
    { ...valid, caption: "x".repeat(81) },
    { ...valid, columns: [{ label: "" }, "Status"] },
    { ...valid, rows: [[cell("a"), { text: "b", state: "pending", fillsIn: { text: "", state: "filled" } }]] },
    { ...valid, rows: [[{ text: "a", detail: "x".repeat(41) }, cell("b")]] },
    { ...valid, summary: "x".repeat(81) },
  ];
  expect(refused.map(tablePreview)).toEqual(refused.map(() => undefined));
});

test("a column can say what kind it is, a waterfall cell which provider answered, and the table how many rows it really has and what they came to", () => {
  const table = {
    caption: "Lead list",
    columns: [{ label: "Company", kind: "text" }, { label: "Email waterfall", kind: "waterfall", enriched: true }, { label: "AI: signal", kind: "ai" }],
    rows: [
      [cell("Nimbus"), { text: "Enriched", state: "filled", waterfall: { step: 2, of: 3 } }, { text: "Series B", state: "filled" }],
      [cell("Quillon"), { text: "Running", state: "pending", waterfall: { step: 2, of: 3 }, fillsIn: { text: "Enriched", state: "filled", waterfall: { step: 3, of: 3 } } }, { text: "Running", state: "pending" }],
    ],
    frontRows: 1, totalRows: 214, summary: "171 of 214 emails found · 80% · 3-provider waterfall · 2.3 credits a row",
  };
  expect(tablePreview(table)).toEqual({
    ...table,
    columns: [
      { label: "Company", kind: "text", enriched: false },
      { label: "Email waterfall", kind: "waterfall", enriched: true },
      { label: "AI: signal", kind: "ai", enriched: false },
    ],
  });
});
