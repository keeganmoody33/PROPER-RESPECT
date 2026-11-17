import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { expect, it, vi } from "vitest";
import { trustDocuments, trustMarkdown } from "./trust-pages";
import HomePage from "@/app/page";
import { homepageMarkdown } from "./agent-discovery";

const statements = [
  "A public profile can show a retained measurement you published, including how much, and withholds an amount you did not publish.",
  "More than one mailbox can be connected. Disconnect stops recording from that mailbox. A retained aggregate of personal and former-employer accounts can stay visible when you record it as public, with the stored label and no email address.",
  "A stored affiliate or referral link is disclosed on the card. A prop from that link shows on the profile only for a signed-in account.",
];

it("the hero has no copy: outside the examples it has its one line and two actions, and nothing else", () => {
  const $ = load(renderToStaticMarkup(HomePage()));
  const hero = $("section[aria-labelledby=homepage-title]").clone();
  hero.find("#example").remove();
  const lines = hero.find("p, h1, a, li").toArray().filter(element => !$(element).find("p, h1, a, li").length).map(element => $(element).text().trim());
  expect(lines).toEqual(["Earn your respect.", "Start your collection", "View Keegan’s shared collection"]);
  // The examples carry no line of their own below the card either.
  expect($("#example").text()).not.toMatch(/Keep your usage private|Choose what to share/);
});

it("keeps the facts the hero dropped on the pages they belong to, and leaves them out of the homepage and its markdown", () => {
  vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://canonical.example");
  const html = renderToStaticMarkup(HomePage());
  const markdown = homepageMarkdown();
  expect(statements.filter(statement => html.includes(statement) || markdown.includes(statement))).toEqual([]);
  const paragraphs = (slug: "privacy" | "terms", heading: string) => trustDocuments[slug].sections.find(section => section.heading === heading)!.paragraphs;
  expect(paragraphs("privacy", "What becomes public")).toContain(statements[0]);
  expect(paragraphs("privacy", "Disconnecting and deleting are different")).toContain(statements[1]);
  expect(paragraphs("terms", "Disclose affiliate and referral links")).toContain(statements[2]);
  for (const [slug, statement] of [["privacy", statements[0]], ["privacy", statements[1]], ["terms", statements[2]]] as const) expect(trustMarkdown(slug)).toContain(statement);
  vi.unstubAllEnvs();
});

const steps = [
  ["Add your tools.", "Search by name. Add anything that is missing by its name."],
  ["Say how you use each one.", "Pick how often you use each one, from tried and dropped to daily. Save the whole list privately in one step."],
  ["Preview once, then share.", "See exactly what visitors will see. Approve that preview once to share your confirmed tools on your public page."],
];
const retired = ["Start from a role", "Start with one tool", "connect a supported source", "measurement packet", "Wispr", "NotebookLM", "TIDAL"];

it("describes the same three steps of the flow that exists, on the page and in its markdown", () => {
  const html = renderToStaticMarkup(HomePage());
  const markdown = homepageMarkdown();
  expect(steps.map(([title, body]) => html.includes(`<h3>${title}</h3><p>${body}</p>`))).toEqual([true, true, true]);
  expect(markdown).toContain(steps.map(([title, body], index) => `${index + 1}. ${title} ${body}`).join("\n"));
  expect(retired.filter(text => html.includes(text) || markdown.includes(text))).toEqual([]);
});
