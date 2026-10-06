import { afterEach, describe, expect, it, vi } from "vitest";
import { captureScreenshot } from "./screenshot";

const captureError = () => new Error("page.screenshot: Protocol error (Page.captureScreenshot): Unable to capture screenshot");

function fixture(failures: Error[]) {
  const events: string[] = [];
  const calls: unknown[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => {
    events.push("frame");
    queueMicrotask(callback);
    return 0;
  });
  const page = { evaluate: (callback: () => Promise<void>) => callback() };
  const target = {
    async screenshot(options: unknown) {
      calls.push(options);
      events.push("shot");
      const failure = failures.shift();
      if (failure) throw failure;
      return Buffer.from("png");
    },
  };
  const sleep = async (ms: number) => { events.push(`wait ${ms}`); };
  return { page, target, calls, events, sleep };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe("captureScreenshot", () => {
  it("backs off and waits for a fresh frame before each retry", async () => {
    const { page, target, calls, events, sleep } = fixture([captureError(), captureError(), captureError()]);
    const options = { path: "shot.png", fullPage: true };
    await expect(captureScreenshot(page, target, options, { sleep })).resolves.toEqual(Buffer.from("png"));
    expect(calls).toEqual([options, options, options, options]);
    expect(events).toEqual(["shot", "wait 500", "frame", "frame", "shot", "wait 1000", "frame", "frame", "shot", "wait 2000", "frame", "frame", "shot"]);
  });

  it("gives up after four attempts", async () => {
    const { page, target, calls, sleep } = fixture([captureError(), captureError(), captureError(), captureError()]);
    await expect(captureScreenshot(page, target, {}, { sleep })).rejects.toThrow("Unable to capture screenshot");
    expect(calls).toHaveLength(4);
  });

  it("does not retry any other failure", async () => {
    const { page, target, calls, sleep } = fixture([new Error("locator.screenshot: Timeout 30000ms exceeded")]);
    await expect(captureScreenshot(page, target, {}, { sleep })).rejects.toThrow("Timeout 30000ms exceeded");
    expect(calls).toHaveLength(1);
  });
});
