import { ConvexHttpClient } from "convex/browser";
const destination = "https://utmost-mongoose-374.convex.cloud";
export function createCodexDevelopmentClient(signal: AbortSignal) {
  return new ConvexHttpClient(destination, { logger: false, fetch: async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (new URL(url).origin !== destination) throw new Error("Development destination changed.");
    const signals = [signal, AbortSignal.timeout(10_000)];
    if (init?.signal) signals.push(init.signal);
    return fetch(input, { ...init, redirect: "error", signal: AbortSignal.any(signals) });
  } });
}
