import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";
import type { LinkPropCredit } from "@/src/domain/link-prop";
import { getServerEnv } from "@/src/env";

const listLinkProps = makeFunctionReference<"query", { handle: string }, LinkPropCredit[]>("linkProps:listForProfile");

export async function getLinkProps(handle: string, token: string): Promise<LinkPropCredit[]> {
  const { NEXT_PUBLIC_CONVEX_URL } = getServerEnv();
  return await fetchQuery(listLinkProps, { handle }, { url: NEXT_PUBLIC_CONVEX_URL, token });
}
