import { describe, expect, it } from "vitest";
import { evidenceRules, evidenceRulesHeading } from "./evidence-rules";
import { agentInstructions } from "../server/agent-instructions";
import { trustDocuments, trustMarkdown } from "../server/trust-pages";

// The agent guide's rules as they read before R12 moved them. Pinned verbatim
// so moving them to one source can't change what agents are told.
const agentRulesBlock = "## Interpreting evidence and activity\n\n- A product relationship is an owner's stated relationship with a tool. It does not by itself establish a measured amount of activity.\n- Read activity with its supplied metric name, unit, measurement period, attribution scope, capture time, freshness, and provenance. Missing periods or coverage remain unknown; do not infer continuous use or complete source coverage.\n- A marketing mention, signup, payment, and usage event establish different things. Signup does not establish first use. Payment does not establish activity during the billing period.\n- Owner testimony is an owner assertion. Review or publication does not turn it into independent source verification.\n- A retrieval route does not change the original evidence meaning. An agent-performed action must not be treated as human activity; unknown actors remain unknown.\n- Synthetic fixtures and prototype activity are not evidence of a person's actual use.";

describe("evidence rules", () => {
  it("leave the agent instructions word for word unchanged", () => {
    expect(agentInstructions()).toContain(agentRulesBlock);
    expect(`## ${evidenceRulesHeading}\n\n${evidenceRules.map(rule => `- ${rule}`).join("\n")}`).toBe(agentRulesBlock);
  });

  it("appear in full on the methodology page, with the receipt file linked", () => {
    const markdown = trustMarkdown("methodology");
    for (const rule of evidenceRules) expect(markdown).toContain(rule);
    expect(markdown).toContain("https://github.com/keeganmoody33/PROPER-RESPECT/blob/receipts/receipts/github-refresh.jsonl");
    expect(trustDocuments.methodology.title).toBe("How evidence works");
    // Section 10's counting rules, so a reader can redo the count from the file.
    for (const rule of [
      "The line from the scheduled run is the one that counts",
      "a check started by hand the same UTC day stands in",
      "must hold a row for every daily refresh",
      "unless it leaves the refresh code unchanged",
      "deploying outside the tagged release process",
    ]) expect(markdown).toContain(rule);
    expect(markdown).toContain("08:17 UTC, a little over two hours after the 06:00 UTC refresh");
  });
});
