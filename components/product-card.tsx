"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import {
  selectProductBrandLogo,
  type ProductBrandSnapshot,
} from "@/src/domain/product-brand";
import type {
  ActivityModule,
  PublicProfile,
} from "@/src/domain/public-profile";
import { ProductBrandDetails } from "./product-brand-details";
import { ProductBrandFonts, productBrandTypography } from "./product-brand-fonts";
import {
  verifiedProductAssets,
  selectVerifiedProductLogo,
  verifiedProductTypography,
  verifiedProductFontFaces,
  type VerifiedProductAssets,
} from "@/src/domain/verified-product-assets";

type Card = PublicProfile["cards"][number];

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

function brandAppearance(brand?: ProductBrandSnapshot) {
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
  }
  const accent = roles?.accent && luminance(roles.accent);
  // Default cards alternate between these two dark surfaces. An accent must
  // remain readable on both when no explicit background/text pair was supplied.
  const backgrounds = readablePair ? [background] : [luminance("#171713")!, luminance("#25251F")!];
  if (typeof accent === "number" && roles?.accent
    && backgrounds.every((value) => contrast(accent, value) >= 4.5)) {
    style["--brand-card-accent"] = roles.accent;
  }
  return { style, surface };
}

function ProductLogo({
  brand,
  verifiedAssets,
  logoUrl,
  mark,
  surface,
}: {
  brand?: ProductBrandSnapshot;
  verifiedAssets?: VerifiedProductAssets;
  logoUrl?: string;
  mark: string;
  surface: "light" | "dark";
}) {
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const verifiedLogo = verifiedAssets && selectVerifiedProductLogo(verifiedAssets, surface, failedUrls);
  const logo = !verifiedAssets && brand ? selectProductBrandLogo({
    logos: brand.logos.filter((candidate) => !failedUrls.includes(candidate.url)),
  }, surface) : undefined;
  const imageUrl = verifiedAssets ? verifiedLogo?.path
    : logo?.url ?? (logoUrl && !failedUrls.includes(logoUrl) ? logoUrl : undefined);

  return (
    <span
      className="product-logo"
      data-logo-layout={verifiedAssets ? "wordmark" : undefined}
      data-logo-mode={verifiedLogo?.mode ?? (logo ? logo.mode : undefined)}
      data-logo-provider={verifiedLogo ? verifiedAssets?.provider : logo ? brand?.provider : undefined}
      aria-hidden="true"
    >
      {imageUrl ? (
        // Retained provider assets may use any verified asset host. Native images
        // preserve onError fallback without a remote image-loader allowlist.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          width={verifiedLogo?.width}
          height={verifiedLogo?.height}
          referrerPolicy="no-referrer"
          onError={() => setFailedUrls((urls) => urls.includes(imageUrl) ? urls : [...urls, imageUrl])}
        />
      ) : mark}
    </span>
  );
}

const standardNumber = new Intl.NumberFormat("en", { notation: "standard", maximumFractionDigits: 1 });
const abbreviatedNumber = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
function compactNumber(value: number) {
  return (value >= 10_000 ? abbreviatedNumber : standardNumber).format(value);
}

function activityHighlight(activity: ActivityModule) {
  switch (activity.kind) {
    case "contributionCalendar":
      return { value: activity.total, label: "contributions" };
    case "headlineMetrics":
    case "codingActivity":
      return activity.primary;
    case "timeSeries":
      return { value: activity.points.at(-1)?.value, label: activity.label, unit: activity.unit };
    case "artifactCollection":
      return { value: activity.total, label: "artifacts" };
    case "reviewActivity":
      return { value: activity.reviews, label: "reviews" };
  }
}

