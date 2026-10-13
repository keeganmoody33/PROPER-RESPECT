import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { expect, test } from "vitest";
import { ProductCard } from "@/components/product-card";
import { parseMeasurementImport, projectMeasurement, projectPublishedMeasurements, reviewMeasurementImports } from "./measurements";
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

const retainedPacket = JSON.stringify({
  format: "proper-measurements-v1",
  captureId: "retained-capture",
  capturedAt: "2026-10-13T00:00:00.000Z",
  source: { namespace: "retained", identityBasis: "OWNER_SUPPLIED", sourceAlias: "retained-source", ownerAlias: null, accountAlias: null, workspaceAlias: null, deviceAlias: null },
  measurements: [
    { id: "exact", metric: "input_tokens", value: "9007199254740993123456789", unit: "tokens", period: { kind: "unknown" }, scope: "ACCOUNT", coverage: "PARTIAL", temporality: "SNAPSHOT", aggregation: "NON_ADDITIVE", overlapGroup: "private-overlap" },
    { id: "unknown", metric: "output_tokens", value: null, unit: "tokens", period: { kind: "unknown" }, scope: "ACCOUNT", coverage: "UNKNOWN", temporality: "SNAPSHOT", aggregation: "NON_ADDITIVE", overlapGroup: null },
    { id: "zero", metric: "cache_read_tokens", value: "0", unit: "tokens", period: { kind: "unknown" }, scope: "ACCOUNT", coverage: "COMPLETE", temporality: "SNAPSHOT", aggregation: "NON_ADDITIVE", overlapGroup: null },
    { id: "withheld", metric: "cache_creation_tokens", value: "424242424242424242", unit: "tokens", period: { kind: "unknown" }, scope: "ACCOUNT", coverage: "PARTIAL", temporality: "SNAPSHOT", aggregation: "NON_ADDITIVE", overlapGroup: "private-withheld" },
  ],
});

test("a published card shows a retained measurement only when that product is public", () => {
  const retained = reviewMeasurementImports([parseMeasurementImport(retainedPacket)]);
  const exact = retained.find(row => row.metric === "input_tokens")!;
  const unknown = retained.find(row => row.metric === "output_tokens")!;
  const zero = retained.find(row => row.metric === "cache_read_tokens")!;
  const withheld = retained.find(row => row.metric === "cache_creation_tokens")!;
  const publishedIds = [exact.id, unknown.id, zero.id];
  const shown = projectPublishedMeasurements("PUBLIC", retained, publishedIds);
  expect(shown?.map(row => row.value)).toEqual(["9007199254740993123456789", null, "0"]);
  expect(shown?.every(row => row.value === null || typeof row.value === "string")).toBe(true);
  expect(projectPublishedMeasurements("PRIVATE", retained, publishedIds)).toBeUndefined();
  expect(projectPublishedMeasurements("DRAFT", retained, [...publishedIds, withheld.id])).toBeUndefined();
  expect(() => projectPublishedMeasurements("PUBLIC", retained, ["not-retained"])).toThrow();

  const product = { name: "Uncatalogued", slug: "uncatalogued", domain: "", description: "" };
  const profile = projectPublicProfile({
    user: { handle: "person", displayName: "Person", bio: "" },
    props: [
      { visibility: "PUBLIC", status: "ACTIVE", headline: "Shown", note: "", links: [], product, retainedMeasurements: retained, publishedMeasurementIds: publishedIds },
      { visibility: "PRIVATE", status: "ACTIVE", headline: "Hidden", note: "", links: [], product: { ...product, name: "Private tool", slug: "private-tool" }, retainedMeasurements: retained, publishedMeasurementIds: [withheld.id] },
    ],
  });
  expect(profile.cards).toHaveLength(1);
  expect(profile.cards[0].measurements?.map(row => row.value)).toEqual(["9007199254740993123456789", null, "0"]);
  expect(JSON.stringify(profile)).not.toContain("424242424242424242");
  expect(JSON.stringify(profile)).not.toContain("private-withheld");
  const visible = projectVisiblePublicProfile(profile);
  expect(visible.cards[0].measurements?.map(row => row.value)).toEqual(["9007199254740993123456789", null, "0"]);
  const html = renderToStaticMarkup(createElement(ProductCard, { card: profile.cards[0], index: 0 }));
  const values = load(html)(".usage-measurement-value").toArray().map(node => load(node).text());
  expect(values).toContain("9007199254740993123456789");
  expect(values).toContain("Unknown");
  expect(values).toContain("0");
  expect(values).not.toContain("424242424242424242");
  expect(html).not.toContain("private-withheld");

  const unpublished = projectPublicProfile({
    user: { handle: "person", displayName: "Person", bio: "" },
    props: [{ visibility: "PUBLIC", status: "ACTIVE", headline: "", note: "", links: [], product, retainedMeasurements: retained, publishedMeasurementIds: [] }],
  });
  expect(unpublished.cards[0].measurements).toBeUndefined();
  const unpublishedHtml = renderToStaticMarkup(createElement(ProductCard, { card: unpublished.cards[0], index: 0 }));
  expect(unpublishedHtml).not.toContain("9007199254740993123456789");
  expect(unpublishedHtml).not.toContain("424242424242424242");
});
