import { z } from "zod";

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

export const publicProfileSchema = z.object({
  handle: handleSchema,
  displayName: z.string().min(1),
  bio: z.string(),
  avatarUrl: z.url().optional(),
  cards: z.array(
    z.object({
      product: z.object({
        name: z.string().min(1),
        slug: handleSchema,
        domain: z.string().min(1),
        description: z.string(),
      }),
      status: statusSchema,
      headline: z.string(),
      note: z.string(),
      startedAt: z.iso.date().optional(),
      primaryLink: z.object({
        type: linkTypeSchema,
        url: z.url(),
        label: z.string().min(1),
      }),
    }),
  ),
});

export type PublicProfile = z.infer<typeof publicProfileSchema>;

export type CuratedProp = {
  visibility: "PUBLIC" | "PRIVATE" | "DRAFT";
  status: "ACTIVE" | "TESTING" | "ARCHIVED";
  headline: string;
  note: string;
  startedAt?: string;
  product: PublicProfile["cards"][number]["product"];
  links: Array<PublicProfile["cards"][number]["primaryLink"] & {
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
    if (!primaryLink) return [];

    return [
      {
        product: prop.product,
        status: prop.status,
        headline: prop.headline,
        note: prop.note,
        startedAt: prop.startedAt,
        primaryLink: {
          type: primaryLink.type,
          url: primaryLink.url,
          label: primaryLink.label,
        },
      },
    ];
  });

  return publicProfileSchema.parse({ ...input.user, cards });
}
