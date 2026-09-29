import { describe, expect, it } from "vitest";
import { captureScreenshot } from "./screenshot";

const captureError = () => new Error("page.screenshot: Protocol error (Page.captureScreenshot): Unable to capture screenshot");

function target(failures: Error[]) {
  const calls: unknown[] = [];
  return {
    calls,
    async screenshot(options: unknown) {
      calls.push(options);
      const failure = failures.shift();
      if (failure) throw failure;
      return Buffer.from("png");
    },
  };
}

describe("captureScreenshot", () => {
  it("retries Chromium's transient capture failure and returns the image", async () => {
    const page = target([captureError(), captureError()]);
    const options = { path: "shot.png", fullPage: true };
    await expect(captureScreenshot(page, options, { delayMs: 0 })).resolves.toEqual(Buffer.from("png"));
    expect(page.calls).toEqual([options, options, options]);
  });

  it("gives up after three attempts", async () => {
    const page = target([captureError(), captureError(), captureError()]);
    await expect(captureScreenshot(page, {}, { delayMs: 0 })).rejects.toThrow("Unable to capture screenshot");
    expect(page.calls).toHaveLength(3);
  });

  it("does not retry any other failure", async () => {
    const page = target([new Error("locator.screenshot: Timeout 30000ms exceeded")]);
    await expect(captureScreenshot(page, {}, { delayMs: 0 })).rejects.toThrow("Timeout 30000ms exceeded");
    expect(page.calls).toHaveLength(1);
  });
});
