import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { expect, test, type Page } from "@playwright/test";
import { parseMeasurementImport, reviewMeasurementImports } from "../../src/domain/measurements";

const stateKey = "proper-respect-fresh-user-fixture";
const attemptsKey = "measurement-preview-attempts";
const loadingKey = "measurement-query-loading";
const propId = "measurement-fixture-tool";
const captures = ["first", "second"].map((source, index) => {
  const parsed = parseMeasurementImport(JSON.stringify({
    format: "proper-measurements-v1", captureId: source, capturedAt: "2026-10-06T10:00:00.000Z",
    source: { namespace: "fixture-tool", identityBasis: "OWNER_SUPPLIED", sourceAlias: source, ownerAlias: "synthetic-owner", accountAlias: `private-${source}`, workspaceAlias: null, deviceAlias: null },
    measurements: [{ id: "tokens", metric: "tokens", value: String(17 + index), unit: "tokens", period: { kind: "unknown" }, scope: "ACCOUNT", coverage: "UNKNOWN", temporality: "SNAPSHOT", aggregation: "NON_ADDITIVE", overlapGroup: source }],
  }));
  const measurements = reviewMeasurementImports([parsed]);
  return { propId, rawEvidenceId: `evidence-${source}`, digest: parsed.digest, capturedAt: parsed.capturedAt, source: parsed.source, adapter: parsed.adapter, measurements, reviewedMeasurementIds: measurements.map(row => row.id), reviewVersion: 1, captureCount: 1 };
});
const initialState = {
  user: { _id: "synthetic-owner", handle: "synthetic-owner", displayName: "Synthetic owner", bio: "" },
  cards: [{
    product: { _id: "fixture-tool", _creationTime: 1, name: "Fixture Tool", slug: "fixture-tool", domain: "", description: "Synthetic measurement review" },
    prop: { _id: propId, _creationTime: 1, userId: "synthetic-owner", productId: "fixture-tool", status: "ACTIVE", visibility: "PRIVATE", confirmedAt: "2026-10-06T10:00:00.000Z", relationshipVersion: 1, headline: "", note: "", goTo: false },
    links: [], claims: [], previousStatuses: [], isPublishedAtCurrentHandle: false,
  }],
  connectors: [], drafts: [], evidence: [], privateInventoryAvailable: true,
  brandEnrichmentAvailable: false, hasPublicationAtCurrentHandle: false, hasClaimedPublicIdentity: true,
  measurementCaptures: captures,
};

let fixtureHtml: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: { contents: `import {createElement} from "react"; import {createRoot} from "react-dom/client"; import {OnboardingClient} from "./components/onboarding-client"; createRoot(document.getElementById("root")).render(createElement(OnboardingClient));`, resolveDir: process.cwd() },
    bundle: true, write: false, outfile: "measurement-review-state-fixture.js", platform: "browser", format: "iife", jsx: "automatic",
    loader: { ".css": "local-css" }, define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "measurement-review-boundaries", setup(builder) {
      builder.onResolve({ filter: /^(@clerk\/nextjs|convex\/react)$/ }, args => ({ path: args.path, namespace: "measurement-review" }));
      builder.onLoad({ filter: /.*/, namespace: "measurement-review" }, args => ({ resolveDir: process.cwd(), loader: "js", contents: args.path === "@clerk/nextjs" ? `
        const user = {id:"synthetic-owner",fullName:"Synthetic owner",imageUrl:"",externalAccounts:[]};
        export const Show=({children})=>children;
        export const SignInButton=({children})=>children;
        export const UserButton=()=>null;
        export const useUser=()=>({user});
        export const useAuth=()=>({getToken:async()=>"synthetic-token",sessionClaims:{}});
        export const useClerk=()=>({openUserProfile:()=>{}});
      ` : `
        export * from "./tests/e2e/fixtures/fresh-user-backend.js";
        import {useConvex as fixtureConvex,useQuery as fixtureQuery} from "./tests/e2e/fixtures/fresh-user-backend.js";
        import {getFunctionName} from "convex/server";
        export function useQuery(ref,args) {
          const result = fixtureQuery(ref,args);
          return getFunctionName(ref)==="retainedEvidence:measurements" && localStorage.getItem("${loadingKey}")==="true" ? undefined : result;
        }
        const fixtureClient = fixtureConvex();
        const client = {async query(ref,args) {
          if (getFunctionName(ref)==="onboarding:previewPublication") {
            const attempts = JSON.parse(localStorage.getItem("${attemptsKey}")??"[]");
            localStorage.setItem("${attemptsKey}",JSON.stringify([...attempts,args]));
            const state = JSON.parse(localStorage.getItem("${stateKey}"));
            // Match the server's reviewed-source guard so stale IDs cannot
            // silently disappear from a successful synthetic preview.
            for (const selection of args.selections) for (const id of selection.measurementEvidenceIds??[]) {
              const capture = state.measurementCaptures.find(item=>item.propId===selection.propId && item.rawEvidenceId===id);
              if (!capture?.reviewedMeasurementIds.length) throw Error("Open a current measurement review before sharing this source.");
            }
          }
          return fixtureClient.query(ref,args);
        }};
        export const useConvex=()=>client;
      ` }));
    } }],
  });
  const javascript = result.outputFiles.find(file => file.path.endsWith(".js"));
  if (!javascript) throw new Error("The measurement review fixture did not produce JavaScript.");
  const styles = result.outputFiles.find(file => file.path.endsWith(".css"))?.text ?? "";
  fixtureHtml = `<meta name="viewport" content="width=device-width, initial-scale=1"><style>${readFileSync("app/globals.css", "utf8")}\n${styles}</style><div id="root"></div><script>${javascript.text.replaceAll("</script", "<\\/script")}</script>`;
});

