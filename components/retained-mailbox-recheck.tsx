"use client";

import { useEffect, useRef, useState } from "react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";

type RecheckPage = FunctionReturnType<typeof api.mailboxDiscovery.recheckRetained>;
const MAX_PAGES = 100;
const emptyCounts = { examined: 0, matched: 0, createdDrafts: 0, alreadyClassified: 0, unmatched: 0, skipped: 0 };

export function RetainedMailboxRecheck({ onRecheck }: { onRecheck: (cursor: string | null) => Promise<RecheckPage> }) {
  const [counts, setCounts] = useState(emptyCounts);
  const [ambiguous, setAmbiguous] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "running" | "partial" | "done">("idle");
  const [error, setError] = useState("");
  const cursor = useRef<string | null>(null);
  const running = useRef(false);
  const stopped = useRef(false);
  useEffect(() => () => { stopped.current = true; }, []);

  async function recheck() {
    if (running.current) return;
    running.current = true;
    stopped.current = false;
    if (status === "done") {
      cursor.current = null;
      setCounts(emptyCounts);
      setAmbiguous([]);
    }
    setStatus("running");
    setError("");
    try {
      for (let page = 0; page < MAX_PAGES && !stopped.current; page++) {
        const result = await onRecheck(cursor.current);
        cursor.current = result.continueCursor;
        setCounts(previous => ({
          examined: previous.examined + result.examined, matched: previous.matched + result.matched,
          createdDrafts: previous.createdDrafts + result.createdDrafts, alreadyClassified: previous.alreadyClassified + result.alreadyClassified,
          unmatched: previous.unmatched + result.unmatched, skipped: previous.skipped + result.skipped,
        }));
        setAmbiguous(previous => [...new Set([...previous, ...result.ambiguousProducts.map(item => item.productSlug)])]);
        if (result.isDone) { setStatus("done"); return; }
      }
      setStatus("partial");
    } catch {
      setStatus("partial");
      setError("Could not recheck this page. Retry it; saved evidence and relationship choices are unchanged.");
    } finally { running.current = false; }
  }

  return <section aria-label="Recheck retained mailbox evidence" style={{ marginBlock: "1rem" }}>
    <h5>Find newly recognized products</h5>
    <p>Look for newly recognized products in up to 1,000 retained email headers. No new mail is read.</p>
    <p>Matches go to private review or support an existing product. Your saved relationships and public profile stay unchanged.</p>
    {status !== "idle" && <div role="status" aria-live="polite">
      <p>{counts.examined} retained headers checked; {counts.matched} catalog-matching headers; {counts.createdDrafts} new private candidates. Header matches are not product or usage counts.</p>
      <p>{counts.alreadyClassified} already classified; {counts.unmatched} still unmatched; {counts.skipped} skipped because unavailable or previously decided.</p>
      <p>{status === "running" ? "Checking retained evidence… Keep this page open." : status === "done"
        ? "Retained recheck reached its final page. This does not establish full mailbox coverage or product use."
        : "Recheck is partial. Continue from the last completed page; starting again later is replay-safe."}</p>
      {ambiguous.map(slug => <p key={slug}>{slug}: choose between existing records in discovery review. No card was selected automatically.</p>)}
    </div>}
    {error && <p role="alert">{error}</p>}
    <div className="action-row">
      <button className="secondary-action" disabled={status === "running"} onClick={() => void recheck()}>{status === "partial" ? "Continue retained recheck" : status === "done" ? "Recheck retained headers again" : "Recheck retained headers"}</button>
      {status === "running" && <button className="secondary-action" onClick={() => { stopped.current = true; }}>Stop after this page</button>}
    </div>
  </section>;
}
