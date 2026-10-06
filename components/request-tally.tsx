"use client";

import { useEffect, useId, useState } from "react";
import { TALLY_CATEGORIES, TALLY_DEFINITIONS, TALLY_LABELS, type TallyCategory, type TallySnapshot } from "@/src/server/request-tally";

type Load = { state: "loading" } | { state: "error" } | { state: "ready"; data: TallySnapshot };
type CountGroup = "presumed_human" | "automated" | "undeclared";
const COUNT_LABELS: Record<CountGroup, string> = { presumed_human: "Presumed human", automated: "Automated", undeclared: "Unidentified" };

const fmt = (n: number) => n.toLocaleString("en-US");
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function sinceLabel(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `since ${date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "America/New_York" })}`;
}

export function RequestTally() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [group, setGroup] = useState<CountGroup>("presumed_human");
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
  const total = data ? data.presumedHuman + data.automated + data.unidentified : 0;
  const value = data ? (group === "presumed_human" ? data.presumedHuman : group === "undeclared" ? data.unidentified : data.automated) : null;
  const pct = (n: number) => (total > 0 ? `${Math.round((n / total) * 100)}%` : "0%");
  const since = sinceLabel(data?.since ?? null);
  const dateSuffix = since ? ` ${since}` : "";
  const line = value === null ? "" : `${fmt(value)} ${COUNT_LABELS[group].toLowerCase()} requests${dateSuffix}, ${pct(value)} of counted page requests`;
  const rows = data
    ? [...TALLY_CATEGORIES].sort((a, b) => (a === "presumed_human" ? -1 : b === "presumed_human" ? 1 : data.byCategory[b] - data.byCategory[a]))
    : [];
  const max = data ? Math.max(1, ...TALLY_CATEGORIES.map(c => data.byCategory[c])) : 1;
  const selected: TallyCategory = picked ?? (group === "automated" ? rows.find(c => c !== "presumed_human" && c !== "undeclared") ?? "unattributed_automation" : group);

  return <div className="site-tally">
    <span className="site-tally-live" aria-live="polite">{line}</span>
    <div className="site-tally-row">
      <span><span className="site-tally-label">Requests served{dateSuffix}</span></span>
      <span className="site-tally-controls">
        <span role="group" aria-label="Count to show" className="site-tally-switch">
          {(Object.keys(COUNT_LABELS) as CountGroup[]).map(key => <button key={key} type="button" aria-pressed={group === key} onClick={() => { setGroup(key); setPicked(null); }}>{COUNT_LABELS[key]}</button>)}
        </span>
        <button type="button" className="site-tally-count" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls={panelId} disabled={!data}>
          <span className="site-tally-live">{COUNT_LABELS[group]} requests</span>
          <strong>{value === null ? "Counting" : fmt(value)}</strong>{" "}
          <span>{open ? "Close" : "Breakdown"}</span>
        </button>
      </span>
    </div>
    {open && data ? <div id={panelId} className="site-tally-panel">
      <ul aria-label="Requests by type">
        {rows.map(c => {
          const active = c === "presumed_human" || c === "undeclared" ? group === c : group === "automated";
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
          <span>proper-respect.com has served {fmt(total)} page requests{dateSuffix}</span>
          <span>{pct(data.presumedHuman)} presumed human · {pct(data.automated)} automated · {pct(data.unidentified)} unidentified</span>
        </div>
        <p><strong>{capitalize(TALLY_LABELS[selected])}.</strong> {capitalize(TALLY_DEFINITIONS[selected])}</p>
        <p className="site-tally-muted">Eligible page requests are classified by declared user agent. Identity is not verified, so automation claiming to be a browser counts as presumed human. Assets, API calls and prefetches are excluded; failed writes can drop requests. The tally stores category totals and a start timestamp, without IP addresses, account identifiers, paths or raw user agents.</p>
      </div>
    </div> : null}
  </div>;
}
