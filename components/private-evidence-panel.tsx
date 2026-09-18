"use client";

import { useMutation, usePaginatedQuery } from "convex/react";
import { useState } from "react";
import { ZodError } from "zod";
import { sourceDefinitions } from "@/src/domain/product-sources";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  acquisitionLabels,
  canUseAsStart,
  claimCaveat,
  claimLabels,
  claimVerdicts,
  formatObservation,
  type EvidenceObservation,
} from "@/src/domain/evidence-claims";
import {
  parsePrivateEvidence,
  type PrivateEvidenceInput,
} from "@/src/domain/private-evidence";

const sourceUrl = (key: string) =>
  sourceDefinitions.find((source) => source.key === key)!.canonicalUrl;
const WISPR_USAGE = sourceUrl("wispr-usage");
const WISPR_EXPORT = sourceUrl("wispr-export");
const WISPR_BILLING = sourceUrl("wispr-billing");

export function EvidenceInstructions({ productSlug }: { productSlug: string }) {
  if (!["wisprflow", "wispr-flow", "wispr"].includes(productSlug))
    return (
      <p>
        Supply selected account evidence for this product, including the
        reporting period and who the figures describe. Leave anything the source
        does not establish blank.
      </p>
    );
  return (
    <details className="source-excerpts">
      <summary>Where to find your Wispr evidence</summary>
      <ol>
        <li>
          <strong>Personal usage:</strong> on Mac or Windows, open Wispr Flow →
          Insights → Your Usage. Capture the Total words dictated tile and any
          visible reporting window. Keep lifetime totals separate from the
          monthly comparison badge.{" "}
          <a href={WISPR_USAGE} target="_blank" rel="noreferrer">
            Official usage instructions ↗
          </a>
        </li>
        <li>
          <strong>Your subscription and payments:</strong> open Settings → Plans
          and Billing → Manage subscription. Select an invoice under Invoice
          History. Use its actual amount, currency, and billing period. App
          Store subscriptions use Apple’s billing records.{" "}
          <a href={WISPR_BILLING} target="_blank" rel="noreferrer">
            Official billing instructions ↗
          </a>
        </li>
        <li>
          <strong>Enterprise admins:</strong> open the admin portal’s Usage
          section → Export usage data. Select the intended date range and your
          user before exporting; include User email. Organization totals and
          projected chart values are not personal usage.{" "}
          <a href={WISPR_EXPORT} target="_blank" rel="noreferrer">
            Official export instructions ↗
          </a>
        </li>
      </ol>
      <p>
        Keep the original screenshot or report privately. Paste selected source
        text, or transcribe the relevant wording, below. This form does not read
        screenshots or parse CSV files automatically. Do not include other
        people’s rows.
      </p>
    </details>
  );
}

