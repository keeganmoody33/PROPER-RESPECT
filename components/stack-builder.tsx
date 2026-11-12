"use client";

import { useEffect, useId, useReducer, useRef, useState, type KeyboardEvent } from "react";
import { useMutation } from "convex/react";
import { makeFunctionReference } from "convex/server";
import type { SaveSelectionResult } from "@/convex/stack";
import {
  addedMessage, emptyTray, nextActiveOption, resolveTypedWhenReady, saveAttempt, saveButtonLabel, savedMessage, TRAY_STATUSES, TYPED_NAME_MAX, trayPicks, trayReducer,
  type SaveAttempt, type StackPick, type TrayEntry, type TrayStatus, type TypedResolution,
} from "@/src/client/stack-tray";
import styles from "./stack-builder.module.css";

type DirectoryModule = typeof import("@/src/domain/product-directory") & typeof import("@/src/client/typed-pick");
type SaveArgs = { operationId: string; picks: StackPick[] };
type SaveResult = Pick<SaveSelectionResult, "created" | "confirmed" | "unchanged">;

// convex/_generated/api is regenerated only against a deployment, so this names the function directly.
const saveSelection = makeFunctionReference<"mutation", SaveArgs, SaveSelectionResult>("stack:saveSelection");

const RESULT_LIMIT = 8;

type EntryState = "available" | "saved" | "listed";

type Option =
  | { kind: "entry"; entry: TrayEntry; state: EntryState }
  | { kind: "typed"; name: string };

const STATE_NOTES: Record<Exclude<EntryState, "available">, string> = { saved: "Already saved", listed: "In your list" };

function entryState(slug: string, held: ReadonlySet<string>, listed: ReadonlySet<string>): EntryState {
  if (held.has(slug)) return "saved";
  return listed.has(`directory:${slug}`) ? "listed" : "available";
}

function resolve(directory: DirectoryModule | null, name: string, website?: string): TypedResolution {
  return resolveTypedWhenReady(directory && directory.resolveTypedPick, name, website);
}

export function StackPicker({ held }: { held: readonly string[] }) {
  const save = useMutation(saveSelection);
  return <StackBuilder held={held} onSave={save} />;
}

