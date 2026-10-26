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

const LEDGER_LOOKBACK = 5;

function connectionCurrent(subscription: Doc<"metricSubscriptions">, connector: Doc<"connectorAccounts"> | null) {
  if (!connector || !["CONNECTED", "ERROR"].includes(connector.status)) return false;
  if (subscription.metricKey !== "github.contributions") return true;
  return connector.provider === "GITHUB" && sameGithubRefreshBinding(subscription.githubBinding, connector.githubBinding);
}

function stateFromLedger(rows: Doc<"refreshAttempts">[]): RefreshState {
  const decisive = rows.find(row => !(row.outcome === "SKIPPED" && row.errorClass === "STALE_GRANT"));
  if (!decisive) return "NEVER_RUN";
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
        // A revoked approval is a diagnostic only when the owner's connection
        // moved on without it. A disconnected connector, a connection that
        // still matches, or a card taken private all record a deliberate stop.
        const prop = await ctx.db.get(subscription.propId);
        if (current || !ownConnector || !["CONNECTED", "ERROR"].includes(ownConnector.status) ||
            !prop || prop.userId !== user._id || prop.visibility !== "PUBLIC") return null;
      }
      const ledger = await ctx.db.query("refreshAttempts")
        .withIndex("by_subscription_attemptedAt", q => q.eq("subscriptionId", subscription._id))
        .order("desc").take(LEDGER_LOOKBACK);
      const lastAttempt = ledger[0];
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
        state: current ? stateFromLedger(ledger) : ("REAUTHORIZE" as RefreshState),
      };
    }));
    return rows.filter(row => row !== null);
  },
});
