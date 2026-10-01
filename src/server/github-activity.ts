import { z } from "zod";
import type { ActivityModule } from "../domain/public-profile";

export const GITHUB_RESPONSE_BYTES = 128 * 1024;
export const GITHUB_REQUEST_TIMEOUT_MS = 10_000;
type GithubFailureCategory = "HTTP" | "GRAPHQL" | "PARSER" | "TRANSPORT" | "TIMEOUT" | "RESPONSE";
export class GithubActivityError extends Error {
  constructor(readonly category: GithubFailureCategory, readonly httpStatus?: number) {
    super("GitHub activity response unavailable.");
  }
}
const unavailable = (category: GithubFailureCategory = "PARSER", httpStatus?: number) => new GithubActivityError(category, httpStatus);

/** Only fixed categories and a bounded status may enter runtime logs. Never retain causes. */
export function githubFailureDiagnostic(error: unknown) {
  if (!(error instanceof GithubActivityError)) return { category: "TRANSPORT" as const };
  const category = ["HTTP", "GRAPHQL", "PARSER", "TRANSPORT", "TIMEOUT", "RESPONSE"].includes(error.category)
    ? error.category : "TRANSPORT";
  const status = error.httpStatus;
  return { category, ...(category === "HTTP" && typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599
    ? { httpStatus: status } : {}) };
}
const levels = ["NONE", "FIRST_QUARTILE", "SECOND_QUARTILE", "THIRD_QUARTILE", "FOURTH_QUARTILE"] as const;
const login = z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/i);
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const sourceSchema = <T extends z.ZodType>(value: T) => z.object({
  errors: z.array(z.unknown()).max(0).optional(),
  data: z.object({ viewer: z.object({
    login, createdAt: z.iso.datetime({ offset: true }),
    contributionsCollection: z.object({ contributionCalendar: z.object({
      totalContributions: value,
      weeks: z.array(z.object({ contributionDays: z.array(z.object({
        date: z.iso.date(), contributionCount: value, contributionLevel: z.enum(levels),
      })).max(7) })).max(60),
    }) }),
  }) }),
});
const numericSchema = sourceSchema(count);
const lexicalSchema = sourceSchema(z.string());
type Window = { from: string; to: string };
type GithubActivity = { accountLabel: string; activity: ActivityModule; value: number };

function exactCount(token: string, value: number) {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(token);
  if (!match) return false;
  if (match[1]) return false;
  const fraction = match[3] ?? "";
  const coefficient = `${match[2]}${fraction}`.replace(/^0+/, "");
  if (!coefficient) return value === 0;
  const exponent = Number(match[4] ?? "0");
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > GITHUB_RESPONSE_BYTES + 16) return false;
  const significant = coefficient.replace(/0+$/, "");
  const scale = exponent - fraction.length + coefficient.length - significant.length;
  if (scale < 0 || significant.length + scale > 16) return false;
  return BigInt(significant + "0".repeat(scale)) === BigInt(value);
}

