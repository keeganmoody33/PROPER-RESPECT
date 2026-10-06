export const firstResultSources = [
  { id: "github", label: "GitHub", detail: "Connect your account for a contributions snapshot." },
  { id: "claude-code", label: "Claude Code", detail: "Import a sanitized usage export. No device access needed." },
  { id: "codex", label: "Codex", detail: "Import a sanitized account usage capture." },
  { id: "metric-packet", label: "Another product", detail: "Import a prepared measurement packet with its scope and period." },
  { id: "manual", label: "Add a tool manually", detail: "Keep a private record now and add evidence later." },
] as const;
export type FirstResultSource = typeof firstResultSources[number]["id"];

export function firstResultSource(search: string): FirstResultSource | null {
  const values = new URLSearchParams(search).getAll("source");
  return values.length === 1 ? firstResultSources.find(source => source.id === values[0])?.id ?? null : null;
}

export function firstResultReturnUrl(source: FirstResultSource | null) {
  return source ? `/app/collection?source=${source}` : "/app/collection";
}

export function readFirstResultSource() {
  return firstResultSource(window.location.search);
}

export function selectFirstResultSource(source: FirstResultSource | null) {
  // Only the allowlisted choice crosses auth. Files, credentials, and account
  // details never enter the URL or browser storage.
  window.history.replaceState(null, "", firstResultReturnUrl(source) + window.location.hash);
  window.dispatchEvent(new Event("proper-source-change"));
}

export function subscribeFirstResultSource(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener("proper-source-change", listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener("proper-source-change", listener);
  };
}
