import { describe, expect, it } from "vitest";
import { reportHref } from "./report-link";

describe("reportHref", () => {
  it("keeps a plain subject", () => {
    expect(reportHref("Report credit on proper-respect.com/ada · card 2")).toBe(
      "mailto:33@lecturesfrom.com?subject=Report%20credit%20on%20proper-respect.com%2Fada%20%C2%B7%20card%202",
    );
  });

  it("turns line breaks and other control characters into one space, so a subject can't add mail headers", () => {
    expect(reportHref("Clay\r\nBcc: someone@example.com\u{2028}x\u0000y\ttab")).toBe(
      "mailto:33@lecturesfrom.com?subject=Clay%20Bcc%3A%20someone%40example.com%20x%20y%20tab",
    );
  });
});