function ContributionCalendar({ activity }: { activity: Extract<ActivityModule, { kind: "contributionCalendar" }> }) {
  if (activity.days.length === 0) return <p className="activity-empty">No daily contribution counts supplied</p>;
  const days = [...activity.days].sort((a, b) => a.date.localeCompare(b.date));
  const first = new Date(`${days[0].date}T00:00:00Z`);
  const firstSunday = first.getTime() - first.getUTCDay() * 86_400_000;
  const last = new Date(`${days.at(-1)!.date}T00:00:00Z`).getTime();
  const weeks = Math.floor((last - firstSunday) / (7 * 86_400_000)) + 1;
  const missingDays = Math.round((last - first.getTime()) / 86_400_000) + 1 - new Set(days.map(day => day.date)).size;
  return (
    <div className="contribution-calendar">
      <div className="contribution-calendar-layout">
        <div className="contribution-weekdays" aria-hidden="true">
          {["", "Mon", "", "Wed", "", "Fri", ""].map((label, index) => <span key={index}>{label}</span>)}
        </div>
        <div className="activity-calendar contribution-grid" role="group" aria-label="Daily contributions, Sunday to Saturday in each column" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))`, maxWidth: `calc(${weeks * 0.7}rem + ${weeks - 1} * clamp(1px, 0.25vw, 3px))` }}>
          {days.map(day => {
            const date = new Date(`${day.date}T00:00:00Z`);
            const label = `${day.date}: ${day.count} ${day.count === 1 ? "contribution" : "contributions"}`;
            return <span key={day.date} role="img" aria-label={label} title={label} data-date={day.date} data-level={day.level}
              style={{ gridColumn: Math.floor((date.getTime() - firstSunday) / (7 * 86_400_000)) + 1, gridRow: date.getUTCDay() + 1 }} />;
          })}
        </div>
      </div>
      <div className="contribution-legend" aria-hidden="true">Less {[0, 1, 2, 3, 4].map(level => <i key={level} data-level={level} />)} More</div>
      {(!activity.period || activity.period.start !== days[0].date || activity.period.end !== days.at(-1)!.date) && (
        <p className="contribution-range">Daily counts: {days[0].date} – {days.at(-1)!.date}</p>
      )}
      {missingDays > 0 && <p className="contribution-gap">{missingDays} {missingDays === 1 ? "day has" : "days have"} no supplied count; blank spaces are not zero activity.</p>}
    </div>
  );
}

function ActivityPreview({ activity, unreviewed = false }: { activity: ActivityModule; unreviewed?: boolean }) {
  const metric = activityHighlight(activity);
  return (
    <div className="card-activity-preview">
      {unreviewed && <p className="card-evidence-review">Unreviewed evidence</p>}
      <p>
        {metric.value === undefined ? "No observations supplied" : <>
          <strong>{compactNumber(metric.value)}</strong>{" "}
          {metric.label}{metric.unit ? ` · ${metric.unit}` : ""}
          {activity.kind === "timeSeries" ? " · observation" : ""}
        </>}
      </p>
      {activity.kind === "contributionCalendar" && <ContributionCalendar activity={activity} />}
      <p className="card-activity-coverage">
        {activity.attributionScope.toLowerCase()} activity ·{" "}
        {activity.period ? `${activity.period.start} to ${activity.period.end}` : "Measurement period not supplied"}
        {activity.freshness !== "FRESH" && <span data-freshness={activity.freshness}> · {activity.freshness.toLowerCase()}</span>}
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
      <span data-freshness={activity.freshness}>
        {activity.freshness === "FRESH"
          ? "Updated"
          : activity.freshness.toLowerCase()}
      </span>
      <span>Snapshot recorded {activity.capturedAt.slice(0, 10)}</span>
    </div>
  );
}

function ActivityView({ activity }: { activity: ActivityModule }) {
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
    const maximum = Math.max(...activity.points.map((point) => point.value), 1);
    return (
      <div className="activity-module">
        {latest ? <>
          <div className="activity-hero">
            <strong>{compactNumber(latest.value)}</strong>
            <span>{activity.label}{activity.unit ? ` · ${activity.unit}` : ""}</span>
          </div>
          <p className="activity-caption">Observed {latest.date}</p>
          <div className="activity-bars" aria-label={`${activity.label} trend`}>
            {activity.points.map((point) => (
              <span
                key={point.date}
                style={{ height: `${Math.max(0, (point.value / maximum) * 100)}%` }}
                title={`${point.date}: ${point.value}${activity.unit ? ` ${activity.unit}` : ""}`}
              />
            ))}
          </div>
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
            {activity.artifacts.map((artifact) => (
              <li key={artifact.url}>
                <a href={artifact.url} target="_blank" rel="noreferrer">
                  {artifact.title} ↗
                </a>
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
}: {
  card: Card;
  index: number;
  displayMode?: "relationship" | "brand-preview";
  relationshipConfirmed?: boolean;
  goTo?: boolean;
  audience?: "owner" | "visitor";
}) {
  const brandPreview = displayMode === "brand-preview";
  const linkDisclosure = card.primaryLink?.type === "AFFILIATE" ? "Affiliate link"
    : card.primaryLink?.type === "REFERRAL" ? "Referral link" : undefined;
  const linkRel = linkDisclosure ? "noopener noreferrer sponsored" : "noopener noreferrer";
  const cardStatus = brandPreview ? "BRAND PREVIEW" : relationshipConfirmed ? card.status : "PRIVATE DISCOVERY";
  const ownerGoTo = !brandPreview && relationshipConfirmed && goTo;
  const footerLabel = brandPreview ? "Brand identity" : !relationshipConfirmed ? "Needs your review" : ownerGoTo ? "Owner-selected go-to" : "Relationship & evidence";
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
  const appearance = brandAppearance(brand);
  const verifiedAssets = verifiedProductAssets(card.product);
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
      {verifiedAssets
        ? <style data-verified-product-fonts={verifiedAssets.productSlug}>{verifiedProductFontFaces(verifiedAssets)}</style>
        : <ProductBrandFonts snapshot={brand} />}
      <div className="card-front" aria-hidden={isFlipped} inert={isFlipped}>
        <div className="card-topline">
          {!verifiedAssets && <ProductLogo brand={brand} logoUrl={card.product.logoUrl} mark={mark} surface={appearance.surface} />}
          <div className="card-title">
            <p className="eyebrow">
              {cardStatus}
              {!brandPreview && relationshipConfirmed && card.startedAt ? ` · SINCE ${card.startedAt.slice(0, 4)}` : ""}
            </p>
            <h2 className={verifiedAssets ? "card-product-name" : undefined}>{card.product.name}</h2>
            {verifiedAssets && <ProductLogo verifiedAssets={verifiedAssets} mark={card.product.name} surface={appearance.surface} />}
          </div>
          {card.primaryLink && <div className="card-destination"><a
            className="card-visit"
            href={card.primaryLink.url}
            target="_blank"
            rel={linkRel}
            aria-label={`${card.primaryLink.label}${linkDisclosure ? ` · ${linkDisclosure}` : ""} (opens in a new tab)`}
          >
            ↗
          </a>{linkDisclosure && <span className="card-link-disclosure">{linkDisclosure}</span>}</div>}
        </div>

        <p className="card-headline">
          {brandPreview ? card.product.description : card.headline || card.note || notePlaceholder}
        </p>

        {!brandPreview && card.activity ? (
          <ActivityPreview activity={card.activity} unreviewed={!relationshipConfirmed} />
        ) : (brandPreview || audience === "owner") ? (
          <p className="activity-placeholder">
            {brandPreview ? "No personal activity is included in this brand preview." : "Add a usage snapshot or describe your history."}
          </p>
        ) : null}

        <div className="card-footer">
          <span className={ownerGoTo ? "card-go-to" : undefined}>{footerLabel}</span>
          <button
            ref={triggerRef}
            type="button"
            className="card-button"
            aria-expanded={isFlipped}
            aria-controls={`${cardId}-back`}
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
            {card.primaryLink && <span>{card.primaryLink.type}</span>}
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
          {!brandPreview && card.cost && (
            <p>
              {card.cost.basis === "ESTIMATE" ? "Estimated cost" : card.cost.basis === "RECEIPT" ? "Receipt cost" : "Owner-reported cost"}: {new Intl.NumberFormat("en", { style: "currency", currency: card.cost.currency }).format(card.cost.amount)}
              {card.cost.cadence === "MONTHLY" ? "/month" : card.cost.cadence === "ANNUAL" ? "/year" : card.cost.cadence === "ONE_TIME" ? " one-time" : " (billing interval unknown)"}
              {" · as of "}{card.cost.asOf}
              {card.cost.period && ` · ${card.cost.period.start} to ${card.cost.period.end}`}
            </p>
          )}
          {!brandPreview && card.activity && <>
            {!relationshipConfirmed && <p className="card-evidence-review">Unreviewed evidence</p>}
            <ActivityView activity={card.activity} />
          </>}
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
          {card.primaryLink && <a
            className="outbound-link"
            href={card.primaryLink.url}
            rel={linkRel}
            target="_blank"
          >
            {card.primaryLink.label} ↗
            {linkDisclosure && <span className="card-link-disclosure">{linkDisclosure}</span>}
          </a>}
        </div>
      </section>
    </article>
  );
}
