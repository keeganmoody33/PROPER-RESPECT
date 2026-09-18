export type ParserKind = "PRICING" | "PLANS" | "USAGE" | "EXPORT" | "BILLING";
export type ProviderKey = "wispr-flow";
export type SourceDefinition = {
  key: string;
  provider: ProviderKey;
  label: string;
  canonicalUrl: string;
  allowedHosts: readonly string[];
  parser: ParserKind;
};
const docBase = "https://docs.wisprflow.ai/articles/";
export const sourceDefinitions: readonly SourceDefinition[] = [
  {
    key: "wispr-pricing",
    provider: "wispr-flow",
    label: "Official pricing",
    canonicalUrl: "https://wisprflow.ai/pricing",
    allowedHosts: ["wisprflow.ai", "www.wisprflow.ai"],
    parser: "PRICING",
  },
  {
    key: "wispr-plans",
    provider: "wispr-flow",
    label: "Official plan documentation",
    canonicalUrl: docBase + "9559327591-flow-plans-and-what-s-included",
    allowedHosts: ["docs.wisprflow.ai"],
    parser: "PLANS",
  },
  {
    key: "wispr-usage",
    provider: "wispr-flow",
    label: "Personal usage screenshot instructions",
    canonicalUrl:
      docBase +
      "8760230576-your-usage-tab-track-your-dictation-stats-in-wispr-flow",
    allowedHosts: ["docs.wisprflow.ai"],
    parser: "USAGE",
  },
  {
    key: "wispr-export",
    provider: "wispr-flow",
    label: "Enterprise admin CSV instructions",
    canonicalUrl:
      docBase +
      "2356896572-admin-usage-v2-team-members-table-and-words-dictated-csv-export",
    allowedHosts: ["docs.wisprflow.ai"],
    parser: "EXPORT",
  },
  {
    key: "wispr-billing",
    provider: "wispr-flow",
    label: "Subscription and invoice instructions",
    canonicalUrl:
      docBase +
      "4152811715-manage-your-billing-invoices-company-details-payment-method-and-cancellation",
    allowedHosts: ["docs.wisprflow.ai"],
    parser: "BILLING",
  },
];
