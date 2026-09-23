// Synthetic Convex boundary for the real onboarding, inventory and preview components.
// Persists only test data across browser reloads; it does not prove hosted storage or auth.
import { useSyncExternalStore } from "react";
import { getFunctionName } from "convex/server";
import { publicProfileSchema } from "../../../src/domain/public-profile";

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
function record(name, args) {
  const calls = JSON.parse(localStorage.getItem(`${key}-calls`) ?? "[]");
  localStorage.setItem(`${key}-calls`, JSON.stringify([...calls, { name, args }]));
}
const mutations = {
  "onboarding:ensureAccount": async args => {
    record("ensureAccount", args);
    if (!state) retain({
      user: { _id: "synthetic-owner", handle: "pending-owner", displayName: "Synthetic owner", bio: "" },
      cards: [], connectors: [], drafts: [], evidence: [], privateInventoryAvailable: true,
      brandEnrichmentAvailable: false, hasPublicationAtCurrentHandle: false,
    });
    return "synthetic-owner";
  },
  "onboarding:addManualProduct": async args => {
    record("addManualProduct", args);
    if (state.cards.length) throw new Error("This fixture accepts one new product.");
    const product = { _id: "manual-product", _creationTime: 1, name: args.name, slug: "field-notes", domain: "field-notes.example", description: "A synthetic note-taking tool." };
    const prop = { _id: "manual-prop", _creationTime: 1, userId: state.user._id, productId: product._id, status: "TESTING", visibility: "DRAFT", ownerEntered: true, headline: "", note: args.description ?? "" };
    retain({ ...state, cards: [{ product, prop, links: [{ type: "CANONICAL", url: "https://field-notes.example", label: "Open Field Notes", isPrimary: true }], claims: [], previousStatuses: [], isPublishedAtCurrentHandle: false }] });
    return { propId: prop._id, duplicate: false };
  },
  "inventory:save": async args => {
    record("savePrivately", args);
    const card = state.cards.find(card => card.prop._id === args.propId);
    if (!card || args.expectedVersion !== (card.prop.relationshipVersion ?? 0)) throw new Error("Stale fixture relationship.");
    const { status, goTo, headline, note, startedAt, supportingUrl } = args;
    const version = args.expectedVersion + 1;
    retain({ ...state, cards: state.cards.map(item => item === card ? { ...item, prop: { ...item.prop, status, goTo, headline, note, startedAt, supportingUrl, relationshipVersion: version, confirmedAt: "2026-09-22T12:00:00Z", visibility: "PRIVATE" } } : item) });
    return { version, duplicate: false };
  },
  "onboarding:claimHandle": async args => {
    record("claimHandle", args);
    retain({ ...state, user: { ...state.user, ...args, preferredLinkUrl: args.preferredLinkUrl ?? undefined } });
    return args.handle;
  },
  "onboarding:publishSelected": async args => {
    record("publishSelected", args);
    throw new Error("Publication is intentionally outside this fixture journey.");
  },
};
const client = {
  query: async (ref, args) => {
    if (getFunctionName(ref) !== "onboarding:previewPublication") throw new Error("Unexpected fixture query.");
    record("previewPublication", args);
    const cards = args.selections.filter(selection => selection.publish).map(selection => {
      const saved = state.cards.find(card => card.prop._id === selection.propId);
      if (saved.prop.visibility !== "PRIVATE") throw new Error("Save privately before preview.");
      return { product: saved.product, status: selection.status, headline: selection.headline, note: selection.note, goTo: saved.prop.goTo, primaryLink: selection.primaryLink };
    });
    return { profile: publicProfileSchema.parse({ ...state.user, cards }), revision: 0, previewHash: "synthetic-preview" };
  },
};
export const useConvex = () => client;
export const useConvexAuth = () => ({ isAuthenticated: true, isLoading: false });
export function useMutation(ref) {
  const name = getFunctionName(ref);
  return mutations[name] ?? (async () => { throw new Error(`Unexpected fixture mutation: ${name}`); });
}
export const useAction = () => async () => { throw new Error("Provider reads are outside this fixture."); };
export function useQuery(ref) {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  switch (getFunctionName(ref)) {
    case "onboarding:getState": return current;
    case "inventory:selectedActivity": return null;
    case "mailboxes:listAccounts": return empty;
    case "productKnowledge:getForProduct": return { supported: false, sources: empty };
    default: return undefined;
  }
}
export function usePaginatedQuery(ref) {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  return { results: getFunctionName(ref) === "inventory:list" ? current?.cards ?? empty : empty, status: "Exhausted", loadMore: () => {} };
}
