"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { Checkbox, CheckboxIndicator } from "@ui-sdk/react/checkbox";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@ui-sdk/react/collapsible";
import { Radio, RadioGroup, RadioIndicator } from "@ui-sdk/react/radio";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { isRelationshipConfirmed, NEVER_USED_KEPT } from "@/src/domain/inventory";
import { productUseLabels, productUseOptions, USE_OTHER_MAX } from "@/src/domain/product-uses";
import { CREDIT_INPUT_MAX, CREDIT_OTHER_PLATFORM_MAX, CREDIT_PLATFORMS, creditPlatform } from "@/src/domain/props-credit";
import { cardStatusLabel, levelDefinition, levelLabel, levelStatus } from "@/src/domain/relationship-level";
import { SUGGESTED_HEADLINE_MAX } from "@/src/domain/suggested-headline";
import { officialProductIcon } from "@/src/domain/product-icons";
import { errorMessage } from "@/src/domain/user-error";
import { headlineField, headlineHelp } from "@/src/client/headline-suggestion";
import {
  choiceFields, currentTool, initialAnswer, keptNote, lineAction, MORE_CHOICES, neverUsedAction, PRIMARY_CHOICES, progressLine, resumeSession, settle,
  startSession, walkthroughLine, walkthroughQueue, walkthroughReason, walkthroughSave,
  type WalkthroughAnswer, type WalkthroughCard, type WalkthroughChoice, type WalkthroughItem, type WalkthroughOutcome, type WalkthroughSession,
} from "@/src/client/walkthrough";
import styles from "./walkthrough.module.css";

// Each screen ends with this many use choices at most; "Something else" covers the rest.
const USES_SHOWN = 5;
const SOURCES_READ = 5;

const choiceLabel = (choice: WalkthroughChoice) => choice === "NEVER" ? "Never used it" : levelLabel(choice);
const isMoreChoice = (choice: WalkthroughChoice | undefined) => MORE_CHOICES.some(more => more === choice);

function ChoiceCard({ choice }: { choice: WalkthroughChoice }) {
  return <label className={styles.choice} data-never={choice === "NEVER" ? "" : undefined}>
    <Radio value={choice} className={styles.radio}><RadioIndicator className={styles.dot} /></Radio>
    {choiceLabel(choice)}
  </label>;
}

function choiceHint(choice: WalkthroughChoice | undefined, never: "remove" | "leave", name: string): string {
  if (!choice) return "Pick one. You can change it later in your collection.";
  if (choice !== "NEVER") return levelDefinition(choice);
  return never === "remove" ? `Nothing is saved about ${name}. It comes out of your collection.`
    : `${name} has evidence or a published card attached, so it stays in your collection as it is. Nothing new is saved.`;
}

function ProductMark({ product }: { product: WalkthroughItem["card"]["product"] }) {
  const icon = officialProductIcon(product);
  const [failed, setFailed] = useState(false);
  if (!icon || failed) return <span className={styles.mark} aria-hidden="true">{product.name.trim().charAt(0).toUpperCase()}</span>;
  // A native image keeps the onError fallback to the initial, as the product card's logo does.
  // eslint-disable-next-line @next/next/no-img-element
  return <span className={styles.mark} aria-hidden="true"><img src={icon.path} alt="" width={48} height={48} onError={() => setFailed(true)} /></span>;
}

