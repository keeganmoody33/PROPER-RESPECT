import { expect, test } from "vitest";
import { initialShareState, previewSummary, shareFlow, skipReasonText, type ShareAllPreview, type ShareEvent, type ShareState } from "./share-all-flow";

const REVISION = 3;
const SHARED = 4;
const BATCH = 100;
const REMAINING = 7;
const preview: ShareAllPreview<string> = {
  profile: "synthetic profile", revision: REVISION, previewHash: "hash-1", sharedCount: SHARED, remainingCount: 0,
  skipped: [{ propId: "prop-bad-link", productName: "Bad Link Tool", reason: "LINK_NEEDS_REVIEW" }],
};

function run(state: ShareState<string>, events: readonly ShareEvent<string>[]) {
  return events.reduce(shareFlow<string>, state);
}

test("a person without a handle starts there and moves on only once one is claimed", () => {
  expect(initialShareState(false)).toEqual({ step: "needsHandle" });
  expect(initialShareState(true)).toEqual({ step: "ready" });
  expect(run(initialShareState(false), [{ type: "preview" }])).toEqual({ step: "needsHandle" });
  expect(run(initialShareState(false), [{ type: "identity", claimed: true }, { type: "preview" }])).toEqual({ step: "previewing" });
});

test("preview, publish and published carry the counts the preview promised", () => {
  const previewed = run(initialShareState(true), [{ type: "preview" }, { type: "previewLoaded", preview, basis: "basis-1" }]);
  expect(previewed).toEqual({ step: "previewed", preview, basis: "basis-1" });
  expect(run(previewed, [{ type: "publish" }])).toEqual({ step: "publishing", preview, basis: "basis-1" });
  expect(run(previewed, [{ type: "publish" }, { type: "published" }])).toEqual({ step: "published", sharedCount: SHARED, remainingCount: 0 });
});

test("a server refusal while previewing or publishing becomes an error that can preview again", () => {
  const refused = run(initialShareState(true), [{ type: "preview" }, { type: "failed", message: "There are no confirmed cards left to share." }]);
  expect(refused).toEqual({ step: "error", message: "There are no confirmed cards left to share." });
  expect(run(refused, [{ type: "preview" }])).toEqual({ step: "previewing" });
  const stale = run(initialShareState(true), [{ type: "preview" }, { type: "previewLoaded", preview, basis: "b" }, { type: "publish" },
    { type: "failed", message: "The sharing preview changed. Open a fresh preview before publishing." }]);
  expect(stale).toEqual({ step: "error", message: "The sharing preview changed. Open a fresh preview before publishing." });
});

test("steps ignore events they do not accept, and losing the handle returns to the handle step", () => {
  const publishing = run(initialShareState(true), [{ type: "preview" }, { type: "previewLoaded", preview, basis: "b" }, { type: "publish" }]);
  expect(run(publishing, [{ type: "preview" }, { type: "identity", claimed: false }])).toBe(publishing);
  expect(run(initialShareState(true), [{ type: "publish" }, { type: "published" }])).toEqual({ step: "ready" });
  expect(run(initialShareState(true), [{ type: "identity", claimed: false }])).toEqual({ step: "needsHandle" });
});

test("the preview summary and skip reasons are plain sentences", () => {
  expect(previewSummary(preview)).toBe("4 cards will be shared. 1 will stay private until you fix it.");
  expect(previewSummary({ sharedCount: BATCH, remainingCount: REMAINING, skipped: [] })).toBe("100 cards will be shared. 7 more remain. Share them in another run after this one.");
  expect(skipReasonText("LINK_NEEDS_REVIEW")).toBe("its saved link is not a public web address. Fix the link in your collection.");
  expect(skipReasonText("LINK_TOO_LONG")).toBe("its saved link or link label is too long to publish. Shorten it in your collection.");
});
