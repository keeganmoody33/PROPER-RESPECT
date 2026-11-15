"use client";

import { useEffect, useId, useRef, useState, type FocusEvent, type RefObject } from "react";
import { Toggle, ToggleGroup } from "@ui-sdk/react/toggle";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@ui-sdk/react/collapsible";
import { ProductCard } from "./product-card";
import { isHttpUrl } from "@/src/domain/http-url";
import type { HomepageExample } from "@/src/data/homepage-examples";
import { useMediaQuery, useReducedMotion } from "./use-reduced-motion";
import styles from "./product-example.module.css";

const ADVANCE_MS = 8000;
/** The homepage's one-column layout (homepage.module.css), where the examples sit in the first screen under the heading. */
const ONE_COLUMN = "(max-width: 900px)";

/** "auto" follows the visitor's motion preference; a press of play or pause, or picking an example, is their own choice. */
type PlayChoice = "auto" | "playing" | "paused";

/** Whether any of the element is on screen, or in the part of it `rootMargin` leaves; undefined until the browser says. */
function useInView(ref: RefObject<HTMLElement | null>, rootMargin = "0px"): boolean | undefined {
  const [inView, setInView] = useState<boolean>();
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, rootMargin]);
  return inView;
}

/** The screen below its top quarter: while the card reaches into it, a phone's examples row is held at the screen's foot. */
const HOLD_ZONE = "-25% 0px 0px 0px";

