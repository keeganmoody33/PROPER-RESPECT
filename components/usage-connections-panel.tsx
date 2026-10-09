"use client";
import { useState, useEffect } from "react";
import "./usage-connections.css";
import { digest, grantScopeSchema, privateUsageTotals } from "@/src/domain/usage-sync";
import type { Id } from "@/convex/_generated/dataModel";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import type { ConnectionsAPI } from "@/src/client/usage-connection-api";
import type { PrivateUsageLoader } from "@/src/client/private-usage-loader";
import { relationshipHref } from "@/src/client/relationship-location";
type Call<K extends "approve" | "disconnect" | "erase"> = (args: FunctionArgs<ConnectionsAPI[K]>) => Promise<FunctionReturnType<ConnectionsAPI[K]>>;
export type SaveUsageSnapshot = (args: { sourceId: Id<"usageSources">; start: string; end: string; propId?: Id<"props"> }) => Promise<{
  propId: Id<"props">; rawEvidenceId: Id<"rawEvidence">; digest: string; replayed: boolean;
}>;

function PrivateUsageSnapshot({ sourceId, onSave, busy, onBusyChange }: {
  sourceId: Id<"usageSources">; onSave: SaveUsageSnapshot; busy: boolean; onBusyChange: (busy: boolean) => void;
}) {
  const [start, setStart] = useState(""), [end, setEnd] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<Awaited<ReturnType<SaveUsageSnapshot>> | null>(null);
  const changeDate = (value: string, setDate: (value: string) => void) => { setDate(value); setSaved(null); setError(""); };
  return <section aria-labelledby="usage-snapshot-title">
    <h3 id="usage-snapshot-title">Save a private usage snapshot</h3>
    <p>Choose up to seven UTC days from this source. The end date is included. The history totals above may include other dates; the saved snapshot uses only the dates you choose.</p>
    <p>Nothing is reviewed or published by saving. Historical account identity and account context remain unverified.</p>
    <form onSubmit={async event => {
      event.preventDefault(); if (busy) return;
      setError(""); setSaved(null);
      const first = Date.parse(`${start}T00:00:00.000Z`), last = Date.parse(`${end}T00:00:00.000Z`);
      const exclusiveEnd = last + 86_400_000;
      if (!Number.isFinite(first) || !Number.isFinite(last) || new Date(first).toISOString().slice(0, 10) !== start || new Date(last).toISOString().slice(0, 10) !== end || last < first || exclusiveEnd - first > 7 * 86_400_000) {
        setError("Choose a start and inclusive end date spanning no more than seven UTC days."); return;
      }
      onBusyChange(true);
      try { setSaved(await onSave({ sourceId, start: new Date(first).toISOString(), end: new Date(exclusiveEnd).toISOString() })); }
      catch (failure) {
        const code = failure instanceof ConvexError && failure.data && typeof failure.data === "object" && "code" in failure.data ? failure.data.code : undefined;
        setError(code === "NO_MODERN_RESPONSES" ? "No modern response history was found in these dates. Choose another window."
          : code === "HISTORY_SCAN_LIMIT" ? "This source exceeds the supported snapshot scan limit. Existing snapshots remain available."
            : "The private snapshot could not be confirmed. Retry this window; an existing snapshot will be reused.");
      }
      finally { onBusyChange(false); }
    }}>
      <label>Snapshot starts, UTC<input required type="date" value={start} disabled={busy} onChange={event => changeDate(event.target.value, setStart)} /></label>
      <label>Snapshot ends, UTC (inclusive)<input required type="date" value={end} disabled={busy} onChange={event => changeDate(event.target.value, setEnd)} /></label>
      <button disabled={busy} type="submit">{busy ? "Saving private snapshot…" : "Save private snapshot"}</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {saved && <div><p role="status">{saved.replayed ? "This snapshot was already saved privately. The same private card is available." : "Snapshot saved privately. Open its card to review the measurements and configure your relationship."}</p>
      <a href={`/app/collection${relationshipHref(saved.propId)}`}>Configure saved private card</a></div>}
    <p>Deleting retained source history removes its private snapshots. Published cards require a separate unpublish.</p>
  </section>;
}

