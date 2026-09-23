import { afterEach, expect, test, vi } from "vitest";
import { fetchGithubActivity, GITHUB_REQUEST_TIMEOUT_MS, GITHUB_RESPONSE_BYTES, parseGithubActivity } from "./github-activity";
const window = { from: "2025-09-22T12:00:00.000Z", to: "2026-09-22T12:00:00.000Z" };
const source = () => ({ data: { viewer: { login: "Synthetic-Account", createdAt: "2020-01-01T00:00:00Z", contributionsCollection: { contributionCalendar: { totalContributions: 2, weeks: [{ contributionDays: [{ date: "2026-09-20", contributionCount: 2, contributionLevel: "FIRST_QUARTILE" }] }] } } } } });
const text = () => JSON.stringify(source());
const response = (body: BodyInit = text(), headers: HeadersInit = {}) => new Response(body, { headers: { "Content-Type": "application/json", ...headers } });
const replaceCounts = (token: string) => text().replace('"totalContributions":2', `"totalContributions":${token}`).replace('"contributionCount":2', `"contributionCount":${token}`);
const error = "GitHub activity response unavailable.";
afterEach(() => { vi.useRealTimers(); });

test.each(["0", "0.0", "0e99999999999999", "1", "1.0", "10e-1", "1000e-3", "1e3", "1e0000000000000003", "9007199254740991"])("retains exact integer %s", token => {
  const result = parseGithubActivity(replaceCounts(token), window);
  expect(result.value).toBe(Number(token));
  expect(result.activity).toMatchObject({ total: Number(token), days: [{ count: Number(token) }] });
});
test.each(["1e-999", "1.0000000000000001", "9007199254740991.1", "9007199254740992", "1e99999", "-0", "-1", "1.5", '"2"', "null", "{}", "true"])("rejects invalid count %s", token => {
  expect(() => parseGithubActivity(replaceCounts(token), window)).toThrow(error);
});
test("bounds enormous coefficients and exponents before integer construction", () => {
  for (const token of ["1".repeat(25_000), "1e" + "9".repeat(25_000), "1e-" + "9".repeat(25_000), "0." + "0".repeat(25_000) + "1"]) {
    expect(() => parseGithubActivity(replaceCounts(token), window)).toThrow(error);
  }
});
test.each(["01", "1e", "1.", "+1", "NaN", "Infinity"])("never repairs malformed JSON count %s", token => {
  expect(() => parseGithubActivity(replaceCounts(token), window)).toThrow(error);
});
test("validates escaped count keys and does not transform string contents or unrelated fractions", () => {
  const encoded = text().replace('"totalContributions"', '"total\\u0043ontributions"').replace('"contributionCount"', '"contribution\\u0043ount"');
  const input = JSON.parse(encoded);
  input.extensions = { cost: 1.25, text: '\\ "count": 1e-999, {"braces": "2"}', literal: "null 1234 \"" };
  expect(parseGithubActivity(JSON.stringify(input), window).value).toBe(2);
  expect(parseGithubActivity(encoded, window).value).toBe(2);
  expect(() => parseGithubActivity(encoded.replace(':2', ':1e-999'), window)).toThrow(error);
  expect(() => parseGithubActivity(text().replace('"contributionCount":2', '"contribution\\u0043ount":1e-999'), window)).toThrow(error);
});
test.each([null, {}, "problem", [{ message: "private" }]])("rejects malformed or nonempty GraphQL errors %j", errors => {
  expect(() => parseGithubActivity(JSON.stringify({ ...source(), errors }), window)).toThrow(error);
});
test("preserves independent totals and dates with factual coverage caveats", () => {
  const input = source(), calendar = input.data.viewer.contributionsCollection.contributionCalendar;
  calendar.totalContributions = 9;
  calendar.weeks[0].contributionDays[0].date = "2010-01-01";
  const result = parseGithubActivity(JSON.stringify(input), window);
  expect(result.activity).toMatchObject({ total: 9, period: { start: "2025-09-22", end: "2026-09-22" }, days: [{ date: "2010-01-01", count: 2 }] });
  expect(result.activity.provenanceLabel).toContain("Reported total differs");
  expect(result.activity.provenanceLabel).toContain("outside the requested period");
});
test("compares daily sums without overflowing safe integer precision", () => {
  const input = source(), calendar = input.data.viewer.contributionsCollection.contributionCalendar;
  calendar.totalContributions = Number.MAX_SAFE_INTEGER;
  calendar.weeks[0].contributionDays = [
    { date: "2026-09-20", contributionCount: Number.MAX_SAFE_INTEGER, contributionLevel: "FOURTH_QUARTILE" },
    { date: "2026-09-21", contributionCount: 1, contributionLevel: "FIRST_QUARTILE" },
  ];
  expect(parseGithubActivity(JSON.stringify(input), window).activity.provenanceLabel).toContain("Reported total differs");
});
test("accepts a full leap-year-sized calendar under the byte bound", () => {
  const input = source(), calendar = input.data.viewer.contributionsCollection.contributionCalendar;
  const days = Array.from({ length: 366 }, (_, index) => ({ date: new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10), contributionCount: 2, contributionLevel: "FIRST_QUARTILE" }));
  calendar.weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, index) => ({ contributionDays: days.slice(index * 7, (index + 1) * 7) }));
  calendar.totalContributions = 732;
  expect(new TextEncoder().encode(JSON.stringify(input)).length).toBeLessThan(40_000);
  expect(parseGithubActivity(JSON.stringify(input), window).activity).toMatchObject({ total: 732, days: expect.arrayContaining([{ date: "2025-01-01", count: 2, level: 1 }]) });
});
test("accepts the actual byte limit and clears its lifetime timer", async () => {
  vi.useFakeTimers();
  const exact = text() + " ".repeat(GITHUB_RESPONSE_BYTES - text().length);
  const fetcher = vi.fn(async (_url: string | URL | Request, options?: RequestInit) => {
    expect(options).toMatchObject({ method: "POST", redirect: "error", credentials: "omit", cache: "no-store", signal: expect.any(AbortSignal) });
    return response(exact);
  });
  expect((await fetchGithubActivity("synthetic", fetcher)).value).toBe(2);
  expect(vi.getTimerCount()).toBe(0);
});
test.each([undefined, "1"])("rejects chunk overflow independent of Content-Length %s and cancels", async length => {
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(70_000)); controller.enqueue(new Uint8Array(70_000)); }, cancel });
  const fetcher = vi.fn(async () => response(stream, length ? { "Content-Length": length } : {}));
  await expect(fetchGithubActivity("synthetic", fetcher)).rejects.toThrow(error);
  expect(cancel).toHaveBeenCalledOnce();
  expect(stream.locked).toBe(false);
});
test.each(["bytes", "json", "type", "redirect", "http", "network"])("rejects unsafe response %s with a fixed diagnostic", async kind => {
  const fetcher = vi.fn(async () => {
    if (kind === "network") throw new Error("SYNTHETIC_PRIVATE_SENTINEL");
    if (kind === "bytes") return response(new Uint8Array([0xc3, 0x28]));
    if (kind === "json") return response('{"private":');
    if (kind === "type") return response(text(), { "Content-Type": "text/html" });
    if (kind === "http") return new Response("SYNTHETIC_PRIVATE_SENTINEL", { status: 403 });
    const result = response(); Object.defineProperty(result, "redirected", { value: true }); return result;
  });
  await expect(fetchGithubActivity("synthetic", fetcher)).rejects.toThrow(error);
});
test("times out an ignored fetch signal and cancels its late response", async () => {
  vi.useFakeTimers();
  let settle!: (value: Response) => void;
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({ cancel });
  const fetcher = vi.fn(() => new Promise<Response>(resolve => { settle = resolve; }));
  const pending = fetchGithubActivity("synthetic", fetcher);
  const checked = expect(pending).rejects.toThrow(error);
  await vi.advanceTimersByTimeAsync(GITHUB_REQUEST_TIMEOUT_MS);
  await checked;
  settle(response(stream));
  await vi.advanceTimersByTimeAsync(0);
  expect(cancel).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
test("one deadline cancels a stalled read without awaiting stalled cancellation", async () => {
  vi.useFakeTimers();
  const cancel = vi.fn(() => new Promise<void>(() => undefined));
  const stream = new ReadableStream<Uint8Array>({ cancel });
  const fetcher = vi.fn(async () => { await new Promise(resolve => setTimeout(resolve, 4_000)); return response(stream); });
  const pending = fetchGithubActivity("synthetic", fetcher);
  const checked = expect(pending).rejects.toThrow(error);
  await vi.advanceTimersByTimeAsync(GITHUB_REQUEST_TIMEOUT_MS);
  await checked;
  expect(cancel).toHaveBeenCalledOnce();
  expect(stream.locked).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});
test.each([400, 401])("enforces aggregate %s-day bound across valid week shapes", size => {
  const input = source(), calendar = input.data.viewer.contributionsCollection.contributionCalendar;
  const days = Array.from({ length: size }, (_, index) => ({ date: new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10), contributionCount: 2, contributionLevel: "FIRST_QUARTILE" }));
  calendar.weeks = Array.from({ length: Math.ceil(size / 7) }, (_, index) => ({ contributionDays: days.slice(index * 7, (index + 1) * 7) }));
  calendar.totalContributions = size * 2;
  if (size === 400) expect(parseGithubActivity(JSON.stringify(input), window).value).toBe(800);
  else expect(() => parseGithubActivity(JSON.stringify(input), window)).toThrow(error);
});
test("counts encoded UTF-8 bytes rather than string code units", () => {
  const input = JSON.stringify({ ...source(), extra: "é".repeat(70_000) });
  expect(input.length).toBeLessThan(GITHUB_RESPONSE_BYTES);
  expect(() => parseGithubActivity(input, window)).toThrow(error);
});
test("rejects a declared oversized response without reading its body", async () => {
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({ cancel });
  await expect(fetchGithubActivity("synthetic", vi.fn(async () => response(stream, { "Content-Length": String(GITHUB_RESPONSE_BYTES + 1) })))).rejects.toThrow(error);
  expect(cancel).toHaveBeenCalledOnce();
  expect(stream.locked).toBe(false);
});
