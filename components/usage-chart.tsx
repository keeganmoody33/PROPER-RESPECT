"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export type UsageChartPoint = {
  date: string;
  value: number;
};

export type UsagePeriod = {
  start: string;
  end: string;
  label?: string;
};

const SKELETON_BAR_COUNT = 30;
const BAR_STAGGER_MS = 18;

export function coverageDays(period: UsagePeriod): number | undefined {
  const start = Date.parse(`${period.start}T00:00:00Z`);
  const end = Date.parse(`${period.end}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return undefined;
  return Math.round((end - start) / 86_400_000) + 1;
}

export function usageChartLog(parts: {
  source?: string;
  period?: UsagePeriod;
  loading?: boolean;
}): string {
  const tokens: string[] = [];
  const source = parts.source?.trim();
  if (source) tokens.push(source.toUpperCase());
  if (parts.period) {
    const days = coverageDays(parts.period);
    if (days) tokens.push(`${days}D`);
    else if (parts.period.label?.trim()) tokens.push(parts.period.label.trim().toUpperCase());
  }
  if (parts.loading) tokens.push("LOADING");
  return tokens.join(" · ");
}

function useBoxSize<T extends HTMLElement>(enabled: boolean) {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>();

  useEffect(() => {
    if (!enabled) return;
    const element = ref.current;
    if (!element) return;

    const update = () => {
      setSize({ width: Math.round(element.offsetWidth), height: Math.round(element.offsetHeight) });
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled]);

  return { ref, size };
}

function BlueprintDimensions({ size }: { size?: { width: number; height: number } }) {
  if (!size || size.width === 0 || size.height === 0) return null;
  return (
    <>
      <span className="blueprint-dim blueprint-dim-w" aria-hidden="true">{size.width} × {size.height}</span>
      <span className="blueprint-dim blueprint-dim-h" aria-hidden="true">{size.height}</span>
    </>
  );
}

export function MeasuredBlueprint({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { ref, size } = useBoxSize<HTMLElement>(true);
  return (
    <article ref={ref} className={className} aria-hidden="true">
      <BlueprintDimensions size={size} />
      {children}
    </article>
  );
}

function SkeletonBars() {
  return (
    <div className="usage-chart-skeleton-bars" aria-hidden="true">
      {Array.from({ length: SKELETON_BAR_COUNT }, (_, index) => (
        <span key={index} data-skeleton-bar="" />
      ))}
    </div>
  );
}

export function UsageChart({
  points,
  label,
  unit,
  loading = false,
  log,
  framed = true,
}: {
  points?: readonly UsageChartPoint[];
  label?: string;
  unit?: string;
  loading?: boolean;
  log?: string;
  framed?: boolean;
}) {
  const resolved = !loading && Boolean(points?.length);
  const [ready, setReady] = useState(false);
  const showBlueprint = !resolved || !ready;
  const { ref, size } = useBoxSize<HTMLDivElement>(framed && showBlueprint);

  useEffect(() => {
    if (!resolved) return;
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, [resolved]);

  const maximum = resolved && points
    ? Math.max(...points.map((point) => point.value), 1)
    : 1;
  return (
    <div
      ref={ref}
      className="usage-chart"
      data-state={resolved ? "resolved" : "skeleton"}
      data-ready={ready ? "true" : "false"}
      data-framed={framed ? "true" : "false"}
    >
      {showBlueprint && framed && <BlueprintDimensions size={size} />}
      {resolved && points ? (
        <div className="activity-bars" aria-label={label ? `${label} trend` : undefined}>
          {points.map((point, index) => (
            <span
              key={point.date}
              style={{
                "--bar-height": `${Math.max(0, (point.value / maximum) * 100)}%`,
                "--bar-delay": `${index * BAR_STAGGER_MS}ms`,
              } as CSSProperties}
              title={`${point.date}: ${point.value}${unit ? ` ${unit}` : ""}`}
            />
          ))}
        </div>
      ) : (
        <SkeletonBars />
      )}
      {resolved && !ready && (
        <div className="usage-chart-blueprint" aria-hidden="true">
          <SkeletonBars />
        </div>
      )}
      {log && showBlueprint && <p className="usage-chart-log" aria-hidden="true">{log}</p>}
    </div>
  );
}
