import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import {
  handleSchema,
  publicProfileSchema,
  type PublicProfile,
} from "@/src/domain/public-profile";
import { getServerEnv } from "@/src/env";
import { e2eReferenceProfile } from "./e2e-reference-profile";

export async function getPublicProfile(
  rawHandle: string,
): Promise<PublicProfile | null> {
  const handle = handleSchema.parse(rawHandle);
  if (process.env.PROPER_RESPECT_E2E_REFERENCE === "1") {
    return handle === e2eReferenceProfile.handle
      ? e2eReferenceProfile
      : null;
  }
  const { NEXT_PUBLIC_CONVEX_URL } = getServerEnv();
  const result = await fetchQuery(
    api.publicProfiles.getByHandle,
    { handle },
    { url: NEXT_PUBLIC_CONVEX_URL },
  );

  return result === null ? null : publicProfileSchema.parse(result);
}
