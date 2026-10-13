"use server";

import { auth } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";
import { revalidatePath } from "next/cache";
import { convexAuthToken } from "@/src/domain/convex-auth-token";
import { getServerEnv } from "@/src/env";

const giveLinkProp = makeFunctionReference<"mutation", { handle: string; productSlug: string }>("linkProps:give");

export async function giveStoredLinkProp(handle: string, productSlug: string) {
  const { userId, sessionClaims, getToken } = await auth();
  if (!userId) return;
  const token = await convexAuthToken({ sessionClaims, getToken });
  if (!token) return;
  const { NEXT_PUBLIC_CONVEX_URL } = getServerEnv();
  await fetchMutation(giveLinkProp, { handle, productSlug }, { url: NEXT_PUBLIC_CONVEX_URL, token });
  revalidatePath(`/${handle}`);
}
