import type { ReactNode } from "react";
import type { Measurement, PublicMeasurement } from "@/src/domain/measurements";
import { groupedDecimal } from "@/src/domain/format-activity-number";
import { dayMonthYear, formatPeriod } from "@/src/domain/format-period";
import { hasWord } from "@/src/domain/activity-headline";

type VisibleMeasurement = Pick<Measurement, "metric" | "value" | "unit" | "period" | "scope" | "coverage" | "temporality" | "aggregation" | "capturedAt" | "status" | "sample" | "derivation">;
export const measurementLabel = (metric: string) => metric.replaceAll("_", " ").replace(/^./, first => first.toUpperCase());
export function measurementPeriod(period: VisibleMeasurement["period"]): ReactNode {
  switch (period.kind) {
    case "unknown": return "Period unknown";
    case "date": return <><time dateTime={period.start}>{dayMonthYear(period.start)}</time> to <time dateTime={period.end}>{dayMonthYear(period.end)}</time> · {period.timezone ?? "timezone unknown"}</>;
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

/**
 * A big number in tabular figures with its group separators set apart in the font's own spacing: some fonts' tabular set
 * makes the comma as wide as a figure ("3 , 690"), and a separator is not a column of figures.
 */
export function Figures({ text }: { text: string }) {
  return <>{text.split(/([,.])/).map((part, index) => index % 2 ? <span key={index} className="figure-separator">{part}</span> : part)}</>;
}

/** What kind of number it is and whether it adds up with others, in a visitor's words; the stored values stay on the line's data attributes. */
const TEMPORALITY_WORDS: Readonly<Record<VisibleMeasurement["temporality"], string>> = { SNAPSHOT: "A reading at one time", DELTA: "Change over the period", CUMULATIVE: "Running total" };
const AGGREGATION_WORDS: Readonly<Record<VisibleMeasurement["aggregation"], string>> = {
  NON_ADDITIVE: "not to be added to other numbers", SNAPSHOT: "a count at one time", DISTINCT: "each item counted once",
};

/** One published number with how it was recorded, as the card's back and the review screen show it. */
export function MeasurementValue({ measurement }: { measurement: VisibleMeasurement }) {
  const synthetic = measurement.sample === "synthetic";
  return <div className="usage-measurement-measurement">
    <span className="usage-measurement-label">{measurementLabel(measurement.metric)}</span>
    <strong className="usage-measurement-value">{measurement.value === null ? "Unknown" : groupedDecimal(measurement.value)}</strong>
    <span className="usage-measurement-unit">{measurementLabel(measurement.unit)}</span>
    <p>{measurementPeriod(measurement.period)}</p>
    {/* An invented sample was reported by no source and covers nothing, so it claims neither. */}
    <p>Scope: {measurement.scope.toLowerCase()}{synthetic ? "" : ` · Coverage: ${measurement.coverage.toLowerCase()}`}</p>
    <p data-temporality={measurement.temporality} data-aggregation={measurement.aggregation}>{TEMPORALITY_WORDS[measurement.temporality]} · {AGGREGATION_WORDS[measurement.aggregation]}</p>
    <p>{synthetic ? "Synthetic sample. Not real account activity." : measurement.sample === "owner-supplied" ? "Owner-supplied sample" : "Sample origin unknown"}</p>
    {!synthetic && <p>{measurement.derivation === "CUMULATIVE_DIFFERENCE" ? "Derived difference between cumulative captures" : "Source-reported value"}</p>}
    {measurement.status === "baseline" && <p>Baseline only. This is not new activity in the interval.</p>}
    {measurement.status === "conflict" && <p>Conflicting evidence. Not eligible for sharing.</p>}
    <p className="usage-measurement-capture">Captured <time dateTime={measurement.capturedAt}>{dayMonthYear(measurement.capturedAt)}</time></p>
  </div>;
}

/** How many published numbers a card's front shows in its row; the back shows every one. */
export const FRONT_MEASUREMENT_LIMIT = 3;

/** What a number counts, in a few words: "rows enriched" for a metric and its unit, "input tokens" where the metric already names the unit. */
function countedThing(measurement: PublicMeasurement): string {
  const [metric, unit] = [measurement.metric, measurement.unit].map(word => word.replaceAll("_", " ").toLowerCase());
  return hasWord(metric, unit) ? metric : `${unit} ${metric}`;
}

/** Whose the shown numbers are, decided on the rows a visitor sees: Details labels every row it holds. A card that already says Sample doesn't say it again. */
function shownOrigin(shown: readonly PublicMeasurement[], sampleCard: boolean): string | undefined {
  const samples = shown.filter(row => row.sample === "synthetic").length;
  if (samples === shown.length) return sampleCard ? undefined : "Sample numbers";
  return samples ? "Rows marked Sample are invented, not account activity; the rest are owner-reported, not verified" : "Owner-reported, not verified";
}

/** A card's front: the numbers in one row, then one line saying whose they are; how each was recorded stays on the back. */
function MeasurementStats({ measurements, sampleCard }: { measurements: PublicMeasurement[]; sampleCard: boolean }) {
  const shown = measurements.slice(0, FRONT_MEASUREMENT_LIMIT);
  const more = measurements.length - shown.length;
  const mixed = shown.some(row => row.sample === "synthetic") && shown.some(row => row.sample !== "synthetic");
  const periods = shown.map(row => measurementPeriodInWords(row.period));
  // One period shared by every shown number is said once, ahead of the note, not under each number.
  const shared = periods.every(period => period === periods[0]) ? periods[0] : undefined;
  const note = [
    ...(shared ? [shared] : []),
    ...[shownOrigin(shown, sampleCard)].filter(origin => origin !== undefined),
    ...(measurements.some(row => row.status === "baseline") ? ["includes a baseline, which is not new activity"] : []),
    more > 0 ? `${more} more and how each was measured are in Details` : "how each was measured is in Details",
  ].join(" · ");
  return <section className="usage-measurement-public" aria-label="Reported usage measurements">
    <ul className="usage-measurement-stats">
      {shown.map((row, index) => <li key={index}>
        <strong>{row.value === null ? "Unknown" : <Figures text={groupedDecimal(row.value)} />}</strong>
        <span>{countedThing(row)}</span>
        {!shared && <small>{periods[index]}</small>}
        {mixed && row.sample === "synthetic" && <em className="usage-measurement-sample">Sample</em>}
      </li>)}
    </ul>
    <p className="usage-measurement-note">{note}</p>
  </section>;
}

const SAMPLE_WORDS: Readonly<Record<PublicMeasurement["sample"], string>> = { synthetic: "sample, not account data", "owner-supplied": "owner-supplied", unknown: "origin unknown" };

/** A card's back: each number on one plain line with its period, scope and whose it is; how each was recorded is in the back's disclosure. */
export function MeasurementLines({ measurements }: { measurements: PublicMeasurement[] }) {
  if (!measurements.length) return null;
  return <ul className="usage-measurement-lines" aria-label="Reported usage measurements">
    {measurements.map((row, index) => <li key={index}>
      <strong>{row.value === null ? "Unknown" : groupedDecimal(row.value)} {countedThing(row)}</strong>
      {` · ${measurementPeriodInWords(row.period)} · ${row.scope.toLowerCase()} · ${SAMPLE_WORDS[row.sample]}${row.status === "baseline" ? " · baseline, not new activity" : ""}`}
    </li>)}
  </ul>;
}

/** `sampleCard`: the card around the numbers already says Sample, so its front says it no more. */
export function PublicMeasurements({ measurements, compact = false, sampleCard = false }: { measurements: PublicMeasurement[]; compact?: boolean; sampleCard?: boolean }) {
  if (!measurements.length) return null;
  if (compact) return <MeasurementStats measurements={measurements} sampleCard={sampleCard} />;
  return <section className="usage-measurement-public" aria-label="Reported usage measurements">
    {measurements.map((measurement, index) => <MeasurementValue key={index} measurement={measurement} />)}
    <p className="usage-measurement-disclosure">Owner-supplied evidence. Account identity is not authenticated. Activity actor is unknown.</p>
  </section>;
}
