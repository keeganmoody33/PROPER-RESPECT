// How Proper Respect's evidence should be read. One source for the agent
// guide (src/server/agent-instructions.ts) and the methodology page
// (/about/methodology), so the two can't drift apart.

export const evidenceRulesHeading = "Interpreting evidence and activity";

export const evidenceRules: readonly string[] = [
  "A product relationship is an owner's stated relationship with a tool. It does not by itself establish a measured amount of activity.",
  "Read activity with its supplied metric name, unit, measurement period, attribution scope, capture time, freshness, and provenance. Missing periods or coverage remain unknown; do not infer continuous use or complete source coverage.",
  "A marketing mention, signup, payment, and usage event establish different things. Signup does not establish first use. Payment does not establish activity during the billing period.",
  "Owner testimony is an owner assertion. Review or publication does not turn it into independent source verification.",
  "A retrieval route does not change the original evidence meaning. An agent-performed action must not be treated as human activity; unknown actors remain unknown.",
  "Synthetic fixtures and prototype activity are not evidence of a person's actual use.",
];
