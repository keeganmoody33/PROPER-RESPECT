import { describe, expect, it } from "vitest";
import { rankQueue, rankTier } from "./walkthrough-rank";
import { walkthroughQueue, type WalkthroughCard } from "./walkthrough";

let next = 0;
function card(name: string, prop: Partial<WalkthroughCard["prop"]> = {}): WalkthroughCard {
  const slug = name.toLowerCase();
  next += 1;
  return { product: { name, slug, domain: `${slug}.com` },
    prop: { _id: `prop-${slug}-${next}`, productId: `product-${slug}`, status: "TESTING", visibility: "DRAFT", headline: "", note: "", ...prop } };
}
const mail = (count: number, capturedAt = "2026-10-01T00:00:00Z") => Array.from({ length: count }, () => ({ sourceType: "GMAIL", capturedAt }));

describe("the rapid fire order", () => {
  it("asks measured, connected, paid, typed, then email, then the rest in collection order", () => {
    const other1 = card("Zapier"), emailed = card("Exa"), typed = card("Clay", { ownerEntered: true }), paid = card("Figma");
    const connected = card("GitHub"), measured = card("Claude Code", { activityEvidenceId: "raw-1" }), other2 = card("Asana");
    const queue = walkthroughQueue([other1, emailed, typed, paid, connected, measured, other2]);
    const signals = {
      [emailed.prop._id]: mail(2), [paid.prop._id]: [{ sourceType: "BILLING" }], [connected.prop._id]: [{ sourceType: "GITHUB" }],
    };
    expect(rankQueue(queue, signals).map(item => item.card.product.name)).toEqual(["Claude Code", "GitHub", "Figma", "Clay", "Exa", "Zapier", "Asana"]);
  });

  it("counts a sanitized measurements upload as measured usage", () => {
    const [item] = walkthroughQueue([card("Codex")]);
    expect(rankTier(item, [{ sourceType: "FILE_UPLOAD", adapterId: "sanitized-measurements" }])).toBe(0);
  });

  it("orders email by originals, capped so one noisy sender can't win, then newest, then name", () => {
    const loud = card("Loud"), quiet = card("Quiet"), capped = card("Capped"), newer = card("Newer");
    const queue = walkthroughQueue([quiet, loud, capped, newer]);
    const signals = {
      [loud.prop._id]: mail(40, "2026-01-01T00:00:00Z"), [capped.prop._id]: mail(10, "2026-01-01T00:00:00Z"),
      [newer.prop._id]: mail(10, "2026-09-01T00:00:00Z"), [quiet.prop._id]: mail(1),
    };
    expect(rankQueue(queue, signals).map(item => item.card.product.name)).toEqual(["Newer", "Capped", "Loud", "Quiet"]);
  });

  it("never adds or drops a tool", () => {
    const queue = walkthroughQueue([card("A"), card("B"), card("C")]);
    expect(rankQueue(queue, {}).map(item => item.propId).sort()).toEqual(queue.map(item => item.propId).sort());
  });
});
