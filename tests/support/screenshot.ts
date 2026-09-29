/**
 * Chromium intermittently rejects Page.captureScreenshot with "Unable to capture screenshot"
 * (seen on 390px full-page captures in CI). Retry only that failure; anything else is real.
 */
const TRANSIENT_CAPTURE_FAILURE = "Unable to capture screenshot";
const ATTEMPTS = 3;

type Screenshottable<Options> = { screenshot(options: Options): Promise<Buffer> };

export async function captureScreenshot<Options>(
  target: Screenshottable<Options>,
  options: Options,
  { delayMs = 250 }: { delayMs?: number } = {},
): Promise<Buffer> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await target.screenshot(options);
    } catch (error) {
      const transient = error instanceof Error && error.message.includes(TRANSIENT_CAPTURE_FAILURE);
      if (!transient || attempt >= ATTEMPTS) throw error;
      await new Promise<void>(done => setTimeout(done, delayMs));
    }
  }
}
