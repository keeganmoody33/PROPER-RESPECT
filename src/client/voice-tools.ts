import { tool } from "@openai/agents-realtime";
import { z } from "zod";
import { CREDIT_PLATFORMS, type CreditPlatform } from "@/src/domain/props-credit";
import { MORE_CHOICES, PRIMARY_CHOICES, type WalkthroughChoice } from "./walkthrough";
import type { RapidFireAnswer } from "./rapid-fire";

// The voice agent's tools for rapid fire (voice onboarding spec, sections 4 and 4b). They run in the browser, next to
// the card on screen, and change it through the same controls a tap uses, so the screen stays the truth. The model
// never talks to the database: moving on saves privately, and removing or publishing stays a tap.

/** What the agent can read about the card on screen. */
export type VoiceCardView = Readonly<{
  name: string; reason: string; progress: string;
  uses: readonly Readonly<{ id: string; label: string }>[];
  answer: RapidFireAnswer;
}>;

/** What a tool can do to the screen. Each returns a short line the agent hears back. */
export type RapidFireControls = Readonly<{
  view: () => VoiceCardView | null;
  setUsage: (choice: WalkthroughChoice) => string;
  setUses: (picks: readonly string[], other: string | undefined, mode: "replace" | "add") => string;
  setSince: (date: string) => string;
  setCredit: (platform: CreditPlatform, handle: string, platformName?: string) => string;
  addComment: (text: string) => string;
  next: () => string;
  back: () => string;
  skip: () => string;
  stop: () => string;
}>;

const CHOICES = [...PRIMARY_CHOICES, ...MORE_CHOICES] as [WalkthroughChoice, ...WalkthroughChoice[]];
const PLATFORMS = CREDIT_PLATFORMS.map(option => option.id) as [CreditPlatform, ...CreditPlatform[]];

/** The card as the agent hears it: plain facts, no ids it could read aloud by mistake. */
export function describeCard(view: VoiceCardView | null): string {
  if (!view) return "No card is open.";
  const { answer } = view;
  return JSON.stringify({
    tool: view.name, why: view.reason, progress: view.progress,
    useOptions: view.uses,
    heard: {
      usage: answer.choice ?? null, uses: answer.usePicks, somethingElse: answer.useOther || null,
      since: answer.startedAt || null, credit: answer.creditHandle ? { platform: answer.creditPlatform, handle: answer.creditHandle } : null,
      comment: answer.comment || null,
    },
  });
}

export function rapidFireTools(controls: RapidFireControls) {
  return [
    tool({
      name: "get_current_card", description: "Read the card on screen: the tool's name, why it is here, its use options and what has been heard so far.",
      parameters: z.object({}), execute: async () => describeCard(controls.view()),
    }),
    tool({
      name: "set_usage",
      description: "Set how the owner uses this tool, only from what they said. DAILY, WEEKLY, OCCASIONAL (now and then), TESTING (trying it), "
        + "PAUSED (on a break), STOPPED (used to, not now), TRIED_NOT_ADOPTED (tried it, didn't stick), NEVER (never used it). Never guess.",
      parameters: z.object({ choice: z.enum(CHOICES) }),
      execute: async ({ choice }) => controls.setUsage(choice),
    }),
    tool({
      name: "set_uses",
      description: "Set what they use the tool for. picks: ids from the card's useOptions that match what they said. other: anything they said "
        + "that no option covers, in their words (60 characters). mode add keeps earlier picks; replace starts over.",
      parameters: z.object({ picks: z.array(z.string()).max(6), other: z.string().max(200).nullable(), mode: z.enum(["add", "replace"]) }),
      execute: async ({ picks, other, mode }) => controls.setUses(picks, other ?? undefined, mode),
    }),
    tool({
      name: "set_since",
      description: "When they started using it, only if they said. A year alone as YYYY (\"since 2023\" is 2023). A full date as YYYY-MM-DD only "
        + "when they said the day. Never add a month or day they didn't say.",
      parameters: z.object({ date: z.string().regex(/^\d{4}(-\d{2}-\d{2})?$/) }),
      execute: async ({ date }) => controls.setSince(date),
    }),
    tool({
      name: "set_credit",
      description: "Who put them on this tool, only if they said. platform is where that person's handle is; OTHER with platformName for anywhere else.",
      parameters: z.object({ platform: z.enum(PLATFORMS), handle: z.string().max(80), platformName: z.string().max(40).nullable() }),
      execute: async ({ platform, handle, platformName }) => controls.setCredit(platform, handle, platformName ?? undefined),
    }),
    tool({
      name: "set_comment",
      description: "Anything else they said about this tool (what it's great at, why they stopped, a story). Pass their words exactly as said. "
        + "Do not summarise, improve or rewrite them. Each call adds to the comment.",
      parameters: z.object({ text: z.string().max(1000) }),
      execute: async ({ text }) => controls.addComment(text),
    }),
    tool({
      name: "next_card", description: "Only when they say \"next\" (or done, move on). Saves this card privately and shows the next one.",
      parameters: z.object({}), execute: async () => controls.next(),
    }),
    tool({
      name: "previous_card", description: "Only when they say \"back\" or \"go back\". Reopens the last card with what was saved.",
      parameters: z.object({}), execute: async () => controls.back(),
    }),
    tool({
      name: "skip", description: "Only when they say \"skip\". Moves on without saving this card.",
      parameters: z.object({}), execute: async () => controls.skip(),
    }),
    tool({
      name: "stop", description: "Only when they say stop, pause or that they're done for now. Ends voice and shows their answers to check.",
      parameters: z.object({}), execute: async () => controls.stop(),
    }),
  ];
}

export const rapidFireInstructions = (names: readonly string[]) => `You help someone go through the tools they use, one card at a time, by voice. It's rapid fire: flashcards, not an interview.

The cards, in order: ${names.join(", ")}.

For each card:
- When a card opens, say only the tool's name as a question ("Clay?") and listen.
- Fill the card from what they say, with the tools: set_usage, set_uses, set_since, set_credit, set_comment. Call them as soon as you hear the answer.
- At most one short follow-up per card, and only when you heard no usage: "Using it, testing, or stopped?"
- Never guess a usage from their tone or anything else. No usage heard means none set.
- Anything else they say about the tool goes to set_comment exactly as they said it. Don't summarise or improve it.
- Uses come only from the card's useOptions. Their own words for anything else go in other.
- If you're not sure what they meant, ask once, then leave it for them to tap.
- Move on only when they say "next" (call next_card) or tap Next. Never move on after a pause, and never on your own.
- "back" calls previous_card, "skip" calls skip, "stop" or "pause" calls stop.
- Never publish anything and never remove a tool: those are taps on their screen.
- Keep every reply to a few words. Don't read the card back unless asked.

Messages marked [screen] tell you what they tapped or which card is now open. Don't ask again about what a tap just answered.`;
