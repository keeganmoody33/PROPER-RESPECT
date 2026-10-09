import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { MeasurementValue } from "../../components/measurement-values";
import type { Measurement } from "../../src/domain/measurements";

const measurement = {
  metric: "total_tokens", value: "9007199254740993", unit: "tokens",
  period: { kind: "date", start: "2026-10-01", end: "2026-10-07", timezone: "UTC" },
  scope: "DEVICE", coverage: "PARTIAL", temporality: "DELTA", aggregation: "NON_ADDITIVE",
  capturedAt: "2026-10-08T00:00:00.000Z", status: "measured", sample: "owner-supplied",
} as const;

test.each([
  ["SOURCE_REPORTED", "Source-reported value"],
  ["CUMULATIVE_DIFFERENCE", "Derived difference between cumulative captures"],
  ["SUMMED_RESPONSES", "Sum of distinct response counters"],
  ["FUTURE_UNKNOWN", "Derivation unknown"],
])("labels %s without claiming an unknown derivation came from the source", (derivation, label) => {
  const html = renderToStaticMarkup(createElement(MeasurementValue, {
    measurement: { ...measurement, derivation: derivation as Measurement["derivation"] },
  }));
  expect(html).toContain(label);
  if (derivation !== "SOURCE_REPORTED") expect(html).not.toContain("Source-reported value");
});