async function updateQuery(page: Page, update: { captures?: typeof captures; loading?: boolean }) {
  await page.evaluate(({ stateKey, loadingKey, update }) => {
    const state: typeof initialState = JSON.parse(localStorage.getItem(stateKey)!);
    if (update.captures) state.measurementCaptures = update.captures;
    if (update.loading !== undefined) localStorage.setItem(loadingKey, String(update.loading));
    const newValue = JSON.stringify(state);
    localStorage.setItem(stateKey, newValue);
    // Deliver the same reactive query update as another tab's capture/delete.
    window.dispatchEvent(new StorageEvent("storage", { key: stateKey, newValue }));
  }, { stateKey, loadingKey, update });
}

async function previewSelections(page: Page) {
  return page.evaluate(attemptsKey => {
    const attempts: { selections: { measurementEvidenceIds: string[] }[] }[] = JSON.parse(localStorage.getItem(attemptsKey) ?? "[]");
    return attempts.map(attempt => attempt.selections.flatMap(selection => selection.measurementEvidenceIds));
  }, attemptsKey);
}

for (const width of [1280, 390]) for (const change of ["invalidate", "delete"]) test(`sharing recovers after reactive ${change} through zero reviewed sources at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript(({ stateKey, initialState }) => localStorage.setItem(stateKey, JSON.stringify(initialState)), { stateKey, initialState });
  await page.route("**/*", route => route.request().url().startsWith("http://127.0.0.1:8883/")
    ? route.fulfill({ contentType: "text/html", body: fixtureHtml }) : route.abort());
  await page.goto("http://127.0.0.1:8883/app/collection");
  const review = page.getByRole("group", { name: "Fixture Tool review", exact: true });
  const choices = review.getByRole("group", { name: "Reviewed usage measurements", exact: true });
  const first = choices.getByRole("checkbox", { name: /private-first$/ });
  const second = choices.getByRole("checkbox", { name: /private-second$/ });
  const previewButton = page.getByRole("button", { name: "Preview sharing", exact: true });
  const preview = page.getByRole("region", { name: "Your visitor’s view", exact: true });
  await review.getByLabel("Share this saved card", { exact: true }).check();
  await first.check();
  await second.check();
  await previewButton.click();
  await expect(preview).toBeVisible();
  await expect(preview.getByText("17", { exact: true }).first()).toBeVisible();
  expect(await previewSelections(page)).toEqual([["evidence-first", "evidence-second"]]);
  await preview.getByRole("checkbox").check();
  await expect(preview.getByRole("button", { name: "Publish this preview", exact: true })).toBeEnabled();

  await updateQuery(page, { loading: true });
  await expect(choices).toHaveCount(0);
  await updateQuery(page, { loading: false });
  await expect(first).toBeChecked();
  await expect(second).toBeChecked();

  const remaining = change === "delete" ? [captures[1]] : captures.map((capture, index) => index === 0 ? { ...capture, reviewedMeasurementIds: [], reviewVersion: 2 } : capture);
  await updateQuery(page, { captures: remaining });
  await expect(first).toHaveCount(0);
  await expect(second).toBeChecked();
  await expect(preview.getByRole("status")).toContainText("Preview again before publishing");
  await expect(preview.getByRole("button", { name: "Publish this preview", exact: true })).toBeDisabled();
  expect(await previewSelections(page)).toHaveLength(1);
  await previewButton.click();
  await expect(preview.getByRole("status")).toHaveCount(0);
  await expect(preview.getByText("18", { exact: true }).first()).toBeVisible();
  expect(await previewSelections(page)).toEqual([["evidence-first", "evidence-second"], ["evidence-second"]]);

  await updateQuery(page, { captures: change === "delete" ? [] : remaining.map(capture => ({ ...capture, reviewedMeasurementIds: [], reviewVersion: 3 })) });
  await expect(choices).toHaveCount(0);
  await expect(preview.getByRole("status")).toContainText("Preview again before publishing");
  await previewButton.click();
  await expect(preview.getByRole("status")).toHaveCount(0);
  expect(await previewSelections(page)).toEqual([["evidence-first", "evidence-second"], ["evidence-second"], []]);
  await expect(preview.locator(".product-card")).toContainText("Fixture Tool");
  await expect(preview.getByRole("region", { name: "Reported usage measurements", exact: true })).toHaveCount(0);

  await updateQuery(page, { captures });
  await expect(first).not.toBeChecked();
  await expect(second).not.toBeChecked();
  await first.check();
  await previewButton.click();
  await expect(preview.getByRole("status")).toHaveCount(0);
  expect(await previewSelections(page)).toEqual([["evidence-first", "evidence-second"], ["evidence-second"], [], ["evidence-first"]]);
  await expect(preview.getByText("17", { exact: true }).first()).toBeVisible();
  await expect(preview.getByRole("checkbox")).not.toBeChecked();
  await expect(preview.getByRole("button", { name: "Publish this preview", exact: true })).toBeDisabled();
  const calls = await page.evaluate(stateKey => {
    const calls: { name: string }[] = JSON.parse(localStorage.getItem(`${stateKey}-calls`) ?? "[]");
    return calls.map(call => call.name);
  }, stateKey);
  expect(calls.filter(name => name === "publishSelected")).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await review.screenshot({ path: testInfo.outputPath(`measurement-review-${change}-${width}.png`) });
});
