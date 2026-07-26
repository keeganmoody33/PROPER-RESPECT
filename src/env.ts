import { z } from "zod";
import { parsePublicSiteUrl } from "@/src/domain/public-site";

const envSchema = z.object({
  NEXT_PUBLIC_CONVEX_URL: z.url().refine(
    (url) =>
      url.startsWith("https://") ||
      url.startsWith("http://127.0.0.1") ||
      url.startsWith("http://localhost"),
    "Must be an HTTPS or local Convex URL",
  ),
  NEXT_PUBLIC_SITE_URL: z.string().transform((value, context) => {
    try {
      return parsePublicSiteUrl(value);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message:
          error instanceof Error ? error.message : "Invalid public site URL",
      });
      return z.NEVER;
    }
  }),
});

export function getServerEnv() {
  return envSchema.parse({
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
    NEXT_PUBLIC_SITE_URL:
      process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.NODE_ENV === "production"
        ? undefined
        : "http://localhost:3000"),
  });
}
