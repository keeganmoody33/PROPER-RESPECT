import { describe, expect, it, vi } from "vitest";
import { registerPublicSiteGuideTool, type PublicSiteGuideTool, type PublicSiteGuideModelContext } from "@/components/public-site-guide-webmcp";
import { publicSiteGuide } from "@/src/server/agent-discovery";

const profile = publicSiteGuide();
function harness(pending = false) {
  const registered: { tool: PublicSiteGuideTool; signal: AbortSignal }[] = [];
  let resolve!: () => void;
  const context: PublicSiteGuideModelContext = {
    registerTool: vi.fn((tool, { signal }) => {
      registered.push({ tool, signal });
      return pending ? new Promise<void>(done => { resolve = done; }) : Promise.resolve();
    }),
  };
  return { context, registered, complete: () => resolve() };
}
const invoke = (tool: PublicSiteGuideTool, input: unknown = {}, signal = new AbortController().signal) => tool.execute(input, { signal });

describe("public site guide registration contract (native API double)", () => {
  it("registers only the documented read-only tool and returns independent JSON snapshots", async () => {
    const h = harness(); const cleanup = registerPublicSiteGuideTool(h.context, profile);
    const { tool, signal } = h.registered[0];
    expect(tool).toMatchObject({ name: "get_public_site_guide", description: "Explains Proper Respect, links to public documentation, and describes how to read a supplied published profile.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false } });
    expect(await invoke(tool)).toEqual(profile);
    const first = await invoke(tool); if ("limits" in first) first.limits.push("mutated");
    expect(await invoke(tool)).toEqual(profile);
    cleanup(); expect(signal.aborted).toBe(true);
  });
  it.each([undefined, null, "", 0, [], { handle: "someone-else" }, { extra: undefined }, { [Symbol("extra")]: true }, { url: "https://private.invalid" }])("returns actionable input errors for %j", async input => {
    const h = harness(); registerPublicSiteGuideTool(h.context, profile);
    expect(await h.registered[0].tool.execute(input, { signal: new AbortController().signal })).toEqual({ error: "Use an empty object {}. This tool returns the public site guide and accepts no URL, handle, or other arguments." });
  });
  it("rejects cancelled executions and retained callbacks after cleanup", async () => {
    const h = harness(); const cleanup = registerPublicSiteGuideTool(h.context, profile);
    const cancellation = new AbortController(); cancellation.abort();
    await expect(invoke(h.registered[0].tool, {}, cancellation.signal)).rejects.toMatchObject({ name: "AbortError" });
    cleanup(); await expect(invoke(h.registered[0].tool)).rejects.toMatchObject({ name: "AbortError" });
  });
  it("accepts bridge calls without execution options while retaining lifecycle cancellation", async () => {
    const h = harness(); const cleanup = registerPublicSiteGuideTool(h.context, profile);
    const { tool } = h.registered[0];
    expect(await tool.execute({})).toEqual(profile);
    expect(await tool.execute({}, {})).toEqual(profile);
    cleanup();
    await expect(tool.execute({})).rejects.toMatchObject({ name: "AbortError" });
    await expect(tool.execute({}, {})).rejects.toMatchObject({ name: "AbortError" });
  });
  it("handles cleanup while registration is pending and fresh registration after StrictMode replay", async () => {
    const h = harness(true); const cleanup = registerPublicSiteGuideTool(h.context, profile);
    const old = h.registered[0]; cleanup(); h.complete();
    registerPublicSiteGuideTool(h.context, { ...profile, name: "second" });
    expect(h.registered[1].signal).not.toBe(old.signal);
    expect(h.registered[1].signal.aborted).toBe(false);
    await expect(invoke(old.tool)).rejects.toMatchObject({ name: "AbortError" });
    expect(await invoke(h.registered[1].tool)).toMatchObject({ name: "second" });
    h.complete();
  });
  it.each([true, false])("contains synchronous or async registration failure (%s)", async synchronous => {
    let retained: PublicSiteGuideTool | undefined;
    const context: PublicSiteGuideModelContext = { registerTool(tool) {
      retained = tool;
      if (synchronous) throw new Error("Unsupported policy");
      return Promise.reject(new Error("Unsupported policy"));
    } };
    expect(() => registerPublicSiteGuideTool(context, profile)).not.toThrow();
    await Promise.resolve();
    await expect(invoke(retained!)).rejects.toMatchObject({ name: "AbortError" });
  });
});

it("execution uses only its captured static data and does not fetch", async () => {
  const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("No network permitted"));
  try {
    const h = harness();
    const source = publicSiteGuide();
    const expected = structuredClone(source);
    registerPublicSiteGuideTool(h.context, source);
    source.documentation.agents = "https://changed.invalid";
    expect(await h.registered[0].tool.execute({})).toEqual(expected);
    expect(fetch).not.toHaveBeenCalled();
  } finally { fetch.mockRestore(); }
});
