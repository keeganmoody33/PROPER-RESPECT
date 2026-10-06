// Receives report-only CSP violations (R04). It keeps nothing: it logs the
// violated directive and the blocked origin, never the page, path or policy.

const MAX_BODY_BYTES = 8 * 1024;

async function boundedText(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function blockedOrigin(value: unknown): string {
  if (typeof value !== "string" || value === "") return "unknown";
  try {
    const url = new URL(value);
    return url.origin === "null" ? url.protocol.replace(/:$/, "") : url.origin;
  } catch {
    // "inline", "eval", "self" and similar keywords carry no URL.
    return /^[a-z-]{1,32}$/.test(value) ? value : "unknown";
  }
}

function directive(value: unknown): string {
  return typeof value === "string" && /^[a-z-]{1,64}$/.test(value) ? value : "unknown";
}

function violations(payload: unknown): { directive: string; blocked: string }[] {
  if (Array.isArray(payload)) {
    return payload.flatMap(report => {
      if (!report || typeof report !== "object" || report.type !== "csp-violation" || !report.body || typeof report.body !== "object") return [];
      return [{ directive: directive(report.body.effectiveDirective), blocked: blockedOrigin(report.body.blockedURL) }];
    });
  }
  const legacy = payload && typeof payload === "object" ? (payload as Record<string, unknown>)["csp-report"] : undefined;
  if (!legacy || typeof legacy !== "object") return [];
  const report = legacy as Record<string, unknown>;
  return [{ directive: directive(report["effective-directive"] ?? report["violated-directive"]), blocked: blockedOrigin(report["blocked-uri"]) }];
}

export async function POST(request: Request) {
  const text = await boundedText(request);
  if (text) {
    try {
      for (const violation of violations(JSON.parse(text))) {
        console.warn("CSP report-only violation", violation);
      }
    } catch {
      // A malformed report is ignored.
    }
  }
  return new Response(null, { status: 204 });
}