export function PrivateEvidenceIntake({
  productSlug,
  busy = false,
  onSubmit,
}: {
  productSlug: string;
  busy?: boolean;
  onSubmit: (input: PrivateEvidenceInput) => Promise<void>;
}) {
  const [kind, setKind] = useState<"USAGE" | "SUBSCRIPTION" | "PAYMENT">(
    "USAGE",
  );
  const [error, setError] = useState("");
  async function submit(form: FormData) {
    setError("");
    const field = (name: string) =>
      String(form.get(name) ?? "").trim() || undefined;
    const common = {
      kind,
      date: field("date"),
      periodStart: field("periodStart"),
      periodEnd: field("periodEnd"),
      excerpt: String(form.get("excerpt") ?? ""),
      scope: field("scope"),
      acquisition: "USER_SUPPLIED",
    };
    const observation =
      kind === "USAGE"
        ? {
            ...common,
            metric: field("metric"),
            value: Number(field("value")),
            unit: field("unit"),
          }
        : kind === "SUBSCRIPTION"
          ? {
              ...common,
              plan: field("plan"),
              billingCadence: field("billingCadence"),
            }
          : {
              ...common,
              amount: Number(field("amount")),
              currency: field("currency")?.toUpperCase(),
              billingCadence: field("billingCadence"),
            };
    try {
      await onSubmit(
        parsePrivateEvidence({
          payload: String(form.get("payload") ?? ""),
          sourceUrl: field("sourceUrl"),
          observations: [observation],
        }),
      );
    } catch (caught) {
      setError(
        caught instanceof ZodError
          ? caught.issues.map((issue) => issue.message).join(" ")
          : caught instanceof Error
            ? caught.message
            : "Evidence could not be saved.",
      );
    }
  }
  return (
    <details className="evidence-intake">
      <summary>Add private account evidence</summary>
      <EvidenceInstructions productSlug={productSlug} />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(new FormData(event.currentTarget));
        }}
      >
        <p>
          Supply one observation at a time. Original text and your later
          corrections are kept separately. Saving evidence does not publish it.
        </p>
        <label className="review-field">
          What does this evidence describe?
          <select
            name="kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as typeof kind)}
          >
            <option value="USAGE">My usage</option>
            <option value="SUBSCRIPTION">My subscription</option>
            <option value="PAYMENT">A payment</option>
          </select>
        </label>
        <label className="review-field">
          Selected original text or screenshot transcription
          <textarea
            name="payload"
            required
            rows={4}
            maxLength={64000}
            placeholder="Copy the relevant source wording here."
          />
        </label>
        <label className="review-field">
          Exact supporting excerpt
          <textarea
            name="excerpt"
            required
            rows={2}
            maxLength={4000}
            placeholder="Copy a passage exactly from the text above."
          />
        </label>
        <label className="review-field">
          Source link (optional)
          <input
            name="sourceUrl"
            type="url"
            maxLength={2048}
            placeholder="https://…"
          />
        </label>
        {kind === "USAGE" && (
          <div className="evidence-input-row">
            <label className="review-field">
              Metric
              <input
                name="metric"
                required
                maxLength={120}
                placeholder="Words dictated"
              />
            </label>
            <label className="review-field">
              Value
              <input name="value" required type="number" min="0" step="any" />
            </label>
            <label className="review-field">
              Unit
              <input name="unit" required maxLength={80} placeholder="words" />
            </label>
          </div>
        )}
        {kind === "SUBSCRIPTION" && (
          <label className="review-field">
            Plan shown in your account
            <input name="plan" required maxLength={200} />
          </label>
        )}
        {kind === "PAYMENT" && (
          <div className="evidence-input-row">
            <label className="review-field">
              Amount paid
              <input name="amount" required type="number" min="0" step="any" />
            </label>
            <label className="review-field">
              Currency (unknown if blank)
              <input
                name="currency"
                minLength={3}
                maxLength={3}
                pattern="[A-Za-z]{3}"
                placeholder="USD"
              />
            </label>
          </div>
        )}
        {kind !== "USAGE" && (
          <label className="review-field">
            Billing period
            <select name="billingCadence" defaultValue="UNKNOWN">
              <option value="UNKNOWN">Unknown</option>
              <option value="MONTHLY">Monthly</option>
              <option value="ANNUAL">Annual</option>
              <option value="ONE_TIME">One-time</option>
            </select>
          </label>
        )}
        <label className="review-field">
          Who does this describe?
          <select name="scope" required defaultValue="UNKNOWN">
            <option value="UNKNOWN">Unknown</option>
            <option value="PERSONAL">Me personally</option>
            <option value="ORGANIZATION">An organization</option>
          </select>
        </label>
        <div className="evidence-input-row">
          <label className="review-field">
            Event date (if stated)
            <input name="date" type="date" />
          </label>
          <label className="review-field">
            Period starts (if stated)
            <input name="periodStart" type="date" />
          </label>
          <label className="review-field">
            Period ends (if stated)
            <input name="periodEnd" type="date" />
          </label>
        </div>
        <p className="evidence-meta">
          Leave unknown dates blank. Collection time is recorded separately.
          Values you enter are labeled “Supplied by you” and await your verdict.
        </p>
        <button className="secondary-action" disabled={busy}>
          Save private evidence
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
    </details>
  );
}

function ClaimHistory({
  propId,
  rawEvidenceId,
  observationIndex,
}: {
  propId: Id<"props">;
  rawEvidenceId: Id<"rawEvidence">;
  observationIndex: number;
}) {
  const history = usePaginatedQuery(
    api.privateEvidence.history,
    { propId, rawEvidenceId, observationIndex },
    { initialNumItems: 5 },
  );
  return (
    <>
      {history.results.length === 0 && <p>No saved verdicts yet.</p>}
      <ol className="claim-history">
        {history.results.map((review) => (
          <li key={review._id}>
            <strong>{review.verdict.toLowerCase()}</strong> ·{" "}
            <time dateTime={review.reviewedAt}>
              {review.reviewedAt.replace("T", " ")}
            </time>
            {review.correction && <blockquote>{review.correction}</blockquote>}
          </li>
        ))}
      </ol>
      {history.status === "CanLoadMore" && (
        <button
          type="button"
          className="secondary-action"
          onClick={() => history.loadMore(10)}
        >
          Earlier verdicts
        </button>
      )}
    </>
  );
}

function ReviewHistory({
  propId,
  rawEvidenceId,
  observationIndex,
}: {
  propId: Id<"props">;
  rawEvidenceId: Id<"rawEvidence">;
  observationIndex: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Verdict history</summary>
      {open && (
        <ClaimHistory
          propId={propId}
          rawEvidenceId={rawEvidenceId}
          observationIndex={observationIndex}
        />
      )}
    </details>
  );
}

