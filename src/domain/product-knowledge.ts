import { load } from "cheerio/slim";

/** Public statements only. Never account usage, invoices, or owner payment amounts. */
export type OfferingPrice = {
  amount: number | null;
  currency: string;
  displayBasis: "MONTH" | "YEAR" | "UNKNOWN";
  billingCadence: "MONTH" | "YEAR" | "UNKNOWN";
  perSeat: boolean | null;
  availability: "LISTED" | "CUSTOM" | "UNAVAILABLE" | "UNKNOWN";
  excerpt: string;
};
export type OfferingTier = {
  name: string;
  option: string;
  excerpt: string;
  features: string[];
  prices: OfferingPrice[];
  allowances: {
    metric: string;
    value: number | null;
    unit: string;
    period: string;
    platform: string;
    excerpt: string;
  }[];
  overage: string;
};
export type OfferingFacts = {
  tiers: OfferingTier[];
  documentation: {
    kind: string;
    scope: string;
    text: string;
    excerpt: string;
  }[];
  effectiveDate: string | null;
};
export type ParseResult = {
  complete: boolean;
  message?: string;
  normalizedText: string;
  facts: OfferingFacts;
  parserVersion: string;
};
import {
  sourceDefinitions,
  type ProviderKey,
  type SourceDefinition,
} from "./product-sources";
export { sourceDefinitions } from "./product-sources";
const WISPR_PARSER_VERSION = "wispr-v1-2026-09-16";
const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
const emptyFacts = (): OfferingFacts => ({
  tiers: [],
  documentation: [],
  effectiveDate: null,
});
const price = (excerpt: string, currency: string): OfferingPrice => ({
  amount: null,
  currency,
  displayBasis: "UNKNOWN",
  billingCadence: "UNKNOWN",
  perSeat: null,
  availability: "UNKNOWN",
  excerpt,
});
const tier = (name: string, option: string, excerpt: string): OfferingTier => ({
  name,
  option,
  excerpt,
  features: [],
  prices: [],
  allowances: [],
  overage: "UNKNOWN",
});

