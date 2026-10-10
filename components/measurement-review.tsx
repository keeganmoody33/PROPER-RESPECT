"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { MEASUREMENT_LIMITS } from "@/src/domain/measurements";
import { MeasurementValue, measurementLabel } from "./measurement-values";

type Capture = FunctionReturnType<typeof api.retainedEvidence.measurements>[number];

function ReviewCapture({ capture, propId }: { capture: Capture; propId: Id<"props"> }) {
  const review = useMutation(api.retainedEvidence.reviewMeasurements);
  const [selected, setSelected] = useState<string[]>(capture.reviewedMeasurementIds);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function save() {
    setBusy(true); setNotice("");
    try {
      await review({ propId, rawEvidenceId: capture.rawEvidenceId, expectedDigest: capture.digest, expectedReviewVersion: capture.reviewVersion, measurementIds: selected });
      setNotice("Measurement choices saved privately. Choose what to share in the sharing preview.");
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "Choices were not saved. Reload the source and try again."); }
    finally { setBusy(false); }
  }
  return <div className="usage-measurement-source">
    <h4>{capture.adapter === "claude-code" ? "Claude Code import" : capture.adapter === "codex" ? "Codex import" : "Measurement packet"}</h4>
    <p>Private source: {capture.source.accountAlias ?? capture.source.sourceAlias}. {capture.source.workspaceAlias && `Workspace: ${capture.source.workspaceAlias}. `}{capture.source.deviceAlias && `Device: ${capture.source.deviceAlias}. `}Owner-supplied identity; not authenticated by the provider.</p>
    <div className="usage-measurement-rows">{capture.measurements.map(row => <div className="usage-measurement-choice" key={row.id}>
      <input type="checkbox" aria-label={`Review ${measurementLabel(row.metric)} ${row.value ?? "unknown"}`} checked={selected.includes(row.id)}
        disabled={busy || row.status === "conflict" || (!selected.includes(row.id) && selected.length >= MEASUREMENT_LIMITS.publicRows)}
        onChange={event => setSelected(current => event.target.checked ? [...current, row.id] : current.filter(id => id !== row.id))} />
      <div><MeasurementValue measurement={row} />
        {Object.values(row.dimensions).some(value => value !== null) && <p>Private dimensions: {Object.entries(row.dimensions).filter(([, value]) => value !== null).map(([key, value]) => `${measurementLabel(key)}: ${value}`).join(" · ")}</p>}
        {row.reasons.length > 0 && <details><summary>Source limitations</summary><ul>{row.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></details>}
      </div>
    </div>)}</div>
    <p>Saved review: {capture.reviewedMeasurementIds.length} measurements selected.</p>
    <p>Select up to {MEASUREMENT_LIMITS.publicRows} measurements to make available for a later sharing preview. Values are never added across snapshots.</p>
    <button className="secondary-action" type="button" disabled={busy} onClick={() => void save()}>{busy ? "Saving choices…" : "Save measurement choices privately"}</button>
    {notice && <p role="status">{notice}</p>}
  </div>;
}

export function PrivateMeasurements({ propId }: { propId: Id<"props"> }) {
  const captures = useQuery(api.retainedEvidence.measurements, { propId, measurementVersion: 2 });
  if (captures === undefined) return <p role="status">Loading private measurements…</p>;
  if (!captures.length) return null;
  return <section className="usage-measurement-panel" aria-labelledby="private-measurements-title">
    <h3 id="private-measurements-title">Your private usage result</h3>
    <p>Exact measurement values, including unknowns. These measurements do not confirm how you use a tool or make anything public.</p>
    <div className="usage-measurement-sources">{captures.map(capture => <ReviewCapture key={`${capture.rawEvidenceId}:${capture.digest}:${capture.reviewVersion}`} capture={capture} propId={propId} />)}</div>
  </section>;
}

export function MeasurementSharingChoices({ propId, selected, onChange, onReviewBasisChange, disabled }: {
  propId: Id<"props">; selected: Id<"rawEvidence">[]; onChange: (ids: Id<"rawEvidence">[]) => void; disabled: boolean;
  onReviewBasisChange?: (basis: string) => void;
}) {
  const captures = useQuery(api.retainedEvidence.measurements, { propId, measurementVersion: 2 });
  // Bind the visible preview to the same source digest and review revision as
  // the server approval, even when a source stays selected with different rows.
  const reviewBasis = captures === undefined ? undefined : JSON.stringify(captures
    .filter(capture => selected.includes(capture.rawEvidenceId) && capture.reviewedMeasurementIds.length > 0)
    .map(capture => ({ id: capture.rawEvidenceId, digest: capture.digest, reviewVersion: capture.reviewVersion, rows: capture.reviewedMeasurementIds })));
  useEffect(() => {
    // A new capture or deleted source can invalidate review while its sharing
    // choice is held in the parent. Loading does not revoke that choice.
    if (captures === undefined) return;
    const available = selected.filter(id => captures.some(capture => capture.rawEvidenceId === id && capture.reviewedMeasurementIds.length > 0));
    if (available.length !== selected.length) onChange(available);
    if (reviewBasis !== undefined) onReviewBasisChange?.(reviewBasis);
  }, [captures, selected, onChange, reviewBasis, onReviewBasisChange]);
  const reviewed = captures?.filter(capture => capture.reviewedMeasurementIds.length > 0) ?? [];
  if (!reviewed.length) return null;
  return <fieldset disabled={disabled} style={{ minWidth: 0 }}>
    <legend>Reviewed usage measurements</legend>
    <p>Select the sources to include in this sharing preview. Private account labels and dimensions stay private.</p>
    {reviewed.map(capture => <label className="review-toggle" key={capture.rawEvidenceId}>
      <input type="checkbox" checked={selected.includes(capture.rawEvidenceId)} disabled={!selected.includes(capture.rawEvidenceId) && selected.length >= MEASUREMENT_LIMITS.publicSources} onChange={event => onChange(event.target.checked ? [...selected, capture.rawEvidenceId] : selected.filter(id => id !== capture.rawEvidenceId))} />
      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>Include {capture.reviewedMeasurementIds.length} reviewed measurements from {capture.capturedAt.slice(0, 10)} · Private source: {capture.source.accountAlias ?? capture.source.workspaceAlias ?? capture.source.deviceAlias ?? capture.source.sourceAlias}</span>
    </label>)}
  </fieldset>;
}
