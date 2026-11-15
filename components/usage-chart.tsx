"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { chartBars, type ChartBar } from "@/src/domain/chart-bars";
import { fullNumber } from "@/src/domain/format-activity-number";
import { dayMonthYear } from "@/src/domain/format-period";
import { cadenceEnd, seriesCadence } from "@/src/domain/activity-headline";

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
/** Past this many bars the gaps narrow, so the bars keep most of the width. */
const SPACIOUS_BAR_COUNT = 16;
const SPACIOUS_GAP = "4px";
const DENSE_GAP = "2px";
const PERCENT = 100;

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

/** A bar's value as a person reads it: one point as recorded, a run of points as their average to one decimal place. */
function barValue(bar: ChartBar, unit?: string): string {
  const shown = bar.points === 1 ? fullNumber(bar.value) : fullNumber(Number(bar.value.toFixed(1)));
  return `${shown}${unit ? ` ${unit}` : ""}${bar.points === 1 ? "" : " on average"}`;
}

/** The days a bar covers, in plain dates: a weekly point covers its seven days. */
function barDays(bar: ChartBar, unit?: string): { from: string; to: string } {
  return { from: dayMonthYear(bar.start), to: dayMonthYear(cadenceEnd(bar.end, seriesCadence(unit))) };
}

function barTitle(bar: ChartBar, unit?: string): string {
  const { from, to } = barDays(bar, unit);
  return `${from === to ? from : `${from} to ${to}`}: ${barValue(bar, unit)}`;
}

/** The bars again as rows, for a screen reader: the chart itself is one image, and its dates and values live only in hover titles. */
function BarTable({ bars, label, unit }: { bars: readonly ChartBar[]; label?: string; unit?: string }) {
  const rows = bars.map(bar => ({ key: bar.start, ...barDays(bar, unit), value: barValue(bar, unit) }));
  // Bars of one day each read as one date, not a From and a To that are the same.
  const daily = rows.every(row => row.from === row.to);
  return (
    // A table grows to fit its cells whatever its width, so the 1px clip goes on a box around it.
    <div className="visually-hidden">
      <table>
        <caption>{label ?? "Activity"}, one row per bar</caption>
        <thead><tr>{daily ? <th scope="col">Date</th> : <><th scope="col">From</th><th scope="col">To</th></>}<th scope="col">Value</th></tr></thead>
        <tbody>
          {rows.map(row => <tr key={row.key}><th scope="row">{row.from}</th>{!daily && <td>{row.to}</td>}<td>{row.value}</td></tr>)}
        </tbody>
      </table>
    </div>
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

  const bars = resolved && points ? chartBars(points) : [];
  const maximum = Math.max(...bars.map((bar) => bar.value), 1);
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
        <div className="activity-bars" role={label ? "img" : undefined} aria-label={label ? `${label} trend` : undefined}
          style={{ "--bar-gap": bars.length > SPACIOUS_BAR_COUNT ? DENSE_GAP : SPACIOUS_GAP } as CSSProperties}>
          {bars.map((bar, index) => (
            <span
              key={bar.start}
              data-zero={bar.value === 0 ? "" : undefined}
              style={{
                "--bar-height": `${Math.max(0, (bar.value / maximum) * PERCENT)}%`,
                "--bar-delay": `${index * BAR_STAGGER_MS}ms`,
              } as CSSProperties}
              title={barTitle(bar, unit)}
            />
          ))}
        </div>
      ) : (
        <SkeletonBars />
      )}
      {resolved && <BarTable bars={bars} label={label} unit={unit} />}
      {resolved && !ready && (
        <div className="usage-chart-blueprint" aria-hidden="true">
          <SkeletonBars />
        </div>
      )}
      {log && showBlueprint && <p className="usage-chart-log" aria-hidden="true">{log}</p>}
    </div>
  );
}
