// Before 17 Nov 2026 a connection, an upload or a discovery wrote a headline and a note on the draft it made, and
// confirming the draft kept them. A card saved then can still hold one. None of them is the owner's words, so a
// card with nothing else has no line: it is not shared, and a visitor is shown nothing for it.

const SYSTEM_NOTES: ReadonlySet<string> = new Set([
  "Connected activity is private until I approve this card.",
  "This file has not been interpreted as product use. Review it before describing your relationship.",
]);
const PROPOSED_NOTE = { start: "Proposed from ", end: " evidence. Review before publishing." };

/** The text as the owner wrote it, or nothing when it is blank or a line the app wrote for this product. */
export function ownerLine(text: string, productName: string): string {
  const line = text.trim();
  const systemHeadlines = [`${productName} is in my stack.`, `${productName} may be in your stack.`, `${productName}: uploaded evidence to review.`];
  const written = systemHeadlines.includes(line) || SYSTEM_NOTES.has(line) || (line.startsWith(PROPOSED_NOTE.start) && line.endsWith(PROPOSED_NOTE.end));
  return line && !written ? text : "";
}
