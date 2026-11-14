"use client";

import { PublicMeasurements } from "./measurement-values";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import {
  selectProductBrandLogo,
  type ProductBrandSnapshot,
} from "@/src/domain/product-brand";
import type {
  ActivityModule,
  PublicProfile,
} from "@/src/domain/public-profile";
import { contributionCalendarCoverage } from "@/src/domain/contribution-calendar-coverage";
import { compactNumber, fullNumber } from "@/src/domain/format-activity-number";
import { usageLinkHost, usageLinkLabelText, usageLinkSchema } from "@/src/domain/usage-links";
import { isHttpUrl } from "@/src/domain/http-url";
import { linkDisclosure, linkTypeLabel } from "@/src/domain/link-type";
import { cardStatusLabel, cardTopLine, noLongerInUse } from "@/src/domain/relationship-level";
import { costDetail, costSummary } from "@/src/domain/cost";
import { tablePreview as parseTablePreview, type TablePreview, type TablePreviewCell, type TablePreviewColumn, type TablePreviewInput } from "@/src/domain/table-preview";
import { useReducedMotion } from "./use-reduced-motion";
import { formatPeriod, freshnessNote } from "@/src/domain/format-period";
import { activityHeadline } from "@/src/domain/activity-headline";
import { productUseLabels } from "@/src/domain/product-uses";
import { privateUsageCardSchema, type PrivateUsageCard } from "@/src/domain/private-usage-card";
import { UsageChart, usageChartLog } from "./usage-chart";
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

/** Scrolls a calendar wider than its card to the newest week, once, the first time it has a width (a back face has none until opened). */
function useNewestWeekInView() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (!element.clientWidth) return;
      element.scrollLeft = element.scrollWidth;
      observer.disconnect();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return ref;
}

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
  }).filter((month, index, all) => index === all.length - 1 || all[index + 1].column - month.column >= 3);
  const columns = { gridTemplateColumns: `repeat(${weeks}, var(--contribution-cell))` };
  return (
    <div className="contribution-calendar">
      <div ref={scrollRef} className="contribution-scroll" tabIndex={0} role="region" aria-label="Contribution calendar; scroll horizontally to see the full period"
        style={{ "--contribution-weeks": weeks } as CSSProperties}>
        <div className="contribution-calendar-layout">
          <div className="contribution-months" aria-hidden="true" style={columns}>
            {months.map(month => <span key={month.month} style={{ gridColumn: month.column }}>{month.label}</span>)}
          </div>
          <div className="contribution-weekdays" aria-hidden="true">
            {["", "Mon", "", "Wed", "", "Fri", ""].map((label, index) => <span key={index}>{label}</span>)}
          </div>
          <div className="activity-calendar contribution-grid" role="group" aria-label="Daily contributions, Sunday to Saturday in each column" style={columns}>
            {days.map(day => {
              const date = new Date(`${day.date}T00:00:00Z`);
              const label = `${day.date}: ${day.count} ${day.count === 1 ? "contribution" : "contributions"}`;
              return <span key={day.date} role="img" aria-label={label} title={label} data-date={day.date} data-level={day.level}
                style={{ gridColumn: Math.floor((date.getTime() - firstSunday) / (7 * 86_400_000)) + 1, gridRow: date.getUTCDay() + 1 }} />;
            })}
          </div>
        </div>
      </div>
      <div className="contribution-legend" aria-hidden="true">Less {[0, 1, 2, 3, 4].map(level => <i key={level} data-level={level} />)} More</div>
      {suppliedRange && <p className="contribution-range">{suppliedRange}</p>}
      {gapNote && <p className="contribution-gap">{gapNote}</p>}
    </div>
  );
}

/** How many of a collection's works the front links; the back lists them all. */
const FRONT_ARTIFACT_LIMIT = 3;

/** The first few works with a web link. A work whose link isn't http or https stays off the front. */
function ArtifactLinks({ artifacts }: { artifacts: Extract<ActivityModule, { kind: "artifactCollection" }>["artifacts"] }) {
  const linked = artifacts.filter(artifact => isHttpUrl(artifact.url)).slice(0, FRONT_ARTIFACT_LIMIT);
  if (!linked.length) return null;
  return (
    <ul className="card-artifact-links">
      {linked.map((artifact, index) => (
        <li key={`${index}:${artifact.url}`}>
          <a href={artifact.url} target="_blank" rel="noopener noreferrer">{artifact.title} ↗</a>
        </li>
      ))}
    </ul>
  );
}

