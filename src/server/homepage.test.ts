import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { expect, it, vi } from "vitest";
import { trustDocuments, trustMarkdown } from "./trust-pages";
import HomePage from "@/app/page";
import { homepageBrowse, homepageMarkdown } from "./agent-discovery";

const statements = [
  "A public profile can show a retained measurement you published, including how much, and withholds an amount you did not publish.",
  "More than one mailbox can be connected. Disconnect stops recording from that mailbox. A retained aggregate of personal and former-employer accounts can stay visible when you record it as public, with the stored label and no email address.",
  "A stored affiliate or referral link is disclosed on the card.",
];

it("the hero holds its one line, the one subline the owner chose and two actions, and nothing else outside the examples", () => {
  const $ = load(renderToStaticMarkup(HomePage()));
  const hero = $("section[aria-labelledby=homepage-title]").clone();
  hero.find("#example").remove();
  const lines = hero.find("p, h1, a, li").toArray().filter(element => !$(element).find("p, h1, a, li").length).map(element => $(element).text().trim());
  expect(lines).toEqual([
    "Every tool you've used counts.",
    "Even the ones you stopped. One page for what you run, what you've tested and what you've moved on from, with the usage behind it.",
    "Start your collection", "See Keegan’s tooling page",
  ]);
  // The examples carry no line of their own below the card either. Matches "Choose what to share", not "Choose a product example".
  // https://regex101.com/?regex=Keep%20your%20usage%20private%7CChoose%20what%20to%20share&testString=Choose%20what%20to%20share%0AChoose%20a%20product%20example
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
  const placed = [["privacy", statements[0]], ["privacy", statements[1]], ["terms", statements[2]]] as const;
  expect(placed.filter(([slug, statement]) => !trustMarkdown(slug).includes(statement))).toEqual([]);
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

it("points at search to see what other people run, on the page and in its markdown, after how it works", () => {
  vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://canonical.example");
  const $ = load(renderToStaticMarkup(HomePage()));
  const browse = $("section[aria-labelledby=browse-title]");
  expect(browse.find("h2").text()).toBe("See what other people run.");
  expect(browse.find("p").first().text()).toBe(homepageBrowse.body);
  expect(browse.find("a").map((_, link) => [[$(link).text(), $(link).attr("href")]]).get()).toEqual([["Search people and tools", "/search"]]);
  expect($("main > section").index(browse)).toBe($("main > section").index($("#how-it-works")) + 1);
  const markdown = homepageMarkdown();
  expect(markdown).toContain(`## See what other people run\n\n${homepageBrowse.body}`);
  expect(markdown).toContain("- [Search people and tools](https://canonical.example/search).");
  ["—", "–", " - "].forEach(dash => expect(browse.text()).not.toContain(dash));
  vi.unstubAllEnvs();
});
