"use client";

import { Figures, FRONT_MEASUREMENT_LIMIT, MeasurementLines, PublicMeasurements } from "./measurement-values";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@ui-sdk/react/collapsible";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import {
  selectProductBrandLogo,
  type ProductBrandSnapshot,
} from "@/src/domain/product-brand";
import type {
  ActivityModule,
  PublicProfile,
} from "@/src/domain/public-profile";
import { contributionCalendarCoverage, monthlyTotals } from "@/src/domain/contribution-calendar-coverage";
import { compactNumber, fullNumber } from "@/src/domain/format-activity-number";
import { usageLinkHost, usageLinkLabelText, usageLinkSchema } from "@/src/domain/usage-links";
import { isHttpUrl } from "@/src/domain/http-url";
import { linkDisclosure, linkTypeLabel } from "@/src/domain/link-type";
import { cardStatusLabel, cardTopLine, noLongerInUse } from "@/src/domain/relationship-level";
import { costDetail, costSummary } from "@/src/domain/cost";
import { useReducedMotion } from "./use-reduced-motion";
import { dayMonthYear, formatPeriod, freshnessNote, monthYear as monthYearOf, yearOf } from "@/src/domain/format-period";
import { activityHeadline, cadenceEnd, FRONT_ARTIFACT_LIMIT, normalizeSeries } from "@/src/domain/activity-headline";
import { productUseLabels } from "@/src/domain/product-uses";
import { creditHref, creditText, listedCredit } from "@/src/domain/props-credit";
import { reportHref } from "@/src/domain/report-link";
import { privateUsageCardSchema, type PrivateUsageCard } from "@/src/domain/private-usage-card";
import { UsageChart } from "./usage-chart";
import { PrivateUsageCardDetails, PrivateUsageCardPreview } from "./private-usage-card-details";
import { ProductBrandDetails } from "./product-brand-details";
import { ProductBrandFonts, productBrandTypography } from "./product-brand-fonts";
import { brandAccent, brandCardKit, brandMark, headlineAccentColour, slabLogo } from "@/src/domain/brand-kit";
import type { BrandSiteTraits } from "@/src/domain/brand-site-traits";
import { ownOriginImageUrl } from "@/src/domain/brand-image-url";
import { officialProductIcon, type ProductIcon } from "@/src/domain/product-icons";
import {
  verifiedProductAssets,
  selectVerifiedProductLogo,
  verifiedProductTypography,
  verifiedProductFontFaces,
  type VerifiedProductAssets,
} from "@/src/domain/verified-product-assets";

type Card = PublicProfile["cards"][number];
/** The surface an unbranded card is drawn on (globals.css --ink). */
const DEFAULT_CARD_SURFACE = "#171713";
/** The link glyph is text, so its colour needs the 4.5:1 WCAG asks of body text. */
const MIN_GLYPH_CONTRAST = 4.5;

