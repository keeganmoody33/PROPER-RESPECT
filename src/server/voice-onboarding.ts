// Rapid fire voice onboarding (docs: voice onboarding spec, 2026-11-17). The voice runs in the browser on OpenAI's
// Realtime API; the only server piece is this: a short-lived client key for a signed-in owner. The provider key never
// leaves the server, and nothing the owner says is stored here.
//
// Off unless both are set on the server: VOICE_ONBOARDING=1 and OPENAI_API_KEY. With either missing, the collection
// page offers no voice, the microphone stays blocked, and the key route answers 404.

export const VOICE_MODEL = "gpt-realtime-2.1-mini";
const CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets";
// How long a minted key can be used to open a session. The session itself can then run on.
const KEY_SECONDS = 120;
// One new voice session per owner per this many milliseconds, in this server instance (a prototype limit).
export const VOICE_SESSION_INTERVAL_MS = 20_000;

type Env = Readonly<Record<string, string | undefined>>;

export function voiceOnboardingEnabled(env: Env = process.env): boolean {
  return env.VOICE_ONBOARDING === "1" && Boolean(env.OPENAI_API_KEY?.trim());
}

/** The model the session runs on: OPENAI_REALTIME_MODEL when set (to try the full-size model), else the mini. */
export function voiceModel(env: Env = process.env): string {
  const chosen = env.OPENAI_REALTIME_MODEL?.trim();
  return chosen && /^[a-z0-9][a-z0-9.-]{0,63}$/.test(chosen) ? chosen : VOICE_MODEL;
}

export type VoiceSessionDeps = Readonly<{
  env: Env;
  userId: () => Promise<string | null>;
  fetch: typeof fetch;
  now: () => number;
  /** When each owner last got a key, kept by the caller so it lasts between requests. */
  lastIssued: Map<string, number>;
}>;

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

/** POST /api/voice/session: a client key for the signed-in owner, or why there is none. */
export async function voiceSessionResponse(request: Request, deps: VoiceSessionDeps): Promise<Response> {
  if (!voiceOnboardingEnabled(deps.env)) return json({ error: "Not found." }, 404);
  if (request.headers.get("origin") !== new URL(request.url).origin ||
      (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) {
    return json({ error: "Same-origin POST required." }, 403);
  }
  const userId = await deps.userId();
  if (!userId) return json({ error: "Sign in to use voice." }, 401);

  const now = deps.now();
  const last = deps.lastIssued.get(userId);
  if (last !== undefined && now - last < VOICE_SESSION_INTERVAL_MS) {
    const seconds = Math.ceil((VOICE_SESSION_INTERVAL_MS - (now - last)) / 1000);
    return json({ error: `Voice just started. Try again in ${seconds} seconds.` }, 429, { "Retry-After": String(seconds) });
  }

  const model = voiceModel(deps.env);
  let response: Response;
  try {
    response = await deps.fetch(CLIENT_SECRETS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${deps.env.OPENAI_API_KEY!.trim()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        expires_after: { anchor: "created_at", seconds: KEY_SECONDS },
        session: { type: "realtime", model },
      }),
    });
  } catch {
    return json({ error: "Voice is unavailable right now. You can tap through instead." }, 502);
  }
  // The provider's own error text can name the account, so none of it is passed on.
  if (!response.ok) return json({ error: "Voice is unavailable right now. You can tap through instead." }, 502);
  const body = await response.json().catch(() => null) as { value?: unknown; expires_at?: unknown } | null;
  if (typeof body?.value !== "string" || !body.value.startsWith("ek_")) {
    return json({ error: "Voice is unavailable right now. You can tap through instead." }, 502);
  }
  // Old entries go once they no longer limit anyone, so the map stays small.
  if (deps.lastIssued.size > 1000) for (const [id, at] of deps.lastIssued) if (now - at >= VOICE_SESSION_INTERVAL_MS) deps.lastIssued.delete(id);
  deps.lastIssued.set(userId, now);
  return json({ key: body.value, model, expiresAt: typeof body.expires_at === "number" ? body.expires_at : undefined }, 200);
}
