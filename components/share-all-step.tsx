"use client";

import { useEffect, useReducer } from "react";
import { useConvex, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { PublicProfile } from "@/src/domain/public-profile";
import { isHttpUrl } from "@/src/domain/http-url";
import { canApproveShare, initialShareState, previewSummary, shareFlow, skipReasonText, type ShareAllPreview, type ShareEvent, type ShareState } from "@/src/client/share-all-flow";
import { SharingPreview } from "./sharing-preview";
import styles from "./stack-builder.module.css";
import { errorMessage } from "@/src/domain/user-error";

type Preview = ShareAllPreview<PublicProfile>;

export function ShareAllSection({ identityClaimed, basis, profileUrl, onSetUpIdentity }: {
  identityClaimed: boolean | null; basis: string; profileUrl: string; onSetUpIdentity: () => void;
}) {
  const convex = useConvex();
  const publishSelected = useMutation(api.onboarding.publishSelected);
  return <ShareAllStep identityClaimed={identityClaimed} basis={basis} profileUrl={profileUrl} onSetUpIdentity={onSetUpIdentity}
    onPreview={async () => {
      const result = await convex.query(api.onboarding.previewPublication, { selections: [], shareAllConfirmed: true });
      return { ...result, sharedCount: result.sharedCount ?? 0, remainingCount: result.remainingCount ?? 0, skipped: result.skipped ?? [] };
    }}
    onPublish={async preview => {
      await publishSelected({ selections: [], shareAllConfirmed: true, expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash });
    }} />;
}

function failure(reason: unknown, fallback: string): ShareEvent<PublicProfile> {
  return { type: "failed", message: errorMessage(reason, fallback) };
}

function statusText(state: ShareState<PublicProfile>) {
  if (state.step === "previewed") return `Preview ready. ${previewSummary(state.preview)}`;
  if (state.step !== "published") return "";
  const shared = `Shared ${state.sharedCount} tool${state.sharedCount === 1 ? "" : "s"}. Your public page is live.`;
  return state.remainingCount ? `${shared} ${state.remainingCount} more remain; preview again to share them.` : shared;
}

export function ShareAllStep({ identityClaimed, basis, profileUrl, onSetUpIdentity, onPreview, onPublish }: {
  identityClaimed: boolean | null; basis: string; profileUrl: string; onSetUpIdentity: () => void;
  onPreview: () => Promise<Preview>; onPublish: (preview: Preview) => Promise<void>;
}) {
  const [state, dispatch] = useReducer(shareFlow<PublicProfile>, identityClaimed === true, initialShareState<PublicProfile>);
  useEffect(() => {
    if (identityClaimed !== null) dispatch({ type: "identity", claimed: identityClaimed });
  }, [identityClaimed]);

  async function preview() {
    dispatch({ type: "preview" });
    try {
      dispatch({ type: "previewLoaded", preview: await onPreview(), basis });
    } catch (reason) {
      dispatch(failure(reason, "The preview could not be prepared. Nothing was published; you can retry."));
    }
  }

  async function publish(current: Preview) {
    dispatch({ type: "publish" });
    try {
      await onPublish(current);
      dispatch({ type: "published" });
    } catch (reason) {
      dispatch(failure(reason, "Publishing failed. Your public page is unchanged; preview again to retry."));
    }
  }

  const shown = state.step === "previewed" || state.step === "publishing" ? state : null;
  const resolvedUrl = state.step === "published" ? new URL(profileUrl, window.location.origin).href : "";
  const liveUrl = isHttpUrl(resolvedUrl) ? resolvedUrl : null;

  return <section id="share-all" className={styles.share} aria-labelledby="share-all-title" tabIndex={-1}>
    <h3 id="share-all-title">Share every confirmed tool</h3>
    <p>One preview covers every tool you have confirmed privately. Nothing becomes public until you approve that exact preview.</p>
    {state.step === "needsHandle" && (identityClaimed === null
      ? <p>Public identity status is unavailable. Reload before sharing.</p>
      : <>
        <p>Sharing needs a public handle first. Your tools stay private while you choose one.</p>
        <button type="button" className="secondary-action" onClick={onSetUpIdentity}>Choose your public handle</button>
      </>)}
    {state.step !== "needsHandle" && <div className="action-row">
      <button type="button" className="primary-action" disabled={state.step === "previewing" || state.step === "publishing"} onClick={() => void preview()}>
        {state.step === "previewing" ? "Preparing preview…" : "Preview sharing all confirmed tools"}
      </button>
    </div>}
    <p role="status" className={styles.status}>{statusText(state)}</p>
    <p role="alert" className={styles.error}>{state.step === "error" ? state.message : ""}</p>
    {state.step === "published" && liveUrl && <p className={styles.live}>Your public page: <a href={liveUrl} target="_blank" rel="noreferrer">{liveUrl}</a></p>}
    {shown && <>
      {shown.preview.skipped.length > 0 && <div className={styles.skipped}>
        <h4>Staying private</h4>
        <ul>{shown.preview.skipped.map(card => <li key={card.propId}><strong>{card.productName}</strong> stays private: {skipReasonText(card.reason)}</li>)}</ul>
      </div>}
      {canApproveShare(shown.preview) && <SharingPreview key={shown.preview.previewHash} profile={shown.preview.profile} refreshAccounts={[...shown.preview.refreshAccounts ?? []]}
        current={shown.basis === basis} busy={state.step === "publishing"} onPublish={() => void publish(shown.preview)} />}
    </>}
  </section>;
}
