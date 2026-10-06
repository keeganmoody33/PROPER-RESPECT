import { z } from "zod";
import type { VisiblePublicProfile } from "@/src/domain/visible-public-profile";

export const MCP_PORT = 8848;
export const HOST_PORT = 8849;
export const MCP_URL = `http://127.0.0.1:${MCP_PORT}/mcp`;
export const HOST_ORIGIN = `http://127.0.0.1:${HOST_PORT}`;
export const PROFILE_RESOURCE_URI = "ui://proper-respect/public-profile/v1.html";
export const MAX_REQUEST_BYTES = 8 * 1024;
export const MAX_RESULT_BYTES = 256 * 1024;
export const READ_DEADLINE_MS = 8_000;

const metric = z.strictObject({ label: z.string(), displayValue: z.string(), unit: z.string().optional() });
const day = z.strictObject({ date: z.string(), count: z.number() });
const period = z.strictObject({ start: z.string(), end: z.string() });
const activityMeta = {
  attributionScope: z.enum(["PERSONAL", "REPOSITORY", "WORKSPACE", "ORGANIZATION"]),
  capturedOn: z.string(), freshness: z.enum(["FRESH", "STALE", "ERROR"]),
  provenanceLabel: z.string(), period: period.optional(), note: z.string().optional(),
};
const activity = z.discriminatedUnion("kind", [
  z.strictObject({ ...activityMeta, kind: z.literal("contributionCalendar"), total: metric, memberSinceYear: z.string().optional(), days: z.array(day), coverageNote: z.string().optional(), suppliedRange: z.string().optional(), emptyNote: z.string().optional() }),
  z.strictObject({ ...activityMeta, kind: z.literal("headlineMetrics"), primary: metric, supporting: z.array(metric) }),
  z.strictObject({ ...activityMeta, kind: z.literal("timeSeries"), label: z.string().optional(), unit: z.string().optional(), points: z.array(z.strictObject({ date: z.string(), value: z.number() })), emptyNote: z.string().optional() }),
  z.strictObject({ ...activityMeta, kind: z.literal("artifactCollection"), total: metric, artifacts: z.array(z.strictObject({ title: z.string(), url: z.string() })), emptyNote: z.string().optional() }),
  z.strictObject({ ...activityMeta, kind: z.literal("reviewActivity"), reviews: metric, bugsCaught: metric, severity: z.array(z.strictObject({ label: z.string(), count: z.number() })) }),
  z.strictObject({ ...activityMeta, kind: z.literal("codingActivity"), primary: metric, supporting: z.array(metric), days: z.array(day).optional() }),
]);
export const visiblePublicProfileSchema = z.strictObject({
  handle: z.string(), displayName: z.string(), bio: z.string(),
  profileLinks: z.array(z.strictObject({ label: z.string(), url: z.string() })), nameLink: z.string().optional(),
  cards: z.array(z.strictObject({
    product: z.strictObject({ name: z.string(), description: z.string() }),
    status: z.enum(["ACTIVE", "TESTING", "ARCHIVED"]), ownerSelectedGoTo: z.boolean(),
    headline: z.string(), note: z.string(), startedAt: z.string().optional(), startDateNote: z.string().optional(),
    activity: activity.optional(),
    cost: z.strictObject({ displayAmount: z.string(), basis: z.enum(["RECEIPT", "ESTIMATE", "OWNER_REPORTED"]), cadence: z.enum(["MONTHLY", "ANNUAL", "ONE_TIME", "UNKNOWN"]), asOf: z.string(), period: period.optional() }).optional(),
    primaryLink: z.strictObject({ type: z.enum(["CANONICAL", "AFFILIATE", "REFERRAL", "INVITE"]), label: z.string(), url: z.string(), disclosure: z.string().optional() }).optional(),
    usageLink: z.strictObject({ label: z.string(), url: z.string() }).optional(),
  })), emptyNote: z.string().optional(),
}) satisfies z.ZodType<VisiblePublicProfile>;
export const bundledBrandKeySchema = z.enum(["github", "wispr-flow"]);
export type BundledBrandKey = z.infer<typeof bundledBrandKeySchema>;
const color = z.string().regex(/^#[0-9a-f]{6}$/i);
export const cardPresentationSchema = z.strictObject({
  cardIndex: z.number().int().nonnegative(), brandKey: bundledBrandKeySchema.optional(),
  background: color.optional(), foreground: color.optional(), accent: color.optional(),
});
export const publicProfileResultSchema = z.strictObject({
  kind: z.literal("profile"), dataMode: z.enum(["synthetic", "published"]), sourceUrl: z.url(), retrievedAt: z.iso.datetime(),
  profile: visiblePublicProfileSchema, presentation: z.array(cardPresentationSchema),
});
export const publicGuideResultSchema = z.strictObject({ kind: z.literal("guide"), sourceUrl: z.url(), markdown: z.string() });
export const publicReadErrorSchema = z.strictObject({
  kind: z.literal("error"),
  code: z.enum(["INVALID_REFERENCE", "UNAVAILABLE", "LIMIT_EXCEEDED", "TEMPORARILY_UNAVAILABLE"]),
  message: z.string(), retryable: z.boolean(),
});
export const publicToolResultSchema = z.discriminatedUnion("kind", [publicProfileResultSchema, publicGuideResultSchema, publicReadErrorSchema]);
export type PublicProfileResult = z.infer<typeof publicProfileResultSchema>;
export type PublicGuideResult = z.infer<typeof publicGuideResultSchema>;
export type PublicReadError = z.infer<typeof publicReadErrorSchema>;
export type PublicToolResult = z.infer<typeof publicToolResultSchema>;
export type CardPresentation = z.infer<typeof cardPresentationSchema>;
export type { VisiblePublicProfile };