function luminance(hex: string): number | undefined {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return undefined;
  const [red, green, blue] = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: number, second: number) {
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function brandAppearance(brand?: ProductBrandSnapshot, site?: BrandSiteTraits) {
  // A product with no stored brand (Claude Code, whose domain is its parent company's) is drawn in its own measured page's colours.
  const roles = brand?.styleguide?.colors ?? (site && !brand ? { background: site.traits.surface?.value, text: site.traits.text?.value } : undefined);
  const background = roles?.background && luminance(roles.background);
  const text = roles?.text && luminance(roles.text);
  const readablePair = typeof background === "number" && typeof text === "number"
    && contrast(background, text) >= 4.5;
  const surface: "light" | "dark" = readablePair && background > 0.179 ? "light" : "dark";
  const style: CSSProperties & Record<`--brand-card-${string}`, string> = {};

  if (readablePair && roles?.background && roles.text) {
    style["--brand-card-background"] = roles.background;
    style["--brand-card-text"] = roles.text;
    // The card's edge and buttons follow the brand's own, by the fixed rules in brand-kit.
    Object.assign(style, brandCardKit(brand, roles.background, roles.text, site));
  }
  // A measured site's signature colour, where it reads as text on the card, colours the link glyph.
  if (site && readablePair && roles?.background) {
    const mark = brandMark(brand, roles.background, MIN_GLYPH_CONTRAST, site);
    if (mark) style["--brand-card-accent"] = mark;
    return { style, surface };
  }
  // The same accent the card's chart is drawn in: the site's own, unless it reported a grey.
  const accentHex = brandAccent(brand, readablePair && roles?.background ? roles.background : DEFAULT_CARD_SURFACE)?.hex;
  const accent = accentHex && luminance(accentHex);
  // Default cards alternate between these two dark surfaces. An accent must
  // remain readable on both when no explicit background/text pair was supplied.
  const backgrounds = readablePair ? [background] : [luminance("#171713")!, luminance("#25251F")!];
  if (typeof accent === "number" && accentHex
    && backgrounds.every((value) => contrast(accent, value) >= 4.5)) {
    style["--brand-card-accent"] = accentHex;
  }
  return { style, surface };
}

type CardLogo = {
  url?: string;
  width?: number;
  height?: number;
  mode?: string;
  provider?: string;
  /** "wordmark" replaces the visible product name; "app-icon" fills the square slot edge to edge. */
  layout?: "app-icon" | "wordmark";
  /** Smaller renditions of the same file, resized by the app's image route for the logo slot at each screen density. */
  srcSet?: string;
};

/** The logo slot is 3rem; a reviewed icon is drawn at 1x, 2x and 3x of it from the app's image route (sizes it allows). */
const ICON_RENDITIONS = [[48, "1x"], [96, "2x"], [256, "3x"]] as const;
const ICON_QUALITY = 75;
const iconSrcSet = (path: string) => ICON_RENDITIONS.map(([width, density]) => `/_next/image?url=${encodeURIComponent(path)}&w=${width}&q=${ICON_QUALITY} ${density}`).join(", ");

/** The one image a card's logo slot shows, skipping any that failed to load. Verified assets win, then a reviewed app icon, then the stored brand. */
function cardLogo({ brand, verifiedAssets, icon, logoUrl, surface, failed }: {
  brand?: ProductBrandSnapshot;
  verifiedAssets?: VerifiedProductAssets;
  icon?: ProductIcon;
  logoUrl?: string;
  surface: "light" | "dark";
  failed: readonly string[];
}): CardLogo {
  if (verifiedAssets) {
    const logo = selectVerifiedProductLogo(verifiedAssets, surface, failed);
    return { url: logo?.path, width: logo?.width, height: logo?.height, mode: logo?.mode, provider: logo && verifiedAssets.provider, layout: "wordmark" };
  }
  if (icon) {
    // Where the app's image route is missing (a standalone bundle), a failed rendition falls back to the original file.
    const srcSet = iconSrcSet(icon.path);
    return failed.includes(icon.path) ? {}
      : { url: icon.path, srcSet: failed.includes(srcSet) ? undefined : srcSet, width: icon.width, height: icon.height, mode: "surface" in icon ? icon.surface : undefined, provider: "official-vendor", layout: "app-icon" };
  }
  const choice = brand && selectProductBrandLogo({ logos: brand.logos.filter(candidate => !failed.includes(candidate.url)) }, surface);
  if (choice) {
    return { url: choice.logo.url, width: choice.logo.width, height: choice.logo.height, mode: choice.logo.mode, provider: brand.provider, layout: choice.layout === "wordmark" ? "wordmark" : undefined };
  }
  return logoUrl && !failed.includes(logoUrl) ? { url: logoUrl } : {};
}

function ProductLogo({ logo, mark, onFailed }: { logo: CardLogo; mark: string; onFailed: (url: string) => void }) {
  const { url } = logo;
  return (
    <span
      className="product-logo"
      data-logo-layout={logo.layout}
      data-logo-mode={logo.mode}
      data-logo-provider={logo.provider}
      aria-hidden="true"
    >
      {url ? (
        // Retained provider assets may use any verified asset host. Native images
        // preserve onError fallback without a remote image-loader allowlist.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          // A fresh element for the fallback file: one reused from its srcset keeps the density it chose there.
          key={logo.srcSet ? "renditions" : "file"}
          ref={element => {
            if (element?.complete && element.naturalWidth === 0) onFailed(logo.srcSet ?? url);
          }}
          src={ownOriginImageUrl(url)}
          srcSet={logo.srcSet}
          alt=""
          width={logo.width}
          height={logo.height}
          referrerPolicy="no-referrer"
          onError={() => onFailed(logo.srcSet ?? url)}
        />
      ) : mark}
    </span>
  );
}

/** The points a card's front draws as bars: a time series as supplied, coding activity one bar per recorded day. */
function activitySeries(activity: ActivityModule) {
  if (activity.kind === "timeSeries" && activity.points.length) return { points: activity.points, label: activity.label, unit: activity.unit };
  if (activity.kind === "codingActivity" && activity.days?.length) {
    return { points: activity.days.map(day => ({ date: day.date, value: day.count })), label: "Coding activity" };
  }
  return undefined;
}

/** Hides a month label the scroll has cut at the left edge, behind the weekday column, so a cut "Feb" never reads as "b". */
function markClippedMonths(element: HTMLElement) {
  const edge = (element.querySelector(".contribution-weekdays")?.getBoundingClientRect().right ?? element.getBoundingClientRect().left);
  element.querySelectorAll<HTMLElement>(".contribution-months span").forEach(label => {
    label.toggleAttribute("data-clipped", label.getBoundingClientRect().left < edge - 1);
  });
}

/**
 * Scrolls a calendar wider than its card to the newest week, once, the first time it has a width (a slide has none until shown),
 * and says whether it is wider than its card now, so only a calendar with earlier weeks out of view says it scrolls.
 */
function useNewestWeekInView() {
  const ref = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const onScroll = () => markClippedMonths(element);
    element.addEventListener("scroll", onScroll, { passive: true });
    let scrolled = false;
    const observer = new ResizeObserver(() => {
      if (!element.clientWidth) return;
      if (!scrolled) element.scrollLeft = element.scrollWidth;
      scrolled = true;
      setScrolls(element.scrollWidth > element.clientWidth);
      markClippedMonths(element);
    });
    observer.observe(element);
    return () => { observer.disconnect(); element.removeEventListener("scroll", onScroll); };
  }, []);
  return { ref, scrolls };
}

/** The calendar in one line for a screen reader: its total, how many days had any, and its busiest day. */
function calendarSummary(days: readonly { date: string; count: number }[]): string {
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const busiest = days.reduce((best, day) => (day.count > best.count ? day : best), days[0]);
  return `${fullNumber(total)} contributions from ${dayMonthYear(days[0].date)} to ${dayMonthYear(days.at(-1)!.date)}, on ${days.filter(day => day.count > 0).length} of ${days.length} days; `
    + `the most in a day was ${fullNumber(busiest.count)}, on ${dayMonthYear(busiest.date)}.`;
}

/** The most weeks a month's label spans: months closer than this keep only the later label. */
const MONTH_LABEL_WEEKS = 3;

