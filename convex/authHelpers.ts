import type {
  GenericMutationCtx,
  GenericQueryCtx,
} from "convex/server";
import { ConvexError } from "convex/values";
import type { DataModel, Doc, Id } from "./_generated/dataModel";

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

type LimitedOperation = Doc<"rateLimits">["operation"];
const WRITE_LIMITS: Record<LimitedOperation, { limit: number; label: string }> = {
  claimHandle: { limit: 10, label: "profile changes" },
  addManualProduct: { limit: 60, label: "product additions" },
  beginUpload: { limit: 30, label: "upload attempts" },
  publishSelected: { limit: 20, label: "publication changes" },
  connectGithub: { limit: 10, label: "GitHub connection attempts" },
};
const HOUR_MS = 60 * 60 * 1000;

// Called inside the write transaction; Convex retries conflicting increments.
// Keep one row per owner/operation and reuse it at each UTC hour boundary.
export async function consumeWriteLimit(
  ctx: GenericMutationCtx<DataModel>,
  userId: Id<"users">,
  operation: LimitedOperation,
) {
  const now = Date.now();
  const windowStart = Math.floor(now / HOUR_MS) * HOUR_MS;
  const { limit, label } = WRITE_LIMITS[operation];
  const current = await ctx.db.query("rateLimits")
    .withIndex("by_user_operation", q => q.eq("userId", userId).eq("operation", operation))
    .unique();
  const count = current?.windowStart === windowStart ? current.count : 0;
  if (count >= limit) {
    const minutes = Math.max(1, Math.ceil((windowStart + HOUR_MS - now) / 60_000));
    throw new ConvexError(`Too many ${label}. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
  }
  const value = { windowStart, count: count + 1 };
  if (current) await ctx.db.patch(current._id, value);
  else await ctx.db.insert("rateLimits", { userId, operation, ...value });
}
