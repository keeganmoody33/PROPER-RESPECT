"use client";

import { useRef, useState } from "react";
import { useConvexAuth, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { MailboxScanMode } from "@/src/server/mailbox-search";
import { MailboxConnectionNotice, MailboxDiscoveryRun, discoveryRunOwnsSearch, type DiscoveryRunAction } from "./mailbox-discovery-run";

import { RetainedMailboxRecheck } from "./retained-mailbox-recheck";

type Account = FunctionReturnType<typeof api.mailboxes.listAccounts>[number];
const modes: Array<{ mode: MailboxScanMode; title: string; action: string; continueAction: string; restartAction: string }> = [
  { mode: "KNOWN_PRODUCTS", title: "Known products", action: "Find known products", continueAction: "Continue known products", restartAction: "Restart known-product search" },
  { mode: "HISTORY", title: "Earlier mail", action: "Explore earlier mail", continueAction: "Continue earlier mail", restartAction: "Restart earlier mail" },
  { mode: "INCREMENTAL", title: "Recent updates", action: "Check recent updates", continueAction: "Continue recent updates", restartAction: "Restart recent updates" },
];
const date = (value: string) => new Date(value).toLocaleString();

export function mailboxReadNotice(result: {
  readCount: number; proposals: number; unmatchedCount?: number; hasMore: boolean;
  ambiguousProducts?: Array<{ productSlug: string; reason: "MULTIPLE_OWNER_RELATIONSHIPS" }>;
}) {
  const pending = result.ambiguousProducts ?? [];
  const review = pending.length > 0
    ? `Evidence for ${pending.map(item => item.productSlug).join(", ")} was retained privately but is not attached to a card. These products have multiple existing records that need to be reconciled before the evidence can be attached. No record was chosen and no duplicate card was added for them.`
    : "Review private discoveries in your collection.";
  return `Examined ${result.readCount} headers; ${result.proposals} catalog product matches and ${result.unmatchedCount ?? 0} unmatched records on this page. ${result.hasMore ? "More pages remain in this search." : "This query reached its final page."} ${review} Your saved relationship decisions and public information are unchanged.`;
}

function SourceProgress({ account }: { account: Account }) {
  return <div style={{ display: "grid", gap: "0.75rem", marginBlock: "1rem" }}>
    {modes.map(({ mode, title }) => {
      const progress = account.contexts?.find(context => context.mode === mode);
      return <div key={mode}>
        <strong>{title}</strong>
        {!progress ? <p>Not started.</p> : <>
          <p>{progress.messagesRead} headers examined across {progress.pagesRead} pages in this search; {progress.retainedRecords} new private records retained.</p>
          <p>{progress.status === "COMPLETE" ? "This query reached its final page." : "Coverage is partial; more pages or a retry may be needed."}
            {progress.after ? ` Window: ${date(new Date(progress.after * 1000).toISOString())} – ${date(new Date(progress.before * 1000).toISOString())}.` : ` Mail dated before ${date(new Date(progress.before * 1000).toISOString())}.`}</p>
          {progress.observedEarliest && <p>Dates present on examined messages: {date(progress.observedEarliest)} – {date(progress.observedLatest ?? progress.observedEarliest)}.</p>}
          <details><summary>Search and coverage details</summary>
            <p style={{ overflowWrap: "anywhere" }}>{progress.query}</p>
            <p>Five headers per page; no bodies or attachments. Spam and trash are excluded. Search results can change; examined message dates do not establish first or last product use. Overlapping refresh windows may re-examine messages without duplicating evidence.</p>
            <p>Updated {date(progress.updatedAt)}. {progress.restartCount > 0 ? `Search restarted ${progress.restartCount} time(s); retained evidence was preserved.` : ""}</p>
          </details>
        </>}
      </div>;
    })}
  </div>;
}

function UnmatchedRecords() {
  const records = usePaginatedQuery(api.mailboxDiscovery.listUnknown, {}, { initialNumItems: 10 });
  const choices = usePaginatedQuery(api.inventory.list, {}, { initialNumItems: 25 });
  const review = useMutation(api.mailboxDiscovery.reviewUnknown);
  const recheckRetained = useMutation(api.mailboxDiscovery.recheckRetained);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(id: Id<"mailboxUnknownRecords">, decision: "LINKED" | "DISMISSED", propId?: Id<"props">) {
    setBusy(true);
    try {
      await review({ id, decision, ...(propId ? { propId } : {}) });
      setNotice(decision === "LINKED" ? "Header evidence attached privately. Your relationship and usage claims are unchanged." : "Removed from the discovery inbox. The original evidence is retained privately.");
    } catch { setNotice("Could not save this review. Reload the inbox and try again."); }
    finally { setBusy(false); }
  }
  return <div>
    <RetainedMailboxRecheck onRecheck={cursor => recheckRetained({ paginationOpts: { cursor, numItems: 10 } })}/>
    <p>These headers were unmatched when first captured. Rechecking may already have proposed some products for private review. They remain here until you attach or dismiss them. Their senders are unverified source text. Inspect them before choosing whether they support a product already in your collection; add or correct that product first if necessary.</p>
    <p role="status">{notice}</p>
    {records.status === "LoadingFirstPage" && <p>Loading private discoveries…</p>}
    {records.status !== "LoadingFirstPage" && records.results.length === 0 && <p>No unmatched headers awaiting review.</p>}
    {records.results.map(record => <details key={record.id} style={{ marginBlock: "0.75rem" }}>
      <summary>{record.senderDomain ?? "Unrecognized sender"} · {record.accountLabel}</summary>
      <p>Retained {date(record.capturedAt)}. Source: Gmail metadata; activity actor unknown. This is not evidence of product use.</p>
      <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: "16rem", overflow: "auto" }}>{record.payload}</pre>
      <form onSubmit={event => {
        event.preventDefault();
        const value = new FormData(event.currentTarget).get("propId");
        if (typeof value === "string" && value) void submit(record.id, "LINKED", value as Id<"props">);
      }}>
        <label>Attach to a product in your collection
          <select name="propId" required defaultValue="" disabled={busy}>
            <option value="">Choose a product</option>
            {choices.results.map(item => <option key={item.prop._id} value={item.prop._id}>{item.product.name} · {item.prop.status.toLowerCase()}{item.prop.headline ? ` · ${item.prop.headline.slice(0, 70)}` : ""}</option>)}
          </select>
        </label>
        <div className="action-row">
          <button className="secondary-action" disabled={busy || choices.results.length === 0}>Attach privately</button>
          <button type="button" className="secondary-action" disabled={busy} onClick={() => void submit(record.id, "DISMISSED")}>Dismiss this discovery</button>
        </div>
      </form>
    </details>)}
    {records.status === "CanLoadMore" && <button className="secondary-action" onClick={() => records.loadMore(10)}>More unmatched headers</button>}
    {choices.status === "CanLoadMore" && <button className="secondary-action" onClick={() => choices.loadMore(25)}>Load more products to attach evidence</button>}
  </div>;
}

