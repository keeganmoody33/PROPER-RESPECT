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
