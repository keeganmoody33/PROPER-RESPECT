import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MeasurementLines, PublicMeasurements } from "@/components/measurement-values";
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
  it("renders exact decimals, grouped in thousands, and nanoseconds without numeric conversion", () => {
    for (const [value, shown] of [["9007199254740993123456789", "9,007,199,254,740,993,123,456,789"], ["0.0000000000000000000000000000000000000000001", "0.0000000000000000000000000000000000000000001"]]) {
      const html = renderToStaticMarkup(createElement(PublicMeasurements, { measurements: [projected(value)] }));
      expect(html).toContain(`>${shown}</strong>`);
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
    // A synthetic sample claims no source: neither a reported nor a derived value.
    expect(html).not.toContain("Derived difference between cumulative captures");
    expect(html).not.toContain("Source-reported value");
    const derived = renderToStaticMarkup(createElement(PublicMeasurements, { measurements: [{ ...projected("1"), derivation: "CUMULATIVE_DIFFERENCE" }] }));
    expect(derived).toContain("Derived difference between cumulative captures");
    const unknown = renderToStaticMarkup(createElement(PublicMeasurements, { measurements: [projected("0")] }));
    expect(unknown).toContain("Sample origin unknown");
  });
  it("on a card's front, keeps what the first number means and leaves how it was recorded to the back", () => {
    const first = { ...projected("2140000"), sample: "synthetic" as const, status: "baseline" as const };
    const html = renderToStaticMarkup(createElement(PublicMeasurements, { measurements: [first, projected("86")], compact: true }));
    // Any one HTML tag, so only the visible text is left: matches "<p>" and "</strong>", leaves "2,140,000" alone.
    // https://regex101.com/?regex=%3C%5B%5E%3E%5D%2B%3E&testString=%3Cp%3E2%2C140%2C000%3C%2Fstrong%3E
    const text = html.replace(/<[^>]+>/g, "|").split("|").filter(Boolean);
    expect(text).toEqual([
      "2,140,000", "input tokens", "Sample", "86", "input tokens",
      "9 Sep 2001 · Rows marked Sample are invented, not account activity; the rest are owner-reported, not verified · includes a baseline, which is not new activity · how each was measured is in Details",
    ]);
  });
  it("on a card's front, decides the sample notice on the numbers it shows", () => {
    const sample = { ...projected("5"), sample: "synthetic" as const };
    const front = (measurements: ReturnType<typeof projected>[]) => renderToStaticMarkup(createElement(PublicMeasurements, { measurements, compact: true }))
      // Any one HTML tag, so only the visible text is left: matches "<p>" and "</strong>", leaves "2,140,000" alone.
      // https://regex101.com/?regex=%3C%5B%5E%3E%5D%2B%3E&testString=%3Cp%3E2%2C140%2C000%3C%2Fstrong%3E
      .replace(/<[^>]+>/g, "|").split("|").filter(Boolean);
    // Three sample rows shown and an owner's row left to Details: the shown numbers are all samples.
    expect(front([sample, sample, sample, projected("7")])).toEqual([
      // One shared period is said once, in the note, rather than under each number.
      "5", "input tokens", "5", "input tokens", "5", "input tokens",
      "9 Sep 2001 · Sample numbers · 1 more and how each was measured are in Details",
    ]);
    // Owner's rows shown and a sample left to Details: no sample is on the front, and Details labels it.
    expect(front([projected("7"), projected("7"), projected("7"), sample]).at(-1)).toBe("9 Sep 2001 · Owner-reported, not verified · 1 more and how each was measured are in Details");
    // Different periods stay under their own numbers.
    const later = { ...projected("8"), period: { kind: "date" as const, start: "2026-01-01", end: "2026-08-31", timezone: "UTC" } };
    expect(front([projected("7"), later])).toEqual(["7", "input tokens", "9 Sep 2001", "8", "input tokens", "Jan–Aug 2026", "Owner-reported, not verified · how each was measured is in Details"]);
  });

  it("names the unit unless the metric already says it as a whole word, and says baseline on the back's plain line too", () => {
    const row = (metric: string, unit: string) => ({ ...projected("2"), metric, unit });
    const front = renderToStaticMarkup(createElement(PublicMeasurements, { measurements: [row("response_time", "s"), row("input_tokens", "tokens"), row("enriched", "rows")], compact: true }));
    expect(front).toContain("<span>s response time</span>");
    expect(front).toContain("<span>input tokens</span>");
    expect(front).toContain("<span>rows enriched</span>");
    const back = renderToStaticMarkup(createElement(MeasurementLines, { measurements: [{ ...row("input_tokens", "tokens"), status: "baseline" }] }));
    expect(back).toContain("baseline, not new activity");
  });
});

