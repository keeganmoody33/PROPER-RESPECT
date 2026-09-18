import { z } from "zod";
import { rawSignalSchema, type RawSignal } from "./discovery.ts";
import { evidenceObservationSchema, type EvidenceObservation } from "./evidence-claims.ts";
import type { ActivityModule } from "./public-profile.ts";
import { canonicalJson } from "./canonical-json.ts";

export const RETAINED_PRODUCT_ADAPTER_VERSION = "retained-product-v1-2026-09-18";
export const MAX_RETAINED_SOURCE_BYTES = 64_000;
const MAX_CALENDAR_DAYS = 400;
const payloadSchema = z.string().min(1).refine(
  value => value.trim().length > 0 && new TextEncoder().encode(value).length <= MAX_RETAINED_SOURCE_BYTES,
  "Retained source must contain at most 64,000 UTF-8 bytes.",
);

export const retainedProductArtifactSchema = z.strictObject({
  kind: z.enum(["WISPR_INSIGHTS", "WISPR_OWNER_REVIEW", "GITHUB_ACTIVITY"]),
  sourceFile: z.string().min(1).max(255).refine(value => !/[\\/\u0000-\u001f]/.test(value) && value !== "." && value !== ".."),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  byteLength: z.number().int().positive().max(MAX_RETAINED_SOURCE_BYTES),
  sourceCapturedDate: z.iso.date(),
  sourceCaptureBasis: z.literal("RETAINED_SOURCE_DATE"),
  preparedAt: z.iso.datetime(),
  adapterVersion: z.literal(RETAINED_PRODUCT_ADAPTER_VERSION),
}).refine(value => value.sourceCapturedDate <= value.preparedAt.slice(0, 10), "Source capture cannot follow preparation.");
export type RetainedProductArtifact = z.infer<typeof retainedProductArtifactSchema>;
export type RetainedProductInput = { payload: string; artifact: RetainedProductArtifact };

// Only these existing ActivityModule variants are emitted. Keeping this bounded
// validator here also allows the file-only Node runner to load this module.
const previewCommon = {
  attributionScope: z.literal("PERSONAL"),
  capturedAt: z.iso.datetime(),
  freshness: z.literal("STALE"),
  provenanceLabel: z.string().min(1).max(1000),
};
const previewMetric = z.strictObject({ label: z.string().min(1).max(120), value: z.number().finite().nonnegative(), unit: z.string().max(80) });
const retainedActivitySchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("headlineMetrics"), ...previewCommon, primary: previewMetric, supporting: z.array(previewMetric).max(4) }),
  z.strictObject({
    kind: z.literal("contributionCalendar"), ...previewCommon,
    total: z.number().int().nonnegative(), memberSince: z.iso.date(),
    days: z.array(z.strictObject({ date: z.iso.date(), count: z.number().int().nonnegative(), level: z.number().int().min(0).max(4) })).max(MAX_CALENDAR_DAYS),
  }),
]);
const packetShape = z.strictObject({
  productSlug: z.enum(["wisprflow", "github"]),
  sourceType: z.enum(["WISPR_FLOW", "GITHUB", "MANUAL"]),
  sourceKey: z.string().min(1).max(512),
  sourceLabel: z.string().min(1).max(512),
  signal: rawSignalSchema.strict().extend({ payload: payloadSchema, observations: z.array(evidenceObservationSchema).max(24) }),
  activity: retainedActivitySchema.optional(),
  limitations: z.array(z.string().min(1).max(1000)).min(1).max(24),
  artifact: retainedProductArtifactSchema,
});
export type RetainedProductEvidencePacket = z.infer<typeof packetShape>;

const commonLimitations = [
  "Retained source only; preparation did not refresh a provider or establish current usage.",
  "capturedAt is preparation time. The original source date and any source-recorded timestamp remain separate; no original capture instant is invented.",
  "The original activity actor is UNKNOWN; collection by an assistant does not attribute the activity to a human or an agent.",
  "Private observations and original payload are authoritative. The activity module is an optional presentation preview, not owner approval or publication.",
];

