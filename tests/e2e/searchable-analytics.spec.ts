import { readFile, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const syntheticTracker = `
  const tracker = document.querySelector("script[data-domain]");
  const session = crypto.randomUUID();
  const capture = () => navigator.sendBeacon("https://tracker.searchableanalytics.com/v1/beacons", JSON.stringify({
    vid: session, sid: session, d: tracker.dataset.domain, tk: tracker.dataset.siteToken,
    events: [{ t: "pageview", p: location.pathname, u: location.href, tl: document.title, r: document.referrer }]
  }));
  const replace = history.replaceState.bind(history);
  history.replaceState = (...args) => { replace(...args); capture(); };
  capture();
`;

test("reserved roots cannot load the tracker through direct frame navigation", async ({ page, request }) => {
  let trackerRequests = 0;
  await page.route("https://tracker.searchableanalytics.com/**", async route => {
    trackerRequests++;
    await route.abort();
  });
  for (const path of ["/app/collection", "/sign-in", "/onboarding", "/evidence-fixture", "/admin", "/icon", "/apple-icon", "/agents", "/auth", "/index"]) {
    const url = `/api/analytics/searchable?path=${encodeURIComponent(path)}`;
    const response = await request.get(url);
    expect(response.status()).toBe(404);
    expect(await response.body()).toHaveLength(0);
    await page.goto(url).catch(error => expect(String(error)).toContain("net::ERR_HTTP_RESPONSE_CODE_FAILURE"));
  }
  expect(trackerRequests).toBe(0);
});

for (const width of [390, 1440]) test(`isolated public visits exclude private data at ${width}px`, async ({ page, context }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  const script = process.env.SEARCHABLE_TEST_SOURCE ? await readFile(process.env.SEARCHABLE_TEST_SOURCE, "utf8") : syntheticTracker;
  const batches: { vid: string; sid: string; events: { t: string; p: string; u?: string; tl?: string; r?: string }[] }[] = [];
  let scripts = 0;
  const unexpected: string[] = [];
  await page.route("https://tracker.searchableanalytics.com/**", async route => {
    const url = route.request().url();
    if (url.endsWith("/s.js")) {
      scripts++;
      await route.fulfill({ contentType: "text/javascript", body: script });
    } else if (url.endsWith("/v1/beacons")) {
      batches.push(JSON.parse(route.request().postData() || "{}"));
      await route.fulfill({ status: 202, body: "{}", headers: { "Access-Control-Allow-Origin": "*" } });
    } else {
      unexpected.push(url);
      await route.abort();
    }
  });
  const pageviews = () => batches.flatMap(batch => batch.events).filter(event => event.t === "pageview");
  await page.goto("/?private_note=synthetic-secret#secret");
  await expect.poll(() => pageviews().length, { timeout: 10_000 }).toBe(1);
  await expect(page.locator("iframe")).toHaveAttribute("sandbox", "allow-scripts");
  const initialFrame = page.frames().find(frame => frame !== page.mainFrame())!;
  expect(await initialFrame.evaluate(() => {
    try { return Boolean(parent.document.body); } catch { return false; }
  })).toBe(false);
  expect(await initialFrame.evaluate(() => {
    try { localStorage.setItem("probe", "test"); return true; } catch { return false; }
  })).toBe(false);

  await page.evaluate(() => history.pushState(null, "", "/about/privacy?private_note=synthetic-secret#secret"));
  await expect.poll(() => pageviews().length, { timeout: 10_000 }).toBe(2);
  expect(scripts).toBe(1);
  expect(page.frames().find(frame => frame !== page.mainFrame())).toBe(initialFrame);
  expect(pageviews().map(event => event.p)).toEqual(["/", "/about/privacy"]);
  expect(new Set(batches.map(batch => batch.sid)).size).toBe(1);

  await initialFrame.evaluate(() => dispatchEvent(new MessageEvent("message", {
    source: parent,
    origin: "https://attacker.test",
    data: { type: "searchable-public-path", pathname: "/attacker" },
  })));
  await initialFrame.evaluate(() => window.postMessage({ type: "searchable-public-path", pathname: "/app/collection/private-fixture" }, "*"));
  await page.evaluate(() => {
    const frame = document.querySelector("iframe")!;
    frame.contentWindow!.postMessage({ type: "searchable-public-path", pathname: "/sign-in?secret=x" }, "*");
    frame.contentWindow!.postMessage({ type: "searchable-public-path", pathname: "/about/privacy" }, "*");
    document.title = "Synthetic private collection title";
    document.body.appendChild(Object.assign(document.createElement("p"), { textContent: "Synthetic private collection text" }));
    history.pushState(null, "", "/app/collection/private-fixture?secret=x#secret");
  });
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(pageviews()).toHaveLength(2);

  await page.evaluate(() => history.pushState(null, "", "/keegan"));
  await expect.poll(() => pageviews().length, { timeout: 10_000 }).toBe(3);
  expect(scripts).toBe(2);
  expect(pageviews().map(event => event.p)).toEqual(["/", "/about/privacy", "/keegan"]);
  expect(new Set(batches.map(batch => batch.sid)).size).toBe(2);
  for (const event of pageviews()) {
    expect(event.tl).toBe("");
    expect(event.r ?? "").toBe("");
    expect(event.u).not.toMatch(/[?#]/);
  }
  expect(JSON.stringify(batches)).not.toMatch(/synthetic-secret|private-fixture|Synthetic private collection|\/sign-in/);
  expect(await context.cookies()).toEqual([]);
  expect(unexpected).toEqual([]);
  const evidence = testInfo.outputPath("intercepted-searchable-batches.json");
  await writeFile(evidence, JSON.stringify({ width, source: process.env.SEARCHABLE_TEST_SOURCE ? "captured official SDK" : "synthetic tracker", scripts, batches }, null, 2));
  await testInfo.attach("intercepted-searchable-batches.json", { path: evidence, contentType: "application/json" });
});
