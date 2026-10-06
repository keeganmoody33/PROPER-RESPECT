import type { Measurement, PublicMeasurement } from "@/src/domain/measurements";
import styles from "./measurement-values.module.css";

type VisibleMeasurement = Pick<Measurement, "metric" | "value" | "unit" | "period" | "scope" | "coverage" | "temporality" | "aggregation" | "capturedAt" | "status" | "sample" | "derivation">;
export const measurementLabel = (metric: string) => metric.replaceAll("_", " ").replace(/^./, first => first.toUpperCase());
export function measurementPeriod(period: VisibleMeasurement["period"]) {
  switch (period.kind) {
    case "unknown": return "Period unknown";
    case "date": return `${period.start} to ${period.end} · ${period.timezone ?? "timezone unknown"}`;
    case "instant": return `${period.startUnixNano} to ${period.endUnixNano} ns since Unix epoch`;
  }
}

export function MeasurementValue({ measurement }: { measurement: VisibleMeasurement }) {
  return <div className={styles.measurement}>
    <span className={styles.label}>{measurementLabel(measurement.metric)}</span>
    <strong className={styles.value}>{measurement.value === null ? "Unknown" : measurement.value}</strong>
    <span className={styles.unit}>{measurementLabel(measurement.unit)}</span>
    <p>{measurementPeriod(measurement.period)}</p>
    <p>Scope: {measurement.scope.toLowerCase()} · Coverage: {measurement.coverage.toLowerCase()}</p>
    <p>{measurement.temporality.toLowerCase()} · {measurement.aggregation === "NON_ADDITIVE" ? "Do not add to other views" : measurement.aggregation.toLowerCase()}</p>
    <p>{measurement.sample === "synthetic" ? "Synthetic sample. Not real account activity." : measurement.sample === "owner-supplied" ? "Owner-supplied sample" : "Sample origin unknown"}</p>
    <p>{measurement.derivation === "CUMULATIVE_DIFFERENCE" ? "Derived difference between cumulative captures" : "Source-reported value"}</p>
    {measurement.status === "baseline" && <p>Baseline only. This is not new activity in the interval.</p>}
    {measurement.status === "conflict" && <p>Conflicting evidence. Not eligible for sharing.</p>}
    <p className={styles.capture}>Captured <time dateTime={measurement.capturedAt}>{measurement.capturedAt}</time></p>
  </div>;
}

export function PublicMeasurements({ measurements, compact = false }: { measurements: PublicMeasurement[]; compact?: boolean }) {
  if (!measurements.length) return null;
  return <section className={styles.public} aria-label="Reported usage measurements">
    {(compact ? measurements.slice(0, 1) : measurements).map((measurement, index) => <MeasurementValue key={index} measurement={measurement} />)}
    {compact && measurements.length > 1 && <p>{measurements.length - 1} more reported measurements in Details.</p>}
    <p className={styles.disclosure}>Owner-supplied evidence. Account identity is not authenticated. Activity actor is unknown.</p>
  </section>;
}
