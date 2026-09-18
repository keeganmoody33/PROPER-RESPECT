import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  RETAINED_PRODUCT_ADAPTER_VERSION,
  parseRetainedProductEvidence,
  prepareGitHubActivity,
  prepareWisprInsights,
  prepareWisprOwnerReview,
  verifyRetainedProductEvidence,
  type RetainedProductArtifact,
} from "./retained-product-evidence";

// Synthetic originals only. No personal source values belong in fixtures.
const insights = `Wispr Flow > Insights > Your usage
120
WORDS PER MINUTE
40
FIXES MADE BY FLOW
30 words corrected
10 dictionary fixes
1,200
TOTAL WORDS DICTATED
Desktop Mobile
Desktop usage
TOTAL APPS USED | 6
50 % 600 AI PROMPTS
20 % 240 OTHER TASKS
10 % 120 WORK MESSAGES
10 % 120 PERSONAL MESSAGES
5 % 60 DOCUMENTS
5 % 60 EMAILS
3 day streak
LONGEST STREAK | 7 DAYS
`;
const review = JSON.stringify({
  recordedAt: "2025-01-02T14:15:16.000Z",
  source: "Synthetic owner conversation",
  question: "What do you use this product for?",
  answer: "I dictate synthetic test notes.",
  interpretation: { purpose: "Synthetic purpose", valueJudgment: "Synthetic interpretation" },
  costControlRequest: "Synthetic private cost request",
  costPublicationDecision: "Not a publication decision",
});
const github = JSON.stringify({ data: { viewer: {
  login: "synthetic-account",
  createdAt: "2020-01-02T03:04:05Z",
  contributionsCollection: { contributionCalendar: {
    totalContributions: 99,
    weeks: [{ contributionDays: [
      { date: "2024-12-31", contributionCount: 0, contributionLevel: "NONE" },
      { date: "2025-01-01", contributionCount: 2, contributionLevel: "FIRST_QUARTILE" },
      { date: "2025-01-02", contributionCount: 5, contributionLevel: "FOURTH_QUARTILE" },
    ] }],
  } },
} } });

function artifact(payload: string, kind: RetainedProductArtifact["kind"]): RetainedProductArtifact {
  return {
    kind,
    sourceFile: `${kind.toLowerCase()}.txt`,
    sha256: createHash("sha256").update(payload).digest("hex"),
    byteLength: Buffer.byteLength(payload),
    sourceCapturedDate: "2025-01-02",
    sourceCaptureBasis: "RETAINED_SOURCE_DATE",
    preparedAt: "2025-01-05T10:11:12.000Z",
    adapterVersion: RETAINED_PRODUCT_ADAPTER_VERSION,
  };
}
const wisprInput = () => ({ payload: insights, artifact: artifact(insights, "WISPR_INSIGHTS") });
const githubInput = (payload = github) => ({ payload, artifact: artifact(payload, "GITHUB_ACTIVITY") });