function ContributionCalendar({ activity }: { activity: Extract<ActivityModule, { kind: "contributionCalendar" }> }) {
  const { ref: scrollRef, scrolls } = useNewestWeekInView();
  const coverage = contributionCalendarCoverage(activity);
  if (!coverage) return <p className="activity-empty">No daily contribution counts supplied</p>;
  const { days, first, last, suppliedRange, gapNote } = coverage;
  const firstSunday = first.getTime() - first.getUTCDay() * 86_400_000;
  const weeks = Math.floor((last - firstSunday) / (7 * 86_400_000)) + 1;
  const months = [...new Set(days.map(day => day.date.slice(0, 7)))].map(month => {
    const monthStart = new Date(`${month}-01T00:00:00Z`);
    const column = Math.max(1, Math.floor((monthStart.getTime() - firstSunday) / (7 * 86_400_000)) + 1);
    return { month, column, label: monthStart.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }) };
  }).filter((month, index, all) => index === all.length - 1 || all[index + 1].column - month.column >= MONTH_LABEL_WEEKS);
  const columns = { gridTemplateColumns: `repeat(${weeks}, var(--contribution-cell))` };
  return (
    <div className="contribution-calendar" data-scrolls={scrolls ? "" : undefined}>
      {/* Only a calendar wider than its card is a tab stop that says it scrolls. */}
      <div ref={scrollRef} className="contribution-scroll" tabIndex={scrolls ? 0 : undefined} role="region"
        aria-label={scrolls ? "Contribution calendar; scroll horizontally to see the full period" : "Contribution calendar"}
        style={{ "--contribution-weeks": weeks } as CSSProperties}>
        <div className="contribution-calendar-layout">
          <div className="contribution-months" aria-hidden="true" style={columns}>
            {/* A label spans up to three weeks, so its name fits its own cells rather than spilling past them. */}
            {months.map(month => <span key={month.month} style={{ gridColumn: `${month.column} / span ${Math.min(MONTH_LABEL_WEEKS, weeks - month.column + 1)}` }}>{month.label}</span>)}
          </div>
          <div className="contribution-weekdays" aria-hidden="true">
            {["", "Mon", "", "Wed", "", "Fri", ""].map((label, index) => <span key={index}>{label}</span>)}
          </div>
          <div className="activity-calendar contribution-grid" aria-hidden="true" style={columns}>
            {days.map(day => {
              const date = new Date(`${day.date}T00:00:00Z`);
              const label = `${dayMonthYear(day.date)}: ${fullNumber(day.count)} ${day.count === 1 ? "contribution" : "contributions"}`;
              return <span key={day.date} title={label} data-date={day.date} data-level={day.level}
                style={{ gridColumn: Math.floor((date.getTime() - firstSunday) / (7 * 86_400_000)) + 1, gridRow: date.getUTCDay() + 1 }} />;
            })}
          </div>
        </div>
      </div>
      <p className="visually-hidden contribution-summary">{calendarSummary(days)}</p>
      {/* The months again as rows, for a screen reader: the calendar's cells are drawn for sight only. */}
      <div className="visually-hidden">
        <table>
          <caption>Contributions each month</caption>
          <thead><tr><th scope="col">Month</th><th scope="col">Contributions</th><th scope="col">Days with any, of the days drawn</th></tr></thead>
          <tbody>{monthlyTotals(days).map(month => <tr key={month.month}>
            <th scope="row">{formatPeriod(month.first, month.last)}</th><td>{fullNumber(month.total)}</td><td>{month.activeDays} of {month.days}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="contribution-legend" aria-hidden="true"><span className="contribution-scroll-hint">← Scroll for earlier months</span>Less {[0, 1, 2, 3, 4].map(level => <i key={level} data-level={level} />)} More</div>
      {suppliedRange && <p className="contribution-range">{suppliedRange}</p>}
      {gapNote && <p className="contribution-gap">{gapNote}</p>}
    </div>
  );
}

/** Text whose hyphenated words ("go-to-market") never break at a hyphen: each sits whole on one line. */
function WholeWords({ text }: { text: string }) {
  return <>{text.split(/(\S+-\S+)/).map((part, index) => index % 2 ? <span key={index} className="whole-word">{part}</span> : part)}</>;
}

/** The first few works with a web link. A work whose link isn't http or https stays off the front. */
function ArtifactLinks({ artifacts }: { artifacts: Extract<ActivityModule, { kind: "artifactCollection" }>["artifacts"] }) {
  const linked = artifacts.filter(artifact => isHttpUrl(artifact.url)).slice(0, FRONT_ARTIFACT_LIMIT);
  if (!linked.length) return null;
  return (
    <ul className="card-artifact-links">
      {linked.map((artifact, index) => (
        <li key={`${index}:${artifact.url}`}>
          <a href={artifact.url} target="_blank" rel="noopener noreferrer"><WholeWords text={artifact.title} /> ↗</a>
        </li>
      ))}
    </ul>
  );
}

/** Past these many characters a headline steps down a size, so the longest an owner can write (240) stays a few lines. */
const HEADLINE_STEPS = [[120, "long"], [60, "medium"]] as const;
function headlineLength(text: string): "short" | "medium" | "long" {
  return HEADLINE_STEPS.find(([limit]) => text.length > limit)?.[1] ?? "short";
}
/** Each step's size in px, as globals.css sets `.card-headline` (1.5rem, 1.3rem, 1.15rem); the CSS default heading weight is 400. */
const HEADLINE_PX = { short: 24, medium: 20.8, long: 18.4 } as const;
const DEFAULT_HEADING_WEIGHT = 400;

/** The headline, with its phrase set apart in `colour` when it has one; without, the phrase keeps the headline's colour. */
function HeadlineText({ text, accent, colour }: { text: string; accent?: string; colour?: string }) {
  const at = accent ? text.indexOf(accent) : -1;
  if (!accent || at < 0) return <>{text}</>;
  return <>{text.slice(0, at)}<span className="card-headline-accent" style={colour ? { color: colour } : undefined}>{accent}</span>{text.slice(at + accent.length)}</>;
}

function ActivityPreview({ activity, pastUse, today, unreviewed = false, expanded = false, countsPerPeriod = false }: { activity: ActivityModule; pastUse: boolean; today?: string; unreviewed?: boolean; expanded?: boolean; countsPerPeriod?: boolean }) {
  const metric = activityHeadline(activity, pastUse, { countsPerPeriod });
  const number = (value: number) => expanded ? fullNumber(value) : compactNumber(value);
  const series = activitySeries(activity);
  const freshness = freshnessNote(activity.freshness, activity.capturedAt, { today });
  return (
    <div className="card-activity-preview">
      {unreviewed && <p className="card-evidence-review">Unreviewed evidence</p>}
      <p>
        {metric === undefined ? "No data points supplied" : <>
          <strong><Figures text={number(metric.value)} /></strong>{" "}
          {metric.label}
        </>}
      </p>
      {metric?.reported && <p className="card-activity-reported">{number(metric.reported.value)} {metric.reported.label}</p>}
      {activity.kind === "contributionCalendar" && <ContributionCalendar activity={activity} />}
      {activity.kind === "artifactCollection" && <ArtifactLinks artifacts={activity.artifacts} />}
      {series && <UsageChart {...series} framed={false} />}
      {expanded && (activity.kind === "headlineMetrics" || activity.kind === "codingActivity") && <dl className="activity-preview-metrics">
        {activity.supporting.map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{compactNumber(metric.value)}{metric.unit ? ` ${metric.unit}` : ""}</dd></div>)}
      </dl>}
      {/* The front says the period and its age in words; the back keeps the scope, exact dates and status word. */}
      <p className="card-activity-coverage">
        {activity.period ? formatPeriod(activity.period.start, activity.period.end) : "Measurement period not supplied"}
        {freshness && <span data-freshness={activity.freshness}> · {freshness}</span>}
      </p>
    </div>
  );
}

