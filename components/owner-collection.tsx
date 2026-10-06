"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { openRelationship, relationshipFromHash, relationshipHref, subscribeRelationship } from "@/src/client/relationship-location";
import { InventoryDetails, RetainedEvidenceIntake, SavedRelationshipPreview } from "./private-inventory";
import { PrivateMeasurements } from "./measurement-review";
import { DiscoveryReview } from "./discovery-review";
import styles from "./private-inventory.module.css";

export type LocatedRelationship = FunctionReturnType<typeof api.inventory.locator>["page"][number];
const views = ["My tools", "Current", "Testing", "Go-to", "Past use", "Discoveries", "All"] as const;
type View = typeof views[number];

function matchesView(row: LocatedRelationship, view: View) {
  switch (view) {
    case "All": return true;
    case "My tools": return row.confirmed;
    case "Discoveries": return !row.confirmed;
    case "Current": return row.confirmed && row.status === "ACTIVE";
    case "Testing": return row.confirmed && row.status === "TESTING";
    case "Past use": return row.confirmed && row.status === "ARCHIVED";
    case "Go-to": return row.confirmed && row.goTo && row.status !== "ARCHIVED";
  }
}

export function relationshipLabel(row: LocatedRelationship) {
  if (!row.confirmed) return "Needs your decision";
  return `${row.status === "ACTIVE" ? "Currently use" : row.status === "TESTING" ? "Testing now" : "Past use"}${row.goTo && row.status !== "ARCHIVED" ? " · Go-to" : ""}`;
}

export function RelationshipFinder({ records, complete, loading, onLoadMore }: {
  records: LocatedRelationship[]; complete: boolean; loading: boolean; onLoadMore: () => void;
}) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("My tools");
  const query = search.trim().toLocaleLowerCase();
  useEffect(() => {
    if ((query || view !== "My tools") && !complete && !loading) onLoadMore();
  }, [query, view, complete, loading, onLoadMore]);
  const matches = records.filter(row => matchesView(row, view) && `${row.name} ${row.domain}`.toLocaleLowerCase().includes(query));
  return <>
    <label className={styles.finder}>Find a tool
      <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search your tools and discoveries" />
    </label>
    <nav className={styles.views} aria-label="Find relationships">{views.map(option => <button key={option} type="button" className="secondary-action" aria-pressed={view === option} onClick={() => setView(option)}>{option}</button>)}</nav>
    <p className={styles.hint}>My tools are relationships you have confirmed. Discoveries still need your decision. Past use is separate from the saved decisions inside each relationship.</p>
    <p role="status">{complete ? `${matches.length} matching relationship${matches.length === 1 ? "" : "s"}.` : `${records.length} relationships checked. ${loading ? "Checking more…" : "More remain to check."}`}</p>
    {matches.length === 0 && <p>{complete ? "No relationships match this view. Try All, change your search, or add a product." : "No matches yet. Results are incomplete while more relationships remain."}</p>}
    <ul className={styles.results}>{matches.map(row => <li key={row.propId}>
      <a href={relationshipHref(row.propId)} className={styles.result}>
        <strong>{row.name}</strong><span>{relationshipLabel(row)}</span>
        <span>{row.confirmed ? row.headline || "Add what this helps you do" : "Inspect the evidence before deciding"}</span>
        <small>{row.domain} · Record {row.propId.slice(-8)}</small>
      </a>
    </li>)}</ul>
    {!complete && <button type="button" className="secondary-action" disabled={loading} onClick={onLoadMore}>{loading ? "Checking relationships…" : "Check more relationships"}</button>}
  </>;
}

function RelatedRelationships({ propId }: { propId: Id<"props"> }) {
  const { results, status, loadMore } = usePaginatedQuery(api.inventory.related, { propId }, { initialNumItems: 25 });
  if (status === "LoadingFirstPage") return <p role="status">Checking other records for this product…</p>;
  if (status === "Exhausted" && results.length < 2) return null;
  return <div className={styles.source}>
    <label>Relationship record
      <select value={propId} onChange={event => openRelationship(event.target.value)}>
        {!results.some(row => row.propId === propId) && <option value={propId}>Selected record {propId.slice(-8)}</option>}
        {results.map(row => <option key={row.propId} value={row.propId}>{relationshipLabel(row)} · {row.headline || "No explanation recorded"} · Record {row.propId.slice(-8)}</option>)}
      </select>
    </label>
    <p>These records keep separate decisions and evidence. Selecting one does not merge or confirm them.</p>
    {status !== "Exhausted" && <button type="button" className="secondary-action" disabled={status === "LoadingMore"} onClick={() => loadMore(25)}>Check more records for this product</button>}
  </div>;
}

export function RelationshipFocus({ name, label, children }: { name: string; label: string; children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <section className={styles.focus} aria-labelledby="relationship-title">
    <a href="#private-collection-title" className="text-link">← Back to my collection</a>
    <p className="onboarding-kicker">YOUR PRIVATE RELATIONSHIP · {label}</p>
    <h2 ref={heading} tabIndex={-1} id="relationship-title">{name}</h2>
    <p>Save your understanding of this tool. Your public profile changes only after a separate sharing preview and approval.</p>
    {children}
  </section>;
}

function SelectedRelationship({ propId, brandEnrichmentAvailable }: { propId: string; brandEnrichmentAvailable: boolean }) {
  const item = useQuery(api.inventory.detail, { propId });
  const save = useMutation(api.inventory.save);
  if (item === undefined) return <p role="status">Opening your relationship…</p>;
  if (item === null) return <div role="status"><p>This relationship is unavailable for this account.</p><a href="#private-collection-title">Back to my collection</a></div>;
  return <RelationshipFocus name={item.product.name} label={item.prop.confirmedAt || item.prop.visibility !== "DRAFT" ? "Saved tool" : "Needs your decision"}>
    <RelatedRelationships propId={item.prop._id} />
    <PrivateMeasurements propId={item.prop._id} />
    <SavedRelationshipPreview item={item} initiallyOpen={item.product.slug === "github"} />
    {item.prop.visibility === "DRAFT" && !item.prop.confirmedAt && <p>Not sure this belongs? <a href="#private-collection-title">Leave it as an undecided discovery</a>. Opening or leaving this record does not confirm use.</p>}
    <InventoryDetails item={item} onSave={save} brandEnrichmentAvailable={brandEnrichmentAvailable} focused />
  </RelationshipFocus>;
}

export function OwnerCollection({ brandEnrichmentAvailable = false }: { brandEnrichmentAvailable?: boolean }) {
  const importPacket = useMutation(api.retainedEvidence.importPacket);
  const selected = useSyncExternalStore(subscribeRelationship, relationshipFromHash, () => "");
  const inventory = usePaginatedQuery(api.inventory.locator, {}, { initialNumItems: 25 });
  return <section className={styles.inventory} aria-labelledby="private-collection-title">
    <h2 id="private-collection-title">My collection</h2>
    <p>Find a tool, explain why it matters, and keep track of what changes.</p>
    {selected ? <SelectedRelationship key={selected} propId={selected} brandEnrichmentAvailable={brandEnrichmentAvailable} /> : <>
      <RelationshipFinder records={inventory.results} complete={inventory.status === "Exhausted"} loading={inventory.status === "LoadingFirstPage" || inventory.status === "LoadingMore"} onLoadMore={() => inventory.loadMore(25)} />
      <details className={styles.intake}><summary>Review retained discoveries</summary><DiscoveryReview /></details>
      <RetainedEvidenceIntake onImport={packet => importPacket({ packet })} />
    </>}
  </section>;
}
