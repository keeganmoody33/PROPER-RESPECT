import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RetainedMailboxAggregate } from "@/components/retained-mailbox-aggregate";
import {
  publicRetainedMailboxAggregate,
  retainMailboxRow,
  type RetainedMailboxRow,
  type StoredMailboxAccount,
} from "./retained-mailbox-aggregate";

const disconnectedAt = "2026-06-01T00:00:00.000Z";

const personal: StoredMailboxAccount = {
  id: "personal-account",
  status: "CONNECTED",
  display: "public",
  distinction: "personal",
};

const formerEmployer: StoredMailboxAccount = {
  id: "former-account",
  status: "DISCONNECTED",
  display: "public",
  distinction: "former-employer",
  disconnectedAt,
  address: "ada@acme.example",
};

const unlabeled: StoredMailboxAccount = {
  id: "unlabeled-account",
  status: "DISCONNECTED",
  display: "public",
  disconnectedAt,
  address: "ada@acme.example",
};

const privateAccount: StoredMailboxAccount = {
  id: "private-account",
  status: "DISCONNECTED",
  display: "private",
  disconnectedAt,
  address: "hidden@secret.example",
};

const retained: readonly RetainedMailboxRow[] = [
  { id: "personal-row", accountId: personal.id, retainedAt: "2026-05-01T00:00:00.000Z" },
  { id: "former-row", accountId: formerEmployer.id, retainedAt: "2026-04-01T00:00:00.000Z" },
  { id: "unlabeled-row", accountId: unlabeled.id, retainedAt: "2026-03-01T00:00:00.000Z" },
  { id: "private-row", accountId: privateAccount.id, retainedAt: "2026-03-01T00:00:00.000Z" },
];

const lateRow: RetainedMailboxRow = {
  id: "after-disconnect",
  accountId: formerEmployer.id,
  retainedAt: "2026-07-01T00:00:00.000Z",
};

describe("retained mailbox aggregate", () => {
  it("adds no row from a disconnected mailbox", () => {
    expect(retainMailboxRow([personal, formerEmployer], retained, lateRow)).toEqual(retained);
    expect(retainMailboxRow([personal, formerEmployer], retained, {
      id: "also-late",
      accountId: unlabeled.id,
      retainedAt: "2026-07-02T00:00:00.000Z",
    })).toEqual(retained);
  });

  it("keeps already retained rows in the public aggregate and leaves a private account off the page", () => {
    const shown = publicRetainedMailboxAggregate({
      accounts: [personal, formerEmployer, unlabeled, privateAccount],
      rows: [...retained, lateRow],
    });

    expect(shown).toEqual([
      { accountId: personal.id, recording: "recording", label: "Personal", retainedCount: 1 },
      { accountId: formerEmployer.id, recording: "stopped", label: "Former employer", retainedCount: 1 },
      { accountId: unlabeled.id, recording: "stopped", label: "Retained source", retainedCount: 1 },
    ]);
    expect(shown.some(source => source.accountId === privateAccount.id)).toBe(false);

    const text = renderToStaticMarkup(createElement(RetainedMailboxAggregate, { sources: shown }));
    expect(text).toContain("Personal");
    expect(text).toContain("Former employer");
    expect(text).toContain("Retained source");
    expect(text).toContain("Recording stopped");
    expect(text).toContain("1 retained row");
    expect(text).not.toContain("private-account");
    expect(text).not.toContain("hidden@secret.example");
    expect(text).not.toContain("ada@acme.example");
    expect(text).not.toContain("acme.example");
    expect(text).not.toContain("Acme");
    expect(JSON.stringify(shown)).not.toContain("@");
    expect(JSON.stringify(shown)).not.toContain("acme");
  });
});
