"use client";
import { useRef, useState } from "react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { InventoryRelationshipDetails, PrivateInventoryView, type InventoryData, type InventoryEvidence } from "@/components/private-inventory";
import { AddProductForm, SharingPreview } from "@/components/onboarding-client";

const initial: InventoryData = { hasMore: false, cards: [{
  prop: { _id: "synthetic-prop" as Id<"props">, _creationTime: 1, userId: "synthetic-owner" as Id<"users">,
    productId: "synthetic-product" as Id<"products">, status: "TESTING", visibility: "DRAFT", headline: "Synthetic suggestion", note: "" },
  product: { _id: "synthetic-product" as Id<"products">, _creationTime: 1, name: "Example Tool", slug: "example", domain: "example.com", description: "Synthetic interaction fixture", brand: undefined },
  links: [], previousStatuses: [],
}] };

const syntheticEvidence: InventoryEvidence[number] = {
  id: "synthetic-raw-evidence" as Id<"rawEvidence">, capturedAt: "2026-09-18T12:00:00.000Z",
  sourceType: "MANUAL", sourceLabel: "Synthetic retained source", captureProvenance: undefined,
  artifact: undefined, limitations: ["Synthetic test data; no real owner or provider."], ownerStatement: undefined, ownerStatementQuestion: undefined,
  observationCount: 0, originalText: "SYNTHETIC RETAINED ORIGINAL: seven example contributions.",
  suggestedActivity: { kind: "contributionCalendar", attributionScope: "PERSONAL", capturedAt: "2026-09-18T12:00:00.000Z", freshness: "STALE", provenanceLabel: "Synthetic retained source", total: 7, days: [{ date: "2026-09-17", count: 7, level: 1 }] },
};

export function InventoryFixture() {
  const [data, setData] = useState(initial);
  const [evidence, setEvidence] = useState<InventoryEvidence>([]);
  const [attempts, setAttempts] = useState<string[]>([]);
  const [manualAttempts, setManualAttempts] = useState<string[]>([]);
  const [manualInputs, setManualInputs] = useState("");
  const loseManualResponse = useRef(false);
  const [previewCurrent, setPreviewCurrent] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [published, setPublished] = useState(false);
  const loseNextResponse = useRef(false);
  const operations = useRef(new Map<string, { request: string; data: InventoryData; result: FunctionReturnType<typeof api.inventory.save> }>());
  async function onSave(args: FunctionArgs<typeof api.inventory.save>) {
    setAttempts(current => [...current, args.operationId]);
    const request = JSON.stringify(args);
    const previous = operations.current.get(args.operationId);
    if (previous) {
      if (previous.request !== request) throw new Error("Synthetic operation reused with different decisions.");
      setData(previous.data);
      return { ...previous.result, duplicate: true };
    }
    const version = args.expectedVersion + 1;
    const next: InventoryData = { ...data, cards: data.cards.map(item => ({ ...item,
      previousStatuses: item.prop.confirmedAt ? [item.prop.status] : [],
      prop: { ...item.prop, status: args.status, goTo: args.goTo, headline: args.headline, note: args.note,
        startedAt: args.startedAt, supportingUrl: args.supportingUrl, relationshipVersion: version,
        activityEvidenceId: args.clearActivity ? undefined : args.activityEvidenceId ?? item.prop.activityEvidenceId,
        activity: args.clearActivity ? undefined : evidence.find(source => source.id === args.activityEvidenceId)?.suggestedActivity ?? item.prop.activity,
        visibility: "PRIVATE", confirmedAt: item.prop.confirmedAt ?? "2026-09-18T12:00:00.000Z" },
    })) };
    const result = { version, duplicate: false };
    operations.current.set(args.operationId, { request, data: next, result });
    if (loseNextResponse.current) {
      loseNextResponse.current = false;
      throw new Error("Synthetic lost save response. Retry unchanged decisions.");
    }
    setData(next);
    return result;
  }
  return <>
    <button type="button" onClick={() => { loseNextResponse.current = true; }}>Simulate one lost save response</button>
    <output aria-label="Synthetic save operations">{attempts.join("\n")}</output>
    <PrivateInventoryView data={data} onSave={onSave} onImport={async packet => {
      if (!packet || typeof packet !== "object" || !("fixture" in packet) || packet.fixture !== "SYNTHETIC_INVENTORY_EVIDENCE") throw new Error("Only the synthetic inventory fixture file is accepted.");
      setEvidence([syntheticEvidence]);
    }} renderDetails={item => <InventoryRelationshipDetails item={item} evidence={evidence} onSave={onSave}
      renderHistory={current => <p>Synthetic prior states: {current.previousStatuses.join(", ") || "none"}</p>} />} />
    <button type="button" onClick={() => { loseManualResponse.current = true; }}>Simulate one lost add response</button>
    <AddProductForm onAdd={async input => {
      setManualAttempts(current => [...current, input.operationId]);
      setManualInputs(JSON.stringify(input));
      if (loseManualResponse.current) { loseManualResponse.current = false; throw new Error("Synthetic lost add response. Retry unchanged product."); }
    }} />
    <output aria-label="Synthetic add operations">{manualAttempts.join("\n")}</output>
    <output aria-label="Synthetic add request">{manualInputs}</output>
    <button type="button" onClick={() => setShowPreview(true)}>Open synthetic sharing preview</button>
    {showPreview && <><button type="button" onClick={() => setPreviewCurrent(false)}>Simulate changed collection after preview</button>
    <SharingPreview profile={{ handle: "synthetic-owner", displayName: "Synthetic owner", bio: "An explicitly shared synthetic footer.", cards: [{
      product: { name: "Synthetic shared product", slug: "synthetic-shared", domain: "", description: "Synthetic preview only" },
      status: "ACTIVE", headline: "Only this approved explanation is shared.", note: "", goTo: true,
    }] }} current={previewCurrent} busy={false} onPublish={() => setPublished(true)} />
    <output aria-label="Synthetic publication status">{published ? "Synthetic approval received" : "Nothing published"}</output></>}
  </>;
}
