import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import {
  handleSchema,
  publicProfileSchema,
  type PublicProfile,
} from "@/src/domain/public-profile";
import { getServerEnv } from "@/src/env";

export async function getPublicProfile(
  rawHandle: string,
): Promise<PublicProfile | null> {
  const handle = handleSchema.parse(rawHandle);
  const { NEXT_PUBLIC_CONVEX_URL } = getServerEnv();
  const result = await fetchQuery(
    api.publicProfiles.getByHandle,
    { handle },
    { url: NEXT_PUBLIC_CONVEX_URL },
  );

  return result === null ? null : publicProfileSchema.parse(result);
}
