import type { PrivateUsageCard } from "@/src/domain/private-usage-card";

type UsageRow = PrivateUsageCard["rows"][number];
type Observation = PrivateUsageCard["observations"][number];

function sampleLabel(sample: UsageRow["sample"]) {
  if (sample === "synthetic") return "Synthetic";
  if (sample === "owner-supplied-unverified") return "Owner-supplied · unverified";
  return "Origin unverified";
}

function coverageLabel(status: UsageRow["status"] | Observation["status"]) {
  switch (status) {
    case "measured": return "Measured interval within supplied coverage";
    case "baseline": return "Cumulative baseline · not measured increments";
    case "conflict": return "Conflicting observations · not measured usage";
    case "account-snapshot": return "Account snapshot · not an observed usage interval";
    case "source-observation": return "Source observation · not an additional usage interval";
  }
}

export function PrivateUsageCardPreview({ usage }: { usage: PrivateUsageCard }) {
  const samples = [...new Set([...usage.rows, ...usage.observations].map((row) => sampleLabel(row.sample)))];
  return (
    <div className="private-usage-preview">
      <span className="private-usage-label">Private local snapshot</span>
      <strong>{samples.join(" · ") || "No observations supplied"}</strong>
      <span>{usage.rows.length} independent coverage {usage.rows.length === 1 ? "row" : "rows"} · not additive</span>
      <span>Not connected · automatic updates unavailable</span>
      {usage.hasConflicts && <span>Conflicts present · review Details</span>}
    </div>
  );
}

function ObservationFacts({ row }: { row: UsageRow | Observation }) {
  return <>
    <p className="private-usage-status">{row.status === "source-observation"
      ? row.temporality === "cumulative"
        ? "Cumulative source reading · not measured increments"
        : "Delta source observation · not an additional usage interval"
      : coverageLabel(row.status)}</p>
    <dl className="private-usage-meta">
      <div><dt>Sample</dt><dd>{sampleLabel(row.sample)}</dd></div>
      <div><dt>Model</dt><dd>{row.model ?? "Unknown"}</dd></div>
      <div><dt>Client version</dt><dd>{row.sourceVersion ?? "Unknown"}</dd></div>
      <div><dt>Observation period</dt><dd>{row.period ? <>
        <time dateTime={row.period.start}>{row.period.start}</time>{" → "}<time dateTime={row.period.end}>{row.period.end}</time>
        {" · "}{row.period.timezone === "UTC" ? "UTC" : "Reporting timezone unknown"}
      </> : "Unknown"}</dd></div>
      <div><dt>Captured</dt><dd>{row.capturedAt ? <time dateTime={row.capturedAt}>{row.capturedAt}</time> : "Unknown"}</dd></div>
    </dl>
    <dl className="private-usage-counts">
      {row.counts.map((count, index) => <div key={index}><dt>{count.label}</dt><dd>{count.value ?? "Unknown"}</dd></div>)}
    </dl>
    {row.reasons.length > 0 && <ul className="private-usage-reasons">{row.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>}
  </>;
}

export function PrivateUsageCardDetails({ usage }: { usage: PrivateUsageCard }) {
  return (
    <section className="private-usage-details" aria-label="Private usage evidence">
      <h3>Private usage preview</h3>
      <p>Local snapshot · not saved · not publishable. Genuine owner usage is not validated.</p>
      <p>Not connected · automatic updates unavailable.</p>
      <p>Coverage rows and source observations are independent and not additive. No total across tools or overlapping snapshots.</p>
      <p>{usage.replays} duplicate {usage.replays === 1 ? "replay" : "replays"} ignored. Conflicts: {usage.hasConflicts ? "present" : "none in supplied batch"}.</p>
      <p>{usage.productSlug === "codex"
        ? "Codex cached input is included in input; reasoning is included in output. Account totals remain unpriced."
        : "Claude input, cache read and cache creation are separate source categories."}</p>
      <div className="private-usage-rows">
        {usage.rows.length === 0 && <p>No reconciled coverage rows supplied.</p>}
        {usage.rows.map((row, index) => <section className="private-usage-row" key={index} aria-label={`Coverage row ${index + 1}`}>
          <h4>Coverage row {index + 1}</h4>
          <ObservationFacts row={row} />
          <dl className="private-usage-costs">
            <div><dt>Source estimate (USD)</dt><dd>{row.sourceEstimateUsd ?? "Unknown"}</dd></div>
            <div><dt>API-equivalent estimate (USD)</dt><dd>{row.apiEquivalent.kind === "unpriced" ? "Unpriced" : row.apiEquivalent.exactUsd}</dd></div>
            <div><dt>Billed (USD)</dt><dd>Unknown</dd></div>
          </dl>
          <p>Source estimates are approximate, not charges. No invoice or subscription evidence was imported.</p>
          {row.apiEquivalent.kind === "unpriced"
            ? <ul className="private-usage-reasons">{row.apiEquivalent.reasons.map((reason, reasonIndex) => <li key={reasonIndex}>{reason}</li>)}</ul>
            : <p className="private-usage-valuation">Synthetic counterfactual list-price estimate · not a bill, savings or compute cost.
                {" Rate: "}{row.apiEquivalent.rateVersion}. Source: {row.apiEquivalent.rateSource}</p>}
        </section>)}
      </div>
      <details className="private-usage-observations">
        <summary>Source observations ({usage.observations.length}) · not additive</summary>
        {usage.observations.length === 0 && <p>No separate source observations supplied.</p>}
        {usage.observations.map((row, index) => <section className="private-usage-row" key={index} aria-label={`Source observation ${index + 1}`}>
          <h4>Source observation {index + 1}</h4>
          <ObservationFacts row={row} />
          <dl className="private-usage-costs"><div><dt>Source estimate (USD)</dt><dd>{row.sourceEstimateUsd ?? "Unknown"}</dd></div></dl>
        </section>)}
      </details>
    </section>
  );
}
