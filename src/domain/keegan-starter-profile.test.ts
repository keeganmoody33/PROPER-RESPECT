import { describe, expect, it } from "vitest";
import { KEEGAN_STARTER_CARDS } from "./keegan-starter-profile";

describe("Keegan's starter profile", () => {
  it("publishes exactly the four agreed canonical product cards", () => {
    expect(KEEGAN_STARTER_CARDS.map((card) => card.product.name)).toEqual([
      "GitHub",
      "Wispr Flow",
      "NotebookLM",
      "Devin Desktop",
    ]);
    expect(KEEGAN_STARTER_CARDS[2].product.description).toContain(
      "Gemini Notebook",
    );
    expect(KEEGAN_STARTER_CARDS[3].product.description).toContain("Windsurf");
  });
});
