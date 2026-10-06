import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicMeasurements } from "@/components/measurement-values";
import { parseMeasurementImport, projectMeasurement, reviewMeasurementImports } from "@/src/domain/measurements";

function projected(value: string | null) {
  const parsed = parseMeasurementImport(JSON.stringify({
    format: "proper-measurements-v1", captureId: "rendering-check", capturedAt: "2026-10-06T10:00:00.000Z",
    source: { namespace: "test", identityBasis: "OWNER_SUPPLIED", sourceAlias: "private-source", ownerAlias: "private-owner", accountAlias: "private-account", workspaceAlias: "private-workspace", deviceAlias: "private-device" },
    measurements: [{ id: "tokens", metric: "input_tokens", value, unit: "tokens", period: { kind: "instant", startUnixNano: "1000000000000000001", endUnixNano: "1000000000000000002" }, scope: "WORKSPACE", coverage: "PARTIAL", temporality: "SNAPSHOT", aggregation: "NON_ADDITIVE", overlapGroup: "private-overlap" }],
  }));
  return projectMeasurement(reviewMeasurementImports([parsed])[0]);
}

describe("exact public measurement rendering", () => {
  it("renders exact decimals and nanoseconds without numeric conversion", () => {
    for (const value of ["9007199254740993123456789", "0.0000000000000000000000000000000000000000001"]) {
      const html = renderToStaticMarkup(createElement(PublicMeasurements, { measurements: [projected(value)] }));
      expect(html).toContain(value);
      expect(html).toContain("1000000000000000001 to 1000000000000000002 ns since Unix epoch");
      expect(html).toContain("Scope: workspace · Coverage: partial");
      expect(html).toContain("Do not add to other views");
      for (const secret of ["private-source", "private-owner", "private-account", "private-workspace", "private-device", "private-overlap"]) expect(html).not.toContain(secret);
    }
  });
  it("does not turn unknown into zero or hide zero", () => {
    const zero = renderToStaticMarkup(createElement(PublicMeasurements, { measurements: [projected("0")] }));
    const unknown = renderToStaticMarkup(createElement(PublicMeasurements, { measurements: [projected(null)] }));
    expect(zero).toMatch(/<strong[^>]*>0<\/strong>/);
    expect(unknown).toMatch(/<strong[^>]*>Unknown<\/strong>/);
    expect(unknown).not.toMatch(/<strong[^>]*>0<\/strong>/);
  });
  it("labels synthetic samples and derived cumulative differences", () => {
    const html = renderToStaticMarkup(createElement(PublicMeasurements, { measurements: [{ ...projected("1"), sample: "synthetic", derivation: "CUMULATIVE_DIFFERENCE" }] }));
    expect(html).toContain("Synthetic sample. Not real account activity.");
    expect(html).toContain("Derived difference between cumulative captures");
    const unknown = renderToStaticMarkup(createElement(PublicMeasurements, { measurements: [projected("0")] }));
    expect(unknown).toContain("Sample origin unknown");
  });

});
