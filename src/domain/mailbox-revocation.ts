/**
 * Time a provider revocation may take: the 10 s request timeout plus a margin. A disconnect only asks Google once at
 * least this much of its reconnect-blocking window is left, so a delayed request can never land after a reconnect
 * and end the new connection's grant (Google revokes the whole grant for the user and app).
 */
export const MAILBOX_REVOCATION_REQUEST_BUDGET_MS = 15_000;

export function revocationWindowOpen(until: number, now = Date.now()) {
  return now + MAILBOX_REVOCATION_REQUEST_BUDGET_MS <= until;
}
