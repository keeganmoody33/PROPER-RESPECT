/**
 * Chromium intermittently rejects Page.captureScreenshot with "Unable to capture screenshot"
 * in CI (390px full-page captures). Immediate retries fail the same way, so each retry
 * backs off and waits for the page to paint a fresh frame first. Any other failure is real.
 */
const TRANSIENT_CAPTURE_FAILURE = "Unable to capture screenshot";
const RETRY_DELAYS_MS = [500, 1000, 2000];

type Screenshottable<Options> = { screenshot(options: Options): Promise<Buffer> };
type Paintable = { evaluate(callback: () => Promise<void>): Promise<unknown> };

const nextFrame = () =>
  new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done())));
const wait = (ms: number) => new Promise<void>(done => setTimeout(done, ms));

export async function captureScreenshot<Options>(
  page: Paintable,
  target: Screenshottable<Options>,
  options: Options,
  { sleep = wait }: { sleep?: (ms: number) => Promise<void> } = {},
): Promise<Buffer> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await target.screenshot(options);
    } catch (error) {
      const transient = error instanceof Error && error.message.includes(TRANSIENT_CAPTURE_FAILURE);
      if (!transient || attempt >= RETRY_DELAYS_MS.length) throw error;
      await sleep(RETRY_DELAYS_MS[attempt]);
      await page.evaluate(nextFrame);
    }
  }
}
