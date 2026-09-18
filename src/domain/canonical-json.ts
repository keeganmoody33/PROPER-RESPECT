/** Deterministic JSON for replay comparisons; omit undefined object fields. */
export function canonicalJson(input: unknown): string {
  const ordered = (value: unknown): unknown => Array.isArray(value)
    ? value.map(ordered)
    : value && typeof value === "object"
      ? Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)
          .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, ordered(item)]))
      : value;
  return JSON.stringify(ordered(input));
}
