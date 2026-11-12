import { expect, test } from "vitest";
import { isHttpUrl } from "@/src/domain/http-url";
import { directoryEntry } from "@/src/domain/product-directory";
import { homepageExamples } from "./homepage-examples";

const examples = homepageExamples();
const YEAR_DIGITS = 4;
const DAYS_IN_YEAR = 365;
// The same sample calendar the homepage has shown since 2026-09-21.
const SAMPLE_CONTRIBUTIONS = 859;

test("the homepage shows a go-to-market engineering stack whose names and links come from the directory", () => {
  expect(examples.map(example => [example.card.product.name, example.card.status, example.card.startedAt?.slice(0, YEAR_DIGITS)])).toEqual([
    ["GitHub", "ACTIVE", "2016"],
    ["Claude Code", "ACTIVE", "2025"],
    ["Exa", "ACTIVE", "2025"],
    ["Spider", "TESTING", "2026"],
    ["HubSpot", "ACTIVE", "2021"],
    ["Apollo.io", "ACTIVE", "2023"],
    ["Clay", "ARCHIVED", "2022"],
    ["n8n", "TESTING", "2026"],
    ["Gong", "ACTIVE", "2024"],
  ]);
  const fromDirectory = examples.map(({ id }) => {
    const entry = directoryEntry(id)!;
    return { product: { name: entry.name, slug: entry.slug, domain: entry.domain, description: entry.description }, link: { type: "CANONICAL", url: entry.website, label: `Open ${entry.name}` }, category: entry.category };
  });
  expect(examples.map(({ card }) => ({ product: { ...card.product, logoUrl: undefined }, link: card.primaryLink })))
    .toEqual(fromDirectory.map(({ product, link }) => ({ product: { ...product, logoUrl: undefined }, link })));
  expect(examples.every(({ card }) => isHttpUrl(card.primaryLink!.url))).toBe(true);
  expect(fromDirectory.filter(({ category }) => category === "CONSUMER")).toEqual([]);
  expect(examples.map(example => example.id)).not.toEqual(expect.arrayContaining(["notebooklm"]));
  expect(examples.map(example => example.id)).not.toEqual(expect.arrayContaining(["wisprflow"]));
});

test("only GitHub carries sample usage: its contribution calendar covers one year", () => {
  expect(examples.filter(example => example.card.activity).map(example => example.id)).toEqual(["github"]);
  const activity = examples[0].card.activity;
  if (activity?.kind !== "contributionCalendar") throw new Error("GitHub sample calendar missing");
  expect(activity.days).toHaveLength(DAYS_IN_YEAR);
  expect(activity.days[0]).toEqual({ date: "2025-09-01", count: 0, level: 0 });
  expect(activity.days.at(-1)?.date).toBe("2026-08-31");
  expect(activity.total).toBe(SAMPLE_CONTRIBUTIONS);
  expect(activity.days.reduce((sum, day) => sum + day.count, 0)).toBe(SAMPLE_CONTRIBUTIONS);
  expect(examples[0].source?.href).toBe("https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference");
});