export function UsageConnectionsPanel({ grants, approve, disconnect, erase, loadUsage, onSaveUsageSnapshot }: {
  grants: FunctionReturnType<ConnectionsAPI["list"]> | undefined;
  approve: Call<"approve">; disconnect: Call<"disconnect">; erase: Call<"erase">; loadUsage: PrivateUsageLoader;
  onSaveUsageSnapshot?: SaveUsageSnapshot;
}) {
  const [source, setSource] = useState(""), [device, setDevice] = useState(""), [context, setContext] = useState("unclassified");
  const [start, setStart] = useState(""), [expires, setExpires] = useState(""), [retain, setRetain] = useState(true);
  const [code, setCode] = useState<string | null>(null), [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false), [insight, setInsight] = useState<ReturnType<typeof privateUsageTotals> | null>(null);
  const [insightSource, setInsightSource] = useState<{ sourceId: Id<"usageSources">; context: string; sourceKey: string; loadedAt: string } | null>(null);
  const [clock, setClock] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 10_000); return () => clearInterval(timer); }, []);
  const load = async (sourceId: Id<"usageSources">) => {
    setBusy(true); setMessage(""); setInsight(null); setInsightSource(null);
    try {
      setInsight(await loadUsage(sourceId));
      const grant = grants?.find(grant => grant.sourceId === sourceId);
      if (grant) setInsightSource({ sourceId, context: grant.scope.context, sourceKey: grant.scope.sourceKey, loadedAt: new Date().toISOString() });
    } catch { setMessage("Private history could not be loaded. Try again."); }
    finally { setBusy(false); }
  };
  return <div className="connection-panel">
    <p>Codex local token history · Private · Development</p>
    <h1>Connect your Codex history</h1>
    <p>Prepare the helper on your approved Mac. Copy its source identity and device digest below. Keep personal and work history in separate sources. Choose unclassified for mixed history whose context has not been established.</p>
    <form onSubmit={async event => {
      event.preventDefault(); if (busy) return; setBusy(true); setMessage(""); setCode(null);
      try {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        const pairingCode = [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
        const scope = grantScopeSchema.parse({ sourceKey: source, deviceDigest: device, context, accountIdentity: "unverified", provider: "codex",
          start: `${start}T00:00:00.000Z`, end: new Date(`${expires}T00:00:00.000Z`).toISOString(), expiresAt: `${expires}T00:00:00.000Z`, retainOnDisconnect: retain,
          destination: "https://utmost-mongoose-374.convex.cloud" });
        await approve({ scopeJson: JSON.stringify(scope), codeDigest: digest(pairingCode) }); setCode(pairingCode);
        setMessage("Approval saved. Pair the helper within five minutes, then start the approved backfill.");
      } catch { setMessage("Approval failed. Check the source and device digests, history dates, and development setup."); }
      finally { setBusy(false); }
    }}>
      <label>Source identity<input required value={source} onChange={event => setSource(event.target.value)} pattern="[a-f0-9]{64}" /></label>
      <label>Device digest<input required value={device} onChange={event => setDevice(event.target.value)} pattern="[a-f0-9]{64}" /></label>
      <label>Account context<select value={context} onChange={event => setContext(event.target.value)}><option value="unclassified">Unclassified mixed history</option><option value="personal">Personal</option><option value="work">Work, separately authorized</option></select></label>
      <label>History starts, UTC<input required type="date" value={start} onChange={event => setStart(event.target.value)} /></label>
      <label>Access expires, UTC, within 31 days<input required type="date" value={expires} onChange={event => setExpires(event.target.value)} /></label>
      <label><input type="checkbox" checked={retain} onChange={event => setRetain(event.target.checked)} />Retain imported history after disconnect, while I remain authorized to keep it</label>
      <p>Destination: https://utmost-mongoose-374.convex.cloud. Numeric counters and opaque event identities only. The helper reads only the directory you selected locally. Historical account identity remains unverified. Foreground sync requires a separate helper command.</p>
      <button disabled={busy} type="submit">Approve numeric history and pair</button>
    </form>
    {code && <div><p>One-use code, expires in five minutes. Enter it in the helper.</p><code className="pair-code">{code}</code></div>}
    <p role="status">{message}</p>
    <h2>Private connections</h2>
    {!grants ? <p>Loading connections…</p> : grants.length === 0 ? <p>No connection yet. Nothing has been imported.</p> : grants.map(grant => <article key={grant.grantId}>
      <h3>Codex · {grant.scope.context}</h3><p>{grant.state === "revoked" ? "revoked" : clock >= Date.parse(grant.scope.expiresAt) || (grant.state === "pending" && clock >= grant.pairExpiresAt) ? "expired" : grant.state} · Historical account unverified · Partial coverage</p>
      <p>History from {grant.scope.start.slice(0, 10)} · Last sync {grant.lastSyncedAt ?? "not received"} · {grant.sequence} acknowledged packets</p>
      {(grant.state === "revoked" || !grant.scope.retainOnDisconnect) && <p>Erasing retained history removes private snapshots made from this source. Published cards require a separate unpublish.</p>}
      <button disabled={busy} onClick={() => load(grant.sourceId)}>View private usage</button>{" "}
      <button disabled={busy || grant.state === "revoked"} onClick={async () => {
        setBusy(true); setCode(null); setInsight(null); setInsightSource(null);
        try {
          const result = await disconnect({ grantId: grant.grantId });
          if (!result.retained) { let done = false; while (!done) done = (await erase({ grantId: grant.grantId })).done; }
          setMessage(result.retained ? "Disconnected. Imported history remains private under your retention approval." : "Disconnected. Imported history and private snapshots erased. Published cards require a separate unpublish.");
        } catch { setMessage("Disconnect or deletion could not be confirmed. Retry to verify revocation."); }
        finally { setBusy(false); }
      }}>Disconnect</button>{grant.state === "revoked" && <button disabled={busy} onClick={async () => {
        setBusy(true); setInsight(null); setInsightSource(null);
        try { let done = false; while (!done) done = (await erase({ grantId: grant.grantId })).done; setMessage("Imported history and private snapshots erased. Published cards require a separate unpublish."); }
        catch { setMessage("Deletion could not be confirmed. Retry after checking current source access."); }
        finally { setBusy(false); }
      }}>Erase imported history</button>}
    </article>)}
    {insight && <section><h2>Your private usage</h2>{insightSource && <p>{insightSource.context} · Source {insightSource.sourceKey.slice(0,12)} · Snapshot loaded {insightSource.loadedAt}. Choose View private usage to refresh.</p>}<p>Partial local history. Historical account unverified. Missing counts stay unknown.</p>
      <p>Retained event times: {insight.earliestAt ?? "unavailable"} to {insight.latestAt ?? "unavailable"}. Gaps between events do not establish zero usage.</p>
      <table><caption>Exact token counters</caption><thead><tr><th>Metric</th><th>Response records</th><th>Legacy observed increases</th></tr></thead><tbody>{insight.responses.map((row, i) => <tr key={row.metric}><th>{row.metric.replaceAll("_", " ")}</th><td>{row.value ?? (row.conflict ? "Conflicted" : "Unknown")}</td><td>{insight.legacy[i].value ?? (insight.legacy[i].conflict ? "Conflicted" : "Unknown")}</td></tr>)}</tbody></table>
      <p>Quota, API-equivalent cost and actual charges are unavailable from this source. Token usage does not establish skill. Nothing here is published to your profile.</p>
      {insightSource && onSaveUsageSnapshot && <PrivateUsageSnapshot key={insightSource.sourceId} sourceId={insightSource.sourceId} onSave={onSaveUsageSnapshot} busy={busy} onBusyChange={setBusy} />}
    </section>}
  </div>;
}
