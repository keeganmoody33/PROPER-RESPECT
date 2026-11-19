import { describe, expect, it, vi } from "vitest";
import { VOICE_MODEL, VOICE_SESSION_INTERVAL_MS, voiceModel, voiceOnboardingEnabled, voiceSessionResponse, type VoiceSessionDeps } from "./voice-onboarding";

const ON = { VOICE_ONBOARDING: "1", OPENAI_API_KEY: "sk-test-synthetic" };
const request = (origin = "https://proper-respect.com") => new Request("https://proper-respect.com/api/voice/session",
  { method: "POST", headers: { origin, "sec-fetch-site": origin === "https://proper-respect.com" ? "same-origin" : "cross-site" } });
const minted = () => Response.json({ value: "ek_synthetic", expires_at: 1_800_000_000 });
function deps(overrides: Partial<VoiceSessionDeps> = {}): VoiceSessionDeps {
  return { env: ON, userId: async () => "user_1", fetch: vi.fn(async () => minted()) as unknown as typeof fetch, now: () => 1_000_000, lastIssued: new Map(), ...overrides };
}

describe("voice onboarding switch", () => {
  it("is on only with both the flag and a key", () => {
    expect(voiceOnboardingEnabled(ON)).toBe(true);
    expect(voiceOnboardingEnabled({ VOICE_ONBOARDING: "1" })).toBe(false);
    expect(voiceOnboardingEnabled({ OPENAI_API_KEY: "sk-test" })).toBe(false);
    expect(voiceOnboardingEnabled({ VOICE_ONBOARDING: "true", OPENAI_API_KEY: "sk-test" })).toBe(false);
  });

  it("runs on the mini model unless another is named", () => {
    expect(voiceModel({})).toBe(VOICE_MODEL);
    expect(voiceModel({ OPENAI_REALTIME_MODEL: "gpt-realtime-2.1" })).toBe("gpt-realtime-2.1");
    expect(voiceModel({ OPENAI_REALTIME_MODEL: "x y/../" })).toBe(VOICE_MODEL);
  });
});

describe("the voice session key route", () => {
  it("doesn't exist while voice is off", async () => {
    const fetch = vi.fn();
    const response = await voiceSessionResponse(request(), deps({ env: {}, fetch: fetch as unknown as typeof globalThis.fetch }));
    expect(response.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses another site and a signed-out visitor", async () => {
    expect((await voiceSessionResponse(request("https://evil.example"), deps())).status).toBe(403);
    expect((await voiceSessionResponse(request(), deps({ userId: async () => null }))).status).toBe(401);
  });

  it("mints a short-lived client key and keeps the provider key on the server", async () => {
    const fetch = vi.fn(async () => minted());
    const response = await voiceSessionResponse(request(), deps({ fetch: fetch as unknown as typeof globalThis.fetch }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toEqual({ key: "ek_synthetic", model: VOICE_MODEL, expiresAt: 1_800_000_000 });
    expect(JSON.stringify(body)).not.toContain("sk-test");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/realtime/client_secrets");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer sk-test-synthetic");
    expect(JSON.parse(String(init.body))).toMatchObject({ session: { type: "realtime", model: VOICE_MODEL } });
  });

  it("starts one session per owner at a time", async () => {
    const lastIssued = new Map<string, number>();
    let now = 1_000_000;
    const shared = deps({ lastIssued, now: () => now });
    expect((await voiceSessionResponse(request(), shared)).status).toBe(200);
    const limited = await voiceSessionResponse(request(), shared);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe(String(VOICE_SESSION_INTERVAL_MS / 1000));
    now += VOICE_SESSION_INTERVAL_MS;
    expect((await voiceSessionResponse(request(), shared)).status).toBe(200);
  });

  it.each([
    ["the provider refuses", async () => Response.json({ error: { message: "account acct_123 over quota" } }, { status: 429 })],
    ["the provider is unreachable", async () => { throw new TypeError("fetch failed"); }],
    ["the provider answers without a client key", async () => Response.json({ value: "sk-not-a-client-key" })],
  ])("says voice is unavailable, and nothing more, when %s", async (_case, provider) => {
    const response = await voiceSessionResponse(request(), deps({ fetch: vi.fn(provider) as unknown as typeof fetch }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Voice is unavailable right now. You can tap through instead." });
  });
});
