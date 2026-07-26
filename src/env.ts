import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_CONVEX_URL: z.url().refine(
    (url) =>
      url.startsWith("https://") ||
      url.startsWith("http://127.0.0.1") ||
      url.startsWith("http://localhost"),
    "Must be an HTTPS or local Convex URL",
  ),
});

export function getServerEnv() {
  return envSchema.parse({
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
  });
}