export function StackBuilder({ held, onSave }: { held: readonly string[]; onSave: (args: SaveArgs) => Promise<SaveResult> }) {
  const ids = useId();
  const [directory, setDirectory] = useState<DirectoryModule | null>(null);
  const [directoryFailed, setDirectoryFailed] = useState(false);
  const [tray, dispatch] = useReducer(trayReducer, emptyTray);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const attempt = useRef<SaveAttempt | null>(null);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let current = true;
    void (async () => {
      try {
        const [entries, typed] = await Promise.all([import("@/src/domain/product-directory"), import("@/src/client/typed-pick")]);
        if (current) setDirectory({ ...entries, ...typed });
      } catch {
        if (current) setDirectoryFailed(true);
      }
    })();
    return () => { current = false; };
  }, []);

  const heldSlugs = new Set(held);
  const listedKeys = new Set(tray.items.map(item => item.key));
  const trimmed = query.trim();
  const found: TrayEntry[] = trimmed ? (directory?.searchDirectory(trimmed, RESULT_LIMIT) ?? []) : [];
  const typed = trimmed ? resolve(directory, trimmed) : null;
  const resolvedEntry = typed?.kind === "directory" && !found.some(entry => entry.slug === typed.entry.slug) ? [typed.entry] : [];
  const options: Option[] = [
    ...[...found, ...resolvedEntry].map((entry): Option => ({
      kind: "entry", entry: { slug: entry.slug, name: entry.name, domain: entry.domain },
      state: entryState(entry.slug, heldSlugs, listedKeys),
    })),
    ...(typed?.kind === "typed" ? [{ kind: "typed", name: trimmed } as const] : []),
  ];
  const expanded = open && options.length > 0;
  const optionId = (index: number) => `${ids}-option-${index}`;

  useEffect(() => {
    if (expanded && active >= 0) document.getElementById(`${ids}-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [expanded, active, ids]);

  function choose(option: Option) {
    if (option.kind === "entry" && option.state !== "available") return;
    dispatch(option.kind === "entry"
      ? { type: "addEntry", entry: option.entry, held }
      : { type: "addTyped", name: option.name, resolution: { kind: "typed", domain: "" }, held });
    setQuery("");
    setActive(-1);
    search.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!options.length) return;
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive(index => nextActiveOption(index, step, options.length));
    } else if (event.key === "Enter" && expanded) {
      event.preventDefault();
      const option = options[active < 0 ? 0 : active];
      if (option) choose(option);
    } else if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  function addTyped(form: HTMLFormElement) {
    const data = new FormData(form);
    const name = String(data.get("name") ?? "");
    const website = String(data.get("website") ?? "");
    const resolution = resolve(directory, name, website);
    if (resolution.kind === "refused") {
      setError(resolution.message);
      return;
    }
    setError("");
    dispatch({ type: "addTyped", name, website, resolution, held });
    form.reset();
  }

  async function saveTray() {
    const picks = trayPicks(tray);
    attempt.current = saveAttempt(attempt.current, picks, () => crypto.randomUUID());
    setSaving(true);
    setError("");
    try {
      const result = await onSave({ operationId: attempt.current.operationId, picks });
      dispatch({ type: "saved", result: { created: result.created, confirmed: result.confirmed, unchanged: result.unchanged } });
      attempt.current = null;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your tools were not saved. Your list is unchanged; you can retry.");
    } finally {
      setSaving(false);
    }
  }

  const directoryNote = directoryFailed ? "The product list did not load. You can still add tools by name below, or reload to try again." : "Loading starter sets…";
  const savedStatus = tray.saved ? savedMessage(tray.saved) : "";
  const status = tray.lastAdded ? addedMessage(tray.lastAdded) : savedStatus;

  return <section id="build-stack" className={`onboarding-panel ${styles.builder}`} aria-labelledby={`${ids}-title`}>
    <p className="onboarding-kicker">YOUR STACK / PRIVATE FIRST</p>
    <h2 id={`${ids}-title`}>Build your stack</h2>
    <p className={styles.lede}>Pick the tools you use. Start from a role or search by name. Everything saves privately; sharing is a separate step.</p>

    <fieldset className={styles.controls} disabled={saving}>
      <legend className={styles.legend}>Start from a role</legend>
      <div className={styles.chips}>
        {directory ? directory.starterSets().map(set => <button key={set.role} type="button" className={`secondary-action ${styles.chip}`}
          aria-label={set.label} aria-describedby={`${ids}-${set.role}`}
          onClick={() => dispatch({ type: "addStarterSet", entries: set.entries.map(entry => ({ slug: entry.slug, name: entry.name, domain: entry.domain })), held })}>
          {set.label}<span id={`${ids}-${set.role}`} className={styles.blurb}>{set.blurb}</span>
        </button>) : <p className={styles.hint}>{directoryNote}</p>}
      </div>

      <label className={styles.searchLabel} htmlFor={`${ids}-search`}>Search products</label>
      <div className={styles.combo}>
        <input ref={search} id={`${ids}-search`} className={styles.search} type="text" role="combobox" autoComplete="off"
          aria-expanded={expanded} aria-controls={`${ids}-results`} aria-autocomplete="list"
          aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
          placeholder="HubSpot, Figma, Cursor…" value={query} maxLength={TYPED_NAME_MAX}
          onChange={event => { setQuery(event.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKeyDown} />
        {expanded && <ul id={`${ids}-results`} role="listbox" aria-label="Matching products" className={styles.results}>
          {options.map((option, index) => <li key={option.kind === "entry" ? option.entry.slug : "typed"} id={optionId(index)} role="option"
            aria-selected={index === active} aria-disabled={option.kind === "entry" && option.state !== "available"}
            className={styles.option} onMouseDown={event => event.preventDefault()} onClick={() => choose(option)}>
            {option.kind === "entry" ? <>
              <strong>{option.entry.name}</strong>
              <span>{option.state === "available" ? option.entry.domain : STATE_NOTES[option.state]}</span>
            </> : <><strong>Add “{option.name}”</strong><span>Not in the directory. Add it by name.</span></>}
          </li>)}
        </ul>}
      </div>

      <details className={styles.typed}>
        <summary>Add a tool with its website</summary>
        <form className="form-grid" onSubmit={event => { event.preventDefault(); addTyped(event.currentTarget); }}>
          <label>Tool name<input name="name" maxLength={120} required autoComplete="off" /></label>
          <label>Website (optional)<input name="website" inputMode="url" placeholder="product.com" autoComplete="off" /></label>
          <div className="action-row full"><button type="submit" className="secondary-action">Add to list</button></div>
        </form>
      </details>

      <h3 className={styles.trayTitle} id={`${ids}-tray`}>Your list ({tray.items.length})</h3>
      {tray.items.length === 0 && <p className={styles.hint}>Nothing picked yet. Choose a role or search above.</p>}
      {tray.items.length > 0 && <ul className={styles.tray} aria-labelledby={`${ids}-tray`}>
        {tray.items.map(item => <li key={item.key} className={styles.item}>
          <span className={styles.itemName}><strong>{item.name}</strong><small>{item.kind === "directory" ? item.domain : (item.website ?? "Added by name")}</small></span>
          <select aria-label={`How you use ${item.name}`} value={item.status}
            onChange={event => dispatch({ type: "setStatus", key: item.key, status: event.target.value as TrayStatus })}>
            {TRAY_STATUSES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button type="button" className={styles.remove} aria-label={`Remove ${item.name}`}
            onClick={() => { dispatch({ type: "remove", key: item.key }); search.current?.focus(); }}>Remove</button>
        </li>)}
      </ul>}
    </fieldset>

    <div className="action-row">
      <button type="button" className="primary-action" disabled={saving || tray.items.length === 0} onClick={() => void saveTray()}>
        {saving ? "Saving…" : saveButtonLabel(tray.items.length)}
      </button>
      {tray.saved && tray.items.length === 0 && <a href="#share-all">Next: share your stack</a>}
    </div>
    <p role="status" className={styles.status}>{status}</p>
    <p role="alert" className={styles.error}>{error}</p>
  </section>;
}