export function PrivateEvidencePanel({
  propId,
  productName,
  productSlug,
  disabled = false,
  onUseStartDate,
}: {
  propId: Id<"props">;
  productName: string;
  productSlug: string;
  disabled?: boolean;
  onUseStartDate?: (date: string) => void;
}) {
  const evidence = usePaginatedQuery(
    api.privateEvidence.listForProp,
    { propId },
    { initialNumItems: 10 },
  );
  const save = useMutation(api.privateEvidence.submit);
  const review = useMutation(api.onboarding.reviewClaim);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const locked = disabled || busy;
  async function run(operation: () => Promise<unknown>, result: string) {
    setBusy(true);
    setMessage("");
    try {
      await operation();
      setMessage(result);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Evidence could not be saved.",
      );
      throw error;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="private-evidence"
      aria-label={`${productName} private evidence review`}
    >
      <h4>My subscription, payments &amp; usage</h4>
      <p>
        Private, evidence-backed observations. Review each one before making any
        public statement.
      </p>
      <PrivateEvidenceIntake
        productSlug={productSlug}
        busy={locked}
        onSubmit={(input) =>
          run(
            () => save({ propId, ...input }),
            "Evidence saved privately. Original text preserved; choose your verdict below.",
          )
        }
      />
      {evidence.status === "LoadingFirstPage" ? (
        <p role="status">Loading private evidence…</p>
      ) : (
        evidence.results.length === 0 && (
          <>
            <p>
              No personal subscription, payment, or usage evidence is attached
              to this card.
            </p>
            <EvidenceInstructions productSlug={productSlug} />
          </>
        )
      )}
      {evidence.results.map((entry) => (
        <div key={entry.raw._id} className="private-source">
          <p className="evidence-meta">
            {entry.source?.label ?? "Private evidence"} · collected{" "}
            {entry.raw.capturedAt.replace("T", " ")}
          </p>
          {entry.raw.sourceUrl && (
            <a href={entry.raw.sourceUrl} target="_blank" rel="noreferrer">
              Source link ↗
            </a>
          )}
          {entry.raw.payload && (
            <details>
              <summary>Retained original text</summary>
              <pre className="raw-evidence">{entry.raw.payload}</pre>
            </details>
          )}
          {entry.claims.length === 0 && (
            <p>
              No structured observation has been extracted from this evidence.
              Use the source to add an observation; dates remain unknown.
            </p>
          )}
          {entry.claims.map((claim) => {
            const observation: EvidenceObservation = claim.observation;
            return (
              <div
                className="evidence-claim"
                key={`${entry.raw._id}:${claim.observationIndex}`}
              >
                <strong>
                  {claimLabels[observation.kind]} ·{" "}
                  {formatObservation(observation)}
                </strong>
                <p>
                  {acquisitionLabels[observation.acquisition]} ·{" "}
                  {observation.scope.toLowerCase()} scope
                </p>
                <blockquote>{observation.excerpt}</blockquote>
                <p>{claimCaveat(observation.kind)}</p>
                <form
                  key={claim.review?._id ?? "unreviewed"}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    void (async () => {
                      try {
                        await run(
                          () =>
                            review({
                              propId,
                              rawEvidenceId: entry.raw._id,
                              observationIndex: claim.observationIndex,
                              verdict: String(
                                form.get("verdict"),
                              ) as (typeof claimVerdicts)[number],
                              correction:
                                String(form.get("correction") ?? "").trim() ||
                                undefined,
                            }),
                          "Verdict saved privately. Original evidence and previous verdicts preserved.",
                        );
                      } catch {
                        /* Error is shown below. */
                      }
                    })();
                  }}
                >
                  <label className="review-field">
                    Your verdict
                    <select
                      name="verdict"
                      disabled={locked}
                      required
                      defaultValue={claim.review?.verdict ?? ""}
                    >
                      <option value="" disabled>
                        Choose a verdict
                      </option>
                      {claimVerdicts.map((verdict) => (
                        <option key={verdict} value={verdict}>
                          {verdict.charAt(0) + verdict.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="review-field">
                    Correction or context (optional)
                    <textarea
                      name="correction"
                      disabled={locked}
                      maxLength={4000}
                      rows={2}
                      defaultValue={claim.review?.correction ?? ""}
                    />
                  </label>
                  <button className="secondary-action" disabled={locked}>
                    Save claim review
                  </button>
                </form>
                <ReviewHistory
                  propId={propId}
                  rawEvidenceId={entry.raw._id}
                  observationIndex={claim.observationIndex}
                />
                {onUseStartDate && <ObservedStartDateAction
                  observation={observation}
                  verdict={claim.review?.verdict}
                  disabled={locked}
                  onUseStartDate={onUseStartDate}
                />}
              </div>
            );
          })}
        </div>
      ))}
      {evidence.status === "CanLoadMore" && (
        <button
          type="button"
          className="secondary-action"
          disabled={locked}
          onClick={() => evidence.loadMore(10)}
        >
          Load more evidence
        </button>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}

export function ObservedStartDateAction({
  observation,
  verdict,
  disabled = false,
  onUseStartDate,
}: {
  observation: EvidenceObservation;
  verdict?: (typeof claimVerdicts)[number];
  disabled?: boolean;
  onUseStartDate: (date: string) => void;
}) {
  if (!canUseAsStart(observation, verdict) || !observation.date) return null;
  return (
    <button
      type="button"
      className="secondary-action"
      disabled={disabled}
      onClick={() => onUseStartDate(observation.date!)}
    >
      Use this observed date as my start date
    </button>
  );
}
