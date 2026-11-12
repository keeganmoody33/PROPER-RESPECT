export const firstResultSources = [
  { id: "github", label: "GitHub", detail: "Connect your GitHub account to show your contributions." },
  { id: "claude-code", label: "Claude Code", detail: "Upload a Claude Code usage file. Only the file you pick is read." },
  { id: "codex", label: "Codex", detail: "Upload a usage file from your Codex account." },
  { id: "metric-packet", label: "Another tool", detail: "Upload a file of another tool’s usage numbers and the dates they cover." },
  { id: "manual", label: "Add a tool by name", detail: "Save it privately now. Add usage later." },
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
