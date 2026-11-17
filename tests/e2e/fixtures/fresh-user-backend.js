// Synthetic Convex boundary for the real onboarding, inventory and preview components.
// Persists only test data across browser reloads; it does not prove hosted storage or auth.
import { useState, useSyncExternalStore } from "react";
import { getFunctionName } from "convex/server";
import { parseMeasurementImport, reviewMeasurementImports, projectMeasurement } from "../../../src/domain/measurements";
import { publicProfileSchema } from "../../../src/domain/public-profile";
import { directoryEntry } from "../../../src/domain/product-directory";
import { shareAllSelections } from "../../../src/domain/share-all";

const key = "proper-respect-fresh-user-fixture";
const empty = [];
const listeners = new Set();
let state = JSON.parse(localStorage.getItem(key) ?? "null");
const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };
const snapshot = () => state;
function retain(next) {
  state = next;
  localStorage.setItem(key, JSON.stringify(next));
  listeners.forEach(listener => listener());
}
// Match the query update an account reconnect in another tab would deliver.
window.addEventListener("storage", event => {
  if (event.key !== key || !event.newValue) return;
  state = JSON.parse(event.newValue);
  listeners.forEach(listener => listener());
});
function record(name, args) {
  const calls = JSON.parse(localStorage.getItem(`${key}-calls`) ?? "[]");
  localStorage.setItem(`${key}-calls`, JSON.stringify([...calls, { name, args }]));
}
// Share-all runs the real selection rules over the synthetic saved cards.
function shareAll() {
  const cards = state.cards.filter(card => card.product);
  const result = shareAllSelections(cards.map(card => ({
    propId: card.prop._id, visibility: card.prop.visibility, onPublishedPage: card.isPublishedAtCurrentHandle === true,
    relationshipVersion: card.prop.relationshipVersion, status: card.prop.status, level: card.prop.level, headline: card.prop.headline, note: card.prop.note,
    product: { name: card.product.name, domain: card.product.domain }, primaryLink: card.links.find(link => link.isPrimary),
  })));
  const shared = result.selections.map(selection => {
    const { product } = cards.find(card => card.prop._id === selection.propId);
    return { product: { name: product.name, slug: product.slug, domain: product.domain, description: product.description }, status: selection.status, level: selection.level,
      headline: selection.headline, note: selection.note, ...(selection.primaryLink ? { primaryLink: selection.primaryLink } : {}) };
  });
  const profile = publicProfileSchema.parse({ ...state.user, cards: shared });
  return { result, profile, previewHash: `synthetic-share-all-${result.selections.map(selection => selection.propId).join(",")}` };
}
function stackProduct(pick) {
  if (pick.kind === "directory") {
    const entry = directoryEntry(pick.slug);
    if (!entry) throw new Error(`${pick.slug} is not in the directory. Search for it again.`);
    return { product: { _id: `product-${entry.slug}`, _creationTime: 1, name: entry.name, slug: entry.slug, domain: entry.domain, description: entry.description }, website: entry.website };
  }
  const slug = `manual-${pick.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return { product: { _id: `product-${slug}`, _creationTime: 1, name: pick.name, slug, domain: "", description: "" }, website: pick.website };
}
const mutations = {
  "stack:saveSelection": async args => {
    record("saveSelection", args);
    if (args.operationId.includes(":")) throw new Error("Invalid save operation.");
    const body = JSON.stringify(args.picks);
    const previous = state.stackOperations?.[args.operationId];
    if (previous) {
      if (previous.body !== body) throw new Error("This save was already used with different picks.");
      return previous.result;
    }
    let cards = state.cards;
    const items = args.picks.map(pick => {
      const { product, website } = stackProduct(pick);
      const existing = cards.find(card => card.product.slug === product.slug);
      if (existing && existing.prop.visibility !== "DRAFT") return { propId: existing.prop._id, productName: product.name, outcome: "UNCHANGED" };
      // Like the server, only a record this save creates is marked as one the owner added.
      const prop = { ...(existing?.prop ?? { _id: `stack-${product.slug}`, _creationTime: 1, userId: state.user._id, productId: product._id, headline: "", note: "", ownerEntered: true }),
        status: pick.status, level: pick.level, visibility: "PRIVATE", confirmedAt: "2026-11-12T12:00:00Z", relationshipVersion: 1, goTo: false };
      const card = { product, prop, links: website ? [{ type: "CANONICAL", url: website, label: `Open ${product.name}`, isPrimary: true }] : [], claims: [], previousStatuses: [], isPublishedAtCurrentHandle: false };
      cards = existing ? cards.map(item => item === existing ? card : item) : [...cards, card];
      return { propId: prop._id, productName: product.name, outcome: existing ? "CONFIRMED_DRAFT" : "CREATED" };
    });
    const count = outcome => items.filter(item => item.outcome === outcome).length;
    const result = { items, created: count("CREATED"), confirmed: count("CONFIRMED_DRAFT"), unchanged: count("UNCHANGED") };
    retain({ ...state, cards, stackOperations: { ...state.stackOperations, [args.operationId]: { body, result } } });
    return result;
  },
  "onboarding:ensureAccount": async args => {
    record("ensureAccount", args);
    if (!state) retain({
      user: { _id: "synthetic-owner", handle: "pending-owner", displayName: "Synthetic owner", bio: "" },
      cards: [], connectors: [], drafts: [], evidence: [], privateInventoryAvailable: true,
      brandEnrichmentAvailable: false, hasPublicationAtCurrentHandle: false, hasClaimedPublicIdentity: false,
    });
    return "synthetic-owner";
  },
  "onboarding:addManualProduct": async args => {
    record("addManualProduct", args);
    if (state.cards.length) throw new Error("This fixture accepts one new product.");
    const product = { _id: "manual-product", _creationTime: 1, name: args.name, slug: "field-notes", domain: "field-notes.example", description: "A synthetic note-taking tool." };
    const prop = { _id: "manual-prop", _creationTime: 1, userId: state.user._id, productId: product._id, status: args.status ?? "TESTING", visibility: args.status ? "PRIVATE" : "DRAFT", ownerEntered: true, headline: "", note: args.description ?? "",
      ...(args.status ? { confirmedAt: "2026-10-06T12:00:00Z", relationshipVersion: 1, goTo: false } : {}) };
    const history = args.status ? [{ _id: "initial-manual-event", propId: prop._id, version: 1, basis: "OWNER_ASSERTED", recordedAt: prop.confirmedAt,
      before: { status: "TESTING", goTo: false, confirmed: false, headline: "", note: prop.note },
      after: { status: args.status, goTo: false, confirmed: true, headline: "", note: prop.note } }] : [];
    retain({ ...state, history, cards: [{ product, prop, links: [{ type: "CANONICAL", url: "https://field-notes.example", label: "Open Field Notes", isPrimary: true }], claims: [], previousStatuses: [], isPublishedAtCurrentHandle: false }] });
    return prop._id;
  },
  "inventory:save": async args => {
    record("savePrivately", args);
    const card = state.cards.find(card => card.prop._id === args.propId);
    if (!card || args.expectedVersion !== (card.prop.relationshipVersion ?? 0)) throw new Error("Stale fixture relationship.");
    const { status, level, goTo, headline, note, uses, credit, startedAt, supportingUrl } = args;
    const version = args.expectedVersion + 1;
    retain({ ...state, history: [...(state.history ?? []), { _id: `event-${args.propId}-${version}`, propId: args.propId, recordedAt: new Date().toISOString(), before: { ...card.prop, confirmed: Boolean(card.prop.confirmedAt) || card.prop.visibility !== "DRAFT" }, after: { status, level, goTo, headline, note, uses, credit, startedAt, supportingUrl } }], cards: state.cards.map(item => item === card ? { ...item, prop: { ...item.prop, status, level, goTo, headline, note, uses, credit, startedAt, supportingUrl, relationshipVersion: version, confirmedAt: "2026-09-22T12:00:00Z", visibility: "PRIVATE" } } : item) });
    return { version, duplicate: false };
  },
  // Never used it: the server removes a bare record; this fixture's records have no evidence attached.
  "inventory:removeNeverUsed": async args => {
    record("removeNeverUsed", args);
    const card = state.cards.find(card => card.prop._id === args.propId);
    if (!card) return { removed: false };
    if ((card.prop.relationshipVersion ?? 0) !== args.expectedVersion) throw new Error("This relationship changed. Reload its saved decisions before trying again.");
    if (card.prop.visibility === "PUBLIC" || card.prop.activity || card.prop.fixtureAttached) throw new Error("This tool has evidence or a published card attached, so it stays in your collection.");
    retain({ ...state, cards: state.cards.filter(item => item !== card) });
    return { removed: true };
  },
  "retainedEvidence:importMeasurements": async args => {
    record("importMeasurements", { expectedSource: args.expectedSource });
    const parsed = parseMeasurementImport(args.text);
    if (args.expectedSource && args.expectedSource !== parsed.adapter) throw new Error("This export does not match the selected source.");
    const captures = state.measurementCaptures ?? [];
    const existing = captures.find(capture => capture.digest === parsed.digest);
    if (existing) return { propId: existing.propId, rawEvidenceId: existing.rawEvidenceId, duplicate: true };
    const name = parsed.adapter === "claude-code" ? "Claude Code" : parsed.adapter === "codex" ? "Codex" : args.productName;
    if (!name) throw new Error("Name the product for this packet.");
    const slug = parsed.adapter === "metric-packet" ? name.toLowerCase().replaceAll(" ", "-") : parsed.adapter;
    const prior = state.cards.find(card => card.product.slug === slug);
    const product = prior?.product ?? { _id: `product-${slug}`, _creationTime: 1, name, slug, domain: parsed.adapter === "claude-code" ? "claude.com" : parsed.adapter === "codex" ? "openai.com" : "", description: "Synthetic imported product" };
    const prop = prior?.prop ?? { _id: `measurement-${slug}`, _creationTime: 1, userId: state.user._id, productId: product._id, visibility: "DRAFT", status: "TESTING", headline: "", note: "" };
    const capture = { propId: prop._id, rawEvidenceId: `evidence-${captures.length}`, digest: parsed.digest, capturedAt: parsed.capturedAt, source: parsed.source, adapter: parsed.adapter, measurements: reviewMeasurementImports([parsed]), reviewedMeasurementIds: [], reviewVersion: 0 };
    retain({ ...state, cards: prior ? state.cards : [...state.cards, { product, prop, links: [], claims: [], previousStatuses: [], isPublishedAtCurrentHandle: false }], measurementCaptures: [...captures, capture] });
    return { propId: prop._id, rawEvidenceId: capture.rawEvidenceId, duplicate: false };
  },
  "retainedEvidence:reviewMeasurements": async args => {
    record("reviewMeasurements", args);
    retain({ ...state, measurementCaptures: state.measurementCaptures.map(capture => capture.rawEvidenceId === args.rawEvidenceId ? { ...capture, reviewedMeasurementIds: args.measurementIds, reviewVersion: capture.reviewVersion + 1 } : capture) });
    return null;
  },
  // The switch saves on the account at once, apart from any publish.
  "publicProfiles:setSearchListing": async args => {
    record("setSearchListing", args);
    retain({ ...state, user: { ...state.user, listedInSearch: args.listed } });
    return { listed: args.listed };
  },
  "onboarding:claimHandle": async args => {
    record("claimHandle", args);
    retain({ ...state, hasClaimedPublicIdentity: true, user: { ...state.user, ...args, displayName: args.displayName.trim(), preferredLinkUrl: args.preferredLinkUrl ?? undefined } });
    return args.handle;
  },
  "onboarding:publishSelected": async args => {
    record("publishSelected", args);
    if (args.shareAllConfirmed) {
      const { result, previewHash } = shareAll();
      if (args.expectedPreviewHash !== previewHash) throw new Error("The sharing preview changed. Open a fresh preview before publishing.");
      if (!result.selections.length) throw new Error("There are no confirmed cards left to share.");
      const shared = new Set(result.selections.map(selection => selection.propId));
      retain({ ...state, hasPublicationAtCurrentHandle: true, cards: state.cards.map(card => shared.has(card.prop._id)
        ? { ...card, isPublishedAtCurrentHandle: true, prop: { ...card.prop, visibility: "PUBLIC" } } : card) });
      return null;
    }
    // Only "unpublish all" (R15) and share-all publish here.
    if (!args.removeAllCards) throw new Error("Publication is intentionally outside this fixture journey.");
    retain({ ...state, cards: state.cards.map(card => ({ ...card, isPublishedAtCurrentHandle: false, prop: { ...card.prop, visibility: card.prop.visibility === "PUBLIC" ? "PRIVATE" : card.prop.visibility } })) });
    return null;
  },
};
// Synthetic export pages (R15): one relationship per page, so assembling the
// download must follow the cursor.
const exportQueries = {
  "inventory:exportProfile": () => ({ handle: state.user.handle, displayName: state.user.displayName, bio: state.user.bio, publicPage: null }),
  "inventory:exportRelationships": args => {
    const index = args.paginationOpts.cursor === null ? 0 : Number(args.paginationOpts.cursor);
    const card = state.cards[index];
    const page = card ? [{ id: card.prop._id, product: { name: card.product.name, slug: card.product.slug }, status: card.prop.status, headline: card.prop.headline, links: card.links, history: [] }] : [];
    return { page, isDone: index + 1 >= state.cards.length, continueCursor: String(index + 1) };
  },
  "inventory:exportEvidence": () => ({ page: [], isDone: true, continueCursor: "" }),
};
const client = {
  query: async (ref, args) => {
    const exportQuery = exportQueries[getFunctionName(ref)];
    if (exportQuery) { record(getFunctionName(ref), args); return exportQuery(args); }
    if (getFunctionName(ref) !== "onboarding:previewPublication") throw new Error("Unexpected fixture query.");
    record("previewPublication", args);
    if (args.shareAllConfirmed) {
      if (!state.hasClaimedPublicIdentity) throw new Error("Claim your public handle before sharing your stack.");
      const { result, profile, previewHash } = shareAll();
      return { profile, refreshAccounts: [], revision: 0, previewHash, sharedCount: result.selections.length, remainingCount: result.remainingCount, skipped: result.skipped };
    }
    const cards = args.removeAllCards ? [] : args.selections.filter(selection => selection.publish).map(selection => {
      const saved = state.cards.find(card => card.prop._id === selection.propId);
      if (saved.prop.visibility !== "PRIVATE") throw new Error("Save privately before preview.");
      const measurements = (state.measurementCaptures ?? []).filter(capture => capture.propId === saved.prop._id && (selection.measurementEvidenceIds ?? []).includes(capture.rawEvidenceId)).flatMap(capture => capture.measurements.filter(row => capture.reviewedMeasurementIds.includes(row.id)).map(projectMeasurement));
      return { ...(measurements.length ? { measurements } : {}), product: saved.product, status: selection.status, level: selection.level, headline: selection.headline, note: selection.note, goTo: saved.prop.goTo, primaryLink: selection.primaryLink, activity: selection.activity };
    });
    const refreshAccounts = args.selections.filter(selection => selection.publish && selection.autoRefresh).map(selection => {
      const connector = state.connectors.find(connector => connector._id === selection.connectorId);
      return { connectorId: connector._id, accountLabel: connector.accountLabel };
    });
    return { profile: publicProfileSchema.parse({ ...state.user, cards }), refreshAccounts, revision: 0, previewHash: args.removeAllCards ? "synthetic-remove-all-preview" : "synthetic-preview" };
  },
};
export const useConvex = () => client;
export const useConvexAuth = () => ({ isAuthenticated: true, isLoading: false });
export function useMutation(ref) {
  const name = getFunctionName(ref);
  return mutations[name] ?? (async () => { throw new Error(`Unexpected fixture mutation: ${name}`); });
}
export const useAction = () => async () => { throw new Error("Provider reads are outside this fixture."); };
export function useQuery(ref, args) {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  switch (getFunctionName(ref)) {
    case "onboarding:getState": return current && args?.includeCards === false ? { ...current, cards: empty } : current;
    case "inventory:selectedActivity": return null;
    case "retainedEvidence:measurements": return (current?.measurementCaptures ?? empty).filter(capture => capture.propId === args.propId);
    case "inventory:detail": return current?.cards.find(card => card.prop._id === args.propId) ?? null;
    case "mailboxes:listAccounts": return empty;
    case "productKnowledge:getForProduct": return { supported: false, sources: empty };
    case "publicProfiles:searchListingChoice": return current ? { listed: current.user.listedInSearch ?? true } : undefined;
    default: return undefined;
  }
}
function located(card) {
  return { propId: card.prop._id, productId: card.product._id, name: card.product.name, domain: card.product.domain,
    status: card.prop.status, level: card.prop.level, confirmed: Boolean(card.prop.confirmedAt) || card.prop.visibility !== "DRAFT", goTo: card.prop.goTo ?? false, headline: card.prop.headline };
}
export function usePaginatedQuery(ref, args, options) {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  const [count, setCount] = useState(options?.initialNumItems ?? 25);
  let rows = empty;
  switch (getFunctionName(ref)) {
    case "onboarding:sharingCards":
    case "inventory:list": rows = current?.cards ?? empty; break;
    case "inventory:locator": rows = (current?.cards ?? empty).map(located); break;
    case "inventory:related": {
      const selected = current?.cards.find(card => card.prop._id === args.propId);
      rows = (current?.cards ?? empty).filter(card => card.prop.productId === selected?.prop.productId).map(located); break;
    }
    case "inventory:history": rows = (current?.history ?? empty).filter(event => event.propId === args.propId).toReversed(); break;
  }
  return { results: rows.slice(0, count), status: count < rows.length ? "CanLoadMore" : "Exhausted", loadMore: amount => setCount(value => value + amount) };
}

// Browser fixture only. This callback stands in for the server's GitHub response;
// it never calls GitHub, Clerk, or Convex and cannot prove live provider behavior.
window.fixtureGithubConnect = () => {
  const product = { _id: "github-product", _creationTime: 1, name: "GitHub", slug: "github", domain: "github.com", description: "Synthetic GitHub fixture" };
  const activity = { kind: "contributionCalendar", total: 12345, days: [], attributionScope: "PERSONAL", capturedAt: "2026-10-06T10:00:00.000Z", freshness: "FRESH", provenanceLabel: "Synthetic GitHub snapshot", period: { start: "2026-01-01", end: "2026-10-06" } };
  const prop = { _id: "github-result", _creationTime: 1, userId: state.user._id, productId: product._id, visibility: "DRAFT", status: "TESTING", headline: "", note: "", activity };
  retain({ ...state, cards: [{ product, prop, links: [], claims: [], previousStatuses: [], isPublishedAtCurrentHandle: false }] });
  return { connectorId: "fixture-connector", propId: prop._id };
};