function parseWispr(definition: SourceDefinition, html: string): ParseResult {
  const $ = load(html);
  // This is a pure parser. Source instructions, links and scripts never become actions.
  $("script,style,noscript,nav,header,footer,svg").remove();
  // Insert textual boundaries consistently before both normalization and excerpt extraction.
  $("p,li,td,th,h1,h2,h3,h4,div,br").each((_, node) => {
    $(node).prepend(" ").append(" ");
  });
  const root =
    definition.parser === "PRICING"
      ? $(".w-tab-content, .pricing-table.v2")
      : $(".kb-article-body").first();
  const normalizedText = normalize(root.text());
  const facts = emptyFacts();
  const result: ParseResult = {
    complete: false,
    normalizedText,
    facts,
    parserVersion: WISPR_PARSER_VERSION,
  };
  const incomplete = (message: string) => ({ ...result, message });
  if (!normalizedText)
    return incomplete("Official article structure missing.");
  // Facts and their semantic key repeat this text. Bound bytes before building either;
  // the refresh action retains the original HTML separately for oversized captures.
  if (new TextEncoder().encode(normalizedText).byteLength > 64_000)
    return {
      ...incomplete("Official article oversized (64,000 UTF-8 byte limit)."),
      normalizedText: "",
    };
  if (definition.parser === "PRICING") {
    const limitRow = $(".pricing-row").filter(
      (_, el) =>
        normalize($(el).find(".pricing-feature-cell").text()) === "Word limit",
    );
    const limitCells = limitRow.find(".pricing-row-content");
    if (limitRow.length !== 1 || limitCells.length !== 4)
      return incomplete("Word allowance comparison structure changed.");
    for (const cadence of ["Monthly", "Annual"]) {
      const pane = $(`.w-tab-pane[data-w-tab="${cadence}"]`);
      if (
        pane.length !== 1 ||
        pane.find(".pricing-v2_card").length !== 4 ||
        new Set(
          pane
            .find(".pricing-v2_tag")
            .map((_, e) => normalize($(e).text()))
            .get(),
        ).size !== 4
      )
        return incomplete("Pricing card or billing toggle structure changed.");
      for (const node of pane.find(".pricing-v2_card").toArray()) {
        const card = $(node),
          name = normalize(card.find(".pricing-v2_tag").text());
        if (!["Free", "Pro", "Growth", "Enterprise"].includes(name))
          return incomplete("Unrecognized pricing tier.");
        const optionPrices = card.find(".pricing-v2_price").toArray();
        if (optionPrices.length !== (name === "Growth" ? 2 : 1))
          return incomplete("Product option price structure changed.");
        for (const priceNode of optionPrices) {
          const el = $(priceNode),
            excerpt = normalize(el.text());
          const option = el
            .find("[data-price]")
            .attr("data-price")
            ?.includes("notetaker")
            ? "Dictation + unlimited Notetaker"
            : name === "Growth"
              ? "Dictation"
              : "Standard";
          const row = tier(name, option, normalize(card.text()));
          row.features = card
            .find(".pricing_text-wrap")
            .map((_, e) => normalize($(e).text()))
            .get()
            .filter(Boolean)
            .sort();
          if (!row.features.length)
            return incomplete("Pricing features missing.");
          // A bare $ does not identify its currency. No cross-source reconciliation here.
          const p = price(
            excerpt,
            /\bUSD\b|US dollars?/i.test(normalizedText) ? "USD" : "UNKNOWN",
          );
          const amount = excerpt.match(/\$\s*([\d,]+(?:\.\d+)?)/);
          if (amount) {
            p.amount = Number(amount[1].replace(/,/g, ""));
            p.availability = "LISTED";
            p.displayBasis = /\/(?:user\/)?mo\b/.test(excerpt)
              ? "MONTH"
              : "UNKNOWN";
            p.billingCadence = cadence === "Annual" ? "YEAR" : "MONTH";
            p.perSeat = /\/user\//.test(excerpt);
          } else if (/custom/i.test(excerpt)) {
            p.availability =
              cadence === "Monthly" &&
              (card.closest("[monthly-unavailable]").length > 0 ||
                /Available annually/.test(row.excerpt))
                ? "UNAVAILABLE"
                : "CUSTOM";
            p.billingCadence = cadence === "Annual" ? "YEAR" : "UNKNOWN";
          } else return incomplete("Unrecognized price text.");
          if (name === "Free") p.billingCadence = "UNKNOWN";
          const allowanceText = normalize(
            limitCells
              .eq(["Free", "Pro", "Growth", "Enterprise"].indexOf(name))
              .text(),
          );
          if (name === "Free") {
            const limits = [
              ...allowanceText.matchAll(
                /(\d[\d,]*)\/week on (desktop|iPhone)/g,
              ),
            ];
            if (limits.length !== 2)
              return incomplete("Free word allowances no longer understood.");
            row.allowances = limits.map((m) => ({
              metric: "dictation",
              value: Number(m[1].replace(/,/g, "")),
              unit: "words",
              period: "WEEK",
              platform: m[2],
              excerpt: m[0],
            }));
          } else if (allowanceText === "Unlimited")
            row.allowances = [
              {
                metric: "dictation",
                value: null,
                unit: "words",
                period: "UNLIMITED",
                platform: "UNKNOWN",
                excerpt: allowanceText,
              },
            ];
          else return incomplete("Paid word allowance no longer understood.");
          row.prices = [p];
          facts.tiers.push(row);
        }
      }
    }
  } else if (definition.parser === "PLANS") {
    const table = root
      .find("table")
      .filter((_, el) =>
        /Plan.*Price \([A-Z]{3}\).*What you get/.test(
          normalize($(el).find("tr").first().text()),
        ),
      )
      .first();
    if (
      !table.length ||
      table.find("tr").length !== 5 ||
      new Set(
        table
          .find("tr")
          .slice(1)
          .map(
            (_, e) => normalize($(e).find("td").first().text()).split(" ")[0],
          )
          .get(),
      ).size !== 4
    )
      return incomplete("Official plans table headers or row count changed.");
    for (const node of table.find("tr").slice(1).toArray()) {
      const cells = $(node).find("td"),
        name = normalize(cells.eq(0).text()).match(
          /^(Free|Pro|Growth|Enterprise)\b/,
        )?.[1];
      if (!name || cells.length !== 3)
        return incomplete("Official plans table shape changed.");
      const excerpt = normalize($(node).text()),
        row = tier(name, "Standard", excerpt),
        amountText = normalize(cells.eq(1).text());
      row.features = [normalize(cells.eq(2).text())];
      if (!row.features[0])
        return incomplete("Official tier features missing.");
      const currency = normalize(table.find("tr").first().text()).match(
        /Price \(([A-Z]{3})\)/,
      )![1];
      if (name === "Pro") {
        const monthly = amountText.match(/\$([\d.]+)\/user\/month/),
          annual = amountText.match(/\$([\d.]+)(?:\/month)? billed annually/);
        if (!monthly || !annual)
          return incomplete("Pro billing terms could not be extracted.");
        row.prices.push({
          ...price(amountText, currency),
          amount: Number(monthly[1]),
          displayBasis: "MONTH",
          billingCadence: "MONTH",
          perSeat: true,
          availability: "LISTED",
        });
        // Only explicit same-source $N/month annual wording corroborates the table's shorthand.
        const explicitAnnual = new RegExp(
          `\\$${annual[1].replace(".", "\\.")}\\/month billed annually`,
        ).test(normalizedText);
        row.prices.push({
          ...price(amountText, currency),
          amount: Number(annual[1]),
          displayBasis: explicitAnnual ? "MONTH" : "UNKNOWN",
          billingCadence: "YEAR",
          perSeat: true,
          availability: "LISTED",
        });
      } else if (name === "Free") {
        if (!/^\$0(?:\s|$)/.test(amountText))
          return incomplete("Free price is no longer understood.");
        row.prices.push({
          ...price(amountText, currency),
          amount: 0,
          availability: "LISTED",
        });
      } else
        row.prices.push({
          ...price(amountText, currency),
          availability: /custom/i.test(amountText) ? "CUSTOM" : "UNKNOWN",
          perSeat: /per-seat/i.test(amountText) ? true : null,
        });
      facts.tiers.push(row);
    }
    // Source-scoped terms preserve feature conflicts and policy changes beyond the table.
    facts.documentation = [
      {
        kind: "PLAN_TERMS",
        scope: "PUBLIC_PRODUCT",
        text: normalizedText,
        excerpt: normalizedText,
      },
    ];
  } else {
    const requirements = {
      USAGE: [/Your Usage/i, /Insights/i, /total words/i],
      EXPORT: [/Enterprise/i, /CSV/i, /admin/i],
      BILLING: [/billing portal/i, /invoice/i, /subscription/i],
    }[definition.parser];
    if (!requirements || !requirements.every((p) => p.test(normalizedText)))
      return incomplete(
        "Documentation content no longer matches its expected purpose.",
      );
    facts.documentation = [
      {
        kind: definition.parser,
        scope:
          definition.parser === "EXPORT"
            ? "ORGANIZATION_ADMIN"
            : "OWNER_SELECTED_EVIDENCE",
        text: normalizedText,
        excerpt: normalizedText,
      },
    ];
  }
  // Numeric limits are captured only with explicit source context, never as actual usage.
  for (const row of facts.tiers) {
    if (
      !row.allowances.length &&
      /Unlimited dictations/i.test(row.features.join(" "))
    )
      row.allowances.push({
        metric: "dictation",
        value: null,
        unit: "words",
        period: "UNLIMITED",
        platform: "UNKNOWN",
        excerpt: row.features.find((f) => /Unlimited dictations/i.test(f))!,
      });
    if (row.name === "Free")
      for (const match of normalizedText.matchAll(
        /(\d[\d,]*) words (?:per week|weekly) (?:on|for) (desktop|iPhone|iOS)/gi,
      ))
        row.allowances.push({
          metric: "dictation",
          value: Number(match[1].replace(/,/g, "")),
          unit: "words",
          period: "WEEK",
          platform: match[2],
          excerpt: match[0],
        });
  }
  const explicitDate = normalizedText.match(
    /(?:Effective|effective as of)\s+(\d{4}-\d{2}-\d{2})\b/,
  );
  facts.effectiveDate = explicitDate?.[1] ?? null;
  result.complete = true;
  return result;
}
/** Register another provider adapter here; persistence and owner UI are provider agnostic. */
export const providerAdapters: Record<
  ProviderKey,
  {
    parserVersion: string;
    matches: (product: { slug: string; domain: string }) => boolean;
    parse: (source: SourceDefinition, html: string) => ParseResult;
  }
