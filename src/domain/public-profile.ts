import { profileLinksSchema, profileLinkUrlSchema } from "./profile-links";
import { z } from "zod";
import { costSchema, type Cost, type CostVisibility } from "./cost";
import { productBrandSnapshotSchema } from "./product-brand";

export const handleSchema = z
  .string()
  .trim()
  .min(1)
  .max(39)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/);

const statusSchema = z.enum(["ACTIVE", "TESTING", "ARCHIVED"]);
const linkTypeSchema = z.enum([
  "CANONICAL",
  "AFFILIATE",
  "REFERRAL",
  "INVITE",
]);

export const attributionScopeSchema = z.enum([
  "PERSONAL",
  "REPOSITORY",
  "WORKSPACE",
  "ORGANIZATION",
]);

export const freshnessSchema = z.enum(["FRESH", "STALE", "ERROR"]);

const periodSchema = z.object({
  start: z.iso.date(),
  end: z.iso.date(),
  label: z.string().optional(),
});

const metricValueSchema = z.object({
  label: z.string().min(1),
  value: z.number(),
  unit: z.string().optional(),
});

const activityCommonShape = {
  attributionScope: attributionScopeSchema,
  capturedAt: z.iso.datetime(),
  freshness: freshnessSchema,
  provenanceLabel: z.string().min(1),
  period: periodSchema.optional(),
};

export const activityModuleSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("contributionCalendar"),
    ...activityCommonShape,
    total: z.number().int().nonnegative(),
    memberSince: z.iso.date().optional(),
    days: z.array(
      z.object({
        date: z.iso.date(),
        count: z.number().int().nonnegative(),
        level: z.number().int().min(0).max(4),
      }),
    ),
  }),
  z.object({
    kind: z.literal("headlineMetrics"),
    ...activityCommonShape,
    primary: metricValueSchema,
    supporting: z.array(metricValueSchema).max(4),
  }),
  z.object({
    kind: z.literal("timeSeries"),
    ...activityCommonShape,
    label: z.string().min(1),
    unit: z.string().optional(),
    points: z.array(
      z.object({
        date: z.iso.date(),
        value: z.number(),
      }),
    ),
  }),
  z.object({
    kind: z.literal("artifactCollection"),
    ...activityCommonShape,
    total: z.number().int().nonnegative(),
    artifacts: z
      .array(
        z.object({
          title: z.string().min(1),
          url: z.url(),
          label: z.string().optional(),
        }),
      )
      .max(6),
  }),
  z.object({
    kind: z.literal("reviewActivity"),
    ...activityCommonShape,
    reviews: z.number().int().nonnegative(),
    bugsCaught: z.number().int().nonnegative(),
    severity: z.array(
      z.object({
        label: z.string().min(1),
        count: z.number().int().nonnegative(),
      }),
    ),
    points: z.array(
      z.object({
        date: z.iso.date(),
        value: z.number().nonnegative(),
      }),
    ),
  }),
  z.object({
    kind: z.literal("codingActivity"),
    ...activityCommonShape,
    primary: metricValueSchema,
    supporting: z.array(metricValueSchema).max(4),
    days: z
      .array(
        z.object({
          date: z.iso.date(),
          count: z.number().int().nonnegative(),
          level: z.number().int().min(0).max(4),
        }),
      )
      .optional(),
  }),
]);

export type ActivityModule = z.infer<typeof activityModuleSchema>;

export const publicProfileSchema = z.object({
  handle: handleSchema,
  displayName: z.string().min(1),
  bio: z.string(),
  avatarUrl: z.url().optional(),
  profileLinks: profileLinksSchema.optional(),
  preferredLinkUrl: profileLinkUrlSchema.optional(),
  cards: z.array(
    z.object({
      product: z.object({
        name: z.string().min(1),
        slug: handleSchema,
        domain: z.string(),
        description: z.string(),
        logoUrl: z.url().optional(),
        brand: productBrandSnapshotSchema.optional(),
      }),
      status: statusSchema,
      goTo: z.boolean().optional(),
      headline: z.string(),
      note: z.string(),
      startedAt: z.iso.date().optional(),
      activity: activityModuleSchema.optional(),
      cost: costSchema.optional(),
      primaryLink: z.object({
        type: linkTypeSchema,
        url: z.url(),
        label: z.string().min(1),
      }).optional(),
    }),
  ),
});

export type PublicProfile = z.infer<typeof publicProfileSchema>;

// Deployed v1 readers require both a product domain and a primary link. Keep
// their contract separate from the current projection, which can describe an
// owner-added product without inventing a website.
const publicCardSchema = publicProfileSchema.shape.cards.element;
export const publicProfileV1Schema = publicProfileSchema.extend({
  cards: z.array(publicCardSchema.extend({
    product: publicCardSchema.shape.product.extend({ domain: z.string().min(1) }),
    primaryLink: publicCardSchema.shape.primaryLink.unwrap(),
  })),
});

export function projectPublicProfileV1(profile: PublicProfile): z.infer<typeof publicProfileV1Schema> {
  return publicProfileV1Schema.parse({
    ...profile,
    cards: profile.cards.filter(card => card.product.domain.length > 0 && card.primaryLink !== undefined),
  });
}

export type CuratedProp = {
  visibility: "PUBLIC" | "PRIVATE" | "DRAFT";
  status: "ACTIVE" | "TESTING" | "ARCHIVED";
  goTo?: boolean;
  headline: string;
  note: string;
  startedAt?: string;
  activity?: ActivityModule;
  cost?: Cost;
  costVisibility?: CostVisibility;
  product: PublicProfile["cards"][number]["product"];
  links: Array<NonNullable<PublicProfile["cards"][number]["primaryLink"]> & {
    isPrimary: boolean;
  }>;
};

export function projectPublicProfile(input: {
  user: Omit<PublicProfile, "cards">;
  props: CuratedProp[];
}): PublicProfile {
  const cards = input.props.flatMap((prop) => {
    if (prop.visibility !== "PUBLIC") return [];

    const primaryLink = prop.links.find((link) => link.isPrimary);

    return [
      {
        product: prop.product,
        status: prop.status,
        goTo: prop.goTo,
        headline: prop.headline,
        note: prop.note,
        startedAt: prop.startedAt,
        activity: prop.activity,
        cost: prop.costVisibility === "PUBLIC" ? prop.cost : undefined,
        primaryLink: primaryLink ? {
          type: primaryLink.type,
          url: primaryLink.url,
          label: primaryLink.label,
        } : undefined,
      },
    ];
  });

  return publicProfileSchema.parse({ ...input.user, cards });
}
