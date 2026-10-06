import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { UsageConnection } from "../../src/local/usage-connection";
import { createCodexHistoryFixture } from "../../tests/support/codex-history-fixture";
import "./styles.css";

const fixture = createCodexHistoryFixture();
const connection = new UsageConnection({
  descriptor: fixture.descriptor,
  window: fixture.window,
  collect: fixture.collect,
});
const subscribe = (listener: () => void) => connection.subscribe(listener);
const getSnapshot = () => connection.getSnapshot();
type ConnectionView = ReturnType<typeof getSnapshot>;

function phaseLabel(phase: ConnectionView["phase"]): string {
  switch (phase) {
    case "disconnected": return "Disconnected";
    case "awaiting-approval": return "Awaiting approval";
    case "connected": return "Connected to fixture";
    case "syncing": return "Reading fixture";
    case "error": return "Sync needs attention";
    case "expired": return "Approval expired";
    default: {
      const exhaustive: never = phase;
      return exhaustive;
    }
  }
}

function metricLabel(metric: string): string {
  switch (metric) {
    case "total_tokens": return "Total tokens";
    case "input_tokens": return "Input tokens";
    case "output_tokens": return "Output tokens";
    default: return metric.replaceAll("_", " ");
  }
}

function formatCount(value: string | null | undefined): string {
  if (value == null) return "Unknown";
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function ConsentDialog({ view }: { view: ConnectionView }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (view.phase === "awaiting-approval" && dialog && !dialog.open) dialog.showModal();
    if (view.phase !== "awaiting-approval" && dialog?.open) {
      dialog.close();
      if (view.phase === "syncing") document.getElementById("source-title")?.focus();
    }
  }, [view.phase]);

  return <dialog ref={dialogRef} aria-labelledby="consent-title" aria-describedby="consent-description" onCancel={() => connection.cancelConnection()}>
    <p className="eyebrow">One source. A bounded window.</p>
    <h2 id="consent-title">Connect this sample history?</h2>
    <p id="consent-description">Approve this synthetic history window for manual syncs over the next 10 minutes. The first backfill starts automatically.</p>
    <dl className="consent-scope">
      <div><dt>Source</dt><dd>Codex · {view.descriptor.sourceAlias}</dd></div>
      <div><dt>Device</dt><dd>{view.descriptor.deviceAlias} · synthetic</dd></div>
      <div><dt>Window</dt><dd><time dateTime={view.window.start}>2026-10-01</time> to <time dateTime={view.window.end}>2026-10-08</time><span className="small-copy">UTC, end exclusive</span></dd></div>
      <div><dt>Permission</dt><dd>Read-only · expires in 10 minutes</dd></div>
    </dl>
    <p className="consent-note">This prototype reads generated fixture data in memory. It does not access your real account, device, session files, prompts, or credentials. Nothing is sent or published.</p>
    <p className="small-copy">Disconnect stops new reads and keeps this page&apos;s history. Reloading the page clears all fixture history.</p>
    <div className="dialog-actions">
      <button className="button secondary" autoFocus onClick={() => connection.cancelConnection()}>Cancel</button>
      <button className="button primary" onClick={() => void connection.approve()}>Approve and backfill</button>
    </div>
  </dialog>;
}

