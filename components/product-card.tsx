"use client";

import { FRONT_MEASUREMENT_LIMIT, MeasurementLines, PublicMeasurements } from "./measurement-values";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@ui-sdk/react/collapsible";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
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
import { tablePreview as parseTablePreview, type TableColumnKind, type TablePreview, type TablePreviewCell, type TablePreviewInput } from "@/src/domain/table-preview";
import { useReducedMotion } from "./use-reduced-motion";
import { dayMonthYear, formatPeriod, freshnessNote, monthYear as monthYearOf, yearOf } from "@/src/domain/format-period";
import { activityHeadline, cadenceEnd, FRONT_ARTIFACT_LIMIT, normalizeSeries } from "@/src/domain/activity-headline";
import { productUseLabels } from "@/src/domain/product-uses";
import { privateUsageCardSchema, type PrivateUsageCard } from "@/src/domain/private-usage-card";
import { UsageChart } from "./usage-chart";
import { PrivateUsageCardDetails, PrivateUsageCardPreview } from "./private-usage-card-details";
import { ProductBrandDetails } from "./product-brand-details";
import { ProductBrandFonts, productBrandTypography } from "./product-brand-fonts";
import { brandAccent, brandCardKit, brandMark } from "@/src/domain/brand-kit";
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
  const roles = brand?.styleguide?.colors;
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
};

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
    return failed.includes(icon.path) ? {}
      : { url: icon.path, width: icon.width, height: icon.height, mode: "surface" in icon ? icon.surface : undefined, provider: "official-vendor", layout: "app-icon" };
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
          ref={element => {
            if (element?.complete && element.naturalWidth === 0) onFailed(url);
          }}
          src={ownOriginImageUrl(url)}
          alt=""
          width={logo.width}
          height={logo.height}
          referrerPolicy="no-referrer"
          onError={() => onFailed(url)}
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

/** Scrolls a calendar wider than its card to the newest week, once, the first time it has a width (a slide has none until shown). */
function useNewestWeekInView() {
  const ref = useRef<HTMLDivElement>(null);
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
      markClippedMonths(element);
    });
    observer.observe(element);
    return () => { observer.disconnect(); element.removeEventListener("scroll", onScroll); };
  }, []);
  return ref;
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
  const scrollRef = useNewestWeekInView();
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
    <div className="contribution-calendar">
      <div ref={scrollRef} className="contribution-scroll" tabIndex={0} role="region" aria-label="Contribution calendar; scroll horizontally to see the full period"
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

/** How long a shown table waits before its running row fills in, so the visitor sees it pending first. */
const FILL_IN_DELAY_MS = 600;

const noSubscription = () => () => undefined;

