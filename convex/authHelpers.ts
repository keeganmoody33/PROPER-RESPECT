import type {
  GenericMutationCtx,
  GenericQueryCtx,
} from "convex/server";
import type { DataModel, Doc } from "./_generated/dataModel";

type AuthenticatedCtx =
  | GenericMutationCtx<DataModel>
  | GenericQueryCtx<DataModel>;

export async function requireIdentity(ctx: AuthenticatedCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required.");
  }
  return identity;
}

export async function requireUser(
  ctx: AuthenticatedCtx,
): Promise<Doc<"users">> {
  const identity = await requireIdentity(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_auth_subject", (q) =>
      q.eq("authSubject", identity.subject),
    )
    .unique();
  if (!user) {
    throw new Error("Complete account setup before continuing.");
  }
  return user;
}
