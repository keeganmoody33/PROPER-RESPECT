import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireUser } from "./authHelpers";
import { sameGithubRefreshBinding } from "./githubRefreshIdentity";

/**
 * Why a scheduled refresh is or is not running for one of the owner's cards.
 *
 * - RUNNING: the approval still matches the live connection.
 * - REAUTHORIZE: the connection was replaced after approval (#150 revokes the
 *   earlier consent on every reconnect), or the connector is gone. Approving
 *   the refresh again on the current connection resumes it.
 * - FAILING: the approval is valid but the last attempt failed at the provider.
 * - NEVER_RUN: approved, nothing attempted yet.
 */
export type RefreshState = "RUNNING" | "REAUTHORIZE" | "FAILING" | "NEVER_RUN";

function refreshState(subscription: Doc<"metricSubscriptions">, connector: Doc<"connectorAccounts"> | null,
  lastAttempt: Doc<"refreshAttempts"> | null): RefreshState {
  if (subscription.metricKey === "github.contributions") {
    if (!connector || connector.provider !== "GITHUB" || !["CONNECTED", "ERROR"].includes(connector.status) ||
        !sameGithubRefreshBinding(subscription.githubBinding, connector.githubBinding)) return "REAUTHORIZE";
  } else if (!connector || !["CONNECTED", "ERROR"].includes(connector.status)) {
    return "REAUTHORIZE";
  }
  if (!lastAttempt) return "NEVER_RUN";
  if (lastAttempt.outcome === "SUCCESS") return "RUNNING";
  if (lastAttempt.errorClass === "STALE_GRANT" || lastAttempt.errorClass === "NOT_ELIGIBLE") return "REAUTHORIZE";
  return "FAILING";
}

/** The owner's active refresh approvals with the last ledger outcome. Outcomes only; no provider text. */
export const forOwner = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const subscriptions = await ctx.db.query("metricSubscriptions")
      .withIndex("by_user", q => q.eq("userId", user._id)).collect();
    const rows = await Promise.all(subscriptions.filter(subscription => !subscription.revokedAt).map(async subscription => {
      const connector = await ctx.db.get(subscription.connectorId);
      const lastAttempt = await ctx.db.query("refreshAttempts")
        .withIndex("by_subscription_attemptedAt", q => q.eq("subscriptionId", subscription._id))
        .order("desc").first();
      return {
        subscriptionId: subscription._id,
        propId: subscription.propId,
        metricKey: subscription.metricKey,
        approvedAt: subscription.approvedAt,
        lastSuccessfulAt: subscription.lastSuccessfulAt,
        lastAttempt: lastAttempt
          ? { attemptedAt: lastAttempt.attemptedAt, outcome: lastAttempt.outcome, errorClass: lastAttempt.errorClass }
          : null,
        state: refreshState(subscription, connector?.userId === user._id ? connector : null, lastAttempt),
      };
    }));
    return rows;
  },
});
