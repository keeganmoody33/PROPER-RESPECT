"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

type Observation = Pick<
  Doc<"productObservations">,
  "_id" | "capturedAt" | "facts" | "parserVersion"
>;
export type KnowledgeViewState = {
  supported: boolean;
  sources: {
    source: { _id: Id<"productSources">; label: string; canonicalUrl: string };
    watchEnabled: boolean;
    latestObservation: Observation | null;
    latestRun: {
      status: Doc<"productRefreshRuns">["status"];
      capturedAt: string;
      message?: string | null;
    } | null;
    history: Observation[];
  }[];
};

const statusLabels: Record<Doc<"productRefreshRuns">["status"], string> = {
  BASELINE: "First observation",
  CHANGED: "Details changed",
  UNCHANGED: "No meaningful change",
  INCOMPLETE: "Page could not be fully interpreted",
  ERROR: "Retrieval failed",
  REPARSED: "Reinterpreted with a new parser",
};

function OfferingFacts({ observation }: { observation: Observation }) {
  return (
    <>
      {observation.facts.tiers.length > 0 && (
        <div className="offering-table-wrap">
          <table className="offering-table">
            <caption>Published terms from this source</caption>
            <thead>
              <tr>
                <th scope="col">Plan</th>
                <th scope="col">Published price</th>
                <th scope="col">Limits &amp; overages</th>
              </tr>
            </thead>
            <tbody>
              {observation.facts.tiers.map((tier, index) => (
                <tr key={`${tier.name}:${tier.option}:${index}`}>
                  <th scope="row">
                    {tier.name}
                    <small>{tier.option}</small>
                  </th>
                  <td>
                    {tier.prices.map((price, pi) => (
                      <p key={pi}>
                        {price.amount === null
                          ? price.availability.toLowerCase()
                          : `${price.currency === "UNKNOWN" ? "Currency unknown ·" : price.currency} ${price.amount}`}
                        {price.perSeat === true ? " / seat" : ""}
                        {price.displayBasis !== "UNKNOWN"
                          ? ` / ${price.displayBasis.toLowerCase()}`
                          : ""}
                        <small>
                          {price.billingCadence === "UNKNOWN"
                            ? "Billing period unknown"
                            : `Billed ${price.billingCadence === "YEAR" ? "annually" : "monthly"}`}
                        </small>
                      </p>
                    ))}
                  </td>
                  <td>
                    {tier.allowances.length ? (
                      tier.allowances.map((allowance, ai) => (
                        <p key={ai}>
                          {allowance.period === "UNLIMITED"
                            ? "Unlimited"
                            : allowance.value === null
                              ? "Limit not quantified"
                              : allowance.value.toLocaleString("en-US")}{" "}
                          {allowance.unit} · {allowance.period} ·{" "}
                          {allowance.platform}
                        </p>
                      ))
                    ) : (
                      <p>Allowance not established by this source.</p>
                    )}
                    <small>Overages: {tier.overage}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {observation.facts.tiers.map((tier, index) => (
            <details key={`evidence:${index}`} className="source-excerpts">
              <summary>{tier.name} · features and source wording</summary>
              {tier.features.length > 0 && (
                <ul>
                  {tier.features.map((feature, fi) => (
                    <li key={fi}>{feature}</li>
                  ))}
                </ul>
              )}
              <blockquote>{tier.excerpt}</blockquote>
              {tier.prices.map((price, pi) => (
                <blockquote key={pi}>{price.excerpt}</blockquote>
              ))}
            </details>
          ))}
        </div>
      )}
      {observation.facts.documentation.map((item, index) => (
        <details key={index} className="source-excerpts">
          <summary>
            {item.kind.replaceAll("_", " ")} · {item.scope.toLowerCase()}
          </summary>
          <blockquote>{item.excerpt || item.text}</blockquote>
        </details>
      ))}
      <p className="evidence-meta">
        Observed{" "}
        {new Date(observation.capturedAt).toLocaleString("en-US", {
          timeZone: "UTC",
        })}{" "}
        UTC. Source effective date:{" "}
        {observation.facts.effectiveDate ?? "unknown"}.
      </p>
    </>
  );
}

export function ProductKnowledgeView({
  state,
  busy = false,
  message = "",
  onDiscover,
  onRefresh,
}: {
  state: KnowledgeViewState | undefined;
  busy?: boolean;
  message?: string;
  onDiscover?: () => void;
  onRefresh?: (enabled: boolean) => void;
}) {
  if (state && !state.supported)
    return (
      <section className="product-knowledge">
        <h4>Official product information</h4>
        <p>
          Automatic official-source discovery is not configured for this product
          yet. You can still add your private evidence below.
        </p>
      </section>
    );
  const watched = state?.sources.some((source) => source.watchEnabled) ?? false;
  return (
    <section
      className="product-knowledge"
      aria-label="Official product information"
    >
      <h4>Official product information</h4>
      <p>
        Public offerings and documentation. Your subscription, payments, and
        usage are established separately below.
      </p>
      {!state ? (
        <p role="status">Loading official sources…</p>
      ) : (
        <>
          <div className="action-row">
            <button
              type="button"
              className="secondary-action"
              onClick={onDiscover}
              disabled={busy}
            >
              Check official sources
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={() => onRefresh?.(!watched)}
              disabled={busy}
            >
              {watched
                ? "Pause daily public checks"
                : "Enable daily public checks"}
            </button>
          </div>
          <p className="evidence-meta">
            {watched
              ? "Daily public-page checks enabled."
              : "Recurring checks are off."}{" "}
            These checks do not access your Wispr account.
          </p>
          {state.sources.length === 0 && (
            <p>No official pages have been retrieved yet.</p>
          )}
          {state.sources.map((entry, index) => {
            const earlierObservations = entry.history.filter(
              (item) => item._id !== entry.latestObservation?._id,
            );
            return (
              <details
                className="official-source"
                key={entry.source._id}
                open={index === 0}
              >
                <summary>
                  {entry.source.label} ·{" "}
                  {entry.latestRun
                    ? (statusLabels[entry.latestRun.status] ??
                      entry.latestRun.status)
                    : "Not checked"}
                </summary>
                <p>
                  <a
                    href={entry.source.canonicalUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open official source ↗
                  </a>
                </p>
                {entry.latestRun && (
                  <p className="evidence-meta">
                    Last check: {entry.latestRun.capturedAt.replace("T", " ")}.{" "}
                    {entry.latestRun.message}
                  </p>
                )}
                {entry.latestRun &&
                  ["ERROR", "INCOMPLETE"].includes(entry.latestRun.status) && (
                    <p role="status">
                      This attempt did not establish a product change. Any
                      previous successful observation is preserved below.
                    </p>
                  )}
                {entry.latestObservation ? (
                  <OfferingFacts observation={entry.latestObservation} />
                ) : (
                  <p>No complete observation is available.</p>
                )}
                {earlierObservations.length > 0 && (
                  <details>
                    <summary>Earlier observations</summary>
                    {earlierObservations.map((item) => (
                      <details key={item._id}>
                        <summary>
                          {item.capturedAt.slice(0, 10)} · original observation
                        </summary>
                        <OfferingFacts observation={item} />
                      </details>
                    ))}
                    <p className="evidence-meta">
                      Recent observations shown. Earlier records remain
                      retained.
                    </p>
                  </details>
                )}
              </details>
            );
          })}
          <p className="evidence-meta">
            Sources may disagree or describe different options. Each source
            retains its own wording. A listed annual rate may be displayed per
            month.
          </p>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}

export function ProductKnowledgePanel({ propId }: { propId: Id<"props"> }) {
  const state = useQuery(api.productKnowledge.getForProduct, { propId });
  const discover = useMutation(api.productKnowledge.discover);
  const setRefresh = useMutation(api.productKnowledge.setRefresh);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function run(operation: () => Promise<unknown>, result: string) {
    setBusy(true);
    setMessage("");
    try {
      await operation();
      setMessage(result);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The request failed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <ProductKnowledgeView
      state={state}
      busy={busy}
      message={message}
      onDiscover={() =>
        void run(
          () => discover({ propId }),
          "Official source check requested. Results will appear here.",
        )
      }
      onRefresh={(enabled) =>
        void run(
          () => setRefresh({ propId, enabled }),
          enabled
            ? "Daily public checks enabled."
            : "Daily public checks paused.",
        )
      }
    />
  );
}
