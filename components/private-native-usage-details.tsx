import type { PrivateNativeUsage, PrivateNativeRow, PrivateNativeObservation } from "@/src/domain/private-native-usage-card";

const metricLabels = { input: "Input tokens", output: "Output tokens", cacheRead: "Cache read tokens", cacheCreation: "Cache creation tokens", sourceCostUsd: "Source estimate (USD)" };

function NativeFacts({ fact }: { fact: PrivateNativeRow | PrivateNativeObservation }) {
  return <>
    <dl className="private-usage-meta">
      <div><dt>Source</dt><dd>Claude Code native metrics · independent scalar stream</dd></div>
      <div><dt>Sample</dt><dd>{fact.sample === "synthetic" ? "Synthetic" : "Owner-supplied · unverified"}</dd></div>
      <div><dt>Local identity</dt><dd>{fact.scopeLabel} · {fact.streamLabel} · {fact.familyLabel}</dd></div>
      <div><dt>Model</dt><dd>{fact.model ?? "Unknown"}</dd></div>
      <div><dt>Client version</dt><dd>{fact.sourceVersion ?? "Unknown"}</dd></div>
      <div><dt>Source temporality</dt><dd>{fact.temporality === "cumulative" ? "Cumulative" : "Delta"}</dd></div>
      <div><dt>Observation period · Unix nanoseconds</dt><dd>{fact.period.startUnixNano}{" → "}{fact.period.endUnixNano}</dd></div>
    </dl>
    <dl className="private-usage-counts">
      <div><dt>{metricLabels[fact.metric]}</dt><dd>{fact.quantity}</dd></div>
    </dl>
  </>;
}

export function PrivateNativeUsageDetails({ usage }: { usage: PrivateNativeUsage }) {
  return <section className="private-native-usage" aria-label="Native Claude metrics">
    <h3>Native Claude metrics</h3>
    <p>Each token category and source-cost stream has its own period. No category alignment, combined total or cost assigned to another stream.</p>
    <p>Missing categories and cache creation duration remain unknown. Source estimates are approximate, not charges. API-equivalent estimates are unpriced; billed amounts are unknown.</p>
    <p>Scope, stream, family, observation and capture labels apply only within this preview. They are not authenticated identities and may change with another batch. A metric family does not establish category alignment.</p>
    <p>{usage.replays} native duplicate {usage.replays === 1 ? "replay" : "replays"} ignored. Native conflicts: {usage.hasConflicts ? "present" : "none in supplied batch"}.</p>
    <div className="private-native-rows">
      {usage.rows.map((row, index) => <section className="private-usage-row" key={index} aria-label={`Native coverage row ${index + 1}`}>
        <h4>Native coverage row {index + 1}</h4>
        <p className="private-usage-status">{row.status === "measured" ? "Measured interval within supplied coverage"
          : row.status === "baseline" ? "Cumulative baseline · not measured increments" : "Conflicting observations · not measured usage"}</p>
        <NativeFacts fact={row} />
        <dl className="private-usage-meta"><div><dt>Supporting observations</dt><dd>{row.observationLabels.join(" · ")}</dd></div></dl>
        <dl className="private-usage-costs">
          {row.metric !== "sourceCostUsd" && <div><dt>Source estimate (USD)</dt><dd>Unknown · independent cost streams are not assigned to this row</dd></div>}
          <div><dt>API-equivalent estimate (USD)</dt><dd>Unpriced</dd></div>
          <div><dt>Billed (USD)</dt><dd>Unknown</dd></div>
        </dl>
        <ul className="private-usage-reasons">{row.reasons.map((reason, reasonIndex) => <li key={reasonIndex}>{reason}</li>)}</ul>
      </section>)}
    </div>
    <details className="private-usage-observations private-native-observations">
      <summary>Native source observations ({usage.observations.length}) · not additive</summary>
      {usage.observations.map((observation) => <section className="private-usage-row" key={observation.observationLabel} aria-label={observation.observationLabel}>
        <h4>{observation.observationLabel}</h4>
        <p>{observation.temporality === "cumulative" ? "Cumulative source reading · not measured increments" : "Delta source observation · not an additional usage interval"}</p>
        <NativeFacts fact={observation} />
        <dl className="private-usage-meta">{observation.captures.map((capture, index) => <div key={index}>
          <dt>{capture.captureLabel} · supplied capture time</dt><dd><time dateTime={capture.capturedAt}>{capture.capturedAt}</time></dd>
        </div>)}</dl>
      </section>)}
    </details>
  </section>;
}
