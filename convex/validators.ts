import { v } from "convex/values";

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
      }),
      status: statusValidator,
      headline: v.string(),
      note: v.string(),
      startedAt: v.optional(v.string()),
      activity: v.optional(activityModuleValidator),
      primaryLink: v.object({
        type: linkTypeValidator,
        url: v.string(),
        label: v.string(),
      }),
    }),
  ),
});
