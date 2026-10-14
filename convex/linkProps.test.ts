// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";

const giveLinkProp = makeFunctionReference<"mutation">("linkProps:give");
const listLinkProps = makeFunctionReference<"query">("linkProps:listForProfile");
import type { PublicProfile } from "../src/domain/public-profile";

const modules = import.meta.glob("./**/*.ts");
const storedUrl = "https://example.com/owner-selected";

function profile(type: "AFFILIATE" | "REFERRAL" | "CANONICAL"): PublicProfile {
  return {
    handle: "person",
    displayName: "Person",
    bio: "",
    cards: [{
      product: { name: "Example Product", slug: "example-product", domain: "example.com", description: "A synthetic published product." },
      status: "ACTIVE",
      headline: "Published relationship.",
      note: "Published note.",
      primaryLink: { type, url: storedUrl, label: "Visit Example Product" },
    }],
  };
}

async function published(type: "AFFILIATE" | "REFERRAL" | "CANONICAL") {
  const t = convexTest(schema, modules);
  await t.run(async ctx => {
    await ctx.db.insert("users", { authSubject: "giver", handle: "giver", displayName: "Giver", bio: "" });
    await ctx.db.insert("publishedProfiles", { handle: "person", revision: 1, publishedAt: "2026-10-13T00:00:00.000Z", profile: profile(type) });
  });
  return { t, giver: t.withIdentity({ subject: "giver" }) };
}

test.each(["AFFILIATE", "REFERRAL"] as const)("a signed-in account sees a prop from the stored %s link", async type => {
  const { t, giver } = await published(type);
  const disclosure = type === "AFFILIATE" ? "Affiliate link" : "Referral link";
  const given = await giver.mutation(giveLinkProp, { handle: "person", productSlug: "example-product" });
  expect(given).toEqual({ productName: "Example Product", productSlug: "example-product", disclosure, url: storedUrl, count: 1 });
  expect(await giver.query(listLinkProps, { handle: "person" })).toEqual([given]);
  await expect(t.query(listLinkProps, { handle: "person" })).rejects.toThrow("Authentication required.");
  const rows = await t.run(ctx => ctx.db.query("linkCredits").collect());
  expect(rows.map(row => row.sourceUrl)).toEqual([storedUrl]);
});

test("a card without a stored affiliate or referral link gains no prop", async () => {
  const { t, giver } = await published("CANONICAL");
  await expect(giver.mutation(giveLinkProp, { handle: "person", productSlug: "example-product" })).rejects.toThrow("This card has no stored affiliate or referral link.");
  expect(await t.run(ctx => ctx.db.query("linkCredits").collect())).toEqual([]);
});
