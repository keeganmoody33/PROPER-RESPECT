import { fetchQuery } from "convex/nextjs";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { PublicRetainedSource } from "@/src/domain/retained-mailbox-aggregate";

const publicRetainedSourceSchema = z.object({
  accountId: z.string().min(1),
  recording: z.enum(["recording", "stopped"]),
  label: z.enum(["Personal", "Former employer", "Retained source"]),
  retainedCount: z.number().int().nonnegative(),
}).refine(source => !source.accountId.includes("@"));

export async function getPublicMailboxAggregate(handle: string): Promise<readonly PublicRetainedSource[]> {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return [];
  try {
    const result = await fetchQuery(api.publicProfiles.getRetainedMailboxAggregate, { handle }, { url });
    return result.flatMap(source => {
      const parsed = publicRetainedSourceSchema.safeParse(source);
      return parsed.success ? [parsed.data] : [];
    });
  } catch {
    // Missing function or a refused payload: show no aggregate, leave the profile up.
    return [];
  }
}
