"use client";

import { useRef, useState } from "react";
import type {
  ActivityModule,
  PublicProfile,
} from "@/src/domain/public-profile";

type Card = PublicProfile["cards"][number];

function compactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function ActivityMeta({ activity }: { activity: ActivityModule }) {
  return (
    <div className="activity-meta">
      <span>{activity.provenanceLabel}</span>
      <span data-freshness={activity.freshness}>
        {activity.freshness === "FRESH"
          ? "Updated"
          : activity.freshness.toLowerCase()}
      </span>
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
        {activity.days.length > 0 ? (
          <div className="activity-calendar" aria-label="Contribution activity">
            {activity.days.map((day) => (
              <span
                key={day.date}
                data-level={day.level}
                title={`${day.date}: ${day.count} contributions`}
              />
            ))}
          </div>
        ) : (
          <p className="activity-empty">Calendar refresh pending</p>
        )}
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
              <span>{metric.label}</span>
            </div>
          ))}
        </div>
        <ActivityMeta activity={activity} />
      </div>
    );
  }

  if (activity.kind === "timeSeries") {
    const maximum = Math.max(...activity.points.map((point) => point.value), 1);
    return (
      <div className="activity-module">
        <div className="activity-hero">
          <strong>
            {compactNumber(activity.points.at(-1)?.value ?? 0)}
          </strong>
          <span>{activity.label}</span>
        </div>
        <div className="activity-bars" aria-label={`${activity.label} trend`}>
          {activity.points.map((point) => (
            <span
              key={point.date}
              style={{ height: `${Math.max(6, (point.value / maximum) * 100)}%` }}
              title={`${point.date}: ${point.value}${activity.unit ?? ""}`}
            />
          ))}
        </div>
        <ActivityMeta activity={activity} />
      </div>
    );
  }

  if (activity.kind === "artifactCollection") {
    return (
      <div className="activity-module">
        <div className="activity-hero">
          <strong>{compactNumber(activity.total)}</strong>
          <span>notebooks</span>
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
          <p className="activity-empty">No public notebooks selected</p>
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
            <span>{metric.label}</span>
          </div>
        ))}
      </div>
      <ActivityMeta activity={activity} />
    </div>
  );
}

export function ProductCard({
  card,
  index,
}: {
  card: Card;
  index: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mark = card.product.name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function openCard() {
    setIsOpen(true);
    dialogRef.current?.showModal();
  }

  function closeCard() {
    dialogRef.current?.close();
  }

  return (
    <article className="product-card">
      <div className="card-topline">
        <div
          className="product-logo"
          style={
            card.product.logoUrl
              ? { backgroundImage: `url("${card.product.logoUrl}")` }
              : undefined
          }
          aria-hidden="true"
        >
          {!card.product.logoUrl && mark}
        </div>
        <span>{(index + 1).toString().padStart(2, "0")}</span>
      </div>

      <div className="card-title">
        <div>
          <p className="eyebrow">
            {card.status} · {card.startedAt ? `SINCE ${card.startedAt.slice(0, 4)}` : "IN USE"}
          </p>
          <h2>{card.product.name}</h2>
        </div>
        <a
          href={card.primaryLink.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${card.primaryLink.label} (opens in a new tab)`}
        >
          ↗
        </a>
      </div>

      {card.activity ? (
        <ActivityView activity={card.activity} />
      ) : (
        <div className="activity-module activity-placeholder">
          <span>Activity module ready for owner approval</span>
        </div>
      )}

      <div className="card-footer">
        <p>{card.headline}</p>
        <button ref={triggerRef} className="card-button" onClick={openCard}>
          Details
        </button>
      </div>

      <dialog
        ref={dialogRef}
        className="card-back"
        aria-labelledby={`card-back-${card.product.slug}`}
        onClose={() => {
          setIsOpen(false);
          triggerRef.current?.focus();
        }}
        onCancel={() => setIsOpen(false)}
      >
        {isOpen && (
          <div>
            <div className="status-row">
              <span>CARD DETAILS</span>
              <span>{card.primaryLink.type}</span>
            </div>
            <h2 id={`card-back-${card.product.slug}`}>
              {card.product.name}
            </h2>
            <blockquote>“{card.note}”</blockquote>
            <p>{card.product.description}</p>
            {card.activity && (
              <p>
                {card.activity.attributionScope.toLowerCase()} activity ·{" "}
                {card.activity.provenanceLabel} · captured{" "}
                {card.activity.capturedAt.slice(0, 10)}
              </p>
            )}
            <a
              className="outbound-link"
              href={card.primaryLink.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              {card.primaryLink.label} ↗
            </a>
            <button className="close-button" onClick={closeCard}>
              Close details
            </button>
          </div>
        )}
      </dialog>
    </article>
  );
}