/** A date a visitor reads ("1 Sep 2026"), with the exact stored value in its datetime attribute. */
export function PlainDate({ value }: { value: string }) {
  return <time dateTime={value}>{dayMonthYear(value)}</time>;
}

/** "1 Aug", for a date: its day and month, the year being the card's period's. */
const dayMonth = (date: string) => dayMonthYear(date).split(" ").slice(0, 2).join(" ");

/** How a point's period reads on the back: "1 Aug" for a day or a week's first day, "Aug 2026", or the date for a level. */
const POINT_WORDS: Readonly<Record<"day" | "week" | "month" | "level", (date: string) => string>> = {
  day: date => dayMonth(date),
  week: date => dayMonth(date),
  month: date => monthYearOf(date),
  level: date => dayMonthYear(date),
};

const MONTH_NAME = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

/** A calendar's months, each with its contributions: what the front's cells add up to, which they can't show as numbers. */
function MonthValues({ activity }: { activity: Extract<ActivityModule, { kind: "contributionCalendar" }> }) {
  const coverage = contributionCalendarCoverage(activity);
  if (!coverage) return null;
  const months = monthlyTotals(coverage.days);
  const busiest = months.reduce((best, month) => (month.total > best.total ? month : best), months[0]);
  // Whole months need only their names: the caption carries the years, and the shorter names fit more columns.
  const whole = months.every(month => month.first.endsWith("-01") && month.last === cadenceEnd(month.first, "month"));
  const span = formatPeriod(months[0].first, months.at(-1)!.last);
  return <>
    <p className="card-back-values-caption">Contributions each month{whole ? `, ${span}` : ""}</p>
    <ol className="card-back-values" aria-label={`Contributions each month, ${span}`} data-short={whole ? "" : undefined}>
      {months.map(month => <li key={month.month}><span>{whole ? MONTH_NAME.format(new Date(`${month.first}T00:00:00Z`)) : formatPeriod(month.first, month.last)}</span><strong>{fullNumber(month.total)}</strong></li>)}
    </ol>
    {months.length > 1 && <p className="card-back-busiest">
      Most contributions: {formatPeriod(busiest.first, busiest.last)}, with {fullNumber(busiest.total)}, on {busiest.activeDays} of {busiest.days} {busiest.days === 1 ? "day" : "days"} drawn.
    </p>}
  </>;
}

const DAYS_IN_WEEK = 7;

/** "29–31 Aug", or "30 Aug–1 Sep": a short week's days without the year, which the card's period already says. */
function dayRange(first: string, last: string): string {
  const [from, to] = [dayMonth(first), dayMonth(last)];
  return from.split(" ")[1] === to.split(" ")[1] ? `${from.split(" ")[0]}–${to}` : `${from}–${to}`;
}

/** Coding bars' days, a week at a time from the first: how many had any activity. Days are counted, so no unnamed count is added up. */
function WeekActiveDays({ days }: { days: readonly { date: string; count: number }[] }) {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const weeks = Array.from({ length: Math.ceil(sorted.length / DAYS_IN_WEEK) }, (_, index) => sorted.slice(index * DAYS_IN_WEEK, (index + 1) * DAYS_IN_WEEK));
  return <>
    <p className="card-back-values-caption">Active days each week, from the day it starts</p>
    <ol className="card-back-values" aria-label="Active days each week">
      {/* A week shorter than seven days is named by the days it has. */}
      {weeks.map(week => <li key={week[0].date}>
        <span>{week.length === DAYS_IN_WEEK ? dayMonth(week[0].date) : dayRange(week[0].date, week.at(-1)!.date)}</span>
        <strong>{week.filter(day => day.count > 0).length} of {week.length}</strong>
      </li>)}
    </ol>
  </>;
}

/** Past this many days, a narrow card's back leads with its highest days and keeps every day behind a press. */
const LONG_DAILY_SERIES = 14;
const HIGHEST_DAYS = 4;

/** A series' every value, in a compact list the front's bars can't show as numbers. */
function SeriesValues({ activity }: { activity: Extract<ActivityModule, { kind: "timeSeries" }> }) {
  const series = normalizeSeries(activity.points, activity.unit);
  if (!series.points.length) return null;
  const words = POINT_WORDS[series.cadence ?? "level"];
  const list = (points: typeof series.points, label: string) => <ol className="card-back-values" aria-label={label}>
    {points.map(point => <li key={point.date}><span>{words(point.date)}</span><strong>{fullNumber(point.value)}</strong></li>)}
  </ol>;
  const every = list(series.points, `${activity.label}, ${series.cadence ? `each ${series.cadence}` : "by date"}`);
  if (series.cadence !== "day" || series.points.length <= LONG_DAILY_SERIES) return <>
    {series.cadence === "week" && <p className="card-back-values-caption">Each week, from the day it starts</p>}
    {every}
  </>;
  // A month of days runs to sixteen rows on a phone, so a narrow card shows the highest few and every day one press away.
  // The card's width picks one of the two (globals.css), so a screen reader meets only the one shown.
  const highest = [...series.points].sort((a, b) => b.value - a.value || a.date.localeCompare(b.date)).slice(0, HIGHEST_DAYS);
  return <div className="series-values">
    <div className="series-values-wide">{every}</div>
    <div className="series-values-narrow">
      <p className="card-back-values-caption">Highest days</p>
      {list(highest, "Highest days")}
      <Collapsible className="series-values-every">
        <CollapsibleTrigger className="card-provenance-trigger">All {series.points.length} days</CollapsibleTrigger>
        <CollapsiblePanel hiddenUntilFound>{list(series.points, `${activity.label}, each day`)}</CollapsiblePanel>
      </Collapsible>
    </div>
  </div>;
}

