import { describe, expect, it } from "vitest";
import { defaultReview, explicitPublicationCards, explicitPublicationReview, githubRefreshConnector, isCurrentReview, reviewActivity, setReviewCostVisibility, type ReviewCard } from "./review";
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
    const card = { ...draft, isPublishedAtCurrentHandle: true, prop: { ...draft.prop, visibility: "PUBLIC" as const, status: "ARCHIVED" as const } };
    expect(defaultReview(card)).toMatchObject({
      publish: true, status: "ARCHIVED", linkType: "REFERRAL", linkLabel: "My referral", linkUrl: "https://example.com/referral",
    });
  });
  it("does not infer public cost permission from a public card", () => {
    expect(defaultReview({ ...draft, prop: { ...draft.prop, visibility: "PUBLIC" } }).costVisibility).toBe("PRIVATE");
  });
  it.each([false, undefined])("does not preselect PUBLIC records when current-handle membership is %s", membership => {
    const card = { ...draft, isPublishedAtCurrentHandle: membership, prop: { ...draft.prop, visibility: "PUBLIC" as const, activity: activity(3) }, publishedActivity: activity(3) };
    expect(defaultReview(card)).toMatchObject({ publish: false, approveActivity: false });
  });
  it("invalidates a saved review when current-handle membership changes without a private edit", () => {
    const card = { ...draft, isPublishedAtCurrentHandle: true, prop: { ...draft.prop, visibility: "PUBLIC" as const } };
    const edit = defaultReview(card);
    const changed = { ...card, isPublishedAtCurrentHandle: false };
    expect(isCurrentReview(changed, edit)).toBe(false);
    expect(() => explicitPublicationReview(changed, edit)).toThrow("changed");
  });
});

const activity = (total: number): ActivityModule => ({ kind: "contributionCalendar", total, days: [],
  attributionScope: "PERSONAL", capturedAt: "2026-09-18T12:00:00.000Z", freshness: "STALE", provenanceLabel: "Synthetic retained snapshot" });
const publishedFixture = { ...draft, isPublishedAtCurrentHandle: true, prop: { ...draft.prop, visibility: "PUBLIC" as const, relationshipVersion: 1, activity: activity(3) } };
const published: ReviewCard = publishedFixture;

describe("bulk cost review", () => {
  it("changes only resolved public cards or existing explicit choices and preserves deselection", () => {
    const resolved = { ...publishedFixture, prop: { ...publishedFixture.prop, _id: "resolved" } };
    const unselected = { ...resolved, isPublishedAtCurrentHandle: false, prop: { ...resolved.prop, _id: "unselected" } };
    const selected = { ...unselected, prop: { ...unselected.prop, _id: "selected" } };
    const removed = { ...resolved, prop: { ...resolved.prop, _id: "removed" } };
    const next = setReviewCostVisibility([resolved, unselected, selected, removed], {
      selected: { ...defaultReview(selected), publish: true },
      removed: { ...defaultReview(removed), publish: false },
    }, "PUBLIC");
    expect(Object.keys(next).sort()).toEqual(["removed", "resolved", "selected"]);
    expect(next.resolved).toMatchObject({ publish: true, costVisibility: "PUBLIC" });
    expect(next.selected).toMatchObject({ publish: true, costVisibility: "PUBLIC" });
    expect(next.removed).toMatchObject({ publish: false, costVisibility: "PUBLIC" });
  });
  it("does not refresh stale publication consent through a bulk cost action", () => {
    const card = { ...publishedFixture, prop: { ...publishedFixture.prop, _id: "changed" } };
    const prior = { ...defaultReview(card), publish: false };
    const changed = { ...card, prop: { ...card.prop, relationshipVersion: 2 } };
    const next = setReviewCostVisibility([changed], { changed: prior }, "PUBLIC");
    expect(next.changed).toEqual(prior);
    expect(() => explicitPublicationCards([changed], next)).toThrow("changed");
  });
});

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

describe("daily GitHub refresh opt-in (R09)", () => {
  const saved = activity(3);
  const refreshed = { ...activity(9), capturedAt: "2026-09-27T12:00:00.000Z", freshness: "FRESH" as const };
  const github: ReviewCard = { ...draft, product: { domain: "github.com", slug: "github" }, isPublishedAtCurrentHandle: true,
    prop: { ...draft.prop, visibility: "PUBLIC" as const, relationshipVersion: 2, activity: saved }, publishedActivity: refreshed, refreshApproved: true };
  const connector = { _id: "connector-1", provider: "GITHUB", status: "CONNECTED", attributionScope: "PERSONAL" };

  it("starts from the approved refresh and keeps the refreshed public calendar", () => {
    const edit = defaultReview(github);
    expect(edit).toMatchObject({ publish: true, autoRefresh: true, approveActivity: true });
    expect(reviewActivity(github, edit)).toEqual(refreshed);
  });

  it("stays off and publishes the saved calendar without an approved refresh", () => {
    const card = { ...github, refreshApproved: false };
    const edit = defaultReview(card);
    expect(edit.autoRefresh).toBe(false);
    expect(reviewActivity(card, edit)).toEqual(saved);
  });

  it("returns to the saved calendar once the owner unchecks the refresh", () => {
    expect(reviewActivity(github, { ...defaultReview(github), autoRefresh: false })).toEqual(saved);
  });

  it.each(["CONNECTED", "ERROR"])("offers the refresh with a personal GitHub connection that is %s", status => {
    expect(githubRefreshConnector(github, [{ ...connector, status }], defaultReview(github))?._id).toBe("connector-1");
  });

  it.each([
    ["a revoked connection", { cards: github, connectors: [{ ...connector, status: "REVOKED" }], edit: {} }],
    ["a connection needing reauthorization", { cards: github, connectors: [{ ...connector, status: "NEEDS_REAUTH" }], edit: {} }],
    ["an organization connection", { cards: github, connectors: [{ ...connector, attributionScope: "ORGANIZATION" }], edit: {} }],
    ["a Devin connection", { cards: github, connectors: [{ ...connector, provider: "DEVIN" }], edit: {} }],
    ["another product", { cards: { ...github, product: { domain: "example.com", slug: "example" } }, connectors: [connector], edit: {} }],
    ["an unpublished card", { cards: github, connectors: [connector], edit: { publish: false } }],
    ["activity left off the card", { cards: github, connectors: [connector], edit: { approveActivity: false } }],
    ["activity that is not a personal calendar", { cards: { ...github, refreshApproved: false, prop: { ...github.prop, activity: { ...saved, attributionScope: "ORGANIZATION" as const } } }, connectors: [connector], edit: { approveActivity: true } }],
  ] as const)("hides the refresh for %s", (_label, { cards, connectors, edit }) => {
    expect(githubRefreshConnector(cards, connectors, { ...defaultReview(cards), ...edit })).toBeUndefined();
  });
});