function ToolScreen({ item, progress, onDone, onLeave }: {
  item: WalkthroughItem; progress: string; onDone: (outcome: WalkthroughOutcome, name: string) => void; onLeave: () => void;
}) {
  const { card } = item;
  const { product } = card;
  const ids = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const save = useMutation(api.inventory.save);
  const remove = useMutation(api.inventory.removeNeverUsed);
  const evidence = usePaginatedQuery(api.inventory.evidence, { propId: item.propId as Id<"props"> }, { initialNumItems: SOURCES_READ });
  const loaded = evidence.status !== "LoadingFirstPage";
  const sources = loaded ? evidence.results.map(source => ({ sourceType: source.sourceType, route: source.captureProvenance?.route, adapterId: source.captureProvenance?.adapter.id })) : undefined;
  const [answer, setAnswer] = useState<WalkthroughAnswer>(() => initialAnswer(card));
  const [more, setMore] = useState(() => isMoreChoice(answer.choice));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Set when the server refuses a removal: something this screen can't see is attached to the record.
  const [keptByServer, setKeptByServer] = useState(false);
  const retry = useRef<{ body: string; id: string } | null>(null);
  useEffect(() => { heading.current?.focus(); }, []);

  const change = (patch: Partial<WalkthroughAnswer>) => { setAnswer(current => ({ ...current, ...patch })); setError(""); };
  const fields = choiceFields(answer.choice);
  const options = productUseOptions(product.slug).slice(0, USES_SHOWN);
  const help = fields.saves ? headlineHelp({ productName: product.name, productSlug: product.slug, confirmed: isRelationshipConfirmed(card.prop), status: levelStatus(fields.saves.level),
    level: fields.saves.level, uses: productUseLabels(product.slug, { picks: [...answer.usePicks], other: answer.useOther }), startedAt: answer.startedAt }) : {};
  const line = headlineField(answer.ownerLine, help.suggestion);
  const action = lineAction(answer.ownerLine, help.suggestion, keptNote(card));
  const never = neverUsedAction(card, sources?.length, keptByServer);
  const submitLabel = answer.choice === "NEVER" ? never.label : action.label;

  async function submit() {
    setBusy(true);
    setError("");
    try {
      if (answer.choice === "NEVER") {
        if (never.kind === "remove") await remove({ propId: item.propId as Id<"props">, expectedVersion: card.prop.relationshipVersion ?? 0 });
        onDone(never.kind === "remove" ? "removed" : "left", product.name);
        return;
      }
      // Exactly the words on screen: the button says whether they are a kept suggestion, the owner's own, or none.
      const result = walkthroughSave(card, answer, action.headline);
      if (!result.ok) { setError(result.message); return; }
      const body = JSON.stringify(result.args);
      if (retry.current?.body !== body) retry.current = { body, id: crypto.randomUUID() };
      await save({ ...result.args, propId: item.propId as Id<"props">, operationId: retry.current.id });
      retry.current = null;
      onDone("saved", product.name);
    } catch (reason) {
      const message = errorMessage(reason, "This answer was not saved. Your collection is unchanged; you can retry or skip.");
      // Not a failure to show: the hint and the button now say the tool stays as it is.
      if (answer.choice === "NEVER" && message === NEVER_USED_KEPT) setKeptByServer(true);
      else setError(message);
    } finally { setBusy(false); }
  }

  return <form className={styles.screen} aria-labelledby={`${ids}-name`} onSubmit={event => { event.preventDefault(); void submit(); }}>
    <div className={styles.topBar}>
      <p className={styles.progress} role="status">{progress}</p>
      <button type="button" className={styles.textButton} onClick={onLeave}>Stop here</button>
    </div>
    <header className={styles.header}>
      <ProductMark product={product} />
      <div>
        <h3 ref={heading} tabIndex={-1} id={`${ids}-name`} className={styles.name}>{product.name}</h3>
        <p className={styles.reason}>{walkthroughReason(card, sources)}</p>
      </div>
    </header>

    <fieldset className={styles.group} disabled={busy}>
      <legend id={`${ids}-level`}>How do you use {product.name}?</legend>
      {/* More opens the other three levels inside the same group, so the arrow keys still move across every level. */}
      <Collapsible className={styles.levels} open={more} onOpenChange={setMore}>
        <RadioGroup<WalkthroughChoice> className={styles.choices} aria-labelledby={`${ids}-level`} aria-describedby={`${ids}-level-hint`}
          value={answer.choice ?? null} onValueChange={value => change({ choice: value ?? undefined })}>
          {PRIMARY_CHOICES.map(choice => <ChoiceCard key={choice} choice={choice} />)}
          <CollapsiblePanel className={styles.morePanel}>{MORE_CHOICES.map(choice => <ChoiceCard key={choice} choice={choice} />)}</CollapsiblePanel>
        </RadioGroup>
        <CollapsibleTrigger className={`collection-disclosure ${styles.disclosure}`}>{more ? "Fewer" : "More"}</CollapsibleTrigger>
      </Collapsible>
      <p id={`${ids}-level-hint`} className={styles.hint}>{choiceHint(answer.choice, never.kind, product.name)}</p>
    </fieldset>

    {fields.asksUses && <fieldset className={styles.group} disabled={busy}>
      <legend>I use {product.name} to (optional)</legend>
      {options.map(option => <label key={option.id} className={styles.check}>
        <Checkbox className={styles.box} checked={answer.usePicks.includes(option.id)}
          onCheckedChange={checked => change({ usePicks: checked === true ? [...answer.usePicks, option.id] : answer.usePicks.filter(id => id !== option.id) })}>
          <CheckboxIndicator aria-hidden="true">✓</CheckboxIndicator>
        </Checkbox>
        {option.label}
      </label>)}
      <label className={styles.field}>Something else<input maxLength={USE_OTHER_MAX} value={answer.useOther} onChange={event => change({ useOther: event.target.value })} /></label>
    </fieldset>}

    {fields.asksSince && <label className={styles.field}>Since (optional)
      <input type="date" value={answer.startedAt} aria-describedby={`${ids}-since`} disabled={busy} onChange={event => change({ startedAt: event.target.value })} />
      <span id={`${ids}-since`} className={styles.hint}>Leave it blank if you don&apos;t know. Signup dates aren&apos;t first use.</span>
    </label>}

    {fields.asksCredit && <Collapsible className={styles.credit} defaultOpen={Boolean(answer.creditHandle)}>
      <CollapsibleTrigger className={`collection-disclosure ${styles.disclosure}`}>Who put you on {product.name}? (optional)</CollapsibleTrigger>
      <CollapsiblePanel><fieldset className={styles.group} disabled={busy}>
        <legend className={styles.hint}>Give them props. A Proper Respect handle links to their page here.</legend>
        <label className={styles.field}>Platform<select value={answer.creditPlatform} onChange={event => change({ creditPlatform: creditPlatform(event.target.value) ?? "PROPER_RESPECT" })}>
          {CREDIT_PLATFORMS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select></label>
        <label className={styles.field}>{answer.creditPlatform === "OTHER" ? "Their name or handle" : "Their handle"}
          <input autoComplete="off" spellCheck={false} maxLength={CREDIT_INPUT_MAX} value={answer.creditHandle} onChange={event => change({ creditHandle: event.target.value })} /></label>
        {answer.creditPlatform === "OTHER" && <label className={styles.field}>Where they are
          <input maxLength={CREDIT_OTHER_PLATFORM_MAX} value={answer.creditPlatformName} onChange={event => change({ creditPlatformName: event.target.value })} /></label>}
      </fieldset></CollapsiblePanel>
    </Collapsible>}

    {fields.asksLine && <label className={styles.field}>The line on its card
      {/* Several rows, so a kept suggestion is read whole before the button keeps it. */}
      <textarea rows={3} maxLength={SUGGESTED_HEADLINE_MAX} value={line.value} placeholder={help.placeholder} disabled={busy}
        aria-describedby={`${ids}-line`} onChange={event => change({ ownerLine: event.target.value })} />
      <span id={`${ids}-line`} className={styles.hint}>{line.suggested
        ? "Suggested from your answers. Edit it, or keep it with the button below."
        : action.standIn ? `With no line here, your saved note shows on the card: ${action.standIn}`
          : "Your own words. A card shows on your page only with a line, and only after you approve it."}</span>
    </label>}

    <p role="alert" className={styles.error}>{error}</p>
    <div className={styles.actions}>
      <button type="submit" className="primary-action" disabled={busy || !answer.choice}>
        {busy ? "Saving…" : submitLabel}
      </button>
      <button type="button" className="secondary-action" disabled={busy} onClick={() => onDone("skipped", product.name)}>Skip</button>
    </div>
    <p className={styles.hint}>Skip saves nothing. Every answer saves privately; nothing goes on your page until you approve it.</p>
  </form>;
}

function PageSummary({ session, cards, removed, onPreview, onClose }: {
  session: WalkthroughSession; cards: readonly WalkthroughCard[]; removed: readonly string[]; onPreview: () => void; onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const saved = cards.filter(card => card.product && session.settled[card.prop._id] === "saved");
  return <div className={styles.screen}>
    <h3 ref={heading} tabIndex={-1} className={styles.name}>Here&apos;s your page</h3>
    <p>Nothing is public yet. These are the tools you said yes to, with the line each card shows. Preview the page, then approve it to publish.</p>
    {saved.length ? <ul className={styles.summary}>{saved.map(card => <li key={card.prop._id}>
      <strong>{card.product!.name}</strong> <span>{cardStatusLabel(card.prop)}</span>
      <p>{walkthroughLine(card) || "No line yet, so this card stays private."}</p>
    </li>)}</ul> : <p>You didn&apos;t save an answer this time. Your collection is as it was.</p>}
    {removed.length > 0 && <p className={styles.hint}>Removed from your collection: {removed.join(", ")}.</p>}
    <div className={styles.actions}>
      <button type="button" className="primary-action" onClick={onPreview}>Preview your page</button>
      <button type="button" className="secondary-action" onClick={onClose}>Done</button>
    </div>
  </div>;
}

/**
 * The guided path through the collection: one tool per screen, each answer saved privately as it is given. It never
 * publishes; its last screen hands over to the existing share preview and approval.
 */
export function Walkthrough({ cards, loadMore }: { cards: readonly WalkthroughCard[]; loadMore?: () => void }) {
  const ids = useId();
  const queue = useMemo(() => walkthroughQueue(cards), [cards]);
  const [stored, setSession] = useState<WalkthroughSession | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);
  // Tools on a later page of the collection join the walk once it has started. Before that, later pages are read only
  // while nothing is waiting, so a tool behind a first page of answered ones still gets its turn.
  const session = stored && resumeSession(stored, queue);
  const started = stored !== null;
  const nothingWaiting = queue.length === 0;
  useEffect(() => { if (started || nothingWaiting) loadMore?.(); }, [started, nothingWaiting, loadMore]);
  if (!session && queue.length === 0) return null;
  const current = session && currentTool(session, queue);

  function done(propId: string, outcome: WalkthroughOutcome, name: string) {
    setSession(value => value && settle(resumeSession(value, queue), propId, outcome));
    if (outcome === "removed") setRemoved(names => [...names, name]);
  }
  function preview() {
    const sharing = document.getElementById("share-all");
    sharing?.scrollIntoView({ block: "start" });
    sharing?.focus();
  }

  return <section id="walkthrough" className={`onboarding-panel ${styles.walkthrough}`} aria-labelledby={`${ids}-title`}>
    <p className="onboarding-kicker">ONE AT A TIME / PRIVATE FIRST</p>
    <h2 id={`${ids}-title`}>Go through your tools</h2>
    {!session && <>
      <p className={styles.lede}>{queue.length === 1 ? "1 tool is" : `${queue.length} tools are`} waiting for your answer. One tool per screen: how you use it, what you use it for, and the line on its card. Each answer saves privately as you go.</p>
      <button type="button" className="primary-action" onClick={() => { setRemoved([]); setSession(startSession(queue)); }}>Go through your tools one at a time</button>
    </>}
    {session && current && <ToolScreen key={current.propId} item={current} progress={progressLine(session, queue)}
      onDone={(outcome, name) => done(current.propId, outcome, name)} onLeave={() => setSession(null)} />}
    {session && !current && <PageSummary session={session} cards={cards} removed={removed} onPreview={preview} onClose={() => setSession(null)} />}
  </section>;
}
