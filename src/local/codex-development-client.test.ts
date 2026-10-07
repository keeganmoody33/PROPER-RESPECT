import { afterEach, expect, test, vi } from "vitest";
import { makeFunctionReference } from "convex/server";
import { createCodexDevelopmentClient } from "./codex-development-client";

afterEach(() => vi.unstubAllGlobals());

function delayedAcknowledgement(delay: number) {
  vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((resolve, reject) => {
    const signal = init?.signal;
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve(new Response(JSON.stringify({ status: "success", value: { sequence: 1, packetId: "accepted" } }), {
        headers: { "Content-Type": "application/json" },
      }));
    }, delay);
    function abort() { clearTimeout(timer); reject(signal?.reason); }
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  })));
}

test("accepts a slow receiver acknowledgement without losing the local request", async () => {
  delayedAcknowledgement(13_000);
  const client = createCodexDevelopmentClient(new AbortController().signal);
  await expect(client.mutation(makeFunctionReference<"mutation">("usageConnections:ingest"), {})).resolves.toEqual({ sequence: 1, packetId: "accepted" });
}, 20_000);

test("stopping the companion immediately cancels a slow pending request", async () => {
  delayedAcknowledgement(13_000);
  const controller = new AbortController();
  const client = createCodexDevelopmentClient(controller.signal);
  const pending = client.mutation(makeFunctionReference<"mutation">("usageConnections:ingest"), {});
  const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
  controller.abort();
  await rejected;
});
