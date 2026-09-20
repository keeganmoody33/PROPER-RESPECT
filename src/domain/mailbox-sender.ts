export function senderDomain(from: string): string | null {
  // Deliberately narrow: a single plain mailbox or display-name <mailbox>.
  // Sender headers are unverified source text; they establish no account or usage claim.
  const match = from.match(/^(?:[^<>\r\n,]*<)?[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@((?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,})(>)?$/);
  if (!match || from.includes("<") !== Boolean(match[2])) return null;
  return match[1].toLowerCase();
}
