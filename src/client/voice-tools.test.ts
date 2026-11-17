import { describe, expect, it, vi } from "vitest";
import { describeCard, rapidFireInstructions, rapidFireTools, type RapidFireControls } from "./voice-tools";

const controls = (): RapidFireControls => ({
  view: () => ({ name: "Clay", reason: "Found in your email", progress: "1 of 3", uses: [{ id: "lists", label: "Build lead lists" }],
    answer: { usePicks: [], useOther: "", startedAt: "", creditPlatform: "PROPER_RESPECT", creditHandle: "", creditPlatformName: "", ownerLine: null, openedVersion: 0, comment: "" } }),
  setUsage: vi.fn(() => "Usage set."), setUses: vi.fn(() => "Uses set."), setSince: vi.fn(() => "Since 2023."),
  setCredit: vi.fn(() => "Credit set."), addComment: vi.fn(() => "Comment added."),
  next: vi.fn(() => "Now on Exa."), back: vi.fn(() => "Back."), skip: vi.fn(() => "Skipped."), stop: vi.fn(() => "Stopped."),
});
const run = (tools: ReturnType<typeof rapidFireTools>, name: string, args: unknown) =>
  tools.find(candidate => candidate.name === name)!.invoke({} as never, JSON.stringify(args));

describe("the rapid fire voice tools", () => {
  it("are the card's controls and nothing else: no publish, no remove", () => {
    expect(rapidFireTools(controls()).map(tool => tool.name)).toEqual(
      ["get_current_card", "set_usage", "set_uses", "set_since", "set_credit", "set_comment", "next_card", "previous_card", "skip", "stop"]);
  });

  it("change the card through the same controls a tap uses", async () => {
    const screen = controls();
    const tools = rapidFireTools(screen);
    expect(await run(tools, "set_usage", { choice: "WEEKLY" })).toBe("Usage set.");
    expect(screen.setUsage).toHaveBeenCalledWith("WEEKLY");
    await run(tools, "set_uses", { picks: ["lists"], other: null, mode: "add" });
    expect(screen.setUses).toHaveBeenCalledWith(["lists"], undefined, "add");
    await run(tools, "set_comment", { text: "Jordan put me on it" });
    expect(screen.addComment).toHaveBeenCalledWith("Jordan put me on it");
    await run(tools, "next_card", {});
    expect(screen.next).toHaveBeenCalledOnce();
  });

  it("refuse a usage that isn't one of the eight answers, and a since with a made-up shape", async () => {
    const screen = controls();
    const tools = rapidFireTools(screen);
    await run(tools, "set_usage", { choice: "SOMETIMES" });
    await run(tools, "set_since", { date: "April 2023" });
    expect(screen.setUsage).not.toHaveBeenCalled();
    expect(screen.setSince).not.toHaveBeenCalled();
  });

  it("read the card back as facts, and tell the agent to move only on next", () => {
    expect(JSON.parse(describeCard(controls().view()))).toMatchObject({ tool: "Clay", progress: "1 of 3", heard: { usage: null } });
    expect(describeCard(null)).toBe("No card is open.");
    const instructions = rapidFireInstructions(["Clay", "Exa"]);
    expect(instructions).toContain("Clay, Exa");
    expect(instructions).toContain("Never move on after a pause");
  });
});
