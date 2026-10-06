import { expect, test } from "vitest";
import { parseMeasurementImport, projectMeasurement, reviewMeasurementImports } from "./measurements";
import { publicProfileSchema, projectPublicProfile } from "./public-profile";
import { projectVisiblePublicProfile } from "./visible-public-profile";

const raw = JSON.stringify({ format: "proper-measurements-v1", captureId: "private-capture", capturedAt: "2026-10-01T00:00:00.000Z", source: { namespace: "private-namespace", identityBasis: "OWNER_SUPPLIED", sourceAlias: "private-source", ownerAlias: "private-owner", accountAlias: "private-account", workspaceAlias: "private-workspace", deviceAlias: "private-device" }, measurements: [{ id: "private-row", metric: "app_duration", value: "0.000000001", unit: "seconds", period: { kind: "instant", startUnixNano: "1000000000000000001", endUnixNano: "1000000000000000002" }, scope: "DEVICE", coverage: "PARTIAL", temporality: "DELTA", aggregation: "NON_ADDITIVE", overlapGroup: "private-overlap" }] });

test("published and machine-visible profiles retain exact semantics without original/private AI data", () => {
  const measurement = projectMeasurement(reviewMeasurementImports([parseMeasurementImport(raw)])[0]);
  const profile = projectPublicProfile({ user: { handle: "person", displayName: "Person", bio: "" }, props: [{ visibility: "PUBLIC", status: "ACTIVE", headline: "", note: "", links: [], product: { name: "Uncatalogued", slug: "uncatalogued", domain: "", description: "" }, measurements: [measurement] }] });
  const enriched = { ...profile, cards: profile.cards.map(card => ({ ...card, privateUsage: { original: raw }, rawEvidence: raw, accountAlias: "private-account" })) };
  const parsed = publicProfileSchema.parse(enriched);
  const visible = projectVisiblePublicProfile(parsed);
  expect(visible.cards[0].measurements?.[0]).toMatchObject({ value: "0.000000001", scope: "DEVICE", coverage: "PARTIAL", period: { startUnixNano: "1000000000000000001", endUnixNano: "1000000000000000002" }, identityBasis: "OWNER_SUPPLIED", sample: "unknown", activityActor: "UNKNOWN" });
  expect(JSON.stringify(parsed)).not.toContain("private-");
  expect(JSON.stringify(visible)).not.toContain("private-");
  expect(visible.cards[0]).not.toHaveProperty("privateUsage");
});
