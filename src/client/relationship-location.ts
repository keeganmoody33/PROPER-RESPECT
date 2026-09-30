export function relationshipHref(propId: string) {
  return `#relationship=${encodeURIComponent(propId)}`;
}

export function openRelationship(propId: string) {
  window.location.hash = relationshipHref(propId);
}

export function relationshipFromHash() {
  if (!window.location.hash.startsWith("#relationship=")) return "";
  try { return decodeURIComponent(window.location.hash.slice("#relationship=".length)); }
  catch { return ""; }
}

export function subscribeRelationship(listener: () => void) {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}
