import { auth } from "@clerk/nextjs/server";
import { voiceSessionResponse } from "@/src/server/voice-onboarding";

const lastIssued = new Map<string, number>();

/** A short-lived OpenAI Realtime key for the signed-in owner's voice walkthrough. Off unless VOICE_ONBOARDING=1. */
export async function POST(request: Request) {
  return voiceSessionResponse(request, {
    env: process.env, fetch, now: Date.now, lastIssued,
    userId: async () => (await auth()).userId,
  });
}
