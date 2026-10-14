import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RetainedAggregateChoice, retainedAggregateChoice } from "@/components/retained-aggregate-choice";

describe("retained aggregate choice", () => {
  it("records public or private and personal or former-employer without using an address", () => {
    expect(retainedAggregateChoice({ display: "public", distinction: "former-employer" })).toEqual({
      display: "public",
      distinction: "former-employer",
    });
    expect(retainedAggregateChoice({ display: "private", distinction: "personal" })).toEqual({
      display: "private",
      distinction: "personal",
    });
    expect(retainedAggregateChoice({ display: "public", distinction: "ada@acme.example" })).toEqual({
      display: "public",
    });
    expect(retainedAggregateChoice({ display: "public", distinction: "" })).toEqual({ display: "public" });

    let saved: unknown;
    const html = renderToStaticMarkup(createElement(RetainedAggregateChoice, {
      address: "ada@acme.example",
      display: undefined,
      distinction: undefined,
      disabled: false,
      onSave: choice => { saved = choice; },
    }));
    expect(html).toContain("Public");
    expect(html).toContain("Private");
    expect(html).toContain("Personal");
    expect(html).toContain("Former employer");
    expect(html).not.toContain("ada@acme.example");
    expect(html).not.toContain("acme");
    expect(html).not.toContain("value=\"former-employer\" checked");
    const choice = retainedAggregateChoice({ display: "public", distinction: "personal" });
    expect(choice).toEqual({ display: "public", distinction: "personal" });
    saved = choice;
    expect(saved).toEqual({ display: "public", distinction: "personal" });
    expect(JSON.stringify(saved)).not.toContain("@");
  });

  it("lives in private mailbox settings and not on the public profile page", () => {
    const settings = readFileSync(new URL("../../components/mailbox-management.tsx", import.meta.url), "utf8");
    const page = readFileSync(new URL("../../app/[handle]/page.tsx", import.meta.url), "utf8");
    expect(settings).toContain("RetainedAggregateChoice");
    expect(settings).toContain("setRetainedAggregateDisplay");
    expect(page).not.toContain("RetainedAggregateChoice");
    expect(page).not.toContain("setRetainedAggregateDisplay");
  });
});
