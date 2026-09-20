"use client";

import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useState } from "react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type Detail = FunctionReturnType<typeof api.discoveryReview.details>;
type Candidate = FunctionReturnType<typeof api.discoveryReview.candidates>["page"][number];
type Attach = FunctionArgs<typeof api.discoveryReview.attach>;
type Result = FunctionReturnType<typeof api.discoveryReview.attach>;

export function DiscoveryResolutionView({ detail, candidates, hasMoreCandidates, loadingMore, onLoadMore, onAttach }: {
  detail: Detail; candidates: Candidate[]; hasMoreCandidates: boolean; loadingMore: boolean;
  onLoadMore: () => void; onAttach: (input: Attach) => Promise<Result>;
}) {
  const [choice, setChoice] = useState<{ id: Id<"props">; expectedHash: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selected = candidates.find(candidate => candidate.id === choice?.id && candidate.expectedHash === choice.expectedHash);
  const target = detail.target ?? selected;
  const expectedHash = detail.target ? detail.expectedHash : selected?.expectedHash;
  const complete = detail.batch.offset >= detail.batch.total;
  async function attach() {
    if (!target || !expectedHash || complete) return;
    setBusy(true);
    try {
      const result = await onAttach({ draftId: detail.id, propId: target.id, expectedHash });
      setMessage(`${result.processed} of ${result.total} originals processed. ${result.skippedDeleted} deleted originals excluded.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Attachment did not complete. Review the current records before retrying.");
    } finally { setBusy(false); }
  }
  return <form onSubmit={event => { event.preventDefault(); void attach(); }}>
    <p>Choose which existing relationship these retained originals support. Attaching them keeps your saved decisions and public profile unchanged.</p>
    <p>{detail.batch.offset} of {detail.batch.total} reviewed originals processed. {detail.batch.skippedDeleted} deleted originals excluded.</p>
    <details><summary>Originals in this attachment step ({detail.sources.length})</summary>
      <ul>{detail.sources.map(source => <li key={source.id}>{source.sourceLabel ? `${source.sourceLabel} · ` : ""}{source.sourceType} · <time dateTime={source.capturedAt}>{source.capturedAt}</time>{source.deleted ? " · Deleted; excluded from attachment" : " · Retained original"}</li>)}</ul>
    </details>
    {detail.target ? <p>Chosen relationship: <strong>{detail.target.headline || "No headline recorded"}</strong> · {detail.target.status.toLowerCase()}. Further steps keep this target.</p> : <>
      <label className="review-field">Existing relationship
        <select value={selected?.id ?? ""} disabled={busy} required onChange={event => {
          const candidate = candidates.find(item => item.id === event.target.value);
          setChoice(candidate ? { id: candidate.id, expectedHash: candidate.expectedHash } : null);
          setMessage("");
        }}>
          <option value="">Choose a relationship explicitly</option>
          {candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.headline || "No headline recorded"} · {candidate.confirmed ? candidate.status.toLowerCase() : "unconfirmed discovery"}{candidate.goTo ? " · saved go-to choice" : ""}</option>)}
        </select>
      </label>
      {!candidates.length && !hasMoreCandidates && <p>No matching saved relationships are available.</p>}
      {choice && !selected && <p role="status">The selected record changed. Review it and choose again.</p>}
      {selected && <blockquote>{selected.note || "No explanation recorded."}</blockquote>}
      {hasMoreCandidates && <button type="button" disabled={loadingMore || busy} onClick={onLoadMore}>{loadingMore ? "Loading relationships…" : "Load more matching relationships"}</button>}
    </>}
    <button type="submit" className="secondary-action" disabled={busy || !target || !expectedHash || complete}>
      {busy ? "Attaching…" : complete ? "Attachment complete" : detail.target ? `Continue attachment (${detail.batch.offset + 1}–${detail.batch.end})` : `Attach originals ${detail.batch.offset + 1}–${detail.batch.end} privately`}
    </button>
    <p role="status">{message}</p>
  </form>;
}

function Resolution({ draftId, bound, onAttach }: { draftId: Id<"draftImports">; bound: boolean; onAttach: (input: Attach) => Promise<Result> }) {
  const detail = useQuery(api.discoveryReview.details, { draftId });
  const boundNow = Boolean(detail?.target) || bound;
  const candidates = usePaginatedQuery(api.discoveryReview.candidates, boundNow ? "skip" : { draftId }, { initialNumItems: 10 });
  if (!detail || (!boundNow && candidates.status === "LoadingFirstPage")) return <p role="status">Loading retained originals and saved relationships…</p>;
  return <DiscoveryResolutionView detail={detail} candidates={candidates.results} hasMoreCandidates={!boundNow && candidates.status !== "Exhausted"} loadingMore={candidates.status === "LoadingMore"} onLoadMore={() => candidates.loadMore(10)} onAttach={onAttach} />;
}

export function DiscoveryReview() {
  const drafts = usePaginatedQuery(api.discoveryReview.list, {}, { initialNumItems: 10 });
  const attach = useMutation(api.discoveryReview.attach);
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  if (drafts.status === "LoadingFirstPage") return <p role="status">Checking retained discoveries awaiting a relationship choice…</p>;
  async function attachPrivately(input: Attach) {
    const result = await attach(input);
    setMessage(result.processed === result.total
      ? `Attachment complete: ${result.total} reviewed originals processed; ${result.skippedDeleted} deleted originals excluded. Your relationship decisions and public profile are unchanged.`
      : `${result.processed} of ${result.total} reviewed originals processed. Continue when ready.`);
    return result;
  }
  if (!drafts.results.length && drafts.status === "Exhausted" && !message) return null;
  return <section aria-labelledby="discovery-review-title">
    <h2 id="discovery-review-title">Retained discoveries awaiting your choice</h2>
    <p>These retained originals still need an explicit relationship choice or a completed attachment.</p>
    {drafts.results.map(draft => <details key={draft.id} onToggle={event => { const open = event.currentTarget.open; setOpened(current => ({ ...current, [draft.id]: open })); }}>
      <summary>{draft.name} · {draft.progress ? `${draft.progress.processed} of ${draft.progress.total} originals processed` : `${draft.evidenceCount} retained originals`}</summary>
      {draft.identityIssue ? <p role="status">{draft.identityIssue}</p> : opened[draft.id] && <Resolution draftId={draft.id} bound={Boolean(draft.progress)} onAttach={attachPrivately} />}
    </details>)}
    {drafts.status !== "Exhausted" && <button type="button" disabled={drafts.status === "LoadingMore"} onClick={() => drafts.loadMore(10)}>{drafts.status === "LoadingMore" ? "Loading discoveries…" : "Load more retained discoveries"}</button>}
    <p role="status">{message}</p>
  </section>;
}
