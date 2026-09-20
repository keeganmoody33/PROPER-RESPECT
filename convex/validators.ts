import { v } from "convex/values";
import { productBrandSnapshotValidator } from "./productBrandTables";

export const evidenceSourceTypeValidator = v.union(
  v.literal("MANUAL"), v.literal("PUBLIC_PROFILE"), v.literal("GITHUB"),
  v.literal("BILLING"), v.literal("BROWSER_HISTORY"), v.literal("SCREEN_TIME"),
  v.literal("SOCIAL_MESSAGES"), v.literal("GMAIL"), v.literal("MICROSOFT_MAIL"),
  v.literal("SCREENSHOT"), v.literal("CSV"), v.literal("FILE_UPLOAD"), v.literal("URL_IMPORT"),
  v.literal("DEVIN"), v.literal("DEVIN_DESKTOP"), v.literal("WINDSURF"),
  v.literal("WISPR_FLOW"), v.literal("NOTEBOOKLM"), v.literal("GREPTILE"),
);

export const captureProvenanceValidator = v.object({
  version: v.literal(1),
  route: v.union(v.literal("DIRECT_API"), v.literal("MCP"), v.literal("WEBMCP"), v.literal("BROWSER_AGENT"), v.literal("UPLOAD"), v.literal("OWNER_TESTIMONY")),
  adapter: v.object({ id: v.string(), version: v.string() }),
  origin: v.object({
    issuer: v.string(), accountId: v.optional(v.string()),
    recordId: v.optional(v.string()), artifactRef: v.optional(v.string()),
  }),
  collector: v.object({ kind: v.union(v.literal("HUMAN"), v.literal("AGENT"), v.literal("SYSTEM"), v.literal("UNKNOWN")), id: v.optional(v.string()) }),
  activityActor: v.object({ kind: v.union(v.literal("HUMAN"), v.literal("AGENT"), v.literal("UNKNOWN")), id: v.optional(v.string()) }),
});

export const costVisibilityValidator = v.union(v.literal("PRIVATE"), v.literal("PUBLIC"));
export const costValidator = v.object({
  amount: v.number(),
  currency: v.string(),
  cadence: v.union(v.literal("MONTHLY"), v.literal("ANNUAL"), v.literal("ONE_TIME"), v.literal("UNKNOWN")),
  basis: v.union(v.literal("RECEIPT"), v.literal("ESTIMATE"), v.literal("OWNER_REPORTED")),
  asOf: v.string(),
  period: v.optional(v.object({ start: v.string(), end: v.string() })),
});

export const statusValidator = v.union(
  v.literal("ACTIVE"),
  v.literal("TESTING"),
  v.literal("ARCHIVED"),
);

export const visibilityValidator = v.union(
  v.literal("PUBLIC"),
  v.literal("PRIVATE"),
  v.literal("DRAFT"),
);

export const attributionScopeValidator = v.union(
  v.literal("PERSONAL"),
  v.literal("REPOSITORY"),
  v.literal("WORKSPACE"),
  v.literal("ORGANIZATION"),
);

export const freshnessValidator = v.union(
  v.literal("FRESH"),
  v.literal("STALE"),
  v.literal("ERROR"),
);

export const linkTypeValidator = v.union(
  v.literal("CANONICAL"),
  v.literal("AFFILIATE"),
  v.literal("REFERRAL"),
  v.literal("INVITE"),
);

const periodValidator = v.object({
  start: v.string(),
  end: v.string(),
  label: v.optional(v.string()),
});

const metricValueValidator = v.object({
  label: v.string(),
  value: v.number(),
  unit: v.optional(v.string()),
});

const activityMetadata = {
  attributionScope: attributionScopeValidator,
  capturedAt: v.string(),
  freshness: freshnessValidator,
  provenanceLabel: v.string(),
  period: v.optional(periodValidator),
};

const activityDayValidator = v.object({
  date: v.string(),
  count: v.number(),
  level: v.number(),
});

