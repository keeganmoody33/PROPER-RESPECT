"use client";

import { useEffect, useId, useState } from "react";
import { TALLY_CATEGORIES, TALLY_DEFINITIONS, TALLY_LABELS, type TallyCategory, type TallySnapshot } from "@/src/server/request-tally";

type Load = { state: "loading" } | { state: "error" } | { state: "ready"; data: TallySnapshot };

const fmt = (n: number) => n.toLocaleString("en-US");
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function sinceLabel(iso: string | null): string {
  if (!iso) return "since launch";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "since launch";
  return `since ${date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}`;
}

/**
 * Footer tally: page requests served to presumed humans vs automated clients,
 * counted on the server and read from /api/tally. The breakdown opens inline
 * below the row so it never covers the page. Hidden if the count is unavailable.
 */
export function RequestTally() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [human, setHuman] = useState(true);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<TallyCategory | null>(null);
  const panelId = useId();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tally", { cache: "no-store" })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: TallySnapshot) => { if (!cancelled) setLoad({ state: "ready", data }); })
      .catch(() => { if (!cancelled) setLoad({ state: "error" }); });
    return () => { cancelled = true; };
  }, []);

  if (load.state === "error") return null;
  const data = load.state === "ready" ? load.data : null;
  const total = data ? data.presumedHuman + data.automated : 0;
  const value = data ? (human ? data.presumedHuman : data.automated) : null;
  const pct = (n: number) => (total > 0 ? `${Math.round((n / total) * 100)}%` : "0%");
  const since = sinceLabel(data?.since ?? null);
  const line = value === null ? "" : `${fmt(value)} ${human ? "presumed human" : "automated"} requests ${since}, ${pct(value)} of all traffic`;
  const rows = data
    ? [...TALLY_CATEGORIES].sort((a, b) => (a === "presumed_human" ? -1 : b === "presumed_human" ? 1 : data.byCategory[b] - data.byCategory[a]))
    : [];
  const max = data ? Math.max(1, ...TALLY_CATEGORIES.map(c => data.byCategory[c])) : 1;
  const selected: TallyCategory = picked ?? (human ? "presumed_human" : rows.find(c => c !== "presumed_human") ?? "undeclared");

  return <div className="site-tally">
    <span className="site-tally-live" aria-live="polite">{line}</span>
    <div className="site-tally-row">
      <span><span className="site-tally-label">Requests served {since}</span></span>
      <span className="site-tally-controls">
        <span role="group" aria-label="Count to show" className="site-tally-switch">
          <button type="button" aria-pressed={human} onClick={() => { setHuman(true); setPicked(null); }}>Humans</button>
          <span aria-hidden="true">/</span>
          <button type="button" aria-pressed={!human} onClick={() => { setHuman(false); setPicked(null); }}>Not humans</button>
        </span>
        <button type="button" className="site-tally-count" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls={panelId} disabled={!data}>
          <span className="site-tally-live">{human ? "Presumed human requests" : "Automated requests"}</span>
          <strong>{value === null ? "Counting" : fmt(value)}</strong>
          <span>{open ? "Close" : "Breakdown"}</span>
        </button>
      </span>
    </div>
    {open && data ? <div id={panelId} className="site-tally-panel">
      <ul aria-label="Requests by type">
        {rows.map(c => {
          const active = c === "presumed_human" ? human : !human;
          return <li key={c}>
            <button type="button" aria-pressed={c === selected} data-active={active} onClick={() => setPicked(c)} onFocus={() => setPicked(c)} onMouseEnter={() => setPicked(c)}>
              <span>{capitalize(TALLY_LABELS[c])}</span>
              <span className="site-tally-bar" aria-hidden="true"><span style={{ width: `${Math.round((data.byCategory[c] / max) * 100)}%` }} /></span>
              <span className="site-tally-n">{fmt(data.byCategory[c])}</span>
            </button>
          </li>;
        })}
      </ul>
      <div className="site-tally-detail">
        <div className="site-tally-summary">
          <span>proper-respect.com has served {fmt(total)} page requests {since}</span>
          <span>{pct(data.presumedHuman)} presumed human · {pct(data.automated)} automated</span>
        </div>
        <p><strong>{capitalize(TALLY_LABELS[selected])}.</strong> {capitalize(TALLY_DEFINITIONS[selected])}<br /><span className="site-tally-muted">Spec id: {selected}</span></p>
        <p className="site-tally-muted">Counted on the server for every page request and classified by user agent. Nothing is network verified yet, so a bot that claims to be a browser counts as human. Assets and API calls excluded. No IPs or personal data are stored.</p>
      </div>
    </div> : null}
  </div>;
}