function ActivityMeta({ activity }: { activity: ActivityModule }) {
  return (
    <div className="activity-meta">
      <span>{activity.provenanceLabel}</span>
      <span>{activity.attributionScope.toLowerCase()} activity</span>
      <span>
        {activity.period
          ? <><PlainDate value={activity.period.start} /> to <PlainDate value={activity.period.end} /></>
          : "Measurement period not supplied"}
      </span>
      {activity.freshness !== "FRESH" && (
        <span data-freshness={activity.freshness}>{activity.freshness.toLowerCase()}</span>
      )}
      <span>Snapshot recorded <PlainDate value={activity.capturedAt} /></span>
    </div>
  );
}

/** Whose use an activity counts, in a visitor's words; the disclosure keeps the stored scope. */
const SCOPE_WORDS: Readonly<Record<ActivityModule["attributionScope"], string>> = {
  PERSONAL: "the owner's own use", REPOSITORY: "one repository", WORKSPACE: "a shared workspace", ORGANIZATION: "a whole organisation",
};

/**
 * An activity's provenance on one plain line: where it came from, whose use, its period and how old it is. A sample's provenance
 * only says it is a sample, which its front already says, so How this was measured keeps it.
 */
function activitySummary(activity: ActivityModule, today?: string, sample = false): string {
  const when = freshnessNote(activity.freshness, activity.capturedAt, { today }) ?? `recorded ${dayMonthYear(activity.capturedAt)}`;
  const period = activity.period ? formatPeriod(activity.period.start, activity.period.end) : "Measurement period not supplied";
  return [...(sample ? [] : [activity.provenanceLabel]), SCOPE_WORDS[activity.attributionScope], period, when].join(" · ");
}

function MetricRow({ metrics }: { metrics: readonly { label: string; value: number; unit?: string }[] }) {
  if (!metrics.length) return null;
  return <div className="metric-row">
    {metrics.map(metric => <div key={metric.label}>
      <strong>{compactNumber(metric.value)}</strong>
      <span>{metric.label}{metric.unit ? ` · ${metric.unit}` : ""}</span>
    </div>)}
  </div>;
}

/** What the back adds to the front's activity: never its chart or calendar again, only what the front leaves out. */
function ActivityEvidence({ activity, today, sample }: { activity: ActivityModule; today?: string; sample: boolean }) {
  const empty = (activity.kind === "timeSeries" && !activity.points.length) || (activity.kind === "artifactCollection" && !activity.artifacts.length);
  // Every work, each with the owner's line about it: the front links only the first few, by title.
  const works = activity.kind === "artifactCollection" ? activity.artifacts : [];
  return (
    <div className="activity-module">
      {empty && <p className="activity-empty">{activity.kind === "timeSeries" ? "No data points supplied" : "No linked works selected"}</p>}
      {(activity.kind === "headlineMetrics" || activity.kind === "codingActivity") && <MetricRow metrics={activity.supporting} />}
      {activity.kind === "reviewActivity" && <>
        <MetricRow metrics={[{ label: "bugs caught", value: activity.bugsCaught }]} />
        <div className="severity-row">{activity.severity.map(severity => <span key={severity.label}>{severity.label} · {severity.count}</span>)}</div>
      </>}
      {activity.kind === "contributionCalendar" && activity.memberSince && <p className="activity-caption">Member since {yearOf(activity.memberSince)}</p>}
      {activity.kind === "timeSeries" && <SeriesValues activity={activity} />}
      {activity.kind === "contributionCalendar" && <MonthValues activity={activity} />}
      {activity.kind === "codingActivity" && activity.days?.length ? <WeekActiveDays days={activity.days} /> : null}
      {works.length > 0 && <ul className="artifact-list">
        {/* A linked work's line about it sits inside its link, so the two make one tap target. */}
        {works.map((artifact, index) => {
          const description = artifact.label && <span className="artifact-description">{artifact.label}</span>;
          return <li key={`${index}:${artifact.url}`}>
            {isHttpUrl(artifact.url)
              ? <a href={artifact.url} target="_blank" rel="noreferrer"><span><WholeWords text={artifact.title} /> ↗</span>{description}</a>
              : <><WholeWords text={artifact.title} />{description}</>}
          </li>;
        })}
      </ul>}
      <p className="activity-summary">{activitySummary(activity, today, sample)}</p>
    </div>
  );
}

// A report names the card as well as the page: one owner can publish two cards for the same product, each with its own credit.
const REPORT_HEADLINE_MAX = 80;
function creditReportSubject(profileHandle: string, card: Card, credit: { name: string; platform: string }): string {
  const headline = [...card.headline.trim()];
  const shown = headline.length > REPORT_HEADLINE_MAX ? `${headline.slice(0, REPORT_HEADLINE_MAX - 1).join("")}…` : headline.join("");
  return [`Report credit on proper-respect.com/${profileHandle}`, card.product.name, `${credit.name} on ${credit.platform}`, ...(shown ? [`"${shown}"`] : [])].join(" · ");
}

