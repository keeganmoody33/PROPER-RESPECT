import { fileURLToPath } from "node:url";
import { startLoopbackServer } from "../../src/transport";
import { projectVisiblePublicProfile } from "@/src/domain/visible-public-profile";
import { e2eReferenceProfile } from "@/src/data/e2e-reference-profile";
import { parseProfileReference, projectPresentation } from "../../src/public-reader";
import { visiblePublicProfileSchema, type PublicProfileResult, type PublicReadError } from "../../src/contracts";

const origin = new URL(process.env.PUBLIC_SITE_ORIGIN!);
const counts = new Map<string, number>();
const readProfile = async (reference: string): Promise<PublicProfileResult | PublicReadError> => {
  let handle: string;
  try { handle = parseProfileReference(reference, origin); }
  catch { return { kind: "error", code: "INVALID_REFERENCE", message: "Invalid synthetic profile reference.", retryable: false }; }
  const count = (counts.get(handle) ?? 0) + 1;
  counts.set(handle, count);
  if (handle === "unavailable" || (handle === "refresh-error" && count > 1)) {
    return { kind: "error", code: "UNAVAILABLE", message: "This public profile is unavailable.", retryable: false };
  }
  if (handle === "slow" && count > 1) await new Promise(resolve => setTimeout(resolve, 900));
  const profile = visiblePublicProfileSchema.parse(projectVisiblePublicProfile(e2eReferenceProfile));
  profile.handle = handle;
  profile.displayName = handle === "hostile" ? '<img src=x onerror="window.injected=true"> Literal owner text' : "Synthetic public profile";
  profile.bio = "Synthetic local fixture. Not evidence of a person's actual activity.";
  if (handle === "changing") profile.bio = "Synthetic snapshot " + count;
  if (handle === "empty") { profile.cards = []; profile.emptyNote = "No published products yet. Draft and private records stay off this page."; }
  if (handle === "variants") {
    const base = profile.cards[0];
    const meta = { attributionScope: "PERSONAL" as const, capturedOn: "2026-09-22", freshness: "STALE" as const, provenanceLabel: "Synthetic source", note: "Measurement period not supplied" };
    profile.cards = [
      ...profile.cards,
      { ...base, product: { name: "Series fixture", description: "Synthetic time series" }, activity: { ...meta, kind: "timeSeries", label: "Words", unit: "words", points: [{ date: "2026-09-21", value: 17 }] } },
      { ...base, product: { name: "Artifact fixture", description: "Synthetic artifacts" }, activity: { ...meta, kind: "artifactCollection", total: { label: "artifacts", displayValue: "1" }, artifacts: [{ title: "<b>Literal artifact</b>", url: "https://example.com/artifact" }] } },
      { ...base, product: { name: "Review fixture", description: "Synthetic reviews" }, activity: { ...meta, kind: "reviewActivity", reviews: { label: "reviews", displayValue: "3" }, bugsCaught: { label: "bugs caught", displayValue: "2" }, severity: [{ label: "high", count: 2 }] } },
      { ...base, product: { name: "Coding fixture", description: "Synthetic coding" }, activity: { ...meta, kind: "codingActivity", primary: { label: "tokens", displayValue: "4.2K", unit: "tokens" }, supporting: [{ label: "sessions", displayValue: "3" }], days: [{ date: "2026-09-21", count: 2 }] } },
    ];
  }
  return { kind: "profile", dataMode: "synthetic", sourceUrl: new URL(`/${handle}`, origin).href, retrievedAt: new Date().toISOString(), profile, presentation: projectPresentation(e2eReferenceProfile).filter(item => item.cardIndex < profile.cards.length) };
};
const http = await startLoopbackServer({ readProfile, widgetPath: fileURLToPath(new URL("./widget.html", import.meta.url)) });
await import("../../host/server");
process.once("SIGTERM", () => { http.closeAllConnections(); http.close(); });
process.once("SIGINT", () => { http.closeAllConnections(); http.close(); });
console.log("Synthetic browser fixture MCP started; no provider or account reads.");