export const activityModuleValidator = v.union(
  v.object({
    kind: v.literal("contributionCalendar"),
    ...activityMetadata,
    total: v.number(),
    memberSince: v.optional(v.string()),
    days: v.array(activityDayValidator),
  }),
  v.object({
    kind: v.literal("headlineMetrics"),
    ...activityMetadata,
    primary: metricValueValidator,
    supporting: v.array(metricValueValidator),
  }),
  v.object({
    kind: v.literal("timeSeries"),
    ...activityMetadata,
    label: v.string(),
    unit: v.optional(v.string()),
    points: v.array(
      v.object({
        date: v.string(),
        value: v.number(),
      }),
    ),
  }),
  v.object({
    kind: v.literal("artifactCollection"),
    ...activityMetadata,
    total: v.number(),
    artifacts: v.array(
      v.object({
        title: v.string(),
        url: v.string(),
        label: v.optional(v.string()),
      }),
    ),
  }),
  v.object({
    kind: v.literal("reviewActivity"),
    ...activityMetadata,
    reviews: v.number(),
    bugsCaught: v.number(),
    severity: v.array(
      v.object({
        label: v.string(),
        count: v.number(),
      }),
    ),
    points: v.array(
      v.object({
        date: v.string(),
        value: v.number(),
      }),
    ),
  }),
  v.object({
    kind: v.literal("codingActivity"),
    ...activityMetadata,
    primary: metricValueValidator,
    supporting: v.array(metricValueValidator),
    days: v.optional(v.array(activityDayValidator)),
  }),
);

export const publicProfileValidator = v.object({
  handle: v.string(),
  displayName: v.string(),
  bio: v.string(),
  avatarUrl: v.optional(v.string()),
  cards: v.array(
    v.object({
      product: v.object({
        name: v.string(),
        slug: v.string(),
        domain: v.string(),
        description: v.string(),
        logoUrl: v.optional(v.string()),
        brand: v.optional(productBrandSnapshotValidator),
      }),
      status: statusValidator,
      goTo: v.optional(v.boolean()),
      headline: v.string(),
      note: v.string(),
      startedAt: v.optional(v.string()),
      activity: v.optional(activityModuleValidator),
      cost: v.optional(costValidator),
      primaryLink: v.optional(v.object({
        type: linkTypeValidator,
        url: v.string(),
        label: v.string(),
      })),
    }),
  ),
});

const observationCommon = {
  excerpt: v.string(),
  scope: v.union(v.literal("PERSONAL"), v.literal("ORGANIZATION"), v.literal("UNKNOWN")),
  acquisition: v.union(v.literal("SOURCE_REPORTED"), v.literal("ASSISTANT_EXTRACTED"), v.literal("USER_SUPPLIED")),
};
const observationDates = { date: v.optional(v.string()), periodStart: v.optional(v.string()), periodEnd: v.optional(v.string()) };
const billingCadence = v.optional(v.union(v.literal("MONTHLY"), v.literal("ANNUAL"), v.literal("ONE_TIME"), v.literal("UNKNOWN")));
export const evidenceObservationValidator = v.union(
  v.object({ ...observationCommon, kind: v.union(v.literal("SIGNUP"), v.literal("FIRST_USE"), v.literal("RECENT_USE"), v.literal("PAID_PERIOD")), date: v.string(), periodEnd: v.optional(v.string()) }),
  v.object({ ...observationCommon, ...observationDates, kind: v.literal("USAGE"), metric: v.string(), value: v.number(), unit: v.string() }),
  v.object({ ...observationCommon, ...observationDates, kind: v.literal("SUBSCRIPTION"), plan: v.string(), billingCadence }),
  v.object({ ...observationCommon, ...observationDates, kind: v.literal("PAYMENT"), amount: v.number(), currency: v.optional(v.string()), billingCadence }),
);
export const claimVerdictValidator = v.union(v.literal("CORRECT"), v.literal("INCORRECT"), v.literal("INCOMPLETE"), v.literal("UNKNOWN"));

export const rawSignalValidator = v.object({
  sourceType: evidenceSourceTypeValidator,
  sourceRecordId: v.optional(v.string()),
  vendor: v.optional(v.string()),
  url: v.optional(v.string()),
  capturedAt: v.string(),
  payload: v.string(),
  observations: v.optional(v.array(evidenceObservationValidator)),
  captureProvenance: v.optional(captureProvenanceValidator),
});