/** Once, a moment after the card is shown; a visitor who asked for less motion sees the filled-in table as soon as the page runs. */
function useFilledIn(shown: boolean): boolean {
  const reducedMotion = useReducedMotion();
  // The server can't know the preference, so it draws the row pending; the browser decides.
  const inBrowser = useSyncExternalStore(noSubscription, () => true, () => false);
  const [filledIn, setFilledIn] = useState(false);
  useEffect(() => {
    if (!shown || reducedMotion || filledIn) return;
    const timer = window.setTimeout(() => setFilledIn(true), FILL_IN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [shown, reducedMotion, filledIn]);
  return filledIn || (reducedMotion && inBrowser);
}

/** An address may break after its @ and before its last dot, so a narrow column wraps it in whole parts rather than mid-word. */
function cellText(text: string) {
  const [at, dot] = [text.indexOf("@"), text.lastIndexOf(".")];
  if (at <= 0) return <WholeWords text={text} />;
  if (dot <= at) return <>{text.slice(0, at + 1)}<wbr />{text.slice(at + 1)}</>;
  return <>{text.slice(0, at + 1)}<wbr />{text.slice(at + 1, dot)}<wbr />{text.slice(dot)}</>;
}

/** A column kind's glyph, drawn in its header the way an enrichment table marks what each column holds. 16-unit strokes in the text colour. */
const COLUMN_GLYPHS: Readonly<Record<TableColumnKind, string>> = {
  text: "M3 4h10M8 4v9",
  email: "M2.5 4.5h11v8h-11zM3 5l5 4 5-4",
  waterfall: "M2 3.5h12M4 7.5h8M6 11.5h4",
  ai: "M8 2l1.4 4.6L14 8l-4.6 1.4L8 14l-1.4-4.6L2 8l4.6-1.4z",
  formula: "M11 2.5c-2 0-2.6 1-3 3l-1.6 7c-.4 1.6-1 2-2.4 2M5 7h5",
};
function ColumnGlyph({ kind }: { kind: TableColumnKind }) {
  return <svg className="table-glyph" data-kind={kind} viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d={COLUMN_GLYPHS[kind]} /></svg>;
}

type WaterfallStep = "missed" | "answered" | "asking" | "unasked";
/** Each provider of a waterfall in turn: the ones before the step missed, the step answered (or is being asked), the rest not asked. Nothing found: all missed. */
function waterfallSteps({ step, of }: NonNullable<TablePreviewCell["waterfall"]>, state: TablePreviewCell["state"]): WaterfallStep[] {
  return Array.from({ length: of }, (_, index): WaterfallStep => {
    if (state === "empty" || index + 1 < step) return "missed";
    if (index + 1 > step) return "unasked";
    return state === "pending" ? "asking" : "answered";
  });
}
function waterfallWords({ step, of }: NonNullable<TablePreviewCell["waterfall"]>, state: TablePreviewCell["state"]) {
  if (state === "empty") return `, none of ${of} providers answered`;
  return state === "pending" ? `, asking provider ${step} of ${of}` : `, provider ${step} of ${of} answered`;
}

/** A waterfall cell: its run status as a pill, then a mark for each provider it tries in turn. */
function WaterfallCell({ text, state, waterfall }: Pick<TablePreviewCell, "text" | "state" | "waterfall">) {
  return <>
    <span className="table-pill" data-state={state}>{text}</span>
    {waterfall && <><span className="table-steps" aria-hidden="true">{waterfallSteps(waterfall, state).map((step, index) => <i key={index} data-step={step} />)}</span>
      <span className="visually-hidden">{waterfallWords(waterfall, state)}</span></>}
  </>;
}

/** What a waterfall's marks mean, said once in the table's title bar for a sighted visitor; each cell already says it in words. */
function WaterfallKey() {
  return <span className="card-table-key" aria-hidden="true">
    <span><i data-step="answered" />found it</span> <span><i data-step="missed" />missed</span> <span><i data-step="unasked" />not asked</span>
  </span>;
}

/**
 * A few rows of a table the product makes, drawn as a real table: a row number in the gutter, the row filled in last highlighted,
 * long cells wrapping rather than cut short. A narrow card stacks each row into a block, every cell beside its column's label.
 */
function TablePreviewBlock({ preview, shown, full = false }: { preview: TablePreview; shown: boolean; full?: boolean }) {
  const captionId = useId();
  const filledIn = useFilledIn(shown);
  const cellShown = (cell: TablePreviewCell) => filledIn && cell.fillsIn ? cell.fillsIn : cell;
  const rows = full ? preview.rows : preview.rows.slice(0, preview.frontRows);
  const hasWaterfall = preview.columns.some(column => "kind" in column && column.kind === "waterfall");
  const count = preview.summary ?? (!full && preview.totalRows ? `${rows.length} of ${fullNumber(preview.totalRows)} rows` : undefined);
  return (
    <div className="card-table-preview" role="region" tabIndex={0} aria-labelledby={captionId} data-full={full ? "" : undefined}>
      <table>
        <caption id={captionId}><span className="card-table-title"><span><WholeWords text={preview.caption} /></span>{hasWaterfall && <WaterfallKey />}</span></caption>
        <thead><tr>{preview.columns.map(column => <th key={column.label} scope="col" data-enriched={column.enriched ? "" : undefined}>
          {"kind" in column && column.kind && <ColumnGlyph kind={column.kind} />}{column.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, rowIndex) => <tr key={rowIndex} data-latest={row.some(cell => cell.fillsIn) ? "" : undefined}>
            {row.map((cell, column) => {
              const shownCell = cellShown(cell), kind = preview.columns[column];
              const content = <span className="table-cell-value">{"kind" in kind && kind.kind === "waterfall" ? <WaterfallCell {...shownCell} /> : cellText(shownCell.text)}
                {cell.detail && <span className="table-cell-detail"><WholeWords text={cell.detail} /></span>}</span>;
              return column === 0
                ? <th key={column} scope="row" data-label={kind.label} data-state={shownCell.state}>{content}</th>
                : <td key={column} data-label={kind.label} data-state={shownCell.state}>{content}</td>;
            })}
          </tr>)}
        </tbody>
      </table>
      {count && <p className="card-table-count"><WholeWords text={count} /></p>}
    </div>
  );
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
          <strong>{number(metric.value)}</strong>{" "}
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

/** Coding bars' days, a week at a time from the first: how many had any activity. Days are counted, so no unnamed count is added up. */
function WeekActiveDays({ days }: { days: readonly { date: string; count: number }[] }) {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const weeks = Array.from({ length: Math.ceil(sorted.length / DAYS_IN_WEEK) }, (_, index) => sorted.slice(index * DAYS_IN_WEEK, (index + 1) * DAYS_IN_WEEK));
  return <>
    <p className="card-back-values-caption">Active days each week, from the day it starts</p>
    <ol className="card-back-values" aria-label="Active days each week">
      {/* A week shorter than seven days is named by the days it has. */}
      {weeks.map(week => <li key={week[0].date}>
        <span>{week.length === DAYS_IN_WEEK ? dayMonth(week[0].date) : formatPeriod(week[0].date, week.at(-1)!.date)}</span>
        <strong>{week.filter(day => day.count > 0).length} of {week.length}</strong>
      </li>)}
    </ol>
  </>;
}

/** A series' every value, in a compact list the front's bars can't show as numbers. */
function SeriesValues({ activity }: { activity: Extract<ActivityModule, { kind: "timeSeries" }> }) {
  const series = normalizeSeries(activity.points, activity.unit);
  if (!series.points.length) return null;
  const words = POINT_WORDS[series.cadence ?? "level"];
  return <>
    {series.cadence === "week" && <p className="card-back-values-caption">Each week, from the day it starts</p>}
    <ol className="card-back-values" aria-label={`${activity.label}, ${series.cadence ? `each ${series.cadence}` : "by date"}`}>
      {series.points.map(point => <li key={point.date}><span>{words(point.date)}</span><strong>{fullNumber(point.value)}</strong></li>)}
    </ol>
  </>;
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

/** An activity's provenance on one plain line: where it came from, whose use, its period and how old it is. */
function activitySummary(activity: ActivityModule, today?: string): string {
  const when = freshnessNote(activity.freshness, activity.capturedAt, { today }) ?? `recorded ${dayMonthYear(activity.capturedAt)}`;
  const period = activity.period ? formatPeriod(activity.period.start, activity.period.end) : "Measurement period not supplied";
  return [activity.provenanceLabel, SCOPE_WORDS[activity.attributionScope], period, when].join(" · ");
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
function ActivityEvidence({ activity, today }: { activity: ActivityModule; today?: string }) {
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
      <p className="activity-summary">{activitySummary(activity, today)}</p>
    </div>
  );
}

export function ProductCard({
  card,
  displayMode = "relationship",
  relationshipConfirmed = true,
  goTo = false,
  audience = "visitor",
  expandedActivity = false,
  privateUsage,
  viewerSignedIn = false,
  profileHandle,
  onGiveProps,
  deferBrandAssets = false,
  siteTraits,
  backHint,
  tablePreview,
  shown = true,
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
  viewerSignedIn?: boolean;
  profileHandle?: string;
  onGiveProps?: (handle: string, productSlug: string) => Promise<void>;
  /** Lays the card out without fetching its brand fonts or logo, for a card nobody can see yet. */
  deferBrandAssets?: boolean;
  /** What measuring the product's own site added to its brand. Used only beside that same brand. */
  siteTraits?: BrandSiteTraits;
  /** Says what the back holds, in the footer, for a visitor who might never press Details. */
  backHint?: string;
  /** A few rows of a table the product makes, shown on the front. Presentation only, never part of the card's stored data. */
  tablePreview?: TablePreviewInput;
  /** Whether a visitor can see this card now; a table preview fills in only once it is. */
  shown?: boolean;
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
  const footerLabel = ([[brandPreview, "Brand identity"], [!relationshipConfirmed, "Needs your review"], [ownerGoTo, "Owner-selected go-to"]] as const)
    .find(([applies]) => applies)?.[1] ?? backHint ?? "Relationship & evidence";
  const useLabels = brandPreview ? [] : productUseLabels(card.product.slug, card.uses);
  const table = brandPreview ? undefined : parseTablePreview(tablePreview);
  const pastUse = noLongerInUse(card);
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
  const site = brand && siteTraits?.productSlug === brand.productSlug && siteTraits.canonicalDomain === brand.canonicalDomain ? siteTraits : undefined;
  const appearance = brandAppearance(brand, site);
  const verifiedAssets = verifiedProductAssets(card.product);
  const [failedLogoUrls, setFailedLogoUrls] = useState<string[]>([]);
  const chosenLogo = cardLogo({ brand, verifiedAssets, icon: officialProductIcon(card.product), logoUrl: card.product.logoUrl, surface: appearance.surface, failed: failedLogoUrls });
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
      style={{ ...appearance.style, ...(verifiedAssets ? verifiedProductTypography(verifiedAssets) : productBrandTypography(brand)), ...(isFlipped && frontHeight ? { minHeight: frontHeight } : {}) }}
      data-surface={appearance.surface}
      data-band={appearance.style["--brand-card-band"] ? "" : undefined}
      data-slab={appearance.style["--brand-card-slab"] ? "" : undefined}
      data-panel={appearance.style["--brand-card-panel"] ? "" : undefined}
      data-logo-tile={appearance.style["--brand-card-logo-tile"] ? "" : undefined}
      data-slab-button={appearance.style["--brand-card-slab-button-fill"] ? "" : undefined}
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
          </a>{disclosure && <span className="card-link-disclosure">{disclosure}</span>}
          {viewerSignedIn && disclosure && <button type="button" className="card-props-action" onClick={() => {
            if (onGiveProps && profileHandle) void onGiveProps(profileHandle, card.product.slug);
          }}>Give props</button>}</div>}
        </div>

        <p className="card-headline" data-length={headlineLength(headlineText)}>{headlineText}</p>
        {reason && <p className="card-reason">{reason}</p>}
        {!!useLabels.length && <div className="card-uses-block">
          <p className="card-uses-lead">{pastUse ? "I used it to" : "I use it to"}</p>
          <ul className="card-uses" aria-label={pastUse ? "What I used it for" : "What I use it for"}>{useLabels.map(label => <li key={label}>{label}</li>)}</ul>
        </div>}

        {/* The numbers come first, so a card that publishes them leads with them; a table preview shows where they come from. */}
        {!brandPreview && card.measurements?.length ? <PublicMeasurements measurements={card.measurements} compact /> : null}
        {table && <TablePreviewBlock preview={table} shown={shown} />}
        {!brandPreview && card.activity ? (
          <ActivityPreview activity={card.activity} pastUse={pastUse} today={today} unreviewed={!relationshipConfirmed} expanded={expandedActivity} countsPerPeriod={countsPerPeriod} />
        ) : (brandPreview || (audience === "owner" && !ownerUsage && !card.measurements?.length)) ? (
          <p className="activity-placeholder">
            {brandPreview ? "No personal activity is included in this brand preview." : "Add a usage snapshot or describe your history."}
          </p>
        ) : null}
        {ownerUsage && <PrivateUsageCardPreview usage={ownerUsage} />}
        {cost && <p className="card-cost">{cost}</p>}

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
              {ownerGoTo && <p className="card-go-to">Owner-selected go-to</p>}
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
            <ActivityEvidence activity={card.activity} today={today} />
          </>}
          {/* Past the few the front shows; the front's own are in How this was measured, each with how it was recorded. */}
          {!brandPreview && card.measurements && card.measurements.length > FRONT_MEASUREMENT_LIMIT ? <MeasurementLines measurements={card.measurements.slice(FRONT_MEASUREMENT_LIMIT)} /> : null}
          {table && <TablePreviewBlock preview={table} shown full />}
          {ownerUsage && <PrivateUsageCardDetails usage={ownerUsage} />}
          {/* Every provenance line stays, folded: exact dates, scope, status words and how each number was recorded. */}
          {!brandPreview && <Collapsible className="card-provenance">
            <CollapsibleTrigger className="card-provenance-trigger">How this was measured</CollapsibleTrigger>
            <CollapsiblePanel className="card-provenance-panel" hiddenUntilFound>
              {relationshipConfirmed && card.startedAt && <p>Relationship started <PlainDate value={card.startedAt} /></p>}
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