/** How long a shown table waits before its running row fills in, so the visitor sees it pending first. */
const FILL_IN_DELAY_MS = 600;

/** Once, a moment after the card is shown, unless the visitor asked for less motion: then the running row stays as it is. */
function useFilledIn(shown: boolean): boolean {
  const reducedMotion = useReducedMotion();
  const [filledIn, setFilledIn] = useState(false);
  useEffect(() => {
    if (!shown || reducedMotion || filledIn) return;
    const timer = window.setTimeout(() => setFilledIn(true), FILL_IN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [shown, reducedMotion, filledIn]);
  return filledIn;
}

const columnMarks = (column: TablePreviewColumn) => ({ "data-droppable": column.droppable ? "" : undefined });

/**
 * A few rows of a table the product makes, drawn as a real table: a row number in the gutter, enriched columns' headers tinted,
 * and on a narrow card the droppable columns left out so the rest fit, long cells cut short with their full text still read out.
 */
function TablePreviewBlock({ preview, shown }: { preview: TablePreview; shown: boolean }) {
  const captionId = useId();
  const filledIn = useFilledIn(shown);
  const cellShown = (cell: TablePreviewCell) => filledIn && cell.fillsIn ? cell.fillsIn : cell;
  return (
    <div className="card-table-preview" role="region" tabIndex={0} aria-labelledby={captionId}>
      <table>
        <caption id={captionId}>{preview.caption}</caption>
        <thead><tr>{preview.columns.map(column => <th key={column.label} scope="col" data-enriched={column.enriched ? "" : undefined} {...columnMarks(column)}>{column.label}</th>)}</tr></thead>
        <tbody>
          {preview.rows.map((row, rowIndex) => <tr key={rowIndex}>
            {row.map((cell, column) => {
              const { text, state } = cellShown(cell);
              return column === 0
                ? <th key={column} scope="row" data-state={state} {...columnMarks(preview.columns[column])}>{text}</th>
                : <td key={column} data-state={state} {...columnMarks(preview.columns[column])}>{text}</td>;
            })}
          </tr>)}
        </tbody>
      </table>
    </div>
  );
}

function ActivityPreview({ activity, pastUse, unreviewed = false, expanded = false }: { activity: ActivityModule; pastUse: boolean; unreviewed?: boolean; expanded?: boolean }) {
  const metric = activityHeadline(activity, pastUse);
  const series = activitySeries(activity);
  const freshness = freshnessNote(activity.freshness, activity.capturedAt);
  return (
    <div className="card-activity-preview">
      {unreviewed && <p className="card-evidence-review">Unreviewed evidence</p>}
      <p>
        {metric === undefined ? "No observations supplied" : <>
          <strong>{expanded ? fullNumber(metric.value) : compactNumber(metric.value)}</strong>{" "}
          {metric.label}
        </>}
      </p>
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

function ActivityMeta({ activity }: { activity: ActivityModule }) {
  return (
    <div className="activity-meta">
      <span>{activity.provenanceLabel}</span>
      <span>{activity.attributionScope.toLowerCase()} activity</span>
      <span>
        {activity.period
          ? `${activity.period.start} to ${activity.period.end}`
          : "Measurement period not supplied"}
      </span>
      {activity.freshness !== "FRESH" && (
        <span data-freshness={activity.freshness}>{activity.freshness.toLowerCase()}</span>
      )}
      <span>Snapshot recorded {activity.capturedAt.slice(0, 10)}</span>
    </div>
  );
}

function ActivityView({ activity, pastUse }: { activity: ActivityModule; pastUse: boolean }) {
  if (activity.kind === "contributionCalendar") {
    return (
      <div className="activity-module contribution-module">
        <div className="activity-hero">
          <strong>{compactNumber(activity.total)}</strong>
          <span>contributions</span>
        </div>
        <ContributionCalendar activity={activity} />
        {activity.memberSince && (
          <p className="activity-caption">
            Member since {activity.memberSince.slice(0, 4)}
          </p>
        )}
        <ActivityMeta activity={activity} />
      </div>
    );
  }

  if (activity.kind === "headlineMetrics") {
    return (
      <div className="activity-module">
        <div className="activity-hero">
          <strong>{compactNumber(activity.primary.value)}</strong>
          <span>
            {activity.primary.label}
            {activity.primary.unit ? ` · ${activity.primary.unit}` : ""}
          </span>
        </div>
        <div className="metric-row">
          {activity.supporting.map((metric) => (
            <div key={metric.label}>
              <strong>{compactNumber(metric.value)}</strong>
              <span>
                {metric.label}
                {metric.unit ? ` · ${metric.unit}` : ""}
              </span>
            </div>
          ))}
        </div>
        <ActivityMeta activity={activity} />
      </div>
    );
  }

  if (activity.kind === "timeSeries") {
    const latest = activity.points.at(-1);
    const headline = activityHeadline(activity, pastUse);
    return (
      <div className="activity-module">
        {latest && headline ? <>
          <div className="activity-hero">
            <strong>{compactNumber(headline.value)}</strong>
            <span>{headline.label}</span>
          </div>
          <p className="activity-caption">Observed {latest.date}</p>
          <UsageChart
            points={activity.points}
            label={activity.label}
            unit={activity.unit}
            log={usageChartLog({
              source: activity.attributionScope,
              period: activity.period,
            })}
          />
        </> : <p className="activity-empty">No observations supplied</p>}
        <ActivityMeta activity={activity} />
      </div>
    );
  }

  if (activity.kind === "artifactCollection") {
    return (
      <div className="activity-module">
        <div className="activity-hero">
          <strong>{compactNumber(activity.total)}</strong>
          <span>artifacts</span>
        </div>
        {activity.artifacts.length > 0 ? (
          <ul className="artifact-list">
            {activity.artifacts.map((artifact, index) => (
              <li key={`${index}:${artifact.url}`}>
                {isHttpUrl(artifact.url) ? (
                  <a href={artifact.url} target="_blank" rel="noreferrer">
                    {artifact.title} ↗
                  </a>
                ) : artifact.title}
              </li>
            ))}
          </ul>
        ) : (
          <p className="activity-empty">No artifacts selected</p>
        )}
        <ActivityMeta activity={activity} />
      </div>
    );
  }

  if (activity.kind === "reviewActivity") {
    return (
      <div className="activity-module">
        <div className="metric-row metric-row-prominent">
          <div>
            <strong>{compactNumber(activity.reviews)}</strong>
            <span>reviews</span>
          </div>
          <div>
            <strong>{compactNumber(activity.bugsCaught)}</strong>
            <span>bugs caught</span>
          </div>
        </div>
        <div className="severity-row">
          {activity.severity.map((severity) => (
            <span key={severity.label}>
              {severity.label} · {severity.count}
            </span>
          ))}
        </div>
        <ActivityMeta activity={activity} />
      </div>
    );
  }

  return (
    <div className="activity-module">
      <div className="activity-hero">
        <strong>{compactNumber(activity.primary.value)}</strong>
        <span>
          {activity.primary.label}
          {activity.primary.unit ? ` · ${activity.primary.unit}` : ""}
        </span>
      </div>
      {activity.days && activity.days.length > 0 && (
        <div className="activity-calendar" aria-label="Coding activity">
          {activity.days.map((day) => (
            <span
              key={day.date}
              data-level={day.level}
              title={`${day.date}: ${day.count}`}
            />
          ))}
        </div>
      )}
      <div className="metric-row">
        {activity.supporting.map((metric) => (
          <div key={metric.label}>
            <strong>{compactNumber(metric.value)}</strong>
            <span>
              {metric.label}
              {metric.unit ? ` · ${metric.unit}` : ""}
            </span>
          </div>
        ))}
      </div>
      <ActivityMeta activity={activity} />
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
}) {
  const brandPreview = displayMode === "brand-preview";
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
  // A paused or stopped card's note is why, so its front says it under the headline.
  const reason = !brandPreview && pastUse && card.note && card.note !== card.headline ? card.note : undefined;
  const notePlaceholder = relationshipConfirmed ? "Relationship note not supplied." : "Discovery note not supplied.";
  const [isFlipped, setIsFlipped] = useState(false);
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

  useEffect(() => {
    if (isFlipped) {
      backHeadingRef.current?.focus();
      hasFlippedRef.current = true;
    } else if (hasFlippedRef.current) {
      triggerRef.current?.focus();
    }
  }, [isFlipped]);

  function closeCard() {
    setIsFlipped(false);
  }

  return (
    <article
      className="product-card"
      style={{ ...appearance.style, ...(verifiedAssets ? verifiedProductTypography(verifiedAssets) : productBrandTypography(brand)) }}
      data-surface={appearance.surface}
      data-band={appearance.style["--brand-card-band"] ? "" : undefined}
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
      <div className="card-front" aria-hidden={isFlipped} inert={isFlipped}>
        <div className="card-topline">
          {!wordmark && <ProductLogo logo={logo} mark={mark} onFailed={markFailed} />}
          <div className="card-title">
            <p className="eyebrow">{topLine}</p>
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

        <p className="card-headline">
          {brandPreview ? card.product.description : card.headline || card.note || notePlaceholder}
        </p>
        {reason && <p className="card-reason">{reason}</p>}
        {!!useLabels.length && <div className="card-uses-block">
          <p className="card-uses-lead">{pastUse ? "I used it to" : "I use it to"}</p>
          <ul className="card-uses" aria-label={pastUse ? "What I used it for" : "What I use it for"}>{useLabels.map(label => <li key={label}>{label}</li>)}</ul>
        </div>}

        {/* The numbers come first, so a card that publishes them leads with them; a table preview shows where they come from. */}
        {!brandPreview && card.measurements?.length ? <PublicMeasurements measurements={card.measurements} compact /> : null}
        {table && <TablePreviewBlock preview={table} shown={shown} />}
        {!brandPreview && card.activity ? (
          <ActivityPreview activity={card.activity} pastUse={pastUse} unreviewed={!relationshipConfirmed} expanded={expandedActivity} />
        ) : (brandPreview || (audience === "owner" && !ownerUsage && !card.measurements?.length)) ? (
          <p className="activity-placeholder">
            {brandPreview ? "No personal activity is included in this brand preview." : "Add a usage snapshot or describe your history."}
          </p>
        ) : null}
        {ownerUsage && <PrivateUsageCardPreview usage={ownerUsage} />}
        {!brandPreview && card.cost && <p className="card-cost">{costSummary(card.cost)}</p>}

        <div className="card-footer">
          <span id={`${cardId}-footer`} className={ownerGoTo ? "card-go-to" : undefined}>{footerLabel}</span>
          <button
            ref={triggerRef}
            type="button"
            className="card-button"
            aria-expanded={isFlipped}
            aria-controls={`${cardId}-back`}
            aria-describedby={backHint && footerLabel === backHint ? `${cardId}-footer` : undefined}
            onClick={() => setIsFlipped(true)}
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
        <div className="card-back-topline">
          <h2 ref={backHeadingRef} id={`${cardId}-back-title`} tabIndex={-1}>{card.product.name}</h2>
          <button type="button" className="close-button" onClick={closeCard}>
            Close details
          </button>
        </div>
        <div className="card-back-content" role="group" aria-label="Card evidence">
          <div className="status-row">
            <span>{cardStatus}</span>
            {card.primaryLink && <> · <span>{linkTypeLabel(card.primaryLink.type)}</span></>}
          </div>
          {!brandPreview && <>
            {ownerGoTo && <p className="card-go-to">Owner-selected go-to</p>}
            {!relationshipConfirmed && <p>Needs your review</p>}
            {card.note ? <blockquote>{card.note}</blockquote> : <p>{notePlaceholder}</p>}
            <p className="relationship-date">
              {!relationshipConfirmed ? "Relationship not confirmed" : card.startedAt ? <>Since <time dateTime={card.startedAt}>{card.startedAt}</time></> : "Start date not supplied"}
            </p>
          </>}
          <p>{card.product.description}</p>
          {!brandPreview && card.cost && <p>{costDetail(card.cost)}</p>}
          {!brandPreview && card.activity && <>
            {!relationshipConfirmed && <p className="card-evidence-review">Unreviewed evidence</p>}
            <ActivityView activity={card.activity} pastUse={pastUse} />
          </>}
          {!brandPreview && card.measurements?.length ? <PublicMeasurements measurements={card.measurements} /> : null}
          {ownerUsage && <PrivateUsageCardDetails usage={ownerUsage} />}
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
      </section>
    </article>
  );
}
