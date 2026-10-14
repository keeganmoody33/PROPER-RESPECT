import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import HomePage from "@/app/page";

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
