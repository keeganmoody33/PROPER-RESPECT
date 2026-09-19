"use client";

export type DiscoveryRun = {
  id: string;
  status: "RUNNING" | "PAUSED" | "FAILED" | "COMPLETE" | "LIMIT_REACHED" | "CANCELLED";
  phase: "KNOWN_PRODUCTS" | "HISTORY";
  phaseAttempts: number;
  totalAttempts: number;
  pagesRead: number;
  messagesRead: number;
  retainedRecords: number;
  maxAttemptsPerPhase: number;
  maxHeaders: number;
  failure?: "TEMPORARY" | "REAUTHORIZE" | "CURSOR_EXPIRED" | "LEASE_EXPIRED" | "CURSOR_CYCLE";
  updatedAt: string;
};
export type DiscoveryRunAction = "PAUSE" | "RESUME" | "CANCEL";

export function discoveryRunOwnsSearch(run?: DiscoveryRun | null) {
  return Boolean(run && ["RUNNING", "PAUSED", "FAILED"].includes(run.status));
}

const statusText: Record<DiscoveryRun["status"], string> = {
  RUNNING: "Discovery is running in the background. You can close this page.",
  PAUSED: "Discovery is paused. Already retained evidence is kept; further results will not be saved while paused.",
  FAILED: "Discovery stopped after a failure. Coverage is partial; retained evidence is safe.",
  COMPLETE: "Both searches reached their final pages. This is query coverage, not proof that every product or every period of use was found.",
  LIMIT_REACHED: "This run reached its budget. Coverage is partial. Another explicitly started run can continue the remaining search.",
  CANCELLED: "Discovery is cancelled. Retained evidence and your relationship choices are unchanged.",
};
const failureText: Record<NonNullable<DiscoveryRun["failure"]>, string> = {
  TEMPORARY: "A provider request failed. Resume to retry within the remaining budget.",
  LEASE_EXPIRED: "A worker did not finish in time. Resume to retry within the remaining budget.",
  REAUTHORIZE: "Reconnect this Gmail account before starting another run.",
  CURSOR_EXPIRED: "Cancel this run, then restart the affected search below. Existing evidence stays private and replay-safe.",
  CURSOR_CYCLE: "The provider repeated a search cursor. Cancel this run, then restart the affected search below.",
};

export function MailboxConnectionNotice({ loading, gmailCount, connectedCount }: {
  loading: boolean; gmailCount: number; connectedCount: number;
}) {
  if (loading) return <p>Loading your mailbox connections…</p>;
  if (connectedCount > 0) return null;
  return <p role="status">{gmailCount === 0 ? "No Gmail accounts are connected in this application." : "None of your Gmail accounts currently has an active connection."} Signing in with Google does not grant mailbox access. Use Add Gmail account or reconnect an existing account to authorize private discovery here.</p>;
}

export function MailboxDiscoveryRun({ run, connected, busy, onStart, onControl }: {
  run?: DiscoveryRun | null; connected: boolean; busy: boolean;
  onStart: () => void; onControl: (action: DiscoveryRunAction) => void;
}) {
  const ownsSearch = discoveryRunOwnsSearch(run);
  const canResume = run?.status === "PAUSED" || (run?.status === "FAILED" && ["TEMPORARY", "LEASE_EXPIRED"].includes(run.failure ?? ""));
  return <section aria-label="Background mailbox discovery" style={{ marginBlock: "1rem" }}>
    <h5>Discover products across your mailbox</h5>
    <p>Search up to 1,000 message headers for products to review privately. No bodies or attachments.</p>
    <p>Unknown senders remain reviewable. You decide which products you use; discovery does not change relationships or publish anything.</p>
    <details><summary>Search limits</summary>
      <p>Up to 100 catalog-search pages and 100 earlier-mail pages, five headers per attempt. The 1,000 header-attempt cap includes failed attempts and retries. Spam and trash are excluded.</p>
      <p>This is a finite run, separate from optional daily discovery below. A budget limit is not complete mailbox coverage. Email is a product clue, not proof of use.</p>
      {run && <p>{run.phaseAttempts} of {run.maxAttemptsPerPhase} page attempts in this phase; {run.totalAttempts * 5} of {run.maxHeaders} header-attempt budget used. Retries consume budget and do not duplicate retained evidence.</p>}
    </details>
    {run && <div aria-live="polite">
      <p>{statusText[run.status]}</p>
      <p>{run.messagesRead} headers examined across {run.pagesRead} successful pages; {run.retainedRecords} new private records retained.</p>
      <p>Current search: {run.phase === "KNOWN_PRODUCTS" ? "catalog products" : "earlier mail"}.</p>
      {run.status === "FAILED" && run.failure && <p role="alert">{failureText[run.failure]}</p>}
      <p>Updated {new Date(run.updatedAt).toLocaleString()}.</p>
    </div>}
    <div className="action-row">
      {!ownsSearch && <button className="secondary-action" disabled={busy || !connected} onClick={onStart}>{run ? "Start another bounded discovery run" : "Start bounded background discovery"}</button>}
      {run?.status === "RUNNING" && <button className="secondary-action" disabled={busy} onClick={() => onControl("PAUSE")}>Pause discovery</button>}
      {canResume && <button className="secondary-action" disabled={busy || !connected} onClick={() => onControl("RESUME")}>Resume discovery</button>}
      {ownsSearch && <button className="secondary-action" disabled={busy} onClick={() => onControl("CANCEL")}>Cancel discovery</button>}
    </div>
    {ownsSearch && <p>Single-page reads and daily discovery wait while this run owns the search. Pause keeps that reservation; cancel releases it. A provider request already sent may finish, but its results will not be saved after pause or cancellation.</p>}
  </section>;
}