export function MailboxManagement() {
  const { isAuthenticated } = useConvexAuth();
  const accounts = useQuery(api.mailboxes.listAccounts, isAuthenticated ? {} : "skip");
  const disconnect = useMutation(api.mailboxes.disconnect);
  const maintenance = useMutation(api.mailboxes.setMaintenance);
  const restart = useMutation(api.mailboxes.restartSearch);
  const startDiscoveryRun = useMutation(api.mailboxes.startDiscoveryRun);
  const controlDiscoveryRun = useMutation(api.mailboxes.controlDiscoveryRun);
  const startRequests = useRef(new Map<string, string>());
  const [busy, setBusy] = useState(false);
  const [showUnknown, setShowUnknown] = useState(false);
  const [notice, setNotice] = useState(() => {
    const result = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("gmail");
    return result === "connected" ? "Gmail connected. Choose a bounded private discovery read below." :
      result === "failed" ? "Gmail authorization did not complete. Start a new connection attempt." : "";
  });
  async function operation(work: () => Promise<unknown>, success: string) {
    setBusy(true);
    try { await work(); setNotice(success); }
    catch { setNotice("This change could not be saved. Check the connection status and retry."); }
    finally { setBusy(false); }
  }
  async function read(account: Account, mode: MailboxScanMode) {
    setBusy(true);
    setNotice("Reading up to five message headers into private review…");
    try {
      const response = await fetch("/api/connect/mailboxes/google/read", { method: "POST",
        body: new URLSearchParams({ accountId: account.accountId, expectedGeneration: String(account.generation), mode }) });
      const result = await response.json();
      if (!response.ok) throw new Error();
      setNotice(mailboxReadNotice(result));
    } catch { setNotice("Gmail read did not complete. Check the account's recovery message below. Retained evidence and your collection remain safe."); }
    finally { setBusy(false); }
  }
  async function startRun(account: Account) {
    const key = `${account.accountId}:${account.generation}`;
    let requestId = startRequests.current.get(key);
    if (!requestId) {
      requestId = crypto.randomUUID();
      startRequests.current.set(key, requestId);
    }
    await operation(async () => {
      await startDiscoveryRun({ accountId: account.accountId, expectedGeneration: account.generation, requestId });
      startRequests.current.delete(key);
    }, "Bounded background discovery started. You can close this page and return to its progress. No recurring collection was enabled.");
  }
  async function controlRun(account: Account, action: DiscoveryRunAction) {
    const run = account.discoveryRun;
    if (!run) return;
    await operation(() => controlDiscoveryRun({ runId: run.id, expectedGeneration: account.generation, action }),
      action === "PAUSE" ? "Discovery paused. Already retained evidence is kept; further results will not be saved while paused." :
        action === "CANCEL" ? "Discovery cancelled. Retained evidence and relationship choices are unchanged." : "Background discovery resumed within its remaining budget.");
  }
  const gmailAccounts = accounts?.filter(account => account.provider === "GOOGLE");
  return <div className="connector-card" aria-labelledby="gmail-management-title">
    <h3 id="gmail-management-title">Gmail discovery</h3>
    <p>Find product clues in read-only message headers. Email presence never establishes use, importance, or a recommendation. Every account keeps separate evidence and search progress.</p>
    <form method="post" action="/api/connect/mailboxes/google/start">
      <button className="secondary-action" disabled={busy || !isAuthenticated}>Add Gmail account</button>
    </form>
    <p role="status" aria-live="polite">{notice}</p>
    {isAuthenticated && <MailboxConnectionNotice loading={accounts === undefined} gmailCount={gmailAccounts?.length ?? 0} connectedCount={gmailAccounts?.filter(account => account.status === "CONNECTED").length ?? 0}/>}
    {gmailAccounts?.map(account => <article key={account.accountId} style={{ borderTop: "1px solid currentColor", paddingBlock: "1rem", overflowWrap: "anywhere" }}>
      <h4>{account.accountLabel}</h4>
      <p>{account.status === "CONNECTED" ? "Connected" : account.status === "NEEDS_REAUTH" ? "Reconnect required" : "Disconnected"} · read-only headers · {account.maintenanceEnabled ? "Daily hosted discovery enabled" : "Manual discovery"}</p>
      <p>{account.lastSyncedAt ? `Last successful read: ${date(account.lastSyncedAt)}.` : "No successful read recorded yet."}</p>
      {account.lastFailure === "TEMPORARY" && <p role="alert">The last read failed. Try again; if it keeps failing, reconnect. Your retained evidence and relationships are unchanged.</p>}
      {account.lastFailure === "REAUTHORIZE" && <p role="alert">Google access expired or was revoked. Reconnect this account. Daily discovery is off until you explicitly enable it again.</p>}
      {account.lastFailure === "CURSOR_EXPIRED" && <p role="alert">A saved search page expired. Restart that search below. Repeated messages will not create duplicate evidence.</p>}
      <MailboxDiscoveryRun run={account.discoveryRun} connected={account.status === "CONNECTED"} busy={busy} onStart={() => void startRun(account)} onControl={action => void controlRun(account, action)}/>
      <div className="action-row">
        {modes.map(({ mode, action, continueAction, restartAction }) => {
          const progress = account.contexts?.find(context => context.mode === mode);
          return progress?.lastFailure === "CURSOR_EXPIRED" ? <button key={mode} className="secondary-action" disabled={busy || account.status !== "CONNECTED" || discoveryRunOwnsSearch(account.discoveryRun)}
            onClick={() => void operation(() => restart({ accountId: account.accountId, expectedGeneration: account.generation, mode, expectedQueryKey: progress.queryKey }), "Search cursor reset. Choose its read button to retry; existing evidence was preserved.")}>{restartAction}</button> :
            <button key={mode} className="secondary-action" disabled={busy || account.status !== "CONNECTED" || discoveryRunOwnsSearch(account.discoveryRun)}
              onClick={() => void read(account, mode)}>{progress?.cursor ? continueAction : action}</button>;
        })}
      </div>
      <SourceProgress account={account}/>
      <details><summary>Automatic discovery and account controls</summary>
        <p>Optional daily discovery runs on the hosted backend, even when this page is closed. Enabling it authorizes the first bounded page within 15 minutes, then at most one page daily. Each run reads at most five recent message headers, retains private evidence, and suggests discoveries for review. It starts with approximately the last month and overlaps subsequent windows by two days. Backlogs remain visible until their pages finish; this is not a live usage tracker or an exhaustive change feed.</p>
        <button className="secondary-action" disabled={busy || (!account.maintenanceEnabled && (account.status !== "CONNECTED" || discoveryRunOwnsSearch(account.discoveryRun)))}
          onClick={() => void operation(() => maintenance({ accountId: account.accountId, expectedGeneration: account.generation, enabled: !account.maintenanceEnabled }), account.maintenanceEnabled ? "Daily hosted discovery disabled. Existing evidence is retained." : "Daily hosted discovery enabled for this account. The first bounded page will run within 15 minutes, then at most once daily.")}>{account.maintenanceEnabled ? "Stop daily discovery" : "Enable daily discovery for this account"}</button>
        {account.nextMaintenanceAt && <p>Next read due: {date(new Date(account.nextMaintenanceAt).toISOString())}.</p>}
        <form method="post" action="/api/connect/mailboxes/google/start">
          <input type="hidden" name="accountId" value={account.accountId}/><input type="hidden" name="expectedGeneration" value={account.generation}/>
          <button className="secondary-action" disabled={busy}>Reconnect this Gmail account</button>
        </form>
        <button className="secondary-action" disabled={busy || account.status === "DISCONNECTED"}
          onClick={() => void operation(() => disconnect({ accountId: account.accountId, expectedGeneration: account.generation }), "Disconnected and stopped collection. Evidence and product relationships remain unchanged.")}>Disconnect and stop collection</button>
        <p>Disconnecting removes the saved credentials and stops future reads. Existing private evidence and relationship history are retained. You can also revoke this app in your Google account permissions.</p>
      </details>
    </article>)}
    <button className="secondary-action" aria-expanded={showUnknown} onClick={() => setShowUnknown(value => !value)}>{showUnknown ? "Hide unmatched headers" : "Review unmatched headers"}</button>
    {showUnknown && isAuthenticated && <UnmatchedRecords/>}
  </div>;
}
