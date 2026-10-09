import type { Measurement, PublicMeasurement } from "@/src/domain/measurements";

type VisibleMeasurement = Pick<Measurement, "metric" | "value" | "unit" | "period" | "scope" | "coverage" | "temporality" | "aggregation" | "capturedAt" | "status" | "sample" | "derivation">;
export const measurementLabel = (metric: string) => metric.replaceAll("_", " ").replace(/^./, first => first.toUpperCase());
function measurementDerivation(derivation: string) {
  switch (derivation) {
    case "SOURCE_REPORTED": return "Source-reported value";
    case "CUMULATIVE_DIFFERENCE": return "Derived difference between cumulative captures";
    case "SUMMED_RESPONSES": return "Sum of distinct response counters";
    default: return "Derivation unknown";
  }
}
export function measurementPeriod(period: VisibleMeasurement["period"]) {
  switch (period.kind) {
    case "unknown": return "Period unknown";
    case "date": return `${period.start} to ${period.end} · ${period.timezone ?? "timezone unknown"}`;
    case "instant": return `${period.startUnixNano} to ${period.endUnixNano} ns since Unix epoch`;
  }
}

export function MeasurementValue({ measurement }: { measurement: VisibleMeasurement }) {
  return <div className="usage-measurement-measurement">
    <span className="usage-measurement-label">{measurementLabel(measurement.metric)}</span>
    <strong className="usage-measurement-value">{measurement.value === null ? "Unknown" : measurement.value}</strong>
    <span className="usage-measurement-unit">{measurementLabel(measurement.unit)}</span>
    <p>{measurementPeriod(measurement.period)}</p>
    <p>Scope: {measurement.scope.toLowerCase()} · Coverage: {measurement.coverage.toLowerCase()}</p>
    <p>{measurement.temporality.toLowerCase()} · {measurement.aggregation === "NON_ADDITIVE" ? "Do not add to other views" : measurement.aggregation.toLowerCase()}</p>
    <p>{measurement.sample === "synthetic" ? "Synthetic sample. Not real account activity." : measurement.sample === "owner-supplied" ? "Owner-supplied sample" : "Sample origin unknown"}</p>
    <p>{measurementDerivation(measurement.derivation)}</p>
    {measurement.status === "baseline" && <p>Baseline only. This is not new activity in the interval.</p>}
    {measurement.status === "conflict" && <p>Conflicting evidence. Not eligible for sharing.</p>}
    <p className="usage-measurement-capture">Captured <time dateTime={measurement.capturedAt}>{measurement.capturedAt}</time></p>
  </div>;
}

export function PublicMeasurements({ measurements, compact = false }: { measurements: PublicMeasurement[]; compact?: boolean }) {
  if (!measurements.length) return null;
  return <section className="usage-measurement-public" aria-label="Reported usage measurements">
    {(compact ? measurements.slice(0, 1) : measurements).map((measurement, index) => <MeasurementValue key={index} measurement={measurement} />)}
    {compact && measurements.length > 1 && <p>{measurements.length - 1} more reported measurements in Details.</p>}
    <p className="usage-measurement-disclosure">Owner-supplied evidence. Account identity is not authenticated. Activity actor is unknown.</p>
  </section>;
}
