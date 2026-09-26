"use client";

import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { useRef, useState, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { inventoryViews, inInventoryView, isRelationshipConfirmed, type InventoryView } from "@/src/domain/inventory";
import { privateCardPrimaryLink } from "@/src/domain/product-destination";
import { AccountEvidence } from "./account-evidence";
import { ProductCard } from "./product-card";
import { PrivateEvidencePanel } from "./private-evidence-panel";
import { ProductBrandControls } from "./product-brand-controls";
import { DiscoveryReview } from "./discovery-review";
import styles from "./private-inventory.module.css";

export type InventoryData = {
  cards: FunctionReturnType<typeof api.inventory.list>["page"];
  hasMore: boolean;
  loadingMore?: boolean;
};
type Item = InventoryData["cards"][number];
export type InventoryEvidence = FunctionReturnType<typeof api.inventory.evidence>["page"];
type SaveInput = FunctionArgs<typeof api.inventory.save>;
type SaveResult = FunctionReturnType<typeof api.inventory.save>;

function History({ propId }: { propId: Id<"props"> }) {
  const { results, status, loadMore } = usePaginatedQuery(api.inventory.history, { propId }, { initialNumItems: 10 });
  return <div>
    <p>Owner decisions, recorded when saved. Earlier unknown dates remain unknown.</p>
    <ol>{results.map(event => <li key={event._id}>
      <time dateTime={event.recordedAt}>{new Date(event.recordedAt).toLocaleString()}</time>
      {` · ${event.before.confirmed ? event.before.status.toLowerCase() : "discovery"} → ${event.after.status.toLowerCase()}`}
      {event.after.goTo ? " · designated go-to" : " · not designated go-to"}
      {event.before.activityEvidenceId && !event.after.activityEvidenceId && " · supporting snapshot removed"}
      {event.after.activityEvidenceId && event.after.activityEvidenceId !== event.before.activityEvidenceId && " · supporting snapshot selected"}
      {event.after.headline && <p>{event.after.headline}</p>}
      {event.after.note && <p>{event.after.note}</p>}
      {event.after.supportingUrl && <a href={event.after.supportingUrl} target="_blank" rel="noreferrer">Selected work sample or workflow ↗</a>}
    </li>)}</ol>
    {status === "CanLoadMore" && <button type="button" className="secondary-action" onClick={() => loadMore(10)}>Earlier decisions</button>}
    {status === "Exhausted" && !results.length && <p>No private relationship decisions saved yet.</p>}
  </div>;
}

function RelationshipEditor({ item, evidence, onSave }: { item: Item; evidence: InventoryEvidence; onSave: (input: SaveInput) => Promise<SaveResult> }) {
  const confirmed = isRelationshipConfirmed(item.prop);
  const [status, setStatus] = useState(item.prop.status as string);
  const [selectedRelationship, setSelectedRelationship] = useState(confirmed);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const retry = useRef<{ body: string; id: string } | null>(null);
  async function submit(form: FormData) {
    if (!selectedRelationship) { setMessage("Choose how this product fits your collection."); return; }
    setBusy(true);
    setMessage("");
    const activityChoice = String(form.get("activityEvidenceId") ?? "");
    const fields = {
      propId: item.prop._id, expectedVersion: item.prop.relationshipVersion ?? 0,
      status: status as SaveInput["status"], goTo: form.get("goTo") === "on",
      headline: String(form.get("headline") ?? ""), note: String(form.get("note") ?? ""),
      startedAt: String(form.get("startedAt") ?? "") || undefined,
      supportingUrl: String(form.get("supportingUrl") ?? "") || undefined,
      activityEvidenceId: (activityChoice === "__remove__" ? undefined : activityChoice || undefined) as Id<"rawEvidence"> | undefined,
      clearActivity: activityChoice === "__remove__" ? true : undefined,
    };
    const body = JSON.stringify(fields);
    if (retry.current?.body !== body) retry.current = { body, id: crypto.randomUUID() };
    try {
      await onSave({ ...fields, operationId: retry.current.id });
      retry.current = null;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed. Your previous decisions remain intact.");
    } finally { setBusy(false); }
  }
  return <form onSubmit={event => {
    event.preventDefault();
    void submit(new FormData(event.currentTarget));
  }} className={styles.editor}>
    <fieldset disabled={busy}>
      <legend>{confirmed ? "Your relationship" : "Confirm this discovery"}</legend>
      <label>How it fits
        <select name="status" value={selectedRelationship ? status : ""} onChange={event => { setStatus(event.target.value); setSelectedRelationship(Boolean(event.target.value)); }} required>
          <option value="" disabled>Choose a relationship</option>
          <option value="ACTIVE">Currently use</option><option value="TESTING">Testing now</option><option value="ARCHIVED">Past use / archived</option>
        </select>
      </label>
      <label className={styles.toggle}><input name="goTo" type="checkbox" defaultChecked={item.prop.goTo ?? false} />One of my go-to tools</label>
      <p className={styles.hint}>Your designation. Frequency and activity never award it automatically. Archiving keeps earlier choices in history.</p>
      <label>What it helps you do (optional)<input name="headline" maxLength={240} defaultValue={confirmed ? item.prop.headline : ""} /></label>
      <label>Explanation or workflow (optional)<textarea name="note" rows={2} maxLength={4000} defaultValue={confirmed || item.prop.ownerEntered ? item.prop.note : ""} /></label>
      {item.prop.ownerEntered && !confirmed && item.prop.note && <p className={styles.hint}>The note you entered when adding this product is already filled in. Edit it if needed.</p>}
      <label>Work sample or workflow link (optional)<input name="supportingUrl" type="url" defaultValue={item.prop.supportingUrl ?? ""} placeholder="https://…" /></label>
      <p className={styles.hint}>Stays private. A Loom, Cap, YouTube, Vimeo or Arcade video can also play on your public card, if you choose it when you review sharing.</p>
      <label>Started using (optional)<input name="startedAt" type="date" defaultValue={item.prop.startedAt ?? ""} /></label>
      <p className={styles.hint}>Leave the date blank when you do not know. Signup dates and capture dates are not first use.</p>
      {(item.prop.activity || item.prop.activityEvidenceId || evidence.some(source => source.suggestedActivity)) && <label>Supporting snapshot
        <select name="activityEvidenceId" defaultValue={evidence.some(source => source.id === item.prop.activityEvidenceId && source.suggestedActivity) ? item.prop.activityEvidenceId : ""}>
          <option value="">{item.prop.activity || item.prop.activityEvidenceId ? "Keep saved supporting activity" : "Do not add a metric preview"}</option>
          {(item.prop.activity || item.prop.activityEvidenceId) && <option value="__remove__">Remove saved supporting snapshot</option>}
          {evidence.filter(source => source.suggestedActivity).map(source => <option key={source.id} value={source.id}>{source.sourceLabel} · {source.artifact?.sourceCapturedDate ?? source.capturedAt.slice(0, 10)}</option>)}
        </select>
      </label>}
      <button className="primary-action" type="submit">{busy ? "Saving…" : confirmed ? "Save privately" : "Confirm and save privately"}</button>
    </fieldset>
    <p role="status">{message}</p>
  </form>;
}

export function InventoryRelationshipDetails({ item, evidence, selectedEvidence, hasMoreEvidence = false, loadingMoreEvidence = false, onLoadMoreEvidence, onSave, renderEvidence, renderHistory }: {
  item: Item; evidence: InventoryEvidence; selectedEvidence?: InventoryEvidence[number] | null;
  hasMoreEvidence?: boolean; loadingMoreEvidence?: boolean; onLoadMoreEvidence?: () => void;
  onSave: (input: SaveInput) => Promise<SaveResult>;
  renderEvidence?: (item: Item) => ReactNode; renderHistory?: (item: Item) => ReactNode;
}) {
  const [saveNotice, setSaveNotice] = useState("");
  async function save(input: SaveInput) {
    setSaveNotice("");
    const result = await onSave(input);
    setSaveNotice("Saved privately. Your public profile has not changed.");
    return result;
  }
  const sources = [...new Map([...(selectedEvidence ? [selectedEvidence] : []), ...evidence].map(source => [source.id, source])).values()];
  return <>
    <RelationshipEditor key={`${item.prop._id}:${item.prop.relationshipVersion ?? 0}`} item={item} evidence={sources} onSave={save} />
    {saveNotice && <p role="status">{saveNotice}</p>}
    <h3>Supporting context</h3>
    {item.prop.activityEvidenceId && !sources.some(source => source.id === item.prop.activityEvidenceId) && <p>The original for your saved supporting snapshot is unavailable. You can keep or remove the saved preview.</p>}
    {sources.length === 0 && <p>{hasMoreEvidence ? "No available sources in the loaded evidence pages. More sources may be available below." : "No retained source is attached. Your explanation is an owner statement."}</p>}
    {sources.map(source => <div className={styles.source} key={source.id}>
      <strong>{source.sourceLabel}</strong>
      {source.uploadedFile && <p>Original file: {source.uploadedFile.filename ?? "Filename unavailable"} · {source.uploadedFile.mimeType ?? "Format unavailable"} · {source.uploadedFile.byteSize === undefined ? "Size unavailable" : `${source.uploadedFile.byteSize.toLocaleString()} bytes`}. Retained privately; contents have not been parsed or authenticated. {source.uploadedFile.attribution === "VERIFIED_OWNER_SESSION" ? "Uploaded through your verified owner session; authorship and product usage are not verified." : "Legacy upload: stored account ownership is known, but the original uploader is unverified."}</p>}
      {source.id === item.prop.activityEvidenceId && <p>Saved supporting snapshot</p>}
      <p>{source.artifact ? `Static capture · source date ${source.artifact.sourceCapturedDate} · ${source.artifact.kind === "WISPR_OWNER_REVIEW" ? "recorded time retained in original" : "original time unknown"} · imported ${source.capturedAt.slice(0, 10)}.` : `Retained evidence · captured ${source.capturedAt}.`}</p>
      <p>{source.artifact ? "Refresh: manual import. This is not live usage tracking." : "This capture alone does not establish continuous source coverage."}</p>
      <p>{source.observationCount} extracted observations. Relationship decisions are separate.</p>
      {source.suggestedActivity && source.id !== item.prop.activityEvidenceId && <p>Supporting snapshot available for review; it has not replaced your saved card.</p>}
      {source.ownerStatementQuestion && <><p>Previously recorded question:</p><blockquote>{source.ownerStatementQuestion}</blockquote></>}
      {source.ownerStatement && <><p>Your recorded answer:</p><blockquote>{source.ownerStatement}</blockquote></>}
      {source.originalText && <details><summary>Retained snapshot original</summary><pre className="raw-evidence">{source.originalText}</pre></details>}
      {source.limitations.length > 0 && <details><summary>Coverage and limitations</summary><ul>{source.limitations.map(limit => <li key={limit}>{limit}</li>)}</ul></details>}
    </div>)}
    {hasMoreEvidence && <button type="button" className="secondary-action" disabled={loadingMoreEvidence} onClick={onLoadMoreEvidence}>{loadingMoreEvidence ? "Loading retained sources…" : "Load more retained sources"}</button>}
    {renderEvidence && <details className={styles.claims}><summary>Inspect extracted claims and correct evidence</summary>{renderEvidence(item)}</details>}
    <h3>Relationship history</h3>
    {renderHistory?.(item)}
  </>;
}

function InventoryDetails({ item, onSave, brandEnrichmentAvailable }: { item: Item; onSave: (input: SaveInput) => Promise<SaveResult>; brandEnrichmentAvailable: boolean }) {
  const evidence = usePaginatedQuery(api.inventory.evidence, { propId: item.prop._id }, { initialNumItems: 10 });
  const selectedEvidence = useQuery(api.inventory.selectedActivity, { propId: item.prop._id });
  if (evidence.status === "LoadingFirstPage" || selectedEvidence === undefined) return <p role="status">Loading relationship and supporting context…</p>;
  return <><InventoryRelationshipDetails item={item} evidence={evidence.results} selectedEvidence={selectedEvidence}
    hasMoreEvidence={evidence.status !== "Exhausted"} loadingMoreEvidence={evidence.status === "LoadingMore"} onLoadMoreEvidence={() => evidence.loadMore(10)} onSave={onSave}
    renderEvidence={current => <PrivateEvidencePanel propId={current.prop._id} productName={current.product.name} productSlug={current.product.slug} />}
    renderHistory={current => <History propId={current.prop._id} />} />
    {brandEnrichmentAvailable && <details className={styles.brand}><summary>Product appearance</summary><p>Retained logos, fonts, and brand styling describe the product. They do not establish your relationship with it.</p><ProductBrandControls propId={item.prop._id} /></details>}
  </>;
}

function InventoryCard({ item, index }: { item: Item; index: number }) {
  return <ProductCard audience="owner" index={index} relationshipConfirmed={isRelationshipConfirmed(item.prop)} goTo={item.prop.goTo} card={{
    product: item.product, status: item.prop.status, headline: item.prop.headline, note: item.prop.note,
    startedAt: item.prop.startedAt, activity: item.prop.activity, cost: item.prop.cost,
    primaryLink: privateCardPrimaryLink({
      product: item.product,
      links: item.links,
      associatedEvidence: item.associatedAccountEvidence ?? [],
    }),
  }} />;
}

export function PrivateInventoryView({ data, onSave, onImport, onLoadMore, renderDetails, renderHistory, renderCard }: {
  renderCard?: (item: Item, index: number) => ReactNode;
  data: InventoryData; onSave: (input: SaveInput) => Promise<SaveResult>;
  onImport: (packet: unknown) => Promise<unknown>;
  onLoadMore?: () => void; renderDetails?: (item: Item) => ReactNode; renderHistory?: (item: Item) => ReactNode;
}) {
  const [view, setView] = useState<InventoryView>("All");
  const [notice, setNotice] = useState("");
  const [importing, setImporting] = useState(false);
  const [inspectedRecords, setInspectedRecords] = useState<Record<string, string>>({});
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  async function importFiles(form: FormData) {
    setImporting(true);
    try {
      const files = form.getAll("packets").filter((file): file is File => file instanceof File && file.size > 0);
      if (!files.length || files.length > 3 || files.some(file => file.size > 256_000)) throw new Error("Choose one to three prepared evidence files, each under 256 KB.");
      for (const file of files) await onImport(JSON.parse(await file.text()));
      setNotice("Retained evidence is ready for private review. No relationship or public profile was changed.");
    } catch { setNotice("Import did not complete. Successfully retained originals remain private; retrying the same files will not duplicate them."); }
    finally { setImporting(false); }
  }
  // usePaginatedQuery accumulates pages: regroup the whole loaded collection on
  // every update so a later page cannot create a second visible product card.
  const groups = new Map<string, Item[]>();
  for (const item of data.cards) {
    const key = `${item.prop.userId}:${item.prop.productId}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const cards = [...groups.entries()].filter(([, members]) => members.some(item => inInventoryView(view, item)));
  return <section className={styles.inventory} aria-labelledby="private-collection-title">
    <p className="onboarding-kicker">YOUR PRIVATE COLLECTION</p>
    <h2 id="private-collection-title">What you use, test, and come back to.</h2>
    <p>Your go-to stack is your choice. Evidence and work context support the story; saving here keeps it private.</p>
    <nav className={styles.views} aria-label="Collection views">{inventoryViews.map(option => <button type="button" className="secondary-action" key={option} aria-pressed={view === option} onClick={() => { setView(option); setInspectedRecords({}); }}>{option}</button>)}</nav>
    <p className={styles.hint}>Views can overlap. History preserves earlier decisions when a tool becomes go-to, is archived, or returns to your stack.</p>
    {!cards.length && <p>{data.hasMore ? "No matches among the products loaded so far." : "No products in this view yet."}</p>}
    <div className={styles.grid}>{cards.map(([groupId, members], index) => {
      const matching = members.filter(item => inInventoryView(view, item));
      const item = members.find(member => member.prop._id === inspectedRecords[groupId]) ?? matching[0];
      const confirmed = isRelationshipConfirmed(item.prop);
      const otherUsageRecords = members.filter(member => member.prop._id !== item.prop._id && member.prop.activity).length;
      return <section className={styles.item} key={groupId} aria-label={`${item.product.name} in your collection`}>
        {members.length > 1 && <div className={styles.source}>
          <label>Record to inspect for {item.product.name}
            <select value={item.prop._id} onChange={event => setInspectedRecords(current => ({ ...current, [groupId]: event.target.value }))}>
              {members.map((member, recordIndex) => <option key={member.prop._id} value={member.prop._id}>
                {`Record ${recordIndex + 1} · ${member.prop.activity ? "Usage snapshot" : member.prop.activityEvidenceId ? "Snapshot unavailable" : "No usage snapshot"} · ${isRelationshipConfirmed(member.prop) ? member.prop.status.toLowerCase() : "needs review"} · ${member.prop.headline || "No explanation recorded"}`}
              </option>)}
            </select>
          </label>
          <p>{members.length} retained records for this product. Inspect each record’s decisions and evidence here. Selecting a record does not merge, confirm, or publish it.</p>
        </div>}
        <div className={styles.usageSummary} aria-live="polite">
          <p>{item.prop.activity
            ? "This record has a saved usage snapshot. Open Details to see its source and coverage."
            : item.prop.activityEvidenceId
              ? "The selected usage snapshot is unavailable. Usage is unknown."
              : "No usage snapshot is selected for this record. Usage is unknown."}</p>
          {otherUsageRecords > 0 && <p>{otherUsageRecords} other loaded {otherUsageRecords === 1 ? "record has" : "records have"} a saved usage snapshot. Choose {otherUsageRecords === 1 ? "it" : "one"} above to inspect its own evidence.</p>}
        </div>
        {renderCard?.(item, index) ?? <InventoryCard key={item.prop._id} item={item} index={index} />}
        <details key={`details:${item.prop._id}`} onToggle={event => { const open = event.currentTarget.open; setOpened(current => ({ ...current, [item.prop._id]: open })); }}>
          <summary>{confirmed ? "Manage relationship and context" : "Review this discovery"}</summary>
          {opened[item.prop._id] && (renderDetails?.(item) ?? <InventoryRelationshipDetails item={item} evidence={[]} onSave={onSave} renderHistory={renderHistory} />)}
        </details>
      </section>;
    })}</div>
    {data.hasMore && <>
      <p>Views group the {data.cards.length} records loaded so far by product. More records, including other records for these products, may be available.</p>
      <button type="button" className="secondary-action" disabled={data.loadingMore} onClick={onLoadMore}>{data.loadingMore ? "Loading products…" : "Load more products"}</button>
    </>}
    <details className={styles.intake}><summary>Bring in retained evidence</summary>
      <p>Import prepared Wispr Insights, your retained explanation, or a GitHub response. Existing originals are reused; this does not connect or refresh a provider. You can also add a product without a file below.</p>
      <form onSubmit={event => { event.preventDefault(); void importFiles(new FormData(event.currentTarget)); }}><label>Prepared evidence files<input type="file" name="packets" accept=".json,application/json" multiple required /></label><button className="secondary-action" disabled={importing}>{importing ? "Retaining…" : "Retain privately"}</button></form>
      <p role="status">{notice}</p>
    </details>
  </section>;
}

export function PrivateInventory({ brandEnrichmentAvailable = false }: { brandEnrichmentAvailable?: boolean }) {
  const inventory = usePaginatedQuery(api.inventory.list, { includeAccountEvidence: false }, { initialNumItems: 25 });
  const save = useMutation(api.inventory.save);
  const importPacket = useMutation(api.retainedEvidence.importPacket);
  if (inventory.status === "LoadingFirstPage") return <p role="status">Loading your private collection…</p>;
  return <><DiscoveryReview /><PrivateInventoryView data={{ cards: inventory.results, hasMore: inventory.status !== "Exhausted", loadingMore: inventory.status === "LoadingMore" }}
    renderCard={(item, index) => <AccountEvidence key={item.prop._id} propId={item.prop._id} productSlug={item.product.slug}>{(evidence, progress) => <><InventoryCard item={{ ...item, associatedAccountEvidence: evidence }} index={index} />{progress}</>}</AccountEvidence>}
    onLoadMore={() => inventory.loadMore(25)} onSave={save} onImport={packet => importPacket({ packet })}
    renderDetails={item => <InventoryDetails item={item} onSave={save} brandEnrichmentAvailable={brandEnrichmentAvailable} />} /></>;
}