function basePacket(input: RetainedProductInput, kind: RetainedProductArtifact["kind"]) {
  const artifact = retainedProductArtifactSchema.parse(input.artifact);
  const payload = payloadSchema.parse(input.payload);
  if (artifact.kind !== kind || artifact.byteLength !== new TextEncoder().encode(payload).length) {
    throw new Error("Retained artifact kind or byte length mismatch.");
  }
  const sourceKey = `retained:${kind.toLowerCase()}:sha256:${artifact.sha256}`;
  const isGitHub = kind === "GITHUB_ACTIVITY";
  const isReview = kind === "WISPR_OWNER_REVIEW";
  const sourceType: RetainedProductEvidencePacket["sourceType"] = isGitHub ? "GITHUB" : isReview ? "MANUAL" : "WISPR_FLOW";
  const signal: RawSignal & { observations: EvidenceObservation[] } = {
    sourceType,
    sourceRecordId: sourceKey,
    vendor: isGitHub ? "GitHub" : "Wispr Flow",
    url: isGitHub ? "https://github.com" : "https://wisprflow.ai",
    capturedAt: artifact.preparedAt,
    payload,
    observations: [],
    captureProvenance: {
      version: 1, route: isReview ? "OWNER_TESTIMONY" : "UPLOAD",
      adapter: { id: "retained-product-evidence", version: artifact.adapterVersion },
      origin: { issuer: isReview ? "OWNER_REVIEW_RECORD" : isGitHub ? "GITHUB" : "WISPR_FLOW", recordId: sourceKey, artifactRef: `sha256:${artifact.sha256}` },
      collector: { kind: "AGENT" }, activityActor: { kind: "UNKNOWN" },
    },
  };
  return {
    productSlug: isGitHub ? "github" as const : "wisprflow" as const,
    sourceType,
    sourceKey,
    sourceLabel: isGitHub ? "GitHub · retained GraphQL response" : isReview ? "Wispr Flow · retained owner review" : "Wispr Flow · retained Insights text",
    signal, artifact, limitations: [...commonLimitations],
  };
}

const numeric = "([0-9][0-9,]*(?:\\.[0-9]+)?)";
function nativeNumber(text: string, integer = true) {
  if (!/^(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d+)?$/.test(text)) throw new Error("Malformed retained native number.");
  const value = Number(text.replaceAll(",", ""));
  if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER || (integer && !Number.isInteger(value))) throw new Error("Invalid retained native number.");
  return value;
}
function uniqueMatch(payload: string, pattern: string): RegExpMatchArray {
  const matches = [...payload.matchAll(new RegExp(pattern, "gm"))];
  if (matches.length !== 1) throw new Error("Required retained source field is missing or ambiguous.");
  return matches[0];
}
function usage(metric: string, value: number, unit: string, excerpt: string): EvidenceObservation {
  return { kind: "USAGE", scope: "PERSONAL", acquisition: "ASSISTANT_EXTRACTED", metric, value, unit, excerpt };
}

