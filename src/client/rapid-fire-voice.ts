"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeSession } from "@openai/agents-realtime";
import type { RapidFireControls } from "./voice-tools";

// The voice half of rapid fire: one OpenAI Realtime session over WebRTC, opened only when the owner presses Play. The
// SDK and the tools load then, not with the page. The browser asks for the microphone; audio goes to OpenAI and is not
// stored by Proper Respect. Only the answers on screen are saved.

export type VoiceState = "off" | "starting" | "listening" | "thinking" | "speaking" | "paused";

const SESSION_ROUTE = "/api/voice/session";

export function useRapidFireVoice() {
  const session = useRef<RealtimeSession | null>(null);
  const [state, setState] = useState<VoiceState>("off");
  const [error, setError] = useState("");

  const stop = useCallback(() => {
    session.current?.close();
    session.current = null;
    setState("off");
  }, []);
  useEffect(() => stop, [stop]);

  /** Tells the agent what changed on screen. With `respond`, it answers (says the new card's name). */
  const note = useCallback((text: string, respond = false) => {
    const live = session.current;
    if (!live) return;
    live.transport.sendEvent({ type: "conversation.item.create",
      item: { type: "message", role: "system", content: [{ type: "input_text", text: `[screen] ${text}` }] } });
    if (respond) live.transport.sendEvent({ type: "response.create" });
  }, []);

  const start = useCallback(async (names: readonly string[], controls: RapidFireControls, firstCard: string) => {
    if (session.current) return true;
    setError("");
    setState("starting");
    try {
      const response = await fetch(SESSION_ROUTE, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const body = await response.json().catch(() => ({})) as { key?: string; model?: string; error?: string };
      if (!response.ok || !body.key) throw new Error(body.error || "Voice is unavailable right now. You can tap through instead.");
      const [{ RealtimeAgent, RealtimeSession: Session }, { rapidFireInstructions, rapidFireTools }] =
        await Promise.all([import("@openai/agents-realtime"), import("./voice-tools")]);
      const agent = new RealtimeAgent({ name: "Rapid fire", instructions: rapidFireInstructions(names), tools: rapidFireTools(controls) });
      const live = new Session(agent, {
        transport: "webrtc", model: body.model,
        // Waits for them to finish a thought before it answers, so a pause doesn't cut them off.
        config: { audio: { input: { turnDetection: { type: "semantic_vad", eagerness: "low" } } } },
        historyStoreAudio: false,
      });
      live.on("audio_start", () => setState("speaking"));
      live.on("audio_stopped", () => setState(current => current === "paused" ? current : "listening"));
      live.on("agent_tool_start", () => setState(current => current === "paused" ? current : "thinking"));
      live.on("agent_tool_end", () => setState(current => current === "thinking" ? "listening" : current));
      live.on("error", () => setError("Voice hit a problem. Your answers on screen are kept; you can keep tapping."));
      session.current = live;
      await live.connect({ apiKey: body.key, model: body.model });
      setState("listening");
      note(`First card: ${firstCard}.`, true);
      return true;
    } catch (reason) {
      session.current?.close();
      session.current = null;
      setState("off");
      const message = reason instanceof Error ? reason.message : "";
      setError(/permission|denied|notallowed/i.test(message) || (reason instanceof DOMException && reason.name === "NotAllowedError")
        ? "The microphone is blocked for this site. Allow it in your browser, or tap through instead."
        : message || "Voice couldn't start. You can tap through instead.");
      return false;
    }
  }, [note]);

  const pause = useCallback(() => {
    if (!session.current) return;
    session.current.interrupt();
    session.current.mute(true);
    setState("paused");
  }, []);
  const resume = useCallback(() => {
    if (!session.current) return;
    session.current.mute(false);
    setState("listening");
  }, []);

  return { state, error, start, stop, pause, resume, note, active: state !== "off" && state !== "starting" };
}
