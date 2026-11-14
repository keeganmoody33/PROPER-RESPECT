import type { Measurement, PublicMeasurement } from "@/src/domain/measurements";
import { groupedDecimal } from "@/src/domain/format-activity-number";
import { formatPeriod } from "@/src/domain/format-period";

type VisibleMeasurement = Pick<Measurement, "metric" | "value" | "unit" | "period" | "scope" | "coverage" | "temporality" | "aggregation" | "capturedAt" | "status" | "sample" | "derivation">;
export const measurementLabel = (metric: string) => metric.replaceAll("_", " ").replace(/^./, first => first.toUpperCase());
export function measurementPeriod(period: VisibleMeasurement["period"]) {
  switch (period.kind) {
    case "unknown": return "Period unknown";
    case "date": return `${period.start} to ${period.end} · ${period.timezone ?? "timezone unknown"}`;
    case "instant": return `${period.startUnixNano} to ${period.endUnixNano} ns since Unix epoch`;
  }
}

const NANOS_PER_MILLI = BigInt(1_000_000);
const nanosDate = (nanos: string) => new Date(Number(BigInt(nanos) / NANOS_PER_MILLI)).toISOString();

/** A period in months, for a card's front; the back keeps the exact dates, time zone or nanoseconds. */
export function measurementPeriodInWords(period: VisibleMeasurement["period"]) {
  switch (period.kind) {
    case "unknown": return "Period unknown";
    case "date": return formatPeriod(period.start, period.end);
    case "instant": return formatPeriod(nanosDate(period.startUnixNano), nanosDate(period.endUnixNano));
  }
}

/** Compact, on a card's front, keeps what the number means; how it was recorded stays on the back, which shows every row in full. */
export function MeasurementValue({ measurement, compact = false }: { measurement: VisibleMeasurement; compact?: boolean }) {
  return <div className="usage-measurement-measurement">
    <span className="usage-measurement-label">{measurementLabel(measurement.metric)}</span>
    <strong className="usage-measurement-value">{measurement.value === null ? "Unknown" : groupedDecimal(measurement.value)}</strong>
    <span className="usage-measurement-unit">{measurementLabel(measurement.unit)}</span>
    <p>{compact ? measurementPeriodInWords(measurement.period) : measurementPeriod(measurement.period)}</p>
    {!compact && <p>Scope: {measurement.scope.toLowerCase()} · Coverage: {measurement.coverage.toLowerCase()}</p>}
    {!compact && <p>{measurement.temporality.toLowerCase()} · {measurement.aggregation === "NON_ADDITIVE" ? "Do not add to other views" : measurement.aggregation.toLowerCase()}</p>}
    <p>{measurement.sample === "synthetic" ? "Synthetic sample. Not real account activity." : measurement.sample === "owner-supplied" ? "Owner-supplied sample" : "Sample origin unknown"}</p>
    {!compact && <p>{measurement.derivation === "CUMULATIVE_DIFFERENCE" ? "Derived difference between cumulative captures" : "Source-reported value"}</p>}
    {measurement.status === "baseline" && <p>Baseline only. This is not new activity in the interval.</p>}
    {measurement.status === "conflict" && <p>Conflicting evidence. Not eligible for sharing.</p>}
    {!compact && <p className="usage-measurement-capture">Captured <time dateTime={measurement.capturedAt}>{measurement.capturedAt}</time></p>}
  </div>;
}

export function PublicMeasurements({ measurements, compact = false }: { measurements: PublicMeasurement[]; compact?: boolean }) {
  if (!measurements.length) return null;
  return <section className="usage-measurement-public" aria-label="Reported usage measurements">
    {(compact ? measurements.slice(0, 1) : measurements).map((measurement, index) => <MeasurementValue key={index} measurement={measurement} compact={compact} />)}
    {compact && measurements.length > 1 && <p>{measurements.length - 1} more reported measurements in Details.</p>}
    <p className="usage-measurement-disclosure">Owner-supplied evidence. Account identity is not authenticated. Activity actor is unknown.</p>
  </section>;
}
