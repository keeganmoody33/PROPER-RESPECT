import { expect, test } from "vitest";
import { mailboxReadNotice } from "../../components/mailbox-management";

test("a completed mailbox page still reports retained evidence awaiting relationship reconciliation", () => {
  const notice = mailboxReadNotice({ readCount: 5, proposals: 1, hasMore: false,
    ambiguousProducts: [{ productSlug: "github", reason: "MULTIPLE_OWNER_RELATIONSHIPS" }],
  });
  expect(notice).toContain("This query reached its final page.");
  expect(notice).toContain("Evidence for github was retained privately but is not attached to a card.");
  expect(notice).toContain("multiple existing records that need to be reconciled");
  expect(notice).toContain("No record was chosen and no duplicate card was added");
  expect(notice).not.toContain("Review private discoveries in your collection.");
});

test("legacy and unambiguous responses preserve the collection review notice and search coverage", () => {
  for (const ambiguousProducts of [undefined, []]) {
    const notice = mailboxReadNotice({ readCount: 5, proposals: 1, hasMore: true, ambiguousProducts });
    expect(notice).toContain("More pages remain in this search.");
    expect(notice).toContain("Review private discoveries in your collection.");
    expect(notice).not.toContain("need to be reconciled");
  }
});
