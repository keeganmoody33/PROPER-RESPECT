import { describe, expect, it } from "vitest";
import { getProductCardPresentation } from "./product-card-presentation";

describe("getProductCardPresentation", () => {
  it("gives each canonical starter card a distinct index and mark", () => {
    const names = ["GitHub", "Wispr Flow", "NotebookLM", "Devin Desktop"];

    expect(
      names.map((name, index) => getProductCardPresentation(name, index)),
    ).toEqual([
      { index: "01", mark: "GH" },
      { index: "02", mark: "WF" },
      { index: "03", mark: "NL" },
      { index: "04", mark: "DD" },
    ]);
  });
});
