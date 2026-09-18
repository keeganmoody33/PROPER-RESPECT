"use client";

import { useState } from "react";
import {
  ProductKnowledgeView,
  type KnowledgeViewState,
} from "@/components/product-knowledge-panel";
import {
  ObservedStartDateAction,
  PrivateEvidenceIntake,
} from "@/components/private-evidence-panel";
import { formatObservation } from "@/src/domain/evidence-claims";
import type { PrivateEvidenceInput } from "@/src/domain/private-evidence";
import type { Id } from "@/convex/_generated/dataModel";

// Synthetic browser fixture. No account, backend persistence, or real owner data.
const observation = {
  _id: "synthetic-observation" as Id<"productObservations">,
  capturedAt: "2026-09-16T12:00:00.000Z",
  parserVersion: "fixture-v1",
  facts: {
    tiers: [
      {
        name: "Example plan",
        option: "Synthetic example",
        excerpt: "Example plan: $12 per month, billed annually.",
        features: ["Example feature"],
        prices: [
          {
            amount: 12,
            currency: "USD",
            displayBasis: "MONTH" as const,
            billingCadence: "YEAR" as const,
            perSeat: true,
            availability: "LISTED" as const,
            excerpt: "$12 per month, billed annually.",
          },
        ],
        allowances: [
          {
            metric: "words",
            value: 2000,
            unit: "words",
            period: "WEEK",
            platform: "desktop",
            excerpt: "2,000 words per week on desktop.",
          },
        ],
        overage: "UNKNOWN",
      },
    ],
    documentation: [],
    effectiveDate: null,
  },
};

export function EvidenceFixture() {
  const [watched, setWatched] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState<PrivateEvidenceInput>();
  const [publishing, setPublishing] = useState(false);
  const [startDate, setStartDate] = useState("2026-01-01");
  const state: KnowledgeViewState = {
    supported: true,
    sources: [
      {
        source: {
          _id: "synthetic-source" as Id<"productSources">,
          label: "Synthetic official-source example",
          canonicalUrl: "https://wisprflow.ai/pricing",
        },
        watchEnabled: watched,
        latestObservation: observation,
        latestRun: {
          status: failed ? "ERROR" : "BASELINE",
          capturedAt: observation.capturedAt,
        },
        history: [
          observation,
          {
            ...observation,
            _id: "synthetic-older" as Id<"productObservations">,
            capturedAt: "2026-09-15T12:00:00.000Z",
          },
        ],
      },
    ],
  };
  return (
    <main className="onboarding-shell">
      <h1>Evidence review browser fixture</h1>
      <p>Synthetic local test data. Nothing is saved to an account.</p>
      <h2>Owner review</h2>
      <article className="review-card">
        <h3>Wispr Flow</h3>
        <ProductKnowledgeView
          state={state}
          onRefresh={setWatched}
          onDiscover={() => setFailed(true)}
        />
        <section className="private-evidence">
          <h4>Private account evidence</h4>
          <PrivateEvidenceIntake
            productSlug="wisprflow"
            onSubmit={async (input) => {
              setSaved(input);
            }}
          />
          {saved && (
            <div role="status">
              <p>Fixture accepted privately</p>
              <p>{formatObservation(saved.observations[0])}</p>
              <pre className="raw-evidence">{saved.payload}</pre>
            </div>
          )}
          <div aria-label="Synthetic deferred publish regression">
            <p>Synthetic publish-race fixture. No account or backend mutation is used.</p>
            <p>Selected start date: {startDate}</p>
            <button
              type="button"
              className="primary-action"
              disabled={publishing}
              onClick={() => setPublishing(true)}
            >
              Begin synthetic publish
            </button>
            {publishing && (
              <button
                type="button"
                className="secondary-action"
                onClick={() => setPublishing(false)}
              >
                Finish synthetic publish
              </button>
            )}
            <ObservedStartDateAction
              observation={{
                kind: "FIRST_USE",
                date: "2026-09-16",
                excerpt: "First used on 2026-09-16",
                scope: "PERSONAL",
                acquisition: "USER_SUPPLIED",
              }}
              verdict="CORRECT"
              disabled={publishing}
              onUseStartDate={setStartDate}
            />
          </div>
        </section>
      </article>
    </main>
  );
}
