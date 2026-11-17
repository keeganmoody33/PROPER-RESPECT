import type { WalkthroughItem } from "./walkthrough";

// Rapid fire asks the most significant tools first, so someone who stops halfway has answered the ones that matter
// (voice onboarding spec, section 3; decision 2, 2026-11-17). Ranking only orders the queue: it never adds or removes a
// tool, never picks a level, and is never shown or stored.

/** One stored source of a tool, as inventory.evidence lists it. */
export type RankSource = Readonly<{ sourceType: string; adapterId?: string; capturedAt?: string }>;

const CONNECTED = new Set(["GITHUB", "DEVIN", "DEVIN_DESKTOP"]);
const MAIL = new Set(["GMAIL", "MICROSOFT_MAIL"]);
// One noisy sender can't outrank everything else in its tier.
const MAIL_CAP = 10;

const MEASURED = 0, CONNECTED_ACCOUNT = 1, PAID = 2, TYPED = 3, EMAIL = 4, OTHER = 5;

export function rankTier(item: WalkthroughItem, sources: readonly RankSource[] = []): number {
  const { prop } = item.card;
  if (prop.activity || prop.activityEvidenceId || sources.some(source => source.adapterId === "sanitized-measurements")) return MEASURED;
  if (sources.some(source => CONNECTED.has(source.sourceType))) return CONNECTED_ACCOUNT;
  if (sources.some(source => source.sourceType === "BILLING")) return PAID;
  if (prop.ownerEntered) return TYPED;
  if (sources.some(source => MAIL.has(source.sourceType))) return EMAIL;
  return OTHER;
}

const newest = (sources: readonly RankSource[]) => sources.reduce((latest, source) =>
  source.capturedAt && source.capturedAt > latest ? source.capturedAt : latest, "");

/**
 * Measured usage, then connected accounts, payment, tools the owner typed, then email (by how many originals, capped),
 * then everything else in collection order. Inside a tier: newest capture first, then product name.
 */
export function rankQueue(queue: readonly WalkthroughItem[], signals: Readonly<Record<string, readonly RankSource[] | undefined>>): WalkthroughItem[] {
  const ranked = queue.map((item, index) => {
    const sources = signals[item.propId] ?? [];
    const tier = rankTier(item, sources);
    const mail = tier === EMAIL ? Math.min(MAIL_CAP, sources.filter(source => MAIL.has(source.sourceType)).length) : 0;
    return { item, index, tier, mail, newest: newest(sources) };
  });
  return ranked.sort((a, b) => a.tier - b.tier
    || (a.tier === OTHER ? a.index - b.index : 0)
    || b.mail - a.mail
    || (a.newest === b.newest ? 0 : a.newest > b.newest ? -1 : 1)
    || a.item.card.product.name.localeCompare(b.item.card.product.name)
    || a.index - b.index).map(entry => entry.item);
}
