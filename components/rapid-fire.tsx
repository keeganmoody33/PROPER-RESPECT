"use client";

import { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
import { useMutation, useQueries } from "convex/react";
import { Checkbox, CheckboxIndicator } from "@ui-sdk/react/checkbox";
import { RadioGroup } from "@ui-sdk/react/radio";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { isRelationshipConfirmed, NEVER_USED_KEPT } from "@/src/domain/inventory";
import { productUseLabels, productUseOptions } from "@/src/domain/product-uses";
import { CREDIT_PLATFORMS } from "@/src/domain/props-credit";
import { levelStatus } from "@/src/domain/relationship-level";
import { errorMessage } from "@/src/domain/user-error";
import { headlineHelp } from "@/src/client/headline-suggestion";
import {
  addComment, creditAnswer, lineFromComment, rapidFireCards, rapidFireSave, rapidFireTally, sinceAnswer, STATUS_LABEL, usesAnswer,
  type RapidFireAnswer, type RapidFireCard, type RapidFireStatus,
} from "@/src/client/rapid-fire";
import { useRapidFireVoice, type VoiceState } from "@/src/client/rapid-fire-voice";
import type { RapidFireControls, VoiceCardView } from "@/src/client/voice-tools";
import { rankQueue, type RankSource } from "@/src/client/walkthrough-rank";
import {
  choiceFields, MORE_CHOICES, neverUsedAction, PRIMARY_CHOICES, walkthroughReason,
  type WalkthroughCard, type WalkthroughChoice, type WalkthroughItem, type WalkthroughOutcome, type WalkthroughSession,
} from "@/src/client/walkthrough";
import { ChoiceCard, choiceLabel, ProductMark, ToolScreen } from "./walkthrough";
import styles from "./walkthrough.module.css";
import rapid from "./rapid-fire.module.css";

// The screens of rapid fire (voice onboarding spec, section 4b): an intro, one flashcard per tool, and a check screen.
// Voice and taps change the same card. Moving on saves privately in the background; nothing is published or removed
// without a tap on the check screen or the page preview after it.

const SOURCES_READ = 5;
const USES_SHOWN = 5;

type Phase = "intro" | "cards" | "check";
type Store = Readonly<{ phase: Phase; cards: readonly RapidFireCard[]; index: number; fixing?: string }>;

/** Each tool's first stored sources, read once for the order and for whether Never used it can remove it. */
function useSignals(queue: readonly WalkthroughItem[]) {
  const requests = useMemo(() => Object.fromEntries(queue.map(item => [item.propId, {
    query: api.inventory.evidence, args: { propId: item.propId as Id<"props">, paginationOpts: { numItems: SOURCES_READ, cursor: null } },
  }])), [queue]);
  const results = useQueries(requests);
  return useMemo(() => {
    const read = (propId: string): RankSource[] | undefined => {
      const result = results[propId] as { page?: { sourceType: string; capturedAt?: string; captureProvenance?: { adapter: { id: string } } }[] } | Error | undefined;
      if (!result || result instanceof Error || !result.page) return undefined;
      return result.page.map(source => ({ sourceType: source.sourceType, capturedAt: source.capturedAt, adapterId: source.captureProvenance?.adapter.id }));
    };
    return Object.fromEntries(queue.map(item => [item.propId, read(item.propId)])) as Record<string, RankSource[] | undefined>;
  }, [queue, results]);
}

// What the walkthrough's page summary hears about each card; the rest count as skipped.
const OUTCOME: Partial<Record<RapidFireStatus, WalkthroughOutcome>> = { saved: "saved", removed: "removed", kept: "left" };
// What a fix on the tool's own screen leaves the card as.
const FIXED: Partial<Record<WalkthroughOutcome, RapidFireStatus>> = { saved: "saved", removed: "removed", left: "kept" };

const LIGHT: Readonly<Record<VoiceState, string>> = {
  off: "Voice off", starting: "Starting voice…", listening: "Listening", thinking: "Thinking", speaking: "Speaking", paused: "Paused",
};

function describe(card: RapidFireCard, progress: string): VoiceCardView {
  const { product } = card.item.card;
  return { name: product.name, reason: walkthroughReason(card.item.card, undefined), progress,
    uses: productUseOptions(product.slug).slice(0, USES_SHOWN + 1), answer: card.answer };
}

/** A card's suggested line and the line from what was said, for the check screen. */
function lineOptions(card: RapidFireCard) {
  const { product } = card.item.card;
  const fields = choiceFields(card.answer.choice);
  const suggestion = fields.saves ? headlineHelp({ productName: product.name, productSlug: product.slug,
    confirmed: isRelationshipConfirmed(card.item.card.prop), status: levelStatus(fields.saves.level), level: fields.saves.level,
    uses: productUseLabels(product.slug, { picks: [...card.answer.usePicks], other: card.answer.useOther }), startedAt: card.answer.startedAt }).suggestion : undefined;
  return { suggestion, said: lineFromComment(card.answer.comment) };
}

export function RapidFire({ queue, cards, onFinish, onLeave }: {
  queue: readonly WalkthroughItem[]; cards: readonly WalkthroughCard[];
  onFinish: (session: WalkthroughSession, removed: string[]) => void; onLeave: () => void;
}) {
  const ids = useId();
  const signals = useSignals(queue);
  const save = useMutation(api.inventory.save);
  const remove = useMutation(api.inventory.removeNeverUsed);
  const voice = useRapidFireVoice();
  // One store the voice tools and taps both read and write, so several quick tool calls never act on a stale card.
  const store = useRef<Store>({ phase: "intro", cards: [], index: 0 });
  const [, render] = useReducer((count: number) => count + 1, 0);
  const update = useCallback((change: (current: Store) => Store) => { store.current = change(store.current); render(); }, []);
  const saving = useRef(new Map<string, Promise<void>>());
  const operations = useRef(new Map<string, string>());
  const [removing, setRemoving] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const { phase, cards: deck, index, fixing } = store.current;
  useEffect(() => { heading.current?.focus(); }, [phase, index]);

  const setCard = useCallback((propId: string, change: (card: RapidFireCard) => RapidFireCard) =>
    update(current => ({ ...current, cards: current.cards.map(card => card.item.propId === propId ? change(card) : card) })), [update]);
  const patch = useCallback((patchAnswer: Partial<RapidFireAnswer>) => {
    const card = store.current.cards[store.current.index];
    if (card) setCard(card.item.propId, value => ({ ...value, answer: { ...value.answer, ...patchAnswer } }));
  }, [setCard]);

  /** Saves a card as it stands, after any save of it already on its way, so each names the version the last one made. */
  const persist = useCallback((propId: string) => {
    const run = async () => {
      const card = store.current.cards.find(value => value.item.propId === propId);
      if (!card) return;
      const plan = rapidFireSave(card);
      if (plan.kind === "none") { setCard(propId, value => ({ ...value, status: plan.status, error: undefined })); return; }
      if (plan.kind === "error") { setCard(propId, value => ({ ...value, status: "notSaved", error: plan.message })); return; }
      if (card.savedBody === plan.body && card.status === "saved") return;
      // A retry of the same answers reuses its operation id, so it can't save twice; different answers get a new one.
      const key = `${propId}:${card.version}:${plan.body}`;
      const operationId = operations.current.get(key) ?? crypto.randomUUID();
      operations.current.set(key, operationId);
      setCard(propId, value => ({ ...value, status: "saving", error: undefined }));
      try {
        const result = await save({ ...plan.args, propId: propId as Id<"props">, operationId });
        setCard(propId, value => ({ ...value, status: "saved", version: result.version, savedBody: plan.body }));
      } catch (reason) {
        // Never retried quietly with other answers: the check screen shows why, and the owner decides.
        setCard(propId, value => ({ ...value, status: "notSaved", error: errorMessage(reason, "This answer was not saved.") }));
      }
    };
    const earlier = saving.current.get(propId);
    const next = (async () => {
      // run() catches its own failures, so an earlier save never rejects.
      await earlier;
      await run();
    })();
    saving.current.set(propId, next);
    return next;
  }, [save, setCard]);

  const progress = (at: number) => `${at + 1} of ${store.current.cards.length}`;
  const go = useCallback((to: number, by: "voice" | "tap") => {
    const current = store.current;
    const leaving = current.cards[current.index];
    if (leaving) void persist(leaving.item.propId);
    if (to >= current.cards.length) {
      update(value => ({ ...value, phase: "check" }));
      voice.stop();
      return "That was the last card. Their answers are on screen to check.";
    }
    const target = Math.max(0, to);
    update(value => ({ ...value, index: target }));
    const name = current.cards[target].item.card.product.name;
    // A tap moves the card without the agent knowing; it hears which card is open and says its name.
    if (by === "tap") voice.note(`Owner moved to ${name} (${progress(target)}).`, true);
    return `Now on ${name} (${progress(target)}). Say only its name.`;
  }, [persist, update, voice]);

  const controls = useRef<RapidFireControls | null>(null);
  controls.current = {
    view: () => { const card = store.current.cards[store.current.index]; return card ? describe(card, progress(store.current.index)) : null; },
    setUsage: choice => { patch({ choice }); return `Usage set to ${choice === "NEVER" ? "never used it" : choiceLabel(choice)}.`; },
    setUses: (picks, other, mode) => {
      const card = store.current.cards[store.current.index];
      if (!card) return "No card is open.";
      const result = usesAnswer(card.answer, card.item.card.product.slug, picks, other, mode);
      patch(result.patch);
      return result.unknown.length ? `Set. Not on the card's list, so left out: ${result.unknown.join(", ")}. Put their words in other instead.` : "Uses set.";
    },
    setSince: date => {
      const result = sinceAnswer(date);
      if (!result.ok) return result.message;
      patch({ startedAt: result.value });
      return `Since ${result.value}.`;
    },
    setCredit: (platform, handle, platformName) => {
      const result = creditAnswer(platform, handle, platformName);
      if (!result.ok) return `Not set: ${result.message}`;
      patch(result.patch);
      return "Credit set.";
    },
    addComment: text => {
      const card = store.current.cards[store.current.index];
      if (!card) return "No card is open.";
      patch({ comment: addComment(card.answer.comment, text) });
      return "Comment added.";
    },
    next: () => go(store.current.index + 1, "voice"),
    back: () => store.current.index === 0 ? "This is the first card." : go(store.current.index - 1, "voice"),
    skip: () => {
      const card = store.current.cards[store.current.index];
      if (card) setCard(card.item.propId, value => ({ ...value, answer: { ...value.answer, choice: undefined } }));
      return go(store.current.index + 1, "voice");
    },
    stop: () => { finishCards(); return "Stopped. Their answers are on screen to check."; },
  };
  const tools: RapidFireControls = useMemo(() => ({
    view: () => controls.current!.view(), setUsage: choice => controls.current!.setUsage(choice),
    setUses: (picks, other, mode) => controls.current!.setUses(picks, other, mode), setSince: date => controls.current!.setSince(date),
    setCredit: (platform, handle, name) => controls.current!.setCredit(platform, handle, name), addComment: text => controls.current!.addComment(text),
    next: () => controls.current!.next(), back: () => controls.current!.back(), skip: () => controls.current!.skip(), stop: () => controls.current!.stop(),
  }), []);

  function finishCards() {
    const card = store.current.cards[store.current.index];
    if (card) void persist(card.item.propId);
    voice.stop();
    update(value => ({ ...value, phase: "check" }));
  }

  function begin(withVoice: boolean) {
    const ranked = rankQueue(queue, signals);
    update(() => ({ phase: "cards", cards: rapidFireCards(ranked), index: 0 }));
    if (withVoice && ranked.length) void voice.start(ranked.map(item => item.card.product.name), tools, ranked[0].card.product.name);
  }

  /** A tap the agent should know about, so it doesn't ask again what the screen already says. */
  const tapped = (text: string) => voice.note(`Owner tapped: ${text}.`);

  const live = (propId: string) => cards.find(card => card.prop._id === propId);

  async function removeNever() {
    setRemoving(true);
    const removeOne = async (card: RapidFireCard) => {
      const action = neverUsedAction(card.item.card, signals[card.item.propId]?.length, false, card.item.otherRecords);
      if (action.kind === "wait") return;
      if (action.kind === "leave") { setCard(card.item.propId, value => ({ ...value, status: "kept" })); return; }
      try {
        await remove({ propId: card.item.propId as Id<"props">, expectedVersion: card.version });
        setCard(card.item.propId, value => ({ ...value, status: "removed" }));
      } catch (reason) {
        const message = errorMessage(reason, "This tool was not removed.");
        setCard(card.item.propId, value => message === NEVER_USED_KEPT ? { ...value, status: "kept" } : { ...value, status: "notSaved", error: message });
      }
    };
    // One at a time, so each refusal is shown against its own tool.
    await store.current.cards.filter(value => value.status === "never")
      .reduce(async (previous, card) => { await previous; await removeOne(card); }, Promise.resolve());
    setRemoving(false);
  }

  async function finish() {
    await Promise.all([...saving.current.values()]);
    const outcome = (status: RapidFireStatus): WalkthroughOutcome => OUTCOME[status] ?? "skipped";
    const all = store.current.cards;
    onFinish({ order: all.map(card => card.item.propId), settled: Object.fromEntries(all.map(card => [card.item.propId, outcome(card.status)])),
      products: Object.fromEntries(all.map(card => [card.item.propId, card.item.card.prop.productId])) },
    all.filter(card => card.status === "removed").map(card => card.item.card.product.name));
  }

  if (phase === "intro") {
    const ready = queue.every(item => signals[item.propId] !== undefined);
    return <div className={styles.screen}>
      <h3 ref={heading} tabIndex={-1} className={styles.name}>Rapid fire: your tools, one card at a time</h3>
      <p>We found {queue.length === 1 ? "1 tool" : `${queue.length} tools`} you&apos;ve touched. Each one comes up as a card. For each card, just say:</p>
      <ul className={rapid.sayList}>
        <li><strong>How you use it:</strong> daily, weekly, testing, stopped, or never used it.</li>
        <li><strong>What you use it for</strong>, if you use it.</li>
        <li><strong>Anything else</strong> you want to say about it. Who put you on, what it&apos;s great at, why you stopped.</li>
      </ul>
      <p>Say &ldquo;next&rdquo; when you&apos;re done, or tap Next. Say &ldquo;back&rdquo; to go back.</p>
      <p className={styles.hint}>Answers save privately as you go. You&apos;ll check every one at the end, and nothing goes on your page until you approve it.
        Your voice goes to OpenAI to be understood; Proper Respect keeps only the answers, never the audio or a transcript.</p>
      {!ready && <p role="status" className={styles.hint}>Putting your tools in order…</p>}
      <div className={styles.actions}>
        <button type="button" className="primary-action" onClick={() => begin(true)}>Play when you&apos;re ready</button>
        <button type="button" className="secondary-action" onClick={() => begin(false)}>Go through them by tapping instead</button>
        <button type="button" className={styles.textButton} onClick={onLeave}>Not now</button>
      </div>
    </div>;
  }

  if (fixing) {
    const card = deck.find(value => value.item.propId === fixing);
    const current = live(fixing);
    const back = () => update(value => ({ ...value, fixing: undefined }));
    if (!card || !current?.product) return <div className={styles.screen}>
      <p role="status">This tool is no longer in your collection.</p>
      <div className={styles.actions}><button type="button" className="secondary-action" onClick={back}>Back to your answers</button></div>
    </div>;
    const item: WalkthroughItem = { propId: fixing, card: { ...current, product: current.product }, otherRecords: card.item.otherRecords };
    return <ToolScreen key={`${fixing}:${current.prop.relationshipVersion ?? 0}`} item={item} progress="Fixing an answer" onLeave={back}
      onDone={outcome => {
        const status = FIXED[outcome];
        if (status) setCard(fixing, value => ({ ...value, status, error: undefined, savedBody: undefined,
          version: (current.prop.relationshipVersion ?? 0) + (status === "saved" ? 1 : 0), fixed: true }));
        back();
      }} />;
  }

  if (phase === "check") {
    const tally = rapidFireTally(deck);
    const nevers = deck.filter(card => card.status === "never");
    const waitingOnSources = nevers.some(card => signals[card.item.propId] === undefined);
    return <div className={styles.screen}>
      <h3 ref={heading} tabIndex={-1} className={styles.name}>Check your answers</h3>
      <p role="status">{tallyLine(tally)} Tap a tool to fix it.</p>
      <ul className={rapid.checkList}>{deck.map(card => <CheckRow key={card.item.propId} card={card} live={live(card.item.propId)}
        onFix={() => update(value => ({ ...value, fixing: card.item.propId }))}
        onLine={line => { setCard(card.item.propId, value => ({ ...value, answer: { ...value.answer, ownerLine: line } })); void persist(card.item.propId); }} />)}</ul>
      {nevers.length > 0 && <div className={rapid.removeBox}>
        <p>{nevers.map(card => card.item.card.product.name).join(", ")}: you said you never used {nevers.length === 1 ? "it" : "them"}. A tool with nothing attached comes out of your collection; one with evidence stays as it is. A removal can&apos;t be undone.</p>
        <button type="button" className="secondary-action" disabled={removing || waitingOnSources} onClick={() => void removeNever()}>
          {removeLabel(removing, waitingOnSources, nevers.length)}</button>
      </div>}
      <div className={styles.actions}>
        <button type="button" className="primary-action" onClick={() => void finish()}>Looks right</button>
        <button type="button" className="secondary-action" onClick={() => update(value => ({ ...value, phase: "cards", index: Math.min(value.index, value.cards.length - 1) }))}>Back to the cards</button>
      </div>
      <p className={styles.hint}>Looks right goes on to your page preview. Nothing is published until you approve it there.</p>
    </div>;
  }

  const card = deck[index];
  if (!card) return null;
  const { product } = card.item.card;
  const { answer } = card;
  const fields = choiceFields(answer.choice);
  const options = productUseOptions(product.slug).slice(0, USES_SHOWN);
  const since = answer.startedAt;
  return <div className={styles.screen} aria-labelledby={`${ids}-name`}>
    <div className={styles.topBar}>
      <p className={styles.progress} role="status">{progress(index)}</p>
      <div className={rapid.controls}>
        <button type="button" className={styles.textButton} disabled={index === 0} onClick={() => go(index - 1, "tap")}>Back</button>
        {voice.active && voice.state === "paused" && <button type="button" className={styles.textButton} onClick={voice.resume}>Resume</button>}
        {voice.active && voice.state !== "paused" && <button type="button" className={styles.textButton} onClick={voice.pause}>Pause</button>}
        <button type="button" className={styles.textButton} onClick={finishCards}>Stop</button>
      </div>
    </div>
    <header className={styles.header}>
      <ProductMark product={product} />
      <div>
        <h3 ref={heading} tabIndex={-1} id={`${ids}-name`} className={styles.name}>{product.name}</h3>
        <p className={styles.reason}>{walkthroughReason(card.item.card, signals[card.item.propId]?.map(source => ({ sourceType: source.sourceType, adapterId: source.adapterId })))}</p>
      </div>
    </header>

    <fieldset className={styles.group}>
      <legend id={`${ids}-level`}>How you use it</legend>
      <RadioGroup<WalkthroughChoice> className={styles.choices} aria-labelledby={`${ids}-level`} value={answer.choice ?? null}
        onValueChange={value => { patch({ choice: value ?? undefined }); if (value) tapped(value === "NEVER" ? "never used it" : choiceLabel(value)); }}>
        {[...PRIMARY_CHOICES, ...MORE_CHOICES].map(choice => <ChoiceCard key={choice} choice={choice} />)}
      </RadioGroup>
    </fieldset>

    {fields.asksUses && <fieldset className={styles.group}>
      <legend>What you use it for</legend>
      {options.map(option => <label key={option.id} className={styles.check}>
        <Checkbox className={styles.box} checked={answer.usePicks.includes(option.id)}
          onCheckedChange={checked => { patch({ usePicks: checked === true ? [...answer.usePicks, option.id] : answer.usePicks.filter(id => id !== option.id) }); tapped(`${checked === true ? "added" : "removed"} the use "${option.label}"`); }}>
          <CheckboxIndicator aria-hidden="true">✓</CheckboxIndicator>
        </Checkbox>
        {option.label}
      </label>)}
      {answer.useOther && <p className={rapid.chip}>Something else: {answer.useOther} <button type="button" className={styles.textButton} onClick={() => patch({ useOther: "" })}>Take off</button></p>}
    </fieldset>}

    {fields.asksSince && since && <p className={rapid.chip}>Since {since}
      <button type="button" className={styles.textButton} onClick={() => patch({ startedAt: "" })}>Take off</button></p>}
    {fields.asksCredit && answer.creditHandle && <p className={rapid.chip}>Put on by {answer.creditHandle}
      {" "}({CREDIT_PLATFORMS.find(option => option.id === answer.creditPlatform)?.label}{answer.creditPlatform === "OTHER" && answer.creditPlatformName ? `: ${answer.creditPlatformName}` : ""})
      <button type="button" className={styles.textButton} onClick={() => patch({ creditHandle: "", creditPlatformName: "" })}>Take off</button></p>}

    <label className={styles.field}>What you said about it
      <textarea rows={3} maxLength={1000} value={answer.comment} onChange={event => patch({ comment: event.target.value })}
        placeholder="Your words, as you say them." />
      <span className={styles.hint}>Kept in your private note as you said it. You can use it as the card&apos;s line at the end.</span>
    </label>

    {voice.error && <p role="alert" className={styles.error}>{voice.error}</p>}
    <div className={rapid.bottom}>
      <button type="button" className="primary-action" onClick={() => go(index + 1, "tap")}>{index + 1 === deck.length ? "Next: check your answers" : "Next"}</button>
      <span className={rapid.light} data-state={voice.state} role="status" aria-live="polite">{LIGHT[voice.state]}</span>
      {!voice.active && voice.state !== "starting" && <button type="button" className="secondary-action"
        onClick={() => void voice.start(deck.map(value => value.item.card.product.name), tools, product.name)}>Turn on voice</button>}
    </div>
    <p className={styles.hint}>Next saves this card privately. No level means nothing is saved.</p>
  </div>;
}

function tallyLine(tally: ReturnType<typeof rapidFireTally>): string {
  const parts = [`${tally.saved} saved privately`, tally.never && `${tally.never} never used`, tally.notSaved && `${tally.notSaved} not saved`,
    tally.waiting && `${tally.waiting} with no answer yet`].filter(Boolean);
  return `${parts.join(", ")}.`;
}

function removeLabel(removing: boolean, waiting: boolean, count: number): string {
  if (removing) return "Removing…";
  if (waiting) return "Checking what is attached…";
  return `Remove the ${count === 1 ? "tool" : `${count} tools`} you never used`;
}

function CheckRow({ card, live, onFix, onLine }: {
  card: RapidFireCard; live: WalkthroughCard | undefined; onFix: () => void; onLine: (line: string) => void;
}) {
  const { product } = card.item.card;
  const { answer } = card;
  // A tool fixed on its own screen shows what that screen saved.
  const shown = card.fixed && live ? live.prop : undefined;
  const choice = shown ? shown.level : answer.choice;
  const level = choice && choiceLabel(choice);
  const uses = shown ? productUseLabels(product.slug, shown.uses) : productUseLabels(product.slug, { picks: [...answer.usePicks], other: answer.useOther });
  const line = shown ? shown.headline : answer.ownerLine ?? "";
  const { suggestion, said } = lineOptions(card);
  const canLine = !card.fixed && card.status === "saved";
  return <li className={rapid.row} data-status={card.status}>
    <div className={rapid.rowTop}>
      <button type="button" className={rapid.rowName} onClick={onFix}>{product.name}</button>
      <span className={rapid.status}>{STATUS_LABEL[card.status]}</span>
    </div>
    {level && <p className={rapid.chips}><span className={rapid.chip}>{level}</span>{uses.map(use => <span key={use} className={rapid.chip}>{use}</span>)}</p>}
    {card.error && <p className={styles.error}>{card.error}</p>}
    {!card.fixed && answer.comment && <blockquote className={rapid.quote}>{answer.comment}</blockquote>}
    <p className={styles.hint}>{line ? <>Line: {line}</> : "No line yet, so this card stays private even after you publish."}</p>
    {canLine && <div className={rapid.lineChoices}>
      {suggestion && suggestion !== line && <button type="button" className="secondary-action" onClick={() => onLine(suggestion)}>Use the suggested line: {suggestion}</button>}
      {said && said !== line && <button type="button" className="secondary-action" onClick={() => onLine(said)}>Use what you said as the line</button>}
    </div>}
  </li>;
}