function App() {
  const [view, setView] = useState(getSnapshot);
  const [fixtureAdvanced, setFixtureAdvanced] = useState(false);
  useEffect(() => subscribe(() => setView(getSnapshot())), []);
  useEffect(() => {
    if (!view.expiresAt || view.phase === "expired") return;
    // Refresh the permission display at expiry; this timer never initiates a read.
    const timeout = window.setTimeout(() => setView(getSnapshot()), Math.max(0, Date.parse(view.expiresAt) - Date.now() + 1));
    return () => window.clearTimeout(timeout);
  }, [view.expiresAt, view.phase]);
  const hasHistory = view.history.observations > 0;
  const isReading = view.phase === "syncing";
  const maySync = view.phase === "connected" || view.phase === "error";
  const mayConnect = view.phase === "disconnected" || view.phase === "expired";
  const total = (metric: string) => view.history.totals.find((item) => item.metric === metric)?.value;
  const observedTotal = hasHistory ? formatCount(total("total_tokens")) : "Not read";

  return <>
    <header className="masthead">
      <span className="wordmark">PROPER<span>RESPECT</span><span className="brand-dot" aria-hidden="true">.</span></span>
      <span className="prototype-label"><span className="prototype-dot" aria-hidden="true" />Local prototype</span>
    </header>
    <main>
      <section className="page-intro" aria-labelledby="page-title">
        <p className="eyebrow">Private collection / connection preview</p>
        <h1 id="page-title">Codex, with context.</h1>
        <p className="intro-copy">A small, inspectable connection from local history to observed usage. Try the full flow with synthetic data.</p>
      </section>

      <div className="content-grid">
        <section className="connection-card" aria-labelledby="source-title">
          <div className="card-heading">
            <div className="product-heading"><div className="product-mark" aria-hidden="true">&gt;_</div><div><p className="eyebrow">Local history</p><h2 id="source-title" tabIndex={-1}>Codex</h2></div></div>
            <span className="sample-badge">Synthetic sample</span>
          </div>
          <div className="connection-status"><span className={`status-dot ${view.phase}`} aria-hidden="true" /><span data-testid="connection-phase">{phaseLabel(view.phase)}</span><span className="coverage-label">Partial coverage</span></div>

          <div className="metric-block">
            <p className="metric-label">Observed token increase</p>
            <p className={`hero-count ${hasHistory ? "" : "empty-count"}`} data-testid="observed-total">{observedTotal}</p>
            <p className="metric-note">{hasHistory ? "Tokens recorded after each stream's first baseline." : "Approve the sample read to see the first backfill."}</p>
            <div className="sub-metrics">
              <div><span>Input tokens</span><strong data-testid="input-total">{hasHistory ? formatCount(total("input_tokens")) : "Not read"}</strong></div>
              <div><span>Output tokens</span><strong data-testid="output-total">{hasHistory ? formatCount(total("output_tokens")) : "Not read"}</strong></div>
            </div>
          </div>

          <div className="scope-line"><span>Read window</span><span>Oct 1–8, 2026 <span className="scope-detail">· UTC · end exclusive</span></span></div>
          <div className="action-area">
            <div className="primary-actions">
              {(mayConnect || view.phase === "awaiting-approval") && <button className="button primary" onClick={() => connection.requestConnection()}>{hasHistory ? "Reconnect sample" : "Connect sample"}<span aria-hidden="true">↗</span></button>}
              {(maySync || isReading) && <button className="button primary" disabled={isReading} onClick={() => void connection.sync()}>{isReading ? "Backfilling…" : view.phase === "error" ? "Retry sync" : "Sync again"}<span aria-hidden="true">↻</span></button>}
              {(maySync || isReading) && <button className="button text-button" onClick={() => connection.disconnect()}>Disconnect</button>}
            </div>
            <p className="sync-message" role="status" aria-live="polite">
              {view.phase === "error" ? "The sample read failed. Your retained history is unchanged. Retry when ready." :
                view.phase === "expired" ? "The 10-minute approval expired. Reconnect to approve another read. History is retained." :
                  isReading ? "Reading the approved sample window…" :
                    view.phase === "disconnected" && hasHistory ? "Disconnected. Your history stays here until you reload the page." :
                      view.history.replays > 0 ? "Repeated observations were recognized. Nothing was counted twice." :
                        view.phase === "connected" ? "Backfill complete. Sync again to check for new observations." :
                          "Nothing is read until you approve the connection."}
            </p>
          </div>

          {hasHistory && <details className="history-details">
            <summary>Inspect retained observations<span>{view.history.observations} observations</span></summary>
            <p className="small-copy">Each stream has its own baseline. Missing values stay unknown. Baselines do not count toward the observed increase.</p>
            <ul className="observation-list">
              {view.history.rows.map((row, index) => <li key={`${row.stream}:${row.metric}:${row.at}:${index}`}>
                <div className="observation-name"><strong>{metricLabel(row.metric)}</strong><span>{row.stream}</span><time dateTime={row.at}>{row.at.replace("T", " ").replace(".000Z", " UTC").replace("Z", " UTC")}</time></div>
                <div className="observation-value"><span>{row.status === "baseline" ? "Baseline" : row.status === "unknown" ? "Unknown" : row.status === "conflict" ? "Conflict" : `+${formatCount(row.delta)}`}</span><small>Reported {formatCount(row.value)}</small></div>
              </li>)}
            </ul>
          </details>}
        </section>

        <aside className="context-column" aria-label="Source and coverage">
          <section className="source-note">
            <p className="eyebrow">Know what you&apos;re reading</p>
            <h2>One source.<br />A limited view.</h2>
            <p>Local history can show recorded token increases. It cannot establish your full account activity, remaining plan quota, or billed charges.</p>
            <dl className="source-lanes">
              <div><dt>Local history</dt><dd>Synthetic fixture</dd></div>
              <div><dt>Account activity</dt><dd>Not connected</dd></div>
              <div><dt>Plan quota</dt><dd>Not connected</dd></div>
              <div><dt>Billed charges</dt><dd>Unknown</dd></div>
            </dl>
            <p className="small-copy">Account identity is unknown. These sources stay separate; no account-wide total or cost is inferred.</p>
          </section>
          <section className="fixture-controls" aria-labelledby="fixture-title">
            <p className="eyebrow">Try the next step</p>
            <h2 id="fixture-title">Make the history change.</h2>
            <p>Add a synthetic 50-token increase, then read the same source again.</p>
            <button className="button secondary full-width" disabled={!maySync || fixtureAdvanced} onClick={() => { fixture.advance(); setFixtureAdvanced(true); void connection.sync(); }}>{fixtureAdvanced ? "50 fixture tokens added" : "Add 50 fixture tokens"}<span aria-hidden="true">{fixtureAdvanced ? "✓" : "+"}</span></button>
            <details className="recovery-controls"><summary>Test recovery</summary><p className="small-copy">Fail one sample read, then use Retry sync. Retained counts stay in place.</p><button className="button secondary full-width" disabled={!maySync} onClick={() => { fixture.failNext(); void connection.sync(); }}>Simulate a failed sync</button></details>
          </section>
        </aside>
      </div>

      <footer className="page-footer"><span className="footer-mark" aria-hidden="true">↳</span><p>In memory, on this page only. Reloading clears fixture history. No real account or device is accessed, and nothing is saved or published. Approval lasts 10 minutes.</p></footer>
    </main>
    <ConsentDialog view={view} />
  </>;
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
