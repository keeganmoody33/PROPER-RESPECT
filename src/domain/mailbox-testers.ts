/**
 * Gmail discovery is open only to invited testers (R16). The list comes from
 * the MAILBOX_GOOGLE_TEST_EMAILS deployment variable: emails separated by
 * commas or whitespace. A missing or empty list allows nobody.
 */
export const MAILBOX_TESTERS_ONLY = "Gmail discovery is open only to invited testers right now.";

export function mailboxTesterAllowed(email: string | undefined, list: string | undefined): boolean {
  const caller = email?.trim().toLowerCase();
  if (!caller) return false;
  return (list ?? "").split(/[\s,]+/).some(entry => entry.toLowerCase() === caller);
}
