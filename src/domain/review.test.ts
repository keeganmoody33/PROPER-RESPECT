import { describe, expect, it } from "vitest";
import { defaultReview, explicitPublicationCards, explicitPublicationReview, isCurrentReview, type ReviewCard } from "./review";
import type { ActivityModule } from "./public-profile";

const draft = {
  prop: { visibility: "DRAFT" as const, status: "TESTING" as const, headline: "Candidate", note: "Unreviewed evidence" },
  product: { domain: "example.com" },
  links: [{ isPrimary: true, type: "REFERRAL" as const, url: "https://example.com/referral", label: "My referral" }],
};

describe("review defaults", () => {
  it("does not turn an unreviewed candidate into active use or a publish selection", () => {
    expect(defaultReview(draft)).toMatchObject({ publish: false, status: "TESTING", approveActivity: false });
  });
  it("keeps a published archived product and its referral destination intact", () => {
    expect(defaultReview({ ...draft, prop: { ...draft.prop, visibility: "PUBLIC", status: "ARCHIVED" } })).toMatchObject({
      publish: true, status: "ARCHIVED", linkType: "REFERRAL", linkLabel: "My referral", linkUrl: "https://example.com/referral",
    });
  });
  it("does not infer public cost permission from a public card", () => {
    expect(defaultReview({ ...draft, prop: { ...draft.prop, visibility: "PUBLIC" } }).costVisibility).toBe("PRIVATE");
  });
});

const activity = (total: number): ActivityModule => ({ kind: "contributionCalendar", total, days: [],
  attributionScope: "PERSONAL", capturedAt: "2026-09-18T12:00:00.000Z", freshness: "STALE", provenanceLabel: "Synthetic retained snapshot" });
const published: ReviewCard = { ...draft, prop: { ...draft.prop, visibility: "PUBLIC", relationshipVersion: 1, activity: activity(3) } };

describe("publication consent follows the approved snapshot", () => {
  it("does not approve activity that was withheld, even on a published relationship", () => {
    expect(defaultReview(published).approveActivity).toBe(false);
    expect(defaultReview({ ...published, publishedActivity: activity(3) }).approveActivity).toBe(true);
    expect(defaultReview({ ...published, publishedActivity: activity(2) }).approveActivity).toBe(false);
  });
  it("omits untouched public cards, preserving their exact approved projection", () => {
    expect(explicitPublicationReview(published)).toBeUndefined();
    const edited = { ...defaultReview(published), publish: false };
    expect(explicitPublicationReview(published, edited)).toBe(edited);
  });
  it("submits only the touched card when another public card has private changes", () => {
    const untouched = { ...published, prop: { ...published.prop, _id: "a", relationshipVersion: 2, note: "Private update", activity: activity(999) } };
    const selected = { ...published, prop: { ...published.prop, _id: "b", visibility: "PRIVATE" as const } };
    const rows = explicitPublicationCards([untouched, selected], { b: { ...defaultReview(selected), publish: true } });
    expect(rows.map(row => row.card.prop._id)).toEqual(["b"]);
    expect(rows[0].edit.approveActivity).toBe(false);
  });
  it("invalidates an open approval when the private version or activity changes", () => {
    const card = { ...published, publishedActivity: activity(3) };
    const edit = defaultReview(card);
    for (const prop of [{ ...card.prop, relationshipVersion: 2 }, { ...card.prop, activity: activity(999) }]) {
      const changed = { ...card, prop };
      expect(isCurrentReview(changed, edit)).toBe(false);
      expect(() => explicitPublicationReview(changed, edit)).toThrow("changed");
    }
  });
  it("requires private confirmation before first publication and accepts the saved current version", () => {
    expect(() => explicitPublicationReview(draft, { ...defaultReview(draft), publish: true })).toThrow("save");
    const saved: ReviewCard = { ...draft, prop: { ...draft.prop, visibility: "PRIVATE", relationshipVersion: 1 } };
    expect(explicitPublicationReview(saved, { ...defaultReview(saved), publish: true })?.publish).toBe(true);
    expect(explicitPublicationReview(draft, { ...defaultReview(draft), publish: true }, false)?.publish).toBe(true);
  });
});
