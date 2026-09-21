"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "./product-card";
import type { PublicProfile } from "@/src/domain/public-profile";
import styles from "./product-example.module.css";

type Example = { id: string; card: PublicProfile["cards"][number]; source: string; sourceLabel: string; caveat: string };
const period = { start: "2026-08-01", end: "2026-08-28" };
const capture = { capturedAt: "2026-08-29T00:00:00.000Z", freshness: "STALE" as const, provenanceLabel: "Illustrative sample, not account data", period };
const countPattern = [0, 2, 4, 1, 0, 6, 2, 3, 0, 0, 4, 7, 1, 2, 5, 0, 3, 2, 1, 0, 4, 6, 2, 0, 3, 1, 4, 2];
const githubPeriod = { start: "2025-09-01", end: "2026-08-31" };
const githubDays = Array.from({ length: 365 }, (_, index) => {
  const count = countPattern[(index * 11 + Math.floor(index / 7)) % countPattern.length];
  return { date: new Date(Date.UTC(2025, 8, 1 + index)).toISOString().slice(0, 10), count, level: Math.min(count, 4) };
});
// These examples never enter an owner's collection or published profile.
const examples: Example[] = [
  {
    id: "github", source: "https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference", sourceLabel: "GitHub contribution definitions",
    caveat: "A captured contribution calendar. Contributions include more than commits; coverage follows the source account and date range.",
    card: {
      product: { name: "GitHub", slug: "github", domain: "github.com", logoUrl: "/brand/github/2026-09-21/favicon.svg", description: "Code hosting and collaboration." },
      status: "ACTIVE", headline: "The work behind the code.", note: "Example only. Contribution totals do not measure code quality or hours worked.",
      activity: { ...capture, capturedAt: "2026-09-01T00:00:00.000Z", period: githubPeriod, kind: "contributionCalendar", attributionScope: "PERSONAL", total: githubDays.reduce((sum, day) => sum + day.count, 0), days: githubDays },
    },
  },
  {
    id: "clay", source: "https://university.clay.com/docs/credit-usage", sourceLabel: "Clay usage and CSV exports",
    caveat: "Concept example. Distinct enriched rows need row-level success records and deduplication. Actions and credits are separate. Clay import is not available here yet.",
    card: {
      product: { name: "Clay", slug: "clay", domain: "clay.com", description: "Data enrichment and GTM workflows." },
      status: "ACTIVE", headline: "From research to enriched records.", note: "Example rule: count each table and row identity once after a successful enrichment in the selected period. Repeated runs and multiple columns do not create more distinct rows. Workspace activity is not automatically personal activity.",
      activity: { ...capture, kind: "headlineMetrics", attributionScope: "WORKSPACE", primary: { label: "Distinct rows enriched", value: 1200 }, supporting: [{ label: "Enrichment actions", value: 3400 }, { label: "Data credits", value: 5100 }] },
    },
  },
  {
    id: "wispr", source: "https://docs.wisprflow.ai/articles/8760230576-your-usage-tab-track-your-dictation-stats-in-wispr-flow", sourceLabel: "Wispr Flow Insights",
    caveat: "A personal Insights snapshot. Total words are cumulative; a monthly comparison does not make the lifetime total a monthly count. No dictation text is needed for this card.",
    card: {
      product: { name: "Wispr Flow", slug: "wisprflow", domain: "wisprflow.ai", description: "Voice dictation across your apps." },
      status: "ACTIVE", headline: "Put your voice to work.", note: "Illustrative cumulative Insights totals. Device coverage and capture date should stay attached to the imported snapshot.",
      activity: { capturedAt: capture.capturedAt, freshness: capture.freshness, provenanceLabel: capture.provenanceLabel, kind: "headlineMetrics", attributionScope: "PERSONAL", primary: { label: "Total words dictated", value: 28400 }, supporting: [{ label: "Average speed", value: 116, unit: "WPM" }, { label: "Current streak", value: 12, unit: "days" }, { label: "Apps used", value: 8 }] },
    },
  },
  {
    id: "claude", source: "https://code.claude.com/docs/en/monitoring-usage", sourceLabel: "Claude Code usage metrics",
    caveat: "Concept example. Token categories come from recorded sessions. They are not your subscription bill or remaining plan allowance. Claude Code import is not available here yet.",
    card: {
      product: { name: "Claude Code", slug: "claude-code", domain: "claude.com", description: "An AI coding agent for your terminal and editor." },
      status: "ACTIVE", headline: "Understand the usage behind a session.", note: "Illustrative metadata totals only. A real import needs session coverage, model attribution and deduplication. Cost estimates and actual bills stay separate. Prompts and code are not required for a usage card.",
      activity: { ...capture, kind: "codingActivity", attributionScope: "PERSONAL", primary: { label: "Recorded tokens", value: 3400000 }, supporting: [{ label: "Input", value: 500000 }, { label: "Output", value: 120000 }, { label: "Cache read", value: 2700000 }, { label: "Cache creation", value: 80000 }] },
    },
  },
];

export function ProductExample() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const example = examples[index];
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex(current => (current + 1) % examples.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [playing]);
  function select(next: number) {
    setPlaying(false);
    setIndex((next + examples.length) % examples.length);
  }
  return <section className={styles.carousel} aria-label="Product usage examples" aria-roledescription="carousel" onMouseEnter={() => setPlaying(false)} onFocusCapture={() => setPlaying(false)}>
    <p className={styles.label}>Inside a card / Illustrative examples</p>
    <div className={styles.choices} aria-label="Choose a product example">
      {examples.map((item, itemIndex) => <button type="button" key={item.id} aria-pressed={index === itemIndex} onClick={() => select(itemIndex)}>{item.card.product.name}</button>)}
    </div>
    <div className={styles.slide} data-example={example.id} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${examples.length}: ${example.card.product.name}`} aria-live={playing ? "off" : "polite"}>
      <p className={styles.sample}>Sample data / No account connected</p>
      <ProductCard key={example.id} card={example.card} index={index} expandedActivity />
      <p className={styles.caveat}>{example.caveat}</p>
      <a className={styles.source} href={example.source} target="_blank" rel="noreferrer">{example.sourceLabel} ↗</a>
    </div>
    <div className={styles.controls}>
      <button type="button" onClick={() => select(index - 1)} aria-label="Previous example">←</button>
      <span>{index + 1} / {examples.length}</span>
      <button type="button" onClick={() => select(index + 1)} aria-label="Next example">→</button>
      <button type="button" className={styles.play} onClick={() => setPlaying(current => !current)}>{playing ? "Pause slideshow" : "Play slideshow"}</button>
    </div>
    <p className={styles.label}>Keep your usage private. Choose what to share.</p>
  </section>;
}
