import type { ActivityModule, PublicProfile } from "./public-profile";
import { contributionCalendarCoverage } from "./contribution-calendar-coverage";
import { compactNumber } from "./format-activity-number";

type VisibleMetric = Readonly<{ label: string; displayValue: string; unit?: string }>;
type VisibleDay = Readonly<{ date: string; count: number }>;
type VisiblePeriod = Readonly<{ start: string; end: string }>;
type VisibleActivityMeta = Readonly<{
  attributionScope: ActivityModule["attributionScope"];
  capturedOn: string;
  freshness: ActivityModule["freshness"];
  provenanceLabel: string;
  period?: VisiblePeriod;
  note?: string;
}>;
export type VisibleActivity = VisibleActivityMeta & (
  | Readonly<{ kind: "contributionCalendar"; total: VisibleMetric; memberSinceYear?: string; days: readonly VisibleDay[]; coverageNote?: string; suppliedRange?: string; emptyNote?: string }>
  | Readonly<{ kind: "headlineMetrics"; primary: VisibleMetric; supporting: readonly VisibleMetric[] }>
  | Readonly<{ kind: "timeSeries"; label?: string; unit?: string; points: readonly Readonly<{ date: string; value: number }>[]; emptyNote?: string }>
  | Readonly<{ kind: "artifactCollection"; total: VisibleMetric; artifacts: readonly Readonly<{ title: string; url: string }>[]; emptyNote?: string }>
  | Readonly<{ kind: "reviewActivity"; reviews: VisibleMetric; bugsCaught: VisibleMetric; severity: readonly Readonly<{ label: string; count: number }>[] }>
  | Readonly<{ kind: "codingActivity"; primary: VisibleMetric; supporting: readonly VisibleMetric[]; days?: readonly VisibleDay[] }>
);
export type VisiblePublicProfile = Readonly<{
  handle: string;
  displayName: string;
  bio: string;
  profileLinks: readonly Readonly<{ label: string; url: string }>[];
  nameLink?: string;
  cards: readonly Readonly<{
    product: Readonly<{ name: string; description: string }>;
    status: PublicProfile["cards"][number]["status"];
    ownerSelectedGoTo: boolean;
    headline: string;
    note: string;
    startedAt?: string;
    startDateNote?: string;
    activity?: VisibleActivity;
    cost?: Readonly<{
      displayAmount: string;
      basis: NonNullable<PublicProfile["cards"][number]["cost"]>["basis"];
      cadence: NonNullable<PublicProfile["cards"][number]["cost"]>["cadence"];
      asOf: string;
      period?: VisiblePeriod;
    }>;
    primaryLink?: Readonly<{ type: "CANONICAL" | "AFFILIATE" | "REFERRAL" | "INVITE"; label: string; url: string; disclosure?: string }>;
  }>[];
  emptyNote?: string;
}>;

function metric(value: Readonly<{ label: string; value: number; unit?: string }>): VisibleMetric {
  return { label: value.label, displayValue: compactNumber(value.value), ...(value.unit ? { unit: value.unit } : {}) };
}
function days(values: readonly VisibleDay[]): readonly VisibleDay[] {
  return values.map(day => ({ date: day.date, count: day.count }));
}
function visibleActivity(activity: ActivityModule): VisibleActivity {
  const meta: VisibleActivityMeta = {
    attributionScope: activity.attributionScope,
    capturedOn: activity.capturedAt.slice(0, 10),
    freshness: activity.freshness,
    provenanceLabel: activity.provenanceLabel,
    ...(activity.period ? { period: { start: activity.period.start, end: activity.period.end } } : { note: "Measurement period not supplied" }),
  };
  switch (activity.kind) {
    case "contributionCalendar": {
      const coverage = contributionCalendarCoverage(activity);
      return {
      ...meta, kind: activity.kind, total: metric({ label: "contributions", value: activity.total }),
      ...(activity.memberSince ? { memberSinceYear: activity.memberSince.slice(0, 4) } : {}),
      days: days([...activity.days].sort((a, b) => a.date.localeCompare(b.date))),
      ...(coverage?.gapNote ? { coverageNote: coverage.gapNote } : {}),
      ...(coverage?.suppliedRange ? { suppliedRange: coverage.suppliedRange } : {}),
      ...(activity.days.length === 0 ? { emptyNote: "No daily contribution counts supplied" } : {}),
      };
    }
    case "headlineMetrics": return { ...meta, kind: activity.kind, primary: metric(activity.primary), supporting: activity.supporting.map(metric) };
    case "timeSeries": return {
      ...meta, kind: activity.kind, ...(activity.points.length ? { label: activity.label, ...(activity.unit ? { unit: activity.unit } : {}) } : {}),
      points: activity.points.map(point => ({ date: point.date, value: point.value })),
      ...(activity.points.length === 0 ? { emptyNote: "No observations supplied" } : {}),
    };
    case "artifactCollection": return {
      ...meta, kind: activity.kind, total: metric({ label: "artifacts", value: activity.total }),
      artifacts: activity.artifacts.map(artifact => ({ title: artifact.title, url: artifact.url })),
      ...(activity.artifacts.length === 0 ? { emptyNote: "No artifacts selected" } : {}),
    };
    case "reviewActivity": return {
      ...meta, kind: activity.kind, reviews: metric({ label: "reviews", value: activity.reviews }),
      bugsCaught: metric({ label: "bugs caught", value: activity.bugsCaught }),
      severity: activity.severity.map(item => ({ label: item.label, count: item.count })),
    };
    case "codingActivity": return {
      ...meta, kind: activity.kind, primary: metric(activity.primary), supporting: activity.supporting.map(metric),
      ...(activity.days?.length ? { days: days(activity.days) } : {}),
    };
  }
}

export function projectVisiblePublicProfile(profile: PublicProfile): VisiblePublicProfile {
  const nameLink = profile.profileLinks?.find(link => link.url === profile.preferredLinkUrl)?.url;
  return {
    handle: profile.handle, displayName: profile.displayName, bio: profile.bio,
    profileLinks: (profile.profileLinks ?? []).map(link => ({ label: link.label, url: link.url })),
    ...(nameLink ? { nameLink } : {}),
    cards: profile.cards.map(card => ({
      product: { name: card.product.name, description: card.product.description },
      status: card.status, ownerSelectedGoTo: card.goTo === true,
      headline: card.headline || card.note || "Relationship note not supplied.",
      note: card.note || "Relationship note not supplied.",
      ...(card.startedAt ? { startedAt: card.startedAt } : { startDateNote: "Start date not supplied" }),
      ...(card.activity ? { activity: visibleActivity(card.activity) } : {}),
      ...(card.cost ? { cost: {
        displayAmount: new Intl.NumberFormat("en", { style: "currency", currency: card.cost.currency }).format(card.cost.amount),
        basis: card.cost.basis, cadence: card.cost.cadence, asOf: card.cost.asOf,
        ...(card.cost.period ? { period: { start: card.cost.period.start, end: card.cost.period.end } } : {}),
      } } : {}),
      ...(card.primaryLink ? { primaryLink: {
        type: card.primaryLink.type, label: card.primaryLink.label, url: card.primaryLink.url,
        ...(card.primaryLink.type === "AFFILIATE" ? { disclosure: "Affiliate link" }
          : card.primaryLink.type === "REFERRAL" ? { disclosure: "Referral link" } : {}),
      } } : {}),
    })),
    ...(profile.cards.length === 0 ? { emptyNote: "No published products yet. Draft and private records stay off this page." } : {}),
  };
}