> = {
  "wispr-flow": {
    parserVersion: WISPR_PARSER_VERSION,
    matches: (p) =>
      ["wispr-flow", "wispr", "wisprflow"].includes(p.slug) ||
      ["wisprflow.ai", "www.wisprflow.ai"].includes(p.domain.toLowerCase()),
    parse: parseWispr,
  },
};
export function definitionsForProduct(product: {
  slug: string;
  domain: string;
}) {
  return sourceDefinitions.filter((s) =>
    providerAdapters[s.provider]?.matches(product),
  );
}
export function sourceParserVersion(key: string) {
  const def = sourceDefinitions.find((s) => s.key === key);
  if (!def) throw new Error("Unregistered official source.");
  return providerAdapters[def.provider].parserVersion;
}
export function parseOfficialSource(key: string, html: string) {
  const def = sourceDefinitions.find((s) => s.key === key);
  if (!def) throw new Error("Unregistered official source.");
  return providerAdapters[def.provider].parse(def, html);
}
export const semanticKey = (facts: OfferingFacts) =>
  JSON.stringify({
    ...facts,
    tiers: facts.tiers
      .map(({ excerpt: _excerpt, ...t }) => {
        void _excerpt;
        return {
          ...t,
          features: [...t.features].sort(),
          prices: t.prices.map(({ excerpt: _e, ...p }) => {
            void _e;
            return p;
          }),
          allowances: t.allowances.map(({ excerpt: _e, ...a }) => {
            void _e;
            return a;
          }),
        };
      })
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  });
export async function sha256(input: string | ArrayBuffer): Promise<string> {
  const buffer = await crypto.subtle.digest(
    "SHA-256",
    typeof input === "string" ? new TextEncoder().encode(input) : input,
  );
  return Array.from(new Uint8Array(buffer), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function validateOfficialUrl(raw: string, definition: SourceDefinition) {
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !definition.allowedHosts.includes(url.hostname)
  )
    throw new Error("URL is not an allowed official HTTPS host.");
  return url.href;
}
export async function fetchOfficialSource(
  definition: SourceDefinition,
  fetcher: typeof fetch = fetch,
  limits: { maxBytes?: number; timeoutMs?: number } = {},
) {
  const registered = sourceDefinitions.find((s) => s.key === definition.key);
  if (!registered || registered.canonicalUrl !== definition.canonicalUrl)
    throw new Error("Unregistered official source.");
  const maxBytes = limits.maxBytes ?? 750_000,
    controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("Official fetch timeout."));
    }, limits.timeoutMs ?? 12_000);
  });
  const retrieve = async () => {
    let url = validateOfficialUrl(registered.canonicalUrl, registered);
    for (let hop = 0; hop <= 3; hop++) {
      const response = await fetcher(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: { Accept: "text/html" },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location || hop === 3)
          throw new Error("Official redirect limit or missing location.");
        url = validateOfficialUrl(new URL(location, url).href, registered);
        continue;
      }
      if (!response.ok)
        throw new Error(`Official fetch HTTP ${response.status}.`);
      const contentType = response.headers.get("content-type");
      if (
        contentType &&
        !/text\/html|application\/xhtml\+xml/i.test(contentType)
      )
        throw new Error("Official response is not HTML.");
      if (Number(response.headers.get("content-length")) > maxBytes) {
        await response.body?.cancel();
        throw new Error("Official response size limit exceeded.");
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Official response has no body.");
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          throw new Error("Official response size limit exceeded.");
        }
        chunks.push(value);
      }
      const body = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return {
        html: new TextDecoder().decode(body),
        rawBytes: body.buffer,
        finalUrl: url,
      };
    }
    throw new Error("Official redirect limit exceeded.");
  };
  try {
    return await Promise.race([retrieve(), timeout]);
  } finally {
    clearTimeout(timer!);
    controller.abort();
  }
}
