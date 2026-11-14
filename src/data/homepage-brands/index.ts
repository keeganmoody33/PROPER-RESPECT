import { brandSiteTraitsSchema, type BrandSiteTraits } from "@/src/domain/brand-site-traits";
import { productBrandSnapshotSchema, type ProductBrandSnapshot } from "@/src/domain/product-brand";
import clay from "./clay.json";
import cloudflare from "./cloudflare.json";
import contextDev from "./context-dev.json";
import docker from "./docker.json";
import elicit from "./elicit.json";
import exa from "./exa.json";
import firecrawl from "./firecrawl.json";
import github from "./github.json";
import n8n from "./n8n.json";
import openPlaces from "./open-places.json";
import porkbun from "./porkbun.json";
import spider from "./spider.json";
import claySite from "./clay.site.json";
import cloudflareSite from "./cloudflare.site.json";
import contextDevSite from "./context-dev.site.json";
import dockerSite from "./docker.site.json";
import elicitSite from "./elicit.site.json";
import exaSite from "./exa.site.json";
import firecrawlSite from "./firecrawl.site.json";
import githubSite from "./github.site.json";
import n8nSite from "./n8n.site.json";
import openPlacesSite from "./open-places.site.json";
import spiderSite from "./spider.site.json";

/**
 * Brands for the homepage examples, pulled once from Context.dev and normalized by the same code that
 * stores a card's brand (scripts/pull-homepage-brands.mjs). Claude Code and Grok Bot have none: their
 * listed domains belong to a parent company, so the brand gate refuses them.
 */
const SNAPSHOTS: Readonly<Record<string, unknown>> = {
  clay, cloudflare, "context-dev": contextDev, docker, elicit, exa, firecrawl, github, n8n, "open-places": openPlaces, porkbun, spider,
};

export const HOMEPAGE_BRANDS: Readonly<Record<string, ProductBrandSnapshot>> = Object.fromEntries(
  Object.entries(SNAPSHOTS).map(([slug, snapshot]) => {
    const parsed = productBrandSnapshotSchema.safeParse(snapshot);
    if (!parsed.success) throw new Error(`src/data/homepage-brands/${slug}.json is not a valid brand snapshot: ${parsed.error.message}`);
    return [slug, parsed.data];
  }),
);

/**
 * What measuring each product's own site added, by scripts/pull-homepage-site-traits.mjs. Porkbun has none:
 * porkbun.com answered the measurement with a 403 bot-block page, and it is not asked again.
 */
const SITES: Readonly<Record<string, unknown>> = {
  clay: claySite, cloudflare: cloudflareSite, "context-dev": contextDevSite, docker: dockerSite, elicit: elicitSite, exa: exaSite,
  firecrawl: firecrawlSite, github: githubSite, n8n: n8nSite, "open-places": openPlacesSite, spider: spiderSite,
};

export const HOMEPAGE_SITE_TRAITS: Readonly<Record<string, BrandSiteTraits>> = Object.fromEntries(
  Object.entries(SITES).map(([slug, file]) => {
    const parsed = brandSiteTraitsSchema.safeParse(file);
    if (!parsed.success) throw new Error(`src/data/homepage-brands/${slug}.site.json is not a valid site-traits file: ${parsed.error.message}`);
    return [slug, parsed.data];
  }),
);