describe("retained product evidence", () => {
  it("keeps Wispr capture date, preparation, unknown window and activity actor distinct", async () => {
    const packet = prepareWisprInsights(wisprInput());
    expect(packet.productSlug).toBe("wisprflow");
    expect(packet.sourceType).toBe("WISPR_FLOW");
    expect(packet.signal.capturedAt).toBe(packet.artifact.preparedAt);
    expect(packet.artifact.sourceCapturedDate).toBe("2025-01-02");
    expect(packet.signal.captureProvenance).toMatchObject({
      route: "UPLOAD", collector: { kind: "AGENT" }, activityActor: { kind: "UNKNOWN" },
    });
    expect(packet.signal.observations?.length).toBe(20);
    for (const observation of packet.signal.observations ?? []) {
      expect(insights).toContain(observation.excerpt);
      expect(observation).toMatchObject({ kind: "USAGE", acquisition: "ASSISTANT_EXTRACTED" });
      expect(observation).not.toHaveProperty("date");
      expect(observation).not.toHaveProperty("periodStart");
      expect(observation).not.toHaveProperty("periodEnd");
    }
    expect(packet.activity).toMatchObject({
      kind: "headlineMetrics", freshness: "STALE",
      primary: { label: "Words dictated", value: 1200, unit: "words" },
    });
    expect(packet.activity).not.toHaveProperty("period");
    expect(packet.limitations.join(" ")).toContain("not a verified inventory");
    expect(await verifyRetainedProductEvidence(packet)).toEqual(packet);
  });

  it("preserves source byte identity including CRLF excerpts", () => {
    const payload = insights.replaceAll("\n", "\r\n");
    const packet = prepareWisprInsights({ payload, artifact: artifact(payload, "WISPR_INSIGHTS") });
    expect(packet.signal.payload).toBe(payload);
    expect(packet.signal.observations?.find(item => item.kind === "USAGE" && item.metric === "Words dictated")?.excerpt).toBe("1,200\r\nTOTAL WORDS DICTATED");
    expect(packet.sourceKey).not.toBe(prepareWisprInsights(wisprInput()).sourceKey);
  });

  it("retains owner testimony separately from extracted usage and interpretations", () => {
    const packet = prepareWisprOwnerReview({ payload: review, artifact: artifact(review, "WISPR_OWNER_REVIEW") });
    expect(packet.sourceType).toBe("MANUAL");
    expect(packet.signal.captureProvenance?.route).toBe("OWNER_TESTIMONY");
    expect(packet.signal.observations).toEqual([]);
    expect(packet.signal.payload).toBe(review);
    expect(packet.activity).toBeUndefined();
    expect(packet.limitations.join(" ")).toContain("interpretation");
  });

  it("retains the reported GitHub total and returned calendar without fabricating request range or first use", () => {
    const packet = prepareGitHubActivity(githubInput());
    expect(packet.signal.observations).toEqual([
      expect.objectContaining({ kind: "SIGNUP", date: "2020-01-02", excerpt: '"createdAt":"2020-01-02T03:04:05Z"' }),
      expect.objectContaining({ kind: "USAGE", value: 99, metric: "Reported contributions", excerpt: '"totalContributions":99' }),
    ]);
    expect(packet.signal.observations?.some(item => item.kind === "FIRST_USE")).toBe(false);
    expect(packet.signal.observations?.[1]).not.toHaveProperty("periodStart");
    expect(packet.activity).toMatchObject({
      kind: "contributionCalendar", total: 99, memberSince: "2020-01-02",
      days: [
        { date: "2024-12-31", count: 0, level: 0 },
        { date: "2025-01-01", count: 2, level: 1 },
        { date: "2025-01-02", count: 5, level: 4 },
      ],
    });
    expect(packet.activity).not.toHaveProperty("period");
    expect(packet.limitations.join(" ")).toContain("requested from/to");
    expect(packet.limitations.join(" ")).toContain("does not equal");
    for (const observation of packet.signal.observations ?? []) expect(github).toContain(observation.excerpt);
  });

  it("extracts exact GitHub excerpts when original JSON uses whitespace", () => {
    const payload = JSON.stringify(JSON.parse(github), null, 2);
    const packet = prepareGitHubActivity(githubInput(payload));
    for (const observation of packet.signal.observations ?? []) expect(payload).toContain(observation.excerpt);
    expect(packet.signal.observations?.[0].excerpt).toBe('"createdAt": "2020-01-02T03:04:05Z"');
  });

  it("does not let native sources become owner assertions or live provider captures", () => {
    const packet = prepareWisprInsights(wisprInput());
    for (const alter of [
      (copy: typeof packet) => { copy.signal.observations![0].acquisition = "USER_SUPPLIED"; },
      (copy: typeof packet) => { copy.signal.captureProvenance!.route = "DIRECT_API"; },
      (copy: typeof packet) => { copy.signal.captureProvenance!.activityActor.kind = "HUMAN"; },
      (copy: typeof packet) => { copy.sourceType = "GITHUB"; },
      (copy: typeof packet) => { copy.signal.capturedAt = "2025-01-02T00:00:00.000Z"; },
      (copy: typeof packet) => { copy.sourceKey += "-different"; },
    ]) {
      const copy = structuredClone(packet); alter(copy);
      expect(() => parseRetainedProductEvidence(copy)).toThrow();
    }
  });

  it("rejects invented normalized values, excerpts, periods and preview metrics", () => {
    const packet = prepareWisprInsights(wisprInput());
    for (const changes of [{ value: 987 }, { excerpt: "not in original" }, { periodStart: "2025-01-01" }]) {
      const copy = structuredClone(packet);
      Object.assign(copy.signal.observations![0], changes);
      expect(() => parseRetainedProductEvidence(copy)).toThrow();
    }
    const copy = structuredClone(packet);
    if (copy.activity?.kind === "headlineMetrics") copy.activity.primary.value = 987;
    expect(() => parseRetainedProductEvidence(copy)).toThrow();
    const withoutPreview = structuredClone(packet); delete withoutPreview.activity;
    expect(parseRetainedProductEvidence(withoutPreview).activity).toBeUndefined();
  });

  it("rejects a changed source even when a digest-shaped value and matching source key are supplied", async () => {
    const packet = prepareWisprInsights({ ...wisprInput(), artifact: { ...wisprInput().artifact, sha256: "0".repeat(64) } });
    await expect(verifyRetainedProductEvidence(packet)).rejects.toThrow("hash mismatch");
  });

  it.each([
    insights.replace("1,200", "1,,200"),
    insights.replace("1,200", "-1"),
    insights.replace("50 %", "150 %"),
    insights.replace("1,200", "1.2"),
    insights + "1,200\nTOTAL WORDS DICTATED\n",
  ])("fails closed on ambiguous or malformed native numbers", payload => {
    expect(() => prepareWisprInsights({ payload, artifact: artifact(payload, "WISPR_INSIGHTS") })).toThrow();
  });

  it("rejects unknown levels, duplicate dates, oversized originals, and inaccurate byte lengths", () => {
    for (const payload of [
      github.replace("FIRST_QUARTILE", "UNRECOGNIZED"),
      github.replace("2025-01-01", "2024-12-31"),
      github.replace('"contributionCount":2', '"contributionCount":-2'),
      `${" ".repeat(64_001)}${github}`,
    ]) expect(() => prepareGitHubActivity(githubInput(payload))).toThrow();
    expect(() => prepareWisprInsights({ ...wisprInput(), artifact: { ...wisprInput().artifact, byteLength: 1 } })).toThrow();
  });
});