export function ProductExample({ examples }: { examples: readonly HomepageExample[] }) {
  const featured = examples.filter(example => example.featured);
  const ordered = [...featured, ...examples.filter(example => !example.featured)];
  const [index, setIndex] = useState(0);
  const [more, setMore] = useState(false);
  const [choice, setChoice] = useState<PlayChoice>("auto");
  // Only a mouse hovers: a tap leaves no pointer resting on the slideshow, so it never holds it.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reducedMotion = useReducedMotion();
  // In one column the slideshow is in view from the start, and each turn would move the copy under it, so it waits for play.
  const oneColumn = useMediaQuery(ONE_COLUMN, true);
  const chooserId = useId();
  const stageRef = useRef<HTMLDivElement>(null);
  // Nobody watches a slideshow below the fold: it holds still until the visitor reaches it, and each arrival starts a whole turn.
  const inView = useInView(stageRef) === true;
  const playing = choice === "playing" || (choice === "auto" && !reducedMotion && !oneColumn);
  // A back the visitor opened holds the slideshow, wherever focus or the pointer goes, until they close it.
  const [openBack, setOpenBack] = useState<string>();
  const backOpen = openBack === ordered[index].id;
  const advancing = playing && !hovered && !focused && inView && !backOpen;
  // The slideshow and its count stay with the featured examples until the visitor picks one of the others; after that, all of them.
  const [pickedOther, setPickedOther] = useState(false);
  const othersInPlay = pickedOther || index >= featured.length;
  if (othersInPlay && !pickedOther) setPickedOther(true);
  const inPlay = othersInPlay ? ordered.length : featured.length;
  // A slide fetches its brand fonts and logo once it is shown or next, so the page doesn't load every example's at once.
  // The featured slides are always mounted; another mounts once it is picked or next, not when More examples opens.
  const upcoming = (index + 1) % inPlay;
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(() => new Set([index, upcoming]));
  if (!revealed.has(index) || !revealed.has(upcoming)) setRevealed(new Set([...revealed, index, upcoming]));

  // In one column the row is held at the screen's foot while the card reaches below the screen's top quarter; a pick from it brings
  // the new card's top into view when it is above the screen or below its middle, so the name just tapped doesn't move.
  // The examples sit in a phone's first screen, so the row is held from the first paint. Once the card has scrolled up into the
  // screen's top quarter it is let go, back in its place under the card, so it never sits over the copy and buttons below.
  const reaching = useInView(stageRef, HOLD_ZONE);
  const held = oneColumn && reaching !== false;
  const pickedRef = useRef(false);
  useEffect(() => {
    if (!pickedRef.current) return;
    pickedRef.current = false;
    const slide = stageRef.current?.querySelector<HTMLElement>("[data-current=true]");
    const card = slide?.querySelector("article");
    if (!held || !slide || !card) return;
    const [cardTop, slideTop] = [card.getBoundingClientRect().top, slide.getBoundingClientRect().top];
    if (cardTop >= 0 && cardTop <= innerHeight / 2) return;
    scrollBy({ top: slideTop, behavior: reducedMotion ? "instant" : "smooth" });
  }, [index, held, reducedMotion]);

  useEffect(() => {
    if (!advancing) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex(current => (current + 1) % inPlay);
    }, ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [advancing, inPlay]);

  function select(next: number) {
    setChoice("paused");
    setIndex((next + inPlay) % inPlay);
  }

  // Pressing play is the visitor asking for movement, so it lets go of the hold that keyboard focus puts on the slideshow.
  function toggle() {
    setChoice(playing ? "paused" : "playing");
    if (!playing) setFocused(false);
  }

  function leave(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
  }

  // Each toggle is named by its product and described by what it shows, which the slide also says above its card.
  const chooserToggle = (item: HomepageExample) => <Toggle key={item.id} value={item.id} onClick={() => setChoice("paused")} aria-describedby={`${chooserId}-${item.id}`}>
    {item.card.product.name}<span id={`${chooserId}-${item.id}`} className="visually-hidden" aria-hidden="true">{item.capability}</span>
  </Toggle>;

  return <section className={styles.carousel} aria-label="Product usage examples" aria-roledescription="carousel" data-held={held ? "" : undefined}
    onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(true); }} onPointerLeave={event => { if (event.pointerType === "mouse") setHovered(false); }}
    onFocus={() => setFocused(true)} onBlur={leave}>
    {/* The controls sit above the chooser and the card, so they stay put while the frame below takes each card's own height. */}
    <div className={styles.header}>
      <p className={styles.label}><span className={styles.shortLabel} aria-hidden="true">Examples</span><span className={styles.longLabel}>Inside a card / Illustrative examples</span></p>
      <div className={styles.controls}>
        <button type="button" onClick={() => select(index - 1)} aria-label="Previous example">←</button>
        <span>{index + 1} / {inPlay}</span>
        <button type="button" onClick={() => select(index + 1)} aria-label="Next example">→</button>
        <button type="button" className={styles.play} onClick={toggle}>{playing ? "Pause" : "Play"}<span className={styles.playWord}> slideshow</span></button>
      </div>
    </div>
    {/* One tab stop across every shown toggle; arrow keys move between examples and a press picks one. The current example stays pressed. */}
    <Collapsible className={styles.chooser} open={more} onOpenChange={setMore}>
      <ToggleGroup className={styles.choices} aria-label="Choose a product example" value={[ordered[index].id]} deselectable={false}
        onValueChange={value => { const next = ordered.findIndex(item => item.id === value[0]); if (next >= 0) { setChoice("paused"); pickedRef.current = true; setIndex(next); } }}>
        {featured.map(chooserToggle)}
        <CollapsiblePanel className={styles.more}>{ordered.slice(featured.length).map(chooserToggle)}</CollapsiblePanel>
      </ToggleGroup>
      <CollapsibleTrigger className={styles.moreTrigger}>More examples <span aria-hidden="true">{more ? "−" : "+"}</span></CollapsibleTrigger>
    </Collapsible>
    {/* A paused slideshow says which example is shown, by its label alone: never the card, whose table can run to dozens of rows. */}
    <p className="visually-hidden" aria-live={advancing ? "off" : "polite"} data-slide-status>{`${index + 1} of ${inPlay}: ${ordered[index].card.product.name}`}</p>
    <div ref={stageRef} className={styles.stage}>
      {ordered.map((example, slideIndex) => {
        if (slideIndex >= featured.length && !revealed.has(slideIndex)) return null;
        const current = slideIndex === index;
        return <div key={example.id} className={styles.slide} data-example={example.id} data-current={current} role="group" aria-roledescription="slide"
          aria-label={`${slideIndex + 1} of ${inPlay}: ${example.card.product.name}`} aria-hidden={!current} inert={!current}>
          <div className={styles.slideHead}>
            <p className={styles.capability} data-capability>{example.capability}</p>
            <p className={styles.sample}>Sample data / No account connected</p>
          </div>
          <ProductCard card={example.card} siteTraits={example.site} index={slideIndex} goTo={example.card.goTo} expandedActivity deferBrandAssets={!revealed.has(slideIndex)} backHint={example.backHint} headlineAccent={example.headlineAccent} countsPerPeriod={example.countsPerPeriod} sample
            onTurn={backShown => setOpenBack(open => backShown ? example.id : open === example.id ? undefined : open)} />
          {example.caveat && <p className={styles.caveat}>{example.caveat}</p>}
          {example.source && isHttpUrl(example.source.href) && <a className={styles.source} href={example.source.href} target="_blank" rel="noreferrer">{example.source.label} ↗</a>}
        </div>;
      })}
    </div>
    <p className={styles.label}>Keep your usage private. Choose what to share.</p>
  </section>;
}