function wisprPacket(input: RetainedProductInput): RetainedProductEvidencePacket {
  const packet = basePacket(input, "WISPR_INSIGHTS");
  if (!/^Wispr Flow > Insights > Your usage\r?$/m.test(input.payload)) throw new Error("Retained Wispr Insights heading required.");
  const specs = [
    ["Words per minute", `^${numeric}\\r?\\nWORDS PER MINUTE(?=\\r?$)`, "words per minute", false],
    ["Fixes made by Flow", `^${numeric}\\r?\\nFIXES MADE BY FLOW(?=\\r?$)`, "fixes", true],
    ["Words corrected", `^${numeric} words corrected(?=\\r?$)`, "words", true],
    ["Dictionary fixes", `^${numeric} dictionary fixes(?=\\r?$)`, "fixes", true],
    ["Words dictated", `^${numeric}\\r?\\nTOTAL WORDS DICTATED(?=\\r?$)`, "words", true],
    ["Apps used", `^TOTAL APPS USED \\| ${numeric}(?=\\r?$)`, "apps", true],
  ] as const;
  for (const [metric, pattern, unit, integer] of specs) {
    const match = uniqueMatch(input.payload, pattern);
    packet.signal.observations.push(usage(metric, nativeNumber(match[1], integer), unit, match[0]));
  }
  for (const category of ["AI PROMPTS", "OTHER TASKS", "WORK MESSAGES", "PERSONAL MESSAGES", "DOCUMENTS", "EMAILS"]) {
    const match = uniqueMatch(input.payload, `^${numeric} % ${numeric} ${category}(?=\\r?$)`);
    const share = nativeNumber(match[1], false);
    if (share > 100) throw new Error("Invalid retained category percentage.");
    packet.signal.observations.push(usage(`${category} share`, share, "percent", match[0]));
    packet.signal.observations.push(usage(`${category} category count`, nativeNumber(match[2]), "count; unit unspecified", match[0]));
  }
  for (const [metric, pattern] of [
    ["Current streak at capture", `^${numeric} day streak(?=\\r?$)`],
    ["Longest streak", `^LONGEST STREAK \\| ${numeric} DAYS(?=\\r?$)`],
  ]) {
    const match = uniqueMatch(input.payload, pattern);
    packet.signal.observations.push(usage(metric, nativeNumber(match[1]), "days", match[0]));
  }
  const previewValue = (metric: string) => {
    const observation = packet.signal.observations.find(item => item.kind === "USAGE" && item.metric === metric);
    if (!observation || observation.kind !== "USAGE") throw new Error("Retained preview source missing.");
    return { label: metric, value: observation.value, unit: observation.unit };
  };
  const activity = {
    kind: "headlineMetrics" as const, attributionScope: "PERSONAL" as const,
    capturedAt: packet.artifact.preparedAt, freshness: "STALE" as const,
    provenanceLabel: `Retained Wispr Insights from ${packet.artifact.sourceCapturedDate}; prepared ${packet.artifact.preparedAt}; measurement period unknown`,
    primary: previewValue("Words dictated"),
    supporting: ["Words per minute", "Fixes made by Flow", "Apps used", "Longest streak"].map(previewValue),
  } satisfies ActivityModule;
  packet.limitations.push(
    "The measurement start and end are absent; no capture date is used as a measurement boundary.",
    "Apps used is a native counter, not a verified inventory of products or evidence of using every app continuously.",
    "Category numbers retain the native labels; their count unit is not supplied in the retained text.",
    "Streaks are native counters at source capture and do not supply actual first-use dates or current-use status.",
  );
  return { ...packet, activity };
}

const ownerReviewSchema = z.strictObject({
  recordedAt: z.iso.datetime({ offset: true }), source: z.string().min(1).max(4000),
  question: z.string().min(1).max(4000), answer: z.string().min(1).max(8000),
  interpretation: z.strictObject({ purpose: z.string().max(4000), valueJudgment: z.string().max(4000) }),
  costControlRequest: z.string().max(4000), costPublicationDecision: z.string().max(4000),
});
function reviewPacket(input: RetainedProductInput): RetainedProductEvidencePacket {
  const packet = basePacket(input, "WISPR_OWNER_REVIEW");
  const review = ownerReviewSchema.parse(JSON.parse(input.payload));
  if (review.recordedAt.slice(0, 10) !== packet.artifact.sourceCapturedDate) throw new Error("Owner-review date does not match retained source date.");
  packet.limitations.push(
    "Only the retained answer is owner testimony; interpretation and cost-control fields remain recorded context, not extracted usage or billing evidence.",
    "The review's recordedAt timestamp remains in the original payload. Preparation is a separate event.",
    "This retained review does not approve a claim, set a relationship status, authorize a charge, or publish evidence.",
  );
  return packet;
}

