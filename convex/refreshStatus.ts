import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireUser } from "./authHelpers";
import { sameGithubRefreshBinding } from "./githubRefreshIdentity";

/**
 * Why a scheduled refresh is or is not running for one of the owner's cards.
 *
 * - RUNNING: the approval is current and the last real attempt succeeded.
 * - REAUTHORIZE: no current approval can run. Either a reconnect replaced the
 *   connection and revoked the approval (#150 revokes consent on every
 *   reconnect) and nothing replaced it, or the connection behind a current
 *   approval no longer matches it. Approving the refresh again on the current
 *   connection resumes it.
 * - FAILING: the approval is current but the last attempt failed at the provider.
 * - SKIPPED: the approval is current but the scheduler declined the last
 *   attempt for a reason other than the connection (for example the profile
 *   is not published). The error class says which.
 * - NEVER_RUN: approved, nothing attempted yet.
 *
 * A `SKIPPED / STALE_GRANT` row can follow a success when two completions of
 * one refresh overlap; it never decides the state on its own.
 */
export type RefreshState = "RUNNING" | "REAUTHORIZE" | "FAILING" | "SKIPPED" | "NEVER_RUN";

function connectionCurrent(subscription: Doc<"metricSubscriptions">, connector: Doc<"connectorAccounts"> | null) {
  if (!connector || !["CONNECTED", "ERROR"].includes(connector.status)) return false;
  if (subscription.metricKey !== "github.contributions") return true;
  return connector.provider === "GITHUB" && sameGithubRefreshBinding(subscription.githubBinding, connector.githubBinding);
}

const staleDuplicate = (row: Doc<"refreshAttempts">) => row.outcome === "SKIPPED" && row.errorClass === "STALE_GRANT";

function stateFromLedger(lastAttempt: Doc<"refreshAttempts"> | null, decisive: Doc<"refreshAttempts"> | null): RefreshState {
  if (!lastAttempt) return "NEVER_RUN";
  // History with no decisive row: every attempt was a stale completion (for
  // example a prop edit changed the authority fingerprint mid-refresh). That
  // is a skip, not "never run".
  if (!decisive) return "SKIPPED";
  if (decisive.outcome === "SUCCESS") return "RUNNING";
  if (decisive.outcome === "FAILURE") return "FAILING";
  return "SKIPPED";
}

/**
 * The owner's refresh approvals, one row per card and metric, with the last
 * ledger outcome. An approval that a reconnect revoked is listed until the
 * owner approves again or deliberately turns the card's refresh off. Outcomes
 * only; no provider text.
 */
export const forOwner = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const subscriptions = await ctx.db.query("metricSubscriptions")
      .withIndex("by_user", q => q.eq("userId", user._id)).collect();
    const byPropMetric = subscriptions.reduce((groups, subscription) => {
      const key = `${subscription.propId}:${subscription.metricKey}`;
      return groups.set(key, [...(groups.get(key) ?? []), subscription]);
    }, new Map<string, Doc<"metricSubscriptions">[]>());
    const rows = await Promise.all([...byPropMetric.values()].map(async group => {
      const active = group.find(subscription => subscription.revokedAt === undefined);
      const subscription = active ?? group
        .filter(candidate => candidate.revokedAt !== undefined)
        .sort((a, b) => b.revokedAt!.localeCompare(a.revokedAt!))[0];
      const connector = await ctx.db.get(subscription.connectorId);
      const ownConnector = connector?.userId === user._id ? connector : null;
      const current = connectionCurrent(subscription, ownConnector);
      if (!active) {
        // A revoked approval is a diagnostic only when a reconnect ended it
        // and the card is still public. The stored reason decides when it is
        // present; rows written before the field existed fall back to the
        // connection: a disconnected connector or one that still matches the
        // approval means the owner stopped it on purpose.
        const prop = await ctx.db.get(subscription.propId);
        const reconnectEnded = subscription.revokedReason
          ? subscription.revokedReason === "RECONNECT"
          : !current && !!ownConnector && ["CONNECTED", "ERROR"].includes(ownConnector.status);
        if (!reconnectEnded || !prop || prop.userId !== user._id || prop.visibility !== "PUBLIC") return null;
      }
      const attempts = () => ctx.db.query("refreshAttempts")
        .withIndex("by_subscription_attemptedAt", q => q.eq("subscriptionId", subscription._id)).order("desc");
      const lastAttempt = await attempts().first();
      // The latest outcome that was not a stale duplicate completion, however
      // many stale rows sit in front of it.
      const decisive = lastAttempt && staleDuplicate(lastAttempt)
        ? await attempts().filter(q => q.neq(q.field("errorClass"), "STALE_GRANT")).first()
        : lastAttempt;
      return {
        subscriptionId: subscription._id,
        propId: subscription.propId,
        metricKey: subscription.metricKey,
        approvedAt: subscription.approvedAt,
        revokedAt: subscription.revokedAt,
        lastSuccessfulAt: subscription.lastSuccessfulAt,
        lastAttempt: lastAttempt
          ? { attemptedAt: lastAttempt.attemptedAt, outcome: lastAttempt.outcome, errorClass: lastAttempt.errorClass }
          : null,
        state: current ? stateFromLedger(lastAttempt, decisive) : ("REAUTHORIZE" as RefreshState),
      };
    }));
    return rows.filter(row => row !== null);
  },
});
