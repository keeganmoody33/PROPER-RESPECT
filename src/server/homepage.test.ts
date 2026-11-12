import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import HomePage from "@/app/page";
import { homepageMarkdown } from "./agent-discovery";

const statements = [
  "A public profile can show a retained measurement you published, including how much, and withholds an amount you did not publish.",
  "More than one mailbox can be connected. Disconnect stops recording from that mailbox. A retained aggregate of personal and former-employer accounts can stay visible when you record it as public, with the stored label and no email address.",
  "A stored affiliate or referral link is disclosed on the card. A prop from that link shows on the profile only for a signed-in account.",
];

it("keeps the three proven statements on the first screen", () => {
  const html = renderToStaticMarkup(HomePage());
  const start = html.indexOf('id="homepage-title"');
  const end = html.indexOf('id="example"');
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const first = html.slice(start, end);
  for (const statement of statements) expect(first).toContain(statement);
  expect(first).not.toMatch(/Wispr|Clay|token spend|live site|already shows|finds affiliate|find affiliate/i);
});

it("keeps the same three statements in the homepage markdown", () => {
  const markdown = homepageMarkdown();
  const opening = markdown.slice(0, markdown.indexOf("## How it works"));
  expect(opening).not.toBe(markdown);
  for (const statement of statements) expect(opening).toContain(statement);
  expect(opening).not.toMatch(/Wispr|Clay|token spend|live site|already shows|finds affiliate|find affiliate/i);
});

const steps = [
  ["Pick your tools.", "Start from a role or search by name. Add anything that is missing by its name."],
  ["Say how you use each one.", "Mark what you use, what you are testing and what you used before. Save the whole list privately in one step."],
  ["Preview once, then share.", "See exactly what visitors will see. Approve that preview once to share your confirmed tools on your public page."],
];
const retired = ["Start with one tool", "connect a supported source", "measurement packet", "Wispr", "NotebookLM", "TIDAL"];

it("describes the same three steps of the flow that exists, on the page and in its markdown", () => {
  const html = renderToStaticMarkup(HomePage());
  const markdown = homepageMarkdown();
  expect(steps.map(([title, body]) => html.includes(`<h3>${title}</h3><p>${body}</p>`))).toEqual([true, true, true]);
  expect(markdown).toContain(steps.map(([title, body], index) => `${index + 1}. ${title} ${body}`).join("\n"));
  expect(retired.filter(text => html.includes(text) || markdown.includes(text))).toEqual([]);
});
