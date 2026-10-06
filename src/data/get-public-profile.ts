import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import {
  handleSchema,
  publicProfileSchema,
  type PublicProfile,
} from "@/src/domain/public-profile";
import { getServerEnv } from "@/src/env";
import { e2eReferenceProfile } from "./e2e-reference-profile";

// The backend returned a published profile this reader cannot accept. That is
// an error, not an absence. The message is fixed and no cause is kept, so no
// payload value reaches logs or error digests.
export class PublicProfilePayloadError extends Error {
  constructor() {
    super("The published profile could not be read.");
    this.name = "PublicProfilePayloadError";
  }
}

export async function getPublicProfile(
  rawHandle: string,
): Promise<PublicProfile | null> {
  const parsedHandle = handleSchema.safeParse(rawHandle);
  if (!parsedHandle.success) return null;
  const handle = parsedHandle.data;
  if (process.env.PROPER_RESPECT_E2E_REFERENCE === "1") {
    if (["lecturesfrom", "legacy-profile-url"].includes(handle)) {
      return { ...e2eReferenceProfile, handle: "lecturesfrom" };
    }
    if (["collection", "app", "about", "origins", "contact", "privacy"].includes(handle)) {
      return { handle, displayName: `Existing ${handle} owner`, bio: "Synthetic published profile for route compatibility checks.", cards: [] };
    }
    return handle === e2eReferenceProfile.handle
      ? e2eReferenceProfile
      : null;
  }
  const { NEXT_PUBLIC_CONVEX_URL } = getServerEnv();
  const result = await fetchQuery(
    api.publicProfiles.getByHandleV2,
    { handle },
    { url: NEXT_PUBLIC_CONVEX_URL },
  );
  if (result === null) return null;

  const profile = publicProfileSchema.safeParse(result);
  if (!profile.success) throw new PublicProfilePayloadError();
  return profile.data;
}
