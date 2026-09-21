import { describe, expect, it, vi } from "vitest";
import { registerPublicProfileTool, type PublicProfileTool, type PublicProfileModelContext } from "@/components/public-profile-webmcp";
import { projectVisiblePublicProfile } from "@/src/domain/visible-public-profile";

const profile = projectVisiblePublicProfile({ handle: "first", displayName: "First", bio: "", cards: [] });
function harness(pending = false) {
  const registered: { tool: PublicProfileTool; signal: AbortSignal }[] = [];
  let resolve!: () => void;
  const context: PublicProfileModelContext = {
    registerTool: vi.fn((tool, { signal }) => {
      registered.push({ tool, signal });
      return pending ? new Promise<void>(done => { resolve = done; }) : Promise.resolve();
    }),
  };
  return { context, registered, complete: () => resolve() };
}
const invoke = (tool: PublicProfileTool, input: unknown = {}, signal = new AbortController().signal) => tool.execute(input, { signal });

describe("public profile registration contract (native API double)", () => {
  it("registers only the documented read-only tool and returns independent JSON snapshots", async () => {
    const h = harness(); const cleanup = registerPublicProfileTool(h.context, profile);
    const { tool, signal } = h.registered[0];
    expect(tool).toMatchObject({ name: "get_current_public_profile", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true } });
    expect(await invoke(tool)).toEqual(profile);
    const first = await invoke(tool); if ("cards" in first) (first.cards as unknown[]).push("mutated");
    expect(await invoke(tool)).toEqual(profile);
    cleanup(); expect(signal.aborted).toBe(true);
  });
  it.each([undefined, null, "", 0, [], { handle: "someone-else" }, { extra: undefined }])("returns actionable input errors for %j", async input => {
    const h = harness(); registerPublicProfileTool(h.context, profile);
    expect(await h.registered[0].tool.execute(input, { signal: new AbortController().signal })).toHaveProperty("error");
  });
  it("rejects cancelled executions and retained callbacks after cleanup", async () => {
    const h = harness(); const cleanup = registerPublicProfileTool(h.context, profile);
    const cancellation = new AbortController(); cancellation.abort();
    await expect(invoke(h.registered[0].tool, {}, cancellation.signal)).rejects.toMatchObject({ name: "AbortError" });
    cleanup(); await expect(invoke(h.registered[0].tool)).rejects.toMatchObject({ name: "AbortError" });
  });
  it("accepts bridge calls without execution options while retaining lifecycle cancellation", async () => {
    const h = harness(); const cleanup = registerPublicProfileTool(h.context, profile);
    const { tool } = h.registered[0];
    expect(await tool.execute({})).toEqual(profile);
    expect(await tool.execute({}, {})).toEqual(profile);
    cleanup();
    await expect(tool.execute({})).rejects.toMatchObject({ name: "AbortError" });
    await expect(tool.execute({}, {})).rejects.toMatchObject({ name: "AbortError" });
  });
  it("handles cleanup while registration is pending and fresh registration after StrictMode replay", async () => {
    const h = harness(true); const cleanup = registerPublicProfileTool(h.context, profile);
    const old = h.registered[0]; cleanup(); h.complete();
    registerPublicProfileTool(h.context, { ...profile, handle: "second" });
    expect(h.registered[1].signal).not.toBe(old.signal);
    expect(h.registered[1].signal.aborted).toBe(false);
    await expect(invoke(old.tool)).rejects.toMatchObject({ name: "AbortError" });
    expect(await invoke(h.registered[1].tool)).toMatchObject({ handle: "second" });
    h.complete();
  });
  it.each([true, false])("contains synchronous or async registration failure (%s)", async synchronous => {
    let retained: PublicProfileTool | undefined;
    const context: PublicProfileModelContext = { registerTool(tool) {
      retained = tool;
      if (synchronous) throw new Error("Unsupported policy");
      return Promise.reject(new Error("Unsupported policy"));
    } };
    expect(() => registerPublicProfileTool(context, profile)).not.toThrow();
    await Promise.resolve();
    await expect(invoke(retained!)).rejects.toMatchObject({ name: "AbortError" });
  });
});
