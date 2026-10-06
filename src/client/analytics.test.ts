import { describe, expect, it } from "vitest";
import { isPrivateReplayPath, sanitizeAnalyticsEvent } from "./analytics";

describe("session replay route gate", () => {
  it.each(["/app", "/app/collection", "/app/collection/abc", "/sign-in", "/sign-in/factor-one", "/sign-up", "/onboarding"])(
    "keeps %s out of replay", path => {
      expect(isPrivateReplayPath(path)).toBe(true);
    });

  it.each(["/", "/about", "/keegan", "/apple", "/application", "/agents.md"])("records public route %s", path => {
    expect(isPrivateReplayPath(path)).toBe(false);
  });
});

describe("private-route event sanitizer", () => {
  const origin = "https://proper-respect.com";

  it("drops autocapture, clicks, vitals and errors raised on a private route", () => {
    for (const event of ["$autocapture", "$dead_click", "$rageclick", "$web_vitals", "$exception", "custom_event"]) {
      expect(sanitizeAnalyticsEvent({ event, properties: { $current_url: `${origin}/app/collection/rel_123`, $pathname: "/app/collection/rel_123" } })).toBeNull();
    }
  });

  it("keeps private pageviews but collapses the URL to the route prefix", () => {
    const out = sanitizeAnalyticsEvent({ event: "$pageview", properties: {
      $current_url: `${origin}/app/collection/rel_123?tab=evidence`, $pathname: "/app/collection/rel_123", $title: "Notion — My collection",
    } });
    expect(out?.properties).toMatchObject({ $current_url: `${origin}/app`, $pathname: "/app" });
    expect(JSON.stringify(out)).not.toContain("rel_123");
    expect(out?.properties).not.toHaveProperty("$title");
  });

  it("scrubs a private previous page from a public event", () => {
    const out = sanitizeAnalyticsEvent({ event: "$pageview", properties: {
      $current_url: `${origin}/about`, $pathname: "/about", $prev_pageview_pathname: "/app/collection/rel_123",
      $prev_pageview_url: `${origin}/app/collection/rel_123`, $referrer: `${origin}/sign-in/factor-one`,
    }, $set: { $current_url: `${origin}/app/collection/rel_123` } });
    expect(JSON.stringify(out)).not.toContain("rel_123");
    expect(JSON.stringify(out)).not.toContain("factor-one");
    expect(out?.properties.$pathname).toBe("/about");
  });

  it("leaves public events untouched", () => {
    const event = { event: "$autocapture", properties: { $current_url: `${origin}/about`, $pathname: "/about", $el_text: "Read more" } };
    expect(sanitizeAnalyticsEvent(structuredClone(event))).toEqual(event);
  });
});
