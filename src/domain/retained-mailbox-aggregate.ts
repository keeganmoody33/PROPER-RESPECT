export type StoredMailboxAccount = {
  id: string;
  status: "CONNECTED" | "DISCONNECTED" | "NEEDS_REAUTH";
  /** Set when recording from this account stopped. Rows after this instant are not retained. */
  disconnectedAt?: string;
  /** Present only when the stored account already records this distinction. */
  distinction?: "personal" | "former-employer";
  /** Owner choice. Absent and private accounts stay off the public page. */
  display?: "public" | "private";
  /** Never copied onto the public aggregate. */
  address?: string;
};

export type RetainedMailboxRow = {
  id: string;
  accountId: string;
  retainedAt: string;
};

export type PublicRetainedSource = {
  accountId: string;
  recording: "recording" | "stopped";
  label: "Personal" | "Former employer" | "Retained source";
  retainedCount: number;
};

function sourceLabel(account: StoredMailboxAccount): PublicRetainedSource["label"] {
  switch (account.distinction) {
    case "personal":
      return "Personal";
    case "former-employer":
      return "Former employer";
    case undefined:
      return "Retained source";
    default: {
      const unexpected: never = account.distinction;
      return unexpected;
    }
  }
}

function keptAfterDisconnect(account: StoredMailboxAccount, row: RetainedMailboxRow): boolean {
  if (account.status !== "DISCONNECTED") return true;
  if (account.disconnectedAt === undefined) return false;
  return row.retainedAt <= account.disconnectedAt;
}

/** A disconnected mailbox contributes nothing new. Rows already in `rows` stay there. */
export function retainMailboxRow(
  accounts: readonly StoredMailboxAccount[],
  rows: readonly RetainedMailboxRow[],
  row: RetainedMailboxRow,
): readonly RetainedMailboxRow[] {
  const account = accounts.find(item => item.id === row.accountId);
  if (account === undefined || account.status === "DISCONNECTED") return rows;
  if (rows.some(existing => existing.id === row.id)) return rows;
  return [...rows, row];
}

/**
 * Public aggregate of retained mailbox rows. Each displayed account stays its
 * own source. A stored personal or former-employer label is kept. An address
 * domain is not a label. Private accounts are omitted.
 */
export function publicRetainedMailboxAggregate(input: {
  accounts: readonly StoredMailboxAccount[];
  rows: readonly RetainedMailboxRow[];
}): readonly PublicRetainedSource[] {
  return input.accounts.filter(account => account.display === "public").map(account => ({
    accountId: account.id,
    recording: account.status === "DISCONNECTED" ? "stopped" : "recording",
    label: sourceLabel(account),
    retainedCount: input.rows.filter(row => row.accountId === account.id && keptAfterDisconnect(account, row)).length,
  }));
}
