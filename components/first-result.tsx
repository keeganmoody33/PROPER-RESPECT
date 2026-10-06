"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useMutation } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { MEASUREMENT_LIMITS, parseMeasurementImport } from "@/src/domain/measurements";
import { api } from "@/convex/_generated/api";
import { firstResultSources, readFirstResultSource, selectFirstResultSource, subscribeFirstResultSource, type FirstResultSource } from "@/src/client/first-result-intent";
import { openRelationship } from "@/src/client/relationship-location";
import styles from "./first-result.module.css";

export function useFirstResultSource() {
  return useSyncExternalStore(subscribeFirstResultSource, readFirstResultSource, () => null);
}

export function SourcePicker({ selected }: { selected: FirstResultSource | null }) {
  return <div className={styles.sources} role="group" aria-label="Choose your first source">
    {firstResultSources.map(source => <button key={source.id} type="button" aria-label={source.label} aria-pressed={selected === source.id}
      className={styles.source} onClick={() => selectFirstResultSource(source.id)}>
      <strong>{source.label}</strong><span>{source.detail}</span>
    </button>)}
  </div>;
}

export function FirstResultPanel({ source, busy, onConnectGithub }: {
  source: FirstResultSource | null; busy: boolean; onConnectGithub: () => Promise<void>;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (source) heading.current?.focus(); }, [source]);
  return <section className={`onboarding-panel ${styles.panel}`} aria-labelledby="first-result-title">
    <p className="onboarding-kicker">PRIVATE FIRST</p>
    <h2 ref={heading} tabIndex={-1} id="first-result-title">{source === "github" ? "Connect GitHub activity" : source === "claude-code" ? "Import Claude Code usage" : source === "codex" ? "Import Codex usage" : source === "metric-packet" ? "Import another product’s measurements" : source === "manual" ? "Start with one tool" : "See your first private result"}</h2>
    {source ? <button type="button" className="text-link" onClick={() => selectFirstResultSource(null)}>Change source</button> : <>
      <p>Choose one source. See what it reports, then decide what belongs in your collection. No mailbox or public profile required.</p>
      <SourcePicker selected={null} />
    </>}
    {source === "github" && <>
      <p>Read your authorized account’s contributions. The result is a private snapshot with its reported period, not continuous tracking.</p>
      <button type="button" className="primary-action" disabled={busy} onClick={() => void onConnectGithub()}>{busy ? "Connecting…" : "Connect GitHub"}</button>
      <p className={styles.hint}>You may need to add GitHub under your account’s Connected accounts first.</p>
    </>}
    {(source === "claude-code" || source === "codex" || source === "metric-packet") && <MeasurementImport key={source} source={source} />}
    {source === "manual" && <><p>Name a tool and choose how you use it. Usage measurements can wait.</p><a className="primary-action" href="#add-product">Add your first tool</a></>}
    {!source && <a className="text-link" href="#add-product">Add your first tool manually</a>}
  </section>;
}

export function MeasurementImport({ source, propId }: { source: Exclude<FirstResultSource, "github" | "manual">; propId?: Id<"props"> }) {
  const importMeasurements = useMutation(api.retainedEvidence.importMeasurements);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    const file = data.get("measurements");
    if (!(file instanceof File) || !file.size) { setError("Choose a sanitized JSON file first."); return; }
    if (file.size > MEASUREMENT_LIMITS.bytes) { setError("Choose a sanitized file no larger than 256,000 bytes."); return; }
    setBusy(true);
    setError("");
    try {
      const text = await file.text();
      try { JSON.parse(text); } catch { throw new Error("This file is not valid JSON. Check the sanitized export and try again."); }
      const parsed = parseMeasurementImport(text);
      if (parsed.adapter !== source) throw new Error("This file belongs to a different measurement source. Choose its matching import option.");
      const result = await importMeasurements({ text, expectedSource: source,
        ...(propId ? { propId } : {}),
        ...(source === "metric-packet" && !propId ? { productName: String(data.get("productName") ?? "").trim(), website: String(data.get("website") ?? "").trim() || undefined } : {}),
      });
      selectFirstResultSource(null);
      openRelationship(result.propId);
      form.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The import failed. Your saved measurements have not changed. Try again.");
    } finally { setBusy(false); }
  }
  return <form className={styles.importForm} onSubmit={event => { event.preventDefault(); void submit(event.currentTarget); }}>
    <p>{source === "metric-packet" ? "Use a proper-measurements-v1 packet prepared from a product’s reported metrics. This does not connect Clay, your browser, or your device." : "Choose a sanitized usage JSON export. This imports the file you select; it does not connect to your device."}</p>
    <details><summary>Which JSON format?</summary>
      <p>{source === "claude-code" ? "Accepts claude-code-native-metrics-v1 captures with exact quantities and nanosecond intervals. Raw telemetry, chat histories, and usage-cost reports are not accepted." : source === "codex" ? "Accepts sanitized account/usage/read captures. Daily buckets and lifetime totals stay separate. Local session files and Markdown reports are not accepted." : "Accepts proper-measurements-v1 packets. Each measurement needs an exact decimal string or null for unknown, plus its period, scope, coverage, and aggregation rules."}</p>
    </details>
    <p className={styles.hint}>Remove API keys, tokens, prompts, and personal content before uploading. Reported totals keep their original scope, period, and coverage. Imports stay private.</p>
    {source === "metric-packet" && !propId && <div className="form-grid">
      <label>Product name<input name="productName" required maxLength={120} disabled={busy} /></label>
      <label>Product website (optional)<input name="website" placeholder="product.com" disabled={busy} /></label>
    </div>}
    <label>Sanitized usage file<input name="measurements" type="file" accept=".json,application/json" required disabled={busy} /></label>
    <button type="submit" className="primary-action" disabled={busy}>{busy ? "Importing…" : "Import privately"}</button>
    {error && <p role="alert">{error}</p>}
  </form>;
}