export function ProductCard({
  card,
  displayMode = "relationship",
  relationshipConfirmed = true,
  goTo = false,
  audience = "visitor",
  expandedActivity = false,
  privateUsage,
  profileHandle,
  deferBrandAssets = false,
  siteTraits,
  backHint,
  headlineAccent,
  sample = false,
  countsPerPeriod = false,
  today: readOn,
  onTurn,
}: {
  card: Card;
  index: number;
  displayMode?: "relationship" | "brand-preview";
  relationshipConfirmed?: boolean;
  goTo?: boolean;
  audience?: "owner" | "visitor";
  expandedActivity?: boolean;
  privateUsage?: PrivateUsageCard;
  /** The published profile the card is shown on. A credit then offers a report naming that page and card. */
  profileHandle?: string;
  /** Lays the card out without fetching its brand fonts or logo, for a card nobody can see yet. */
  deferBrandAssets?: boolean;
  /** What measuring the product's own site added to its brand. Used only beside that same brand. */
  siteTraits?: BrandSiteTraits;
  /** Says what the back holds, in the footer, for a visitor who might never press Details. */
  backHint?: string;
  /** A phrase within the headline to set apart, as the product's own site sets part of its heading in its brand colour. Presentation only. */
  headlineAccent?: string;
  /** An invented example with no owner, as on the homepage: its front says Sample and its words never claim an owner. */
  sample?: boolean;
  /** The series' points each count their own period, so they add up. Presentation only: nothing a card stores can say so. */
  countsPerPeriod?: boolean;
  /** The day the card is read (yyyy-mm-dd), which a snapshot's and a price's age are judged against. Defaults to now. */
  today?: string;
  /** Told each time the card turns, with whether its back now shows. */
  onTurn?: (backShown: boolean) => void;
}) {
  const brandPreview = displayMode === "brand-preview";
  // An invented sample keeps its own wording and never ages.
  const today = sample ? undefined : readOn ?? new Date().toISOString().slice(0, 10);
  const parsedUsage = audience === "owner" && !brandPreview && privateUsage
    ? privateUsageCardSchema.safeParse(privateUsage)
    : undefined;
  const ownerUsage = parsedUsage?.success
    && parsedUsage.data.productSlug === card.product.slug
    && card.product.domain === (parsedUsage.data.productSlug === "claude-code" ? "claude.com" : "openai.com")
    ? parsedUsage.data : undefined;
  const disclosure = card.primaryLink && linkDisclosure(card.primaryLink.type);
  const linkRel = disclosure ? "noopener noreferrer sponsored" : "noopener noreferrer";
  // Only an http or https destination becomes a link; any other keeps its label as plain text.
  const webLink = card.primaryLink && isHttpUrl(card.primaryLink.url) ? card.primaryLink : undefined;
  // The owner's work-sample link, checked again here so a stored non-https
  // value never becomes a link.
  const usageLink = !brandPreview && card.usageLink && usageLinkSchema.safeParse(card.usageLink).success ? card.usageLink : undefined;
  // Typed as written; the card's CSS sets the case, from the product's measured site or the house default.
  const relationshipStatus = relationshipConfirmed ? cardStatusLabel(card) : "Private discovery";
  const cardStatus = brandPreview ? "Brand preview" : relationshipStatus;
  const topLine = !brandPreview && relationshipConfirmed ? cardTopLine(card) : cardStatus;
  const ownerGoTo = !brandPreview && relationshipConfirmed && goTo;
  // What Details adds, in a visitor's words: since when, and how much where the card has numbers.
  const backSays = card.activity || card.measurements?.length ? "How long and how much" : "How long I've used it";
  const footerLabel = ([[brandPreview, "Brand identity"], [!relationshipConfirmed, "Needs your review"], [ownerGoTo, "Go-to"]] as const)
    .find(([applies]) => applies)?.[1] ?? backHint ?? backSays;
  const useLabels = brandPreview ? [] : productUseLabels(card.product.slug, card.uses);
  const pastUse = noLongerInUse(card);
  const credit = brandPreview ? undefined : listedCredit(card.credit);
  const creditWords = credit && creditText(credit);
  const creditLink = credit && creditHref(credit);
  // A Proper Respect page opens here; another platform's profile opens in a new tab.
  const creditLinkTarget = credit?.platform === "PROPER_RESPECT" || !creditWords ? {}
    : { target: "_blank", rel: "noopener noreferrer", "aria-label": `${creditWords.name} on ${creditWords.platform} (opens in a new tab)` };
  const creditReport = credit && creditWords && profileHandle ? reportHref(creditReportSubject(profileHandle, card, creditWords)) : undefined;
  const cost = !brandPreview && card.cost ? costSummary(card.cost, { today, sample }) : undefined;
  // A paused or stopped card's note is why, so its front says it under the headline.
  const reason = !brandPreview && pastUse && card.note && card.note !== card.headline ? card.note : undefined;
  const notePlaceholder = relationshipConfirmed ? "Relationship note not supplied." : "Discovery note not supplied.";
  const headlineText = brandPreview ? card.product.description : card.headline || card.note || notePlaceholder;
  const [isFlipped, setIsFlipped] = useState(false);
  // Turned over, a card keeps at least the height it had, so its back never makes the page under it jump up.
  const [frontHeight, setFrontHeight] = useState<number>();
  const articleRef = useRef<HTMLElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const cardId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const backHeadingRef = useRef<HTMLHeadingElement>(null);
  const hasFlippedRef = useRef(false);
  const brand = card.product.brand?.productSlug === card.product.slug
    && card.product.brand.canonicalDomain === card.product.domain
    ? card.product.brand
    : undefined;
  // A measured page is read only for the product and domain it was measured for; a stored brand already names the same pair.
  const site = siteTraits?.productSlug === card.product.slug && siteTraits.canonicalDomain === card.product.domain ? siteTraits : undefined;
  const appearance = brandAppearance(brand, site);
  const verifiedAssets = verifiedProductAssets(card.product);
  const typography = verifiedAssets ? verifiedProductTypography(verifiedAssets) : productBrandTypography(brand);
  // The headline sits on the hero band where the card has one, otherwise on the card.
  const headlineSurface = appearance.style["--brand-card-band"] ?? appearance.style["--brand-card-background"];
  const headlineSize = HEADLINE_PX[headlineLength(headlineText)];
  const headlineWeight = Number(typography["--brand-card-heading-weight"] ?? DEFAULT_HEADING_WEIGHT);
  const accentColour = !brandPreview && headlineAccent && headlineSurface
    ? headlineAccentColour(brand, headlineSurface, { sizePx: headlineSize, weight: headlineWeight }, site) : undefined;
  const [failedLogoUrls, setFailedLogoUrls] = useState<string[]>([]);
  // A stored wordmark that reads on the brand's colour slab shows straight on it (Cloudflare's); one that fails to load gives way to
  // the card's usual logo, on the tile of the card's surface it then needs.
  const slabWordmark = !verifiedAssets && !officialProductIcon(card.product) && appearance.style["--brand-card-slab"] ? slabLogo(brand, site) : undefined;
  const slabWordmarkShows = brand && slabWordmark && !failedLogoUrls.includes(slabWordmark.url);
  const chosenLogo: CardLogo = slabWordmarkShows
    ? { url: slabWordmark.url, width: slabWordmark.width, height: slabWordmark.height, mode: slabWordmark.mode, provider: brand.provider, layout: "wordmark" }
    : cardLogo({ brand, verifiedAssets, icon: officialProductIcon(card.product), logoUrl: card.product.logoUrl, surface: appearance.surface, failed: failedLogoUrls });
  const logoTile = appearance.style["--brand-card-logo-tile"] ?? (slabWordmark && !slabWordmarkShows ? appearance.style["--brand-card-background"] : undefined);
  const logo = deferBrandAssets ? { ...chosenLogo, url: undefined } : chosenLogo;
  const wordmark = logo.layout === "wordmark";
  const markFailed = (url: string) => setFailedLogoUrls(urls => urls.includes(url) ? urls : [...urls, url]);
  const mark = card.product.name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Focus follows the turn. A card in view stays where the visitor pressed it; one whose top is above the screen (Details pressed
  // at its foot) brings its back's top into view, and closing brings Details back into view.
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const behavior = reducedMotion ? "instant" : "smooth";
    if (isFlipped) {
      backHeadingRef.current?.focus({ preventScroll: true });
      hasFlippedRef.current = true;
      const top = articleRef.current?.getBoundingClientRect().top ?? 0;
      if (top < 0) scrollBy({ top, behavior });
    } else if (hasFlippedRef.current) {
      triggerRef.current?.focus({ preventScroll: true });
      triggerRef.current?.scrollIntoView({ block: "nearest", behavior });
    }
    // Only a turn moves the page, not a change of motion preference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFlipped]);

  // The front stays laid out, unseen, while the back shows, so a resize or a turned phone re-measures the height the card keeps.
  useEffect(() => {
    const front = frontRef.current, article = articleRef.current;
    if (!front || !article || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const style = getComputedStyle(article);
      const frame = ["paddingTop", "paddingBottom", "borderTopWidth", "borderBottomWidth"] as const;
      setFrontHeight(front.offsetHeight + frame.reduce((sum, side) => sum + parseFloat(style[side]), 0));
    });
    observer.observe(front);
    return () => observer.disconnect();
  }, []);

  function turn(backShown: boolean) {
    setIsFlipped(backShown);
    onTurn?.(backShown);
  }

  function closeCard() {
    turn(false);
  }

  return (
    <article
      className="product-card"
      ref={articleRef}
      style={{ ...appearance.style, ...(logoTile ? { "--brand-card-logo-tile": logoTile } : {}), ...typography, ...(isFlipped && frontHeight ? { minHeight: frontHeight } : {}) }}
      data-surface={appearance.surface}
      data-band={appearance.style["--brand-card-band"] ? "" : undefined}
      data-slab={appearance.style["--brand-card-slab"] ? "" : undefined}
      data-panel={appearance.style["--brand-card-panel"] ? "" : undefined}
      data-logo-tile={logoTile ? "" : undefined}
      data-slab-button={appearance.style["--brand-card-slab-button-fill"] ? "" : undefined}
      data-marks={appearance.style["--brand-card-chart-tint"] ? "line" : undefined}
      data-number-backdrop={appearance.style["--brand-card-number-backdrop"] ? "" : undefined}
      data-verified-brand={verifiedAssets?.productSlug}
      data-brand-revision={verifiedAssets?.revision}
      data-side={isFlipped ? "back" : "front"}
      aria-label={`${card.product.name} card`}
      onKeyDown={(event) => {
        if (isFlipped && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closeCard();
        }
      }}
    >
      {deferBrandAssets ? null : verifiedAssets
        ? <style data-verified-product-fonts={verifiedAssets.productSlug}>{verifiedProductFontFaces(verifiedAssets)}</style>
        : <ProductBrandFonts snapshot={brand} />}
      <div ref={frontRef} className="card-front" aria-hidden={isFlipped} inert={isFlipped}>
        <div className="card-topline">
          {!wordmark && <ProductLogo logo={logo} mark={mark} onFailed={markFailed} />}
          <div className="card-title">
            {sample ? <div className="card-eyebrow-row"><p className="eyebrow">{topLine}</p><span className="card-sample-tag">Sample</span></div>
              : <p className="eyebrow">{topLine}</p>}
            {/* A wordmark shows the name, so the heading keeps it for screen readers only. */}
            <h2 className={wordmark ? "card-product-name" : undefined}>{card.product.name}</h2>
            {wordmark && <ProductLogo logo={logo} mark={card.product.name} onFailed={markFailed} />}
          </div>
          {webLink && <div className="card-destination"><a
            className="card-visit"
            href={webLink.url}
            target="_blank"
            rel={linkRel}
            aria-label={`${webLink.label}${disclosure ? ` · ${disclosure}` : ""} (opens in a new tab)`}
          >
            ↗
          </a>{disclosure && <span className="card-link-disclosure">{disclosure}</span>}</div>}
        </div>

        <p className="card-headline" data-length={headlineLength(headlineText)}><HeadlineText text={headlineText} accent={brandPreview ? undefined : headlineAccent} colour={accentColour} /></p>
        {reason && <p className="card-reason">{reason}</p>}
        {!!useLabels.length && <div className="card-uses-block">
          <p className="card-uses-lead">{pastUse ? "I used it to" : "I use it to"}</p>
          <ul className="card-uses" aria-label={pastUse ? "What I used it for" : "What I use it for"}>{useLabels.map(label => <li key={label}>{label}</li>)}</ul>
        </div>}

        {!brandPreview && card.measurements?.length ? <PublicMeasurements measurements={card.measurements} compact sampleCard={sample} /> : null}
        {!brandPreview && card.activity ? (
          <ActivityPreview activity={card.activity} pastUse={pastUse} today={today} unreviewed={!relationshipConfirmed} expanded={expandedActivity} countsPerPeriod={countsPerPeriod} />
        ) : (brandPreview || (audience === "owner" && !ownerUsage && !card.measurements?.length)) ? (
          <p className="activity-placeholder">
            {brandPreview ? "No personal activity is included in this brand preview." : "Add a usage snapshot or describe your history."}
          </p>
        ) : null}
        {ownerUsage && <PrivateUsageCardPreview usage={ownerUsage} />}
        {cost && <p className="card-cost">{cost}</p>}
        {creditWords && <div className="card-credit">
          <p className="card-credit-line">Props to {creditLink
            ? <a href={creditLink} {...creditLinkTarget}>{creditWords.name}</a>
            : creditWords.name} · {creditWords.platform}</p>
          {creditReport && <a className="card-credit-report" href={creditReport}>Not you? Report</a>}
        </div>}

        <div className="card-footer">
          <span id={`${cardId}-footer`} className={ownerGoTo ? "card-go-to" : undefined}><WholeWords text={footerLabel} /></span>
          <button
            ref={triggerRef}
            type="button"
            className="card-button"
            aria-expanded={isFlipped}
            aria-controls={`${cardId}-back`}
            aria-describedby={backHint && footerLabel === backHint ? `${cardId}-footer` : undefined}
            onClick={() => turn(true)}
          >
            Details <span aria-hidden="true">↶</span>
          </button>
        </div>
      </div>

      <section
        id={`${cardId}-back`}
        className="card-back"
        role="region"
        aria-labelledby={`${cardId}-back-title`}
        hidden={!isFlipped}
      >
        {/* The back is the same branded object: its logo and name as on the front. */}
        <div className="card-back-topline">
          {!wordmark && <ProductLogo logo={logo} mark={mark} onFailed={markFailed} />}
          <div className="card-title">
            <h2 ref={backHeadingRef} id={`${cardId}-back-title`} tabIndex={-1} className={wordmark ? "card-product-name" : undefined}>{card.product.name}</h2>
            {wordmark && <ProductLogo logo={logo} mark={card.product.name} onFailed={markFailed} />}
          </div>
          <button type="button" className="close-button" onClick={closeCard}>
            Close details
          </button>
        </div>
        <div className="card-back-content" role="group" aria-label="Card evidence">
          {/* The relationship in one line: its level and link, whether it is the owner's go-to, and since when. */}
          <div className="card-back-facts">
            <div className="status-row">
              <span>{cardStatus}</span>
              {card.primaryLink && <> · <span>{linkTypeLabel(card.primaryLink.type)}</span></>}
            </div>
            {!brandPreview && <>
              {ownerGoTo && <p className="card-go-to">Go-to</p>}
              {!relationshipConfirmed && <p>Needs your review</p>}
              <p className="relationship-date">
                {!relationshipConfirmed ? "Relationship not confirmed" : card.startedAt ? `Since ${yearOf(card.startedAt)}` : "Start date not supplied"}
              </p>
            </>}
          </div>
          {!brandPreview && (card.note ? <blockquote>{card.note}</blockquote> : <p>{notePlaceholder}</p>)}
          <p><WholeWords text={card.product.description} /></p>
          {!brandPreview && card.cost && <p>{costDetail(card.cost, { today, sample })}</p>}
          {!brandPreview && card.activity && <>
            {!relationshipConfirmed && <p className="card-evidence-review">Unreviewed evidence</p>}
            <ActivityEvidence activity={card.activity} today={today} sample={sample} />
          </>}
          {/* Past the few the front shows; the front's own are in How this was measured, each with how it was recorded. */}
          {!brandPreview && card.measurements && card.measurements.length > FRONT_MEASUREMENT_LIMIT ? <MeasurementLines measurements={card.measurements.slice(FRONT_MEASUREMENT_LIMIT)} /> : null}
          {ownerUsage && <PrivateUsageCardDetails usage={ownerUsage} />}
          {/* Every provenance line stays, folded: exact dates, scope, status words and how each number was recorded. */}
          {!brandPreview && <Collapsible className="card-provenance">
            <CollapsibleTrigger className="card-provenance-trigger">How this was measured</CollapsibleTrigger>
            <CollapsiblePanel className="card-provenance-panel" hiddenUntilFound>
              {/* As the top line: a tool no longer in use says when it started, not "since". */}
              {relationshipConfirmed && card.startedAt && <p>{card.status === "ARCHIVED" ? "Started" : "Using since"} <PlainDate value={card.startedAt} /></p>}
              {card.activity && <ActivityMeta activity={card.activity} />}
              {card.measurements?.length ? <PublicMeasurements measurements={card.measurements} /> : null}
              {!card.activity && !card.measurements?.length && <p>No activity or published numbers on this card.</p>}
            </CollapsiblePanel>
          </Collapsible>}
          {brandPreview && brand && <details className="card-brand-provenance" open>
            <summary>Brand provenance</summary>
            <ProductBrandDetails snapshot={brand} />
          </details>}
          {brandPreview && verifiedAssets && <details className="card-brand-provenance" open>
            <summary>Official brand assets</summary>
            <section className="product-brand-details" aria-label="Official brand provenance">
              <p>Official vendor assets identify the product. They do not verify ownership or use.</p>
              <dl className="brand-provenance">
                <div><dt>Source</dt><dd>{verifiedAssets.provider}</dd></div>
                <div><dt>Product</dt><dd><a href={verifiedAssets.productUrl} target="_blank" rel="noopener noreferrer">{card.product.name}</a></dd></div>
                <div><dt>Verified</dt><dd><time dateTime={verifiedAssets.verifiedAt}>{verifiedAssets.verifiedAt}</time></dd></div>
                <div><dt>Revision</dt><dd>{verifiedAssets.revision}</dd></div>
                <div><dt>Logo</dt><dd><a href={verifiedAssets.logoSource.productGuidanceUrl} target="_blank" rel="noopener noreferrer">Official product brand guide</a></dd></div>
                <div><dt>Font</dt><dd>{verifiedAssets.typography.family} · <a href={verifiedAssets.typography.license.path}>{verifiedAssets.typography.license.name}</a></dd></div>
                <div><dt>Asset record</dt><dd><a href={verifiedAssets.manifestPath}>Source URLs and SHA-256 hashes</a></dd></div>
              </dl>
            </section>
          </details>}
          {/* The way out: a work sample, the product's site and how evidence works, on one row where the card has room. */}
          <div className="card-back-links">
            {usageLink && <a
              className="usage-link"
              href={usageLink.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${usageLinkLabelText(usageLink.label)}, on ${usageLinkHost(usageLink.url)} (opens in a new tab)`}
            >
              <span>{usageLinkLabelText(usageLink.label)} ↗</span>
              <span className="usage-link-host">{usageLinkHost(usageLink.url)}</span>
            </a>}
            {webLink ? <a
              className="outbound-link"
              href={webLink.url}
              rel={linkRel}
              target="_blank"
            >
              {webLink.label} ↗
              {disclosure && <span className="card-link-disclosure">{disclosure}</span>}
            </a> : card.primaryLink && <span className="outbound-link">{card.primaryLink.label}</span>}
            {/* The card also renders without a Next.js router (standalone bundles), so a plain link. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            {!brandPreview && <a className="evidence-link" href="/about/methodology">How evidence works</a>}
          </div>
        </div>
      </section>
    </article>
  );
}
