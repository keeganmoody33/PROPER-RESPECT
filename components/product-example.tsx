"use client";

import { useEffect, useState, useSyncExternalStore, type FocusEvent } from "react";
import { ProductCard } from "./product-card";
import { isHttpUrl } from "@/src/domain/http-url";
import type { HomepageExample } from "@/src/data/homepage-examples";
import styles from "./product-example.module.css";

const ADVANCE_MS = 8000;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** "auto" follows the visitor's motion preference; a press of play or pause, or picking an example, is their own choice. */
type PlayChoice = "auto" | "playing" | "paused";

function subscribeReducedMotion(listener: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

function useReducedMotion() {
  // The server assumes reduced motion, so nothing starts moving before the preference is known.
  return useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(REDUCED_MOTION).matches, () => true);
}

export function ProductExample({ examples }: { examples: readonly HomepageExample[] }) {
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<PlayChoice>("auto");
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reducedMotion = useReducedMotion();
  const playing = choice === "playing" || (choice === "auto" && !reducedMotion);
  const advancing = playing && !hovered && !focused;

  useEffect(() => {
    if (!advancing) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex(current => (current + 1) % examples.length);
    }, ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [advancing, examples.length]);

  function select(next: number) {
    setChoice("paused");
    setIndex((next + examples.length) % examples.length);
  }

  // Focus on the play toggle is the visitor asking to play, so it must not hold the slideshow.
  function enter(event: FocusEvent<HTMLElement>) {
    setFocused(!(event.target instanceof HTMLElement && event.target.dataset.playToggle !== undefined));
  }

  function leave(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
  }

  return <section className={styles.carousel} aria-label="Product usage examples" aria-roledescription="carousel"
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={enter} onBlur={leave}>
    <p className={styles.label}>Inside a card / Illustrative examples</p>
    <div className={styles.choices} aria-label="Choose a product example">
      {examples.map((item, itemIndex) => <button type="button" key={item.id} aria-pressed={index === itemIndex} onClick={() => select(itemIndex)}>{item.card.product.name}</button>)}
    </div>
    <div className={styles.stage} aria-live={advancing ? "off" : "polite"}>
      {examples.map((example, slideIndex) => {
        const current = slideIndex === index;
        return <div key={example.id} className={styles.slide} data-example={example.id} data-current={current} role="group" aria-roledescription="slide"
          aria-label={`${slideIndex + 1} of ${examples.length}: ${example.card.product.name}`} aria-hidden={!current} inert={!current}>
          <p className={styles.sample}>Sample data / No account connected</p>
          <ProductCard card={example.card} index={slideIndex} expandedActivity />
          {example.caveat && <p className={styles.caveat}>{example.caveat}</p>}
          {example.source && isHttpUrl(example.source.href) && <a className={styles.source} href={example.source.href} target="_blank" rel="noreferrer">{example.source.label} ↗</a>}
        </div>;
      })}
    </div>
    <div className={styles.controls}>
      <button type="button" onClick={() => select(index - 1)} aria-label="Previous example">←</button>
      <span>{index + 1} / {examples.length}</span>
      <button type="button" onClick={() => select(index + 1)} aria-label="Next example">→</button>
      <button type="button" className={styles.play} data-play-toggle onClick={() => setChoice(playing ? "paused" : "playing")}>{playing ? "Pause slideshow" : "Play slideshow"}</button>
    </div>
    <p className={styles.label}>Keep your usage private. Choose what to share.</p>
  </section>;
}