export function parseGithubActivity(text: string, window: Window): GithubActivity {
  try {
    if (text.length > GITHUB_RESPONSE_BYTES || new TextEncoder().encode(text).byteLength > GITHUB_RESPONSE_BYTES) throw unavailable();
    const raw: unknown = JSON.parse(text);
    if (raw && typeof raw === "object" && "errors" in raw && Array.isArray(raw.errors) && raw.errors.length > 0) {
      throw unavailable("GRAPHQL");
    }
    const viewer = numericSchema.parse(raw).data.viewer;
    const lexicalText = text.replace(/"(?:\\[\s\S]|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
      token => token.startsWith('"') ? token : JSON.stringify(token));
    const lexical = lexicalSchema.parse(JSON.parse(lexicalText)).data.viewer.contributionsCollection.contributionCalendar;
    const calendar = viewer.contributionsCollection.contributionCalendar;
    if (!exactCount(lexical.totalContributions, calendar.totalContributions)) throw unavailable();
    const days = calendar.weeks.flatMap((week, weekIndex) => week.contributionDays.map((day, dayIndex) => {
      if (!exactCount(lexical.weeks[weekIndex].contributionDays[dayIndex].contributionCount, day.contributionCount)) throw unavailable();
      return { date: day.date, count: day.contributionCount, level: levels.indexOf(day.contributionLevel) };
    }));
    if (days.length > 400 || new Set(days.map(day => day.date)).size !== days.length) throw unavailable();
    const from = z.iso.datetime({ offset: true }).parse(window.from), to = z.iso.datetime({ offset: true }).parse(window.to);
    if (Date.parse(from) > Date.parse(to)) throw unavailable();
    const start = from.slice(0, 10), end = to.slice(0, 10);
    const caveats = ["GitHub account; contribution visibility and coverage follow the source"];
    if (days.reduce((sum, day) => sum + BigInt(day.count), BigInt(0)) !== BigInt(calendar.totalContributions)) {
      caveats.push("Reported total differs from returned daily counts; both are retained without reconciliation");
    }
    if (days.some(day => day.date < start || day.date > end)) {
      caveats.push("Returned calendar includes dates outside the requested period; those dates do not establish period coverage");
    }
    return {
      accountLabel: `github.com/${viewer.login}`,
      value: calendar.totalContributions,
      activity: {
        kind: "contributionCalendar", attributionScope: "PERSONAL", capturedAt: to, freshness: "FRESH",
        provenanceLabel: caveats.join(". "), period: { start, end, label: "Last 12 months" },
        total: calendar.totalContributions, memberSince: viewer.createdAt.slice(0, 10), days,
      },
    };
  } catch (error) { throw error instanceof GithubActivityError ? error : unavailable(); }
}

export async function fetchGithubActivity(token: string, fetcher: typeof fetch = fetch): Promise<GithubActivity> {
  const to = new Date(), from = new Date(to);
  from.setUTCFullYear(to.getUTCFullYear() - 1);
  const window = { from: from.toISOString(), to: to.toISOString() };
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const cancelReader = () => { void reader?.cancel().catch(() => undefined); };
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      cancelReader();
      reject(unavailable("TIMEOUT"));
    }, GITHUB_REQUEST_TIMEOUT_MS);
  });
  const retrieve = async () => {
    const response = await fetcher("https://api.github.com/graphql", {
      method: "POST", redirect: "error", credentials: "omit", cache: "no-store", signal: controller.signal,
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "proper-respect" },
      body: JSON.stringify({
        query: `query ViewerActivity($from: DateTime!, $to: DateTime!) {
          viewer {
            login
            createdAt
            contributionsCollection(from: $from, to: $to) {
              contributionCalendar {
                totalContributions
                weeks { contributionDays { date contributionCount contributionLevel } }
              }
            }
          }
        }`,
        variables: window,
      }),
    });
    if (!response.ok) {
      void response.body?.cancel().catch(() => undefined);
      throw unavailable("HTTP", response.status);
    }
    if (controller.signal.aborted || response.redirected ||
        response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json" ||
        Number(response.headers.get("content-length")) > GITHUB_RESPONSE_BYTES) {
      void response.body?.cancel().catch(() => undefined);
      throw unavailable("RESPONSE");
    }
    reader = response.body?.getReader();
    if (!reader) throw unavailable("RESPONSE");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (controller.signal.aborted) throw unavailable("TIMEOUT");
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > GITHUB_RESPONSE_BYTES) throw unavailable("RESPONSE");
        chunks.push(part.value);
      }
      const body = new Uint8Array(bytes);
      let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
      let text: string;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(body); }
      catch { throw unavailable("PARSER"); }
      return parseGithubActivity(text, window);
    } catch (error) { cancelReader(); throw error instanceof GithubActivityError ? error : unavailable("TRANSPORT"); }
    finally { reader.releaseLock(); }
  };
  try { return await Promise.race([retrieve(), deadline]); }
  catch (error) { controller.abort(); cancelReader(); throw error instanceof GithubActivityError ? error : unavailable("TRANSPORT"); }
  finally { clearTimeout(timeout); }
}
