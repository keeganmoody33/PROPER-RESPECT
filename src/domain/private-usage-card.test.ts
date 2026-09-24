import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildUsageCostReport, SYNTHETIC_SCENARIO } from "./usage-cost-report.ts";
import { privateUsageCardSchema, projectPrivateUsage } from "./private-usage-card.ts";
const text = (name: string) => readFileSync(`tests/fixtures/usage-cost/${name}.json`, "utf8");
const fixture = () => JSON.parse(text("priced-synthetic"));
const scenario = { syntheticScenario: SYNTHETIC_SCENARIO } as const;

describe("private usage card projection", () => {
  it("retains exact huge counts, tiny costs, zero and unknown separately", () => {
    const input = fixture();
    input.bundles[0].counts = { input: "999999999999999999999999999999", output: "0", cacheRead: null, cacheCreation: "0" };
    input.bundles[0].sourceCostUsd = "0.000000000001";
    const card = projectPrivateUsage(buildUsageCostReport([JSON.stringify(input)])).tools[0];
    expect(card.rows[0].counts.map(x => x.value)).toEqual(["999999999999999999999999999999", "0", null, "0"]);
    expect(card.rows[0].sourceEstimateUsd).toBe("0.000000000001");
    expect(card.rows[0].billed).toBe("unknown");
    expect(card.rows[0].apiEquivalent.kind).toBe("unpriced");
    expect(card.observations[0].counts).toEqual(card.rows[0].counts);
    expect(card.rows[0].period).toEqual({ start: input.bundles[0].start, end: input.bundles[0].end, timezone: "UTC" });
  });
  it("preserves source temporality without calling cumulative observations increments", () => {
    const delta = projectPrivateUsage(buildUsageCostReport([text("priced-synthetic")])).tools[0];
    const cumulative = projectPrivateUsage(buildUsageCostReport([text("cumulative-reset")])).tools[0];
    expect(delta.observations.every(value => value.temporality === "delta")).toBe(true);
    expect(cumulative.observations.every(value => value.temporality === "cumulative")).toBe(true);
    expect(cumulative.observations.every(value => value.status === "source-observation")).toBe(true);
  });
  it("rejects missing or extra valuations instead of mismatching rows", () => {
    const missing = buildUsageCostReport([text("priced-synthetic")]);
    missing.valuations = [];
    expect(() => projectPrivateUsage(missing)).toThrow("Usage valuation count does not match reconciled rows.");
    const extra = buildUsageCostReport([text("priced-synthetic")]);
    extra.valuations.push(extra.valuations[0]);
    expect(() => projectPrivateUsage(extra)).toThrow("Usage valuation count does not match reconciled rows.");
  });
  it("keeps optional synthetic valuation distinct from source estimates", () => {
    const normal = projectPrivateUsage(buildUsageCostReport([text("priced-synthetic")])).tools[0].rows[0];
    const priced = projectPrivateUsage(buildUsageCostReport([text("priced-synthetic")], scenario)).tools[0].rows[0];
    expect(normal.apiEquivalent.kind).toBe("unpriced");
    expect(priced.apiEquivalent).toMatchObject({ kind: "synthetic-api-equivalent", exactUsd: "0.002010000000" });
    expect(priced.sourceEstimateUsd).toBe("0.009123456789");
    expect(priced.sample).toBe("synthetic");
    const owner = fixture(); owner.sample = "owner-supplied";
    expect(projectPrivateUsage(buildUsageCostReport([JSON.stringify(owner)], scenario)).tools[0].rows[0]).toMatchObject({ sample: "owner-supplied-unverified", apiEquivalent: { kind: "unpriced" } });
  });
  it("preserves reset baseline and gaps without combining coverage", () => {
    const report = buildUsageCostReport([text("cumulative-reset"), text("cumulative-reset")], scenario);
    const preview = projectPrivateUsage(report), card = preview.tools[0];
    expect(preview.replays).toBe(report.replays);
    expect(card.rows.map(x => x.status)).toEqual(report.claude!.rows.map(x => x.status));
    expect(card.rows.map(x => x.counts[0].value)).toEqual(report.claude!.rows.map(x => x.counts.input));
    expect(card.rows.flatMap(x => x.reasons).join(" ")).toContain("baseline");
    expect(card.rows.flatMap(x => x.reasons).join(" ")).toContain("gap");
    expect(card.observations).toHaveLength(report.claude!.observations.length);
  });
  it("keeps quarantined conflicts and replay metadata without identities", () => {
    const report = buildUsageCostReport([text("overlap")], scenario);
    const preview = projectPrivateUsage(report);
    expect(preview.hasConflicts).toBe(true);
    expect(preview.tools[0].rows.every(x => x.status === "conflict" && x.apiEquivalent.kind === "unpriced")).toBe(true);
  });
  it("strips private fields and unsafe diagnostics and rejects extras", () => {
    const f = fixture();
    for (const key of ["ownerAlias", "accountAlias", "deviceAlias", "namespace", "captureId"]) f[key] = "PRIVATE_SENTINEL";
    f.bundles[0].sessionAlias = "PRIVATE_SENTINEL";
    f.bundles[0].processAlias = "PRIVATE_SENTINEL";
    const report = buildUsageCostReport([JSON.stringify(f)]);
    report.claude!.rows[0].reasons.push("PRIVATE_SENTINEL");
    const preview = projectPrivateUsage(report);
    const serialized = JSON.stringify(preview);
    expect(serialized).not.toContain("PRIVATE_SENTINEL");
    for (const key of ["evidenceDigest", "streamDigest", "captureProvenance", "ownerAlias", "accountAlias"]) expect(serialized).not.toContain(key);
    expect(privateUsageCardSchema.safeParse({ ...preview.tools[0], secret: "PRIVATE_SENTINEL" }).success).toBe(false);
    expect(privateUsageCardSchema.safeParse({ ...preview.tools[0], rows: [{ ...preview.tools[0].rows[0], counts: [{ label: "Input", value: 1000 }] }] }).success).toBe(false);
  });
  it("represents Codex snapshots and conflicts without pricing or total", () => {
    const source = JSON.parse(text("codex-account-synthetic"));
    const report = buildUsageCostReport([JSON.stringify(source)]);
    const card = projectPrivateUsage(report).tools[0];
    expect(card.productSlug).toBe("codex");
    expect(card.rows[0]).toMatchObject({ sample: "origin-unverified", status: "account-snapshot", period: null, apiEquivalent: { kind: "unpriced" }, billed: "unknown" });
    expect(card.rows[0].counts[0].value).toBe(String(source.response.summary.lifetimeTokens));
    source.response.summary.lifetimeTokens++;
    const conflicts = projectPrivateUsage(buildUsageCostReport([text("codex-account-synthetic"), JSON.stringify(source)])).tools[0];
    expect(conflicts.rows).toHaveLength(1);
    expect(conflicts.rows[0]).toMatchObject({ status: "conflict", counts: [], sourceEstimateUsd: null });
  });
});