const levels = ["NONE", "FIRST_QUARTILE", "SECOND_QUARTILE", "THIRD_QUARTILE", "FOURTH_QUARTILE"] as const;
const safeCount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const githubSourceSchema = z.strictObject({ data: z.strictObject({ viewer: z.strictObject({
  login: z.string().min(1).max(128), createdAt: z.iso.datetime({ offset: true }),
  contributionsCollection: z.strictObject({ contributionCalendar: z.strictObject({
    totalContributions: safeCount,
    weeks: z.array(z.strictObject({ contributionDays: z.array(z.strictObject({
      date: z.iso.date(), contributionCount: safeCount, contributionLevel: z.enum(levels),
    })).min(1).max(7) })).min(1).max(60),
  }) }),
}) }) });
function jsonFieldExcerpt(payload: string, field: string, expected: string | number) {
  const token = typeof expected === "string" ? '"(?:[^"\\\\]|\\\\.)*"' : "(?:0|[1-9]\\d*)";
  const match = uniqueMatch(payload, `"${field}"\\s*:\\s*(${token})(?=\\s*[,}])`);
  if (JSON.parse(match[1]) !== expected) throw new Error("Retained JSON excerpt does not match the extracted field.");
  return match[0];
}
function githubPacket(input: RetainedProductInput): RetainedProductEvidencePacket {
  const packet = basePacket(input, "GITHUB_ACTIVITY");
  const viewer = githubSourceSchema.parse(JSON.parse(input.payload)).data.viewer;
  const calendar = viewer.contributionsCollection.contributionCalendar;
  const sourceDays = calendar.weeks.flatMap(week => week.contributionDays);
  if (sourceDays.length > MAX_CALENDAR_DAYS || new Set(sourceDays.map(day => day.date)).size !== sourceDays.length) throw new Error("Retained calendar is oversized or has duplicate dates.");
  const days = sourceDays.map(day => ({ date: day.date, count: day.contributionCount, level: levels.indexOf(day.contributionLevel) }));
  const memberSince = viewer.createdAt.slice(0, 10);
  packet.signal.url = `https://github.com/${encodeURIComponent(viewer.login)}`;
  packet.signal.captureProvenance!.origin.accountId = viewer.login;
  packet.signal.observations.push({
    kind: "SIGNUP", scope: "PERSONAL", acquisition: "ASSISTANT_EXTRACTED", date: memberSince,
    excerpt: jsonFieldExcerpt(input.payload, "createdAt", viewer.createdAt),
  });
  packet.signal.observations.push(usage("Reported contributions", calendar.totalContributions, "contributions", jsonFieldExcerpt(input.payload, "totalContributions", calendar.totalContributions)));
  const span = days.map(day => day.date).sort();
  packet.limitations.push(
    "The original requested from/to range is not retained. Reported total measurement boundaries remain unknown.",
    `Returned calendar dates span ${span[0]} through ${span.at(-1)}; that source span does not reconstruct the requested measurement range.`,
    "Account creation is signup metadata, not first use. Contributions are not pushes, hours, human-only work, or proof of continuous use.",
  );
  if (days.reduce((sum, day) => sum + day.count, 0) !== calendar.totalContributions) packet.limitations.push("The sum of returned calendar counts does not equal the reported total; both original representations are retained without reconciliation.");
  const activity = {
    kind: "contributionCalendar" as const, attributionScope: "PERSONAL" as const,
    capturedAt: packet.artifact.preparedAt, freshness: "STALE" as const,
    provenanceLabel: `Retained GitHub response from ${packet.artifact.sourceCapturedDate}; prepared ${packet.artifact.preparedAt}; requested range unknown`,
    total: calendar.totalContributions, memberSince, days,
  } satisfies ActivityModule;
  return { ...packet, activity };
}

function buildPacket(input: RetainedProductInput) {
  if (input.artifact.kind === "WISPR_INSIGHTS") return wisprPacket(input);
  if (input.artifact.kind === "WISPR_OWNER_REVIEW") return reviewPacket(input);
  return githubPacket(input);
}

export const retainedProductEvidencePacketSchema = packetShape.superRefine((packet, context) => {
  try {
    const expected = buildPacket({ payload: packet.signal.payload, artifact: packet.artifact });
    // Omitting the optional presentation does not remove the original evidence.
    if (!packet.activity) delete expected.activity;
    if (canonicalJson(packet) !== canonicalJson(expected)) throw new Error("mismatch");
    for (const observation of packet.signal.observations) {
      if (!packet.signal.payload.includes(observation.excerpt)) throw new Error("excerpt mismatch");
    }
  } catch {
    context.addIssue({ code: "custom", message: "Retained packet does not match its original source and adapter." });
  }
});

/** Shape and deterministic extraction validation; use verify at an intake boundary. */
export function parseRetainedProductEvidence(input: unknown): RetainedProductEvidencePacket {
  return retainedProductEvidencePacketSchema.parse(input);
}
/** Verifies original bytes as well as structure before any private persistence. */
export async function verifyRetainedProductEvidence(input: unknown): Promise<RetainedProductEvidencePacket> {
  const packet = parseRetainedProductEvidence(input);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(packet.signal.payload));
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  if (hash !== packet.artifact.sha256) throw new Error("Retained source hash mismatch.");
  return packet;
}
export function prepareWisprInsights(input: RetainedProductInput): RetainedProductEvidencePacket {
  return parseRetainedProductEvidence(wisprPacket(input));
}
export function prepareWisprOwnerReview(input: RetainedProductInput): RetainedProductEvidencePacket {
  return parseRetainedProductEvidence(reviewPacket(input));
}
export function prepareGitHubActivity(input: RetainedProductInput): RetainedProductEvidencePacket {
  return parseRetainedProductEvidence(githubPacket(input));
}
