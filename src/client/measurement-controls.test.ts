import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { expect, it, vi } from "vitest";
import { PrivateMeasurements } from "../../components/measurement-review";
import type { Id } from "../../convex/_generated/dataModel";

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useQuery: () => [{
    rawEvidenceId: "fixture-evidence", digest: "fixture-digest", capturedAt: "2026-10-06T10:00:00.000Z",
    adapter: "metric-packet", source: { sourceAlias: "fixture-source", accountAlias: null, workspaceAlias: null, deviceAlias: null },
    reviewedMeasurementIds: [], reviewVersion: 0,
    measurements: [{
      id: "fixture-row", metric: "words", value: "17", unit: "words", period: { kind: "unknown" },
      scope: "ACCOUNT", coverage: "UNKNOWN", temporality: "SNAPSHOT", aggregation: "NON_ADDITIVE",
      capturedAt: "2026-10-06T10:00:00.000Z", status: "measured", sample: "unknown", derivation: "SOURCE_REPORTED",
      dimensions: { model: null, reasoningEffort: null, speed: null, threadAlias: null }, reasons: ["Synthetic source limitation"],
    }],
  }],
}));

it("keeps the limitations disclosure outside a checkbox label", () => {
  const html = renderToStaticMarkup(createElement(PrivateMeasurements, { propId: "fixture-prop" as Id<"props"> }));
  const $ = load(html);
  expect($("summary").text()).toBe("Source limitations");
  expect($("label details")).toHaveLength(0);
  expect($('input[type="checkbox"][aria-label="Review Words 17"]')).toHaveLength(1);
});
