import type { AssociatedAccountEvidence } from "./product-destination";

export type RankedAccountEvidence = {
  sourceDay: string;
  captureInstant?: number;
  accountKey: string;
  evidence: AssociatedAccountEvidence;
};

export function compareAccountEvidence(left: RankedAccountEvidence, right: RankedAccountEvidence): number {
  if (left.sourceDay !== right.sourceDay) return left.sourceDay < right.sourceDay ? 1 : -1;
  const leftInstant = left.captureInstant ?? -Infinity;
  const rightInstant = right.captureInstant ?? -Infinity;
  if (leftInstant !== rightInstant) return leftInstant < rightInstant ? 1 : -1;
  if (left.accountKey === right.accountKey) return 0;
  return left.accountKey < right.accountKey ? -1 : 1;
}
