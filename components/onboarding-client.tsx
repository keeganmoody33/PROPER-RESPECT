"use client";

import { ProfileName, ProfileLinks } from "./profile-identity";
import { ProfileLinksFields } from "./profile-links-fields";
import { classifyEvidenceUpload, EVIDENCE_UPLOAD_ACCEPT } from "@/src/domain/evidence-upload";
import {
  SignInButton,
  Show,
  UserButton,
  useUser,
  useAuth,
  useClerk,
} from "@clerk/nextjs";
import { useAction, useConvex, useConvexAuth, useMutation, useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { PublicProfile } from "@/src/domain/public-profile";
import { defaultReview, explicitPublicationCards, isCurrentReview, reviewUsageLink, setReviewCostVisibility, type ReviewEdit } from "@/src/domain/review";
import { USAGE_LINK_LABELS, usageLinkLabelText } from "@/src/domain/usage-links";
import { isRelationshipConfirmed } from "@/src/domain/inventory";
import { privateCardPrimaryLink, offeredPrivatePublicationLink } from "@/src/domain/product-destination";
import { costSchema, type CostVisibility } from "@/src/domain/cost";
import { ProductKnowledgePanel } from "./product-knowledge-panel";
import { PrivateEvidencePanel } from "./private-evidence-panel";
import { AccountEvidence } from "./account-evidence";
import { ProductCard } from "./product-card";
import { ProductBrandControls } from "./product-brand-controls";
import { PrivateInventory } from "./private-inventory";
import { MailboxManagement } from "./mailbox-management";
import { prepareCollectionBrands, type BrandPreparationItem } from "@/src/client/product-brand-preparation";

type ManualProductInput = { name: string; website?: string; description?: string; operationId: string };

function CollectionBrandPreparation({ propIds }: { propIds: Id<"props">[] }) {
  const convex = useConvex();
  const [attempt, setAttempt] = useState(0);
  const attemptedRetry = useRef(0);
  const [progress, setProgress] = useState<{ items: BrandPreparationItem[]; done: boolean }>({ items: [], done: false });
  const selection = JSON.stringify([...new Set(propIds)].sort());
  useEffect(() => {
    const controller = new AbortController();
    const retryFailed = attempt > attemptedRetry.current;
    attemptedRetry.current = attempt;
    void prepareCollectionBrands({
      propIds: JSON.parse(selection), signal: controller.signal,
      prepare: ids => convex.mutation(api.productBrands.prepareForProps, { propIds: ids as Id<"props">[], retryFailed }),
      read: ids => convex.query(api.productBrands.getPreparationForProps, { propIds: ids as Id<"props">[] }),
      report: (items, done) => setProgress({ items, done }),
    });
    return () => controller.abort();
  }, [convex, selection, attempt]);
  if (!propIds.length) return null;
  const ready = progress.items.filter(item => item.status === "READY").length;
  const pending = progress.items.filter(item => ["PENDING", "RUNNING", "NOT_REQUESTED"].includes(item.status)).length;
  const failed = progress.items.filter(item => item.status === "FAILED").length;
  const unverified = progress.items.length - ready - pending - failed;
  return <div className="product-brand-controls" aria-label="Collection appearance">
    <p role="status">Card appearance: {ready} ready, {pending} pending, {failed} unavailable{unverified ? `, ${unverified} awaiting verified product identity` : ""}.</p>
    {(pending > 0 || failed > 0) && <p>Your products remain available while their appearance is prepared.</p>}
    {progress.done && (failed > 0 || pending > 0) && <><p>Unavailable appearance can be retried after one minute.</p><button type="button" className="secondary-action" onClick={() => setAttempt(value => value + 1)}>Retry unfinished appearance</button></>}
  </div>;
}

export function AddProductForm({ onAdd }: { onAdd: (input: ManualProductInput) => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "saved" | "error"; text: string } | null>(null);
  const retry = useRef<{ body: string; id: string } | null>(null);
  async function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    const values = {
      name: String(data.get("name") ?? "").trim(),
      website: String(data.get("website") ?? "").trim() || undefined,
      description: String(data.get("description") ?? "").trim() || undefined,
    };
    const body = JSON.stringify(values);
    if (retry.current?.body !== body) retry.current = { body, id: crypto.randomUUID() };
    setBusy(true);
    setNotice(null);
    try {
      await onAdd({ ...values, operationId: retry.current.id });
      setNotice({ kind: "saved", text: "Saved privately. Review the card to choose how you use this tool and add your explanation. Existing products keep their saved choices and notes." });
      retry.current = null;
      form.reset();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "The product was not added. Your collection is unchanged; you can retry." });
    } finally { setBusy(false); }
  }
  return <div id="add-product" className="collection-add">
    <h2>Add a product</h2>
    <p>No integration or activity measurement is required. Add something you use, are testing, or remember using; you will choose the relationship in private review.</p>
    <form onSubmit={event => { event.preventDefault(); void submit(event.currentTarget); }} className="form-grid">
      <label>Product name<input name="name" maxLength={120} required autoComplete="off" disabled={busy} /></label>
      <label>Website (optional)<input name="website" inputMode="url" placeholder="product.com" autoComplete="url" disabled={busy} /></label>
      <label className="full">What you want to remember (optional)<textarea name="description" rows={2} maxLength={4000} disabled={busy} /></label>
      <div className="action-row full"><button className="secondary-action" disabled={busy}>{busy ? "Adding…" : "Add for private review"}</button></div>
    </form>
    <p role="status">{notice?.text}</p>
    {notice?.kind === "saved" && <a href="#private-collection-title">Review your collection</a>}
  </div>;
}

export function SharingPreview({ profile, current, busy, onPublish }: {
  profile: PublicProfile; current: boolean; busy: boolean; onPublish: () => void;
}) {
  const [approved, setApproved] = useState(false);
  return <section className="sharing-preview" aria-labelledby="sharing-preview-title">
    <h3 id="sharing-preview-title">Your visitor’s view</h3>
    <p>This is the public information after your selected changes, including previously approved cards that you kept. Private originals and unselected details are excluded.</p>
    {!current && <p role="status">Your saved collection or sharing choices changed. Preview again before publishing.</p>}
    {profile.cards.some(card => card.usageLink) && <p>The links on the backs of these cards open only if their own sharing settings allow it. Check that each shows nothing private, like other people’s contact details.</p>}
    <div className="card-grid">{profile.cards.map((card, index) => <ProductCard key={`${card.product.slug}-${index}`} card={card} index={index} goTo={card.goTo} />)}</div>
    {!profile.cards.length && <p>No products will be public.</p>}
    <footer className="profile-footer"><div><strong><ProfileName profile={profile} /></strong><span>@{profile.handle}</span></div><p>{profile.bio}</p><ProfileLinks profile={profile} /></footer>
    <label className="sharing-preview-confirmation"><input type="checkbox" checked={approved} disabled={!current || busy} onChange={event => setApproved(event.target.checked)} />I approve making exactly this preview visible to anyone with the public link.</label>
    <button type="button" className="primary-action" disabled={!current || busy || !approved} onClick={onPublish}>{busy ? "Publishing…" : "Publish this preview"}</button>
  </section>;
}

function Builder() {
  const convex = useConvex();
  const { user: clerkUser } = useUser();
  const { getToken, sessionClaims } = useAuth();
  const { openUserProfile } = useClerk();
  const ensureAccount = useMutation(api.onboarding.ensureAccount);
  const claimHandle = useMutation(api.onboarding.claimHandle);
  const beginUpload = useMutation(api.onboarding.beginUpload);
  const retainUpload = useMutation(api.onboarding.retainUpload);
  const addManualProduct = useMutation(api.onboarding.addManualProduct);
  const publishSelected = useMutation(api.onboarding.publishSelected);
  const revokeConnector = useMutation(api.connectors.revokeConnector);
  const connectDevin = useAction(api.connectors.connectDevin);
  const state = useQuery(api.onboarding.getState, { includeClaims: false, includeLegacyCollections: false, includeAccountEvidence: false });
  const uploadAttempt = useRef<{ file: File; vendor: string; uploadUrl: string } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewEdits, setReviewEdits] = useState<
    Record<string, ReviewEdit>
  >({});
  const [preview, setPreview] = useState<{
    profile: PublicProfile; revision: number; previewHash: string; selections: FunctionArgs<typeof api.onboarding.publishSelected>["selections"]; basis: string;
  } | null>(null);
  const previewBasis = useMemo(() => JSON.stringify({ edits: reviewEdits, cards: state?.cards, user: state?.user }), [reviewEdits, state?.cards, state?.user]);

  const [setupAttempt, setSetupAttempt] = useState(0);
  const [setupFailed, setSetupFailed] = useState(false);
  const [setupPending, setSetupPending] = useState(true);
  const clerkId = clerkUser?.id;
  const clerkName = clerkUser?.fullName;
  const clerkAvatar = clerkUser?.imageUrl;

  useEffect(() => {
    if (!clerkId) return;
    let active = true;
    void ensureAccount({
      displayName: clerkName ?? undefined,
      avatarUrl: clerkAvatar,
    }).then(() => {
      if (active) setSetupFailed(false);
    }).catch(() => {
      if (active) setSetupFailed(true);
    }).finally(() => {
      if (active) setSetupPending(false);
    });
    return () => { active = false; };
  }, [clerkId, clerkName, clerkAvatar, ensureAccount, setupAttempt]);

  async function run(label: string, operation: () => Promise<unknown>) {
    setBusy(true);
    setMessage("");
    try {
      await operation();
      setMessage(label);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function submitProfile(form: FormData) {
    await run("Public identity saved. Your private collection has not been published.", async () => {
      const urls = form.getAll("profileLinkUrl").map(String);
      const preferred = String(form.get("preferredProfileLink") ?? "");
      await claimHandle({
        handle: String(form.get("handle")),
        displayName: String(form.get("displayName")),
        bio: String(form.get("bio")),
        profileLinks: form.getAll("profileLinkLabel").map((label, index) => ({ label: String(label), url: urls[index] })),
        preferredLinkUrl: preferred === "" ? null : urls[Number(preferred)],
      });
    });
  }

  async function uploadEvidence(form: FormData) {
    const file = form.get("evidence");
    if (!(file instanceof File) || file.size === 0) {
      setMessage("Choose an export or screenshot first.");
      return;
    }
    await run("Original file retained privately. Review the product in your collection; add selected observations only if the original supports them.", async () => {
      const { sourceType } = classifyEvidenceUpload({ filename: file.name, mimeType: file.type, byteSize: file.size });
      const vendor = String(form.get("vendor"));
      const token = sessionClaims?.aud === "convex" ? await getToken() : await getToken({ template: "convex" });
      if (!token) throw new Error("Sign in again before uploading evidence.");
      if (uploadAttempt.current?.file !== file || uploadAttempt.current.vendor !== vendor) {
        const { uploadUrl } = await beginUpload({ filename: file.name, mimeType: file.type || "application/octet-stream", byteSize: file.size, vendor });
        uploadAttempt.current = { file, vendor, uploadUrl };
      }
      const response = await fetch(uploadAttempt.current.uploadUrl, {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": file.type || "application/octet-stream", Authorization: `Bearer ${token}` },
        body: file,
      });
      if (!response.ok) {
        if (response.status === 404 || response.status === 409) uploadAttempt.current = null;
        throw new Error("Evidence upload failed. Retry the file; expired uploads start again.");
      }
      const { storageId } = (await response.json()) as {
        storageId: Id<"_storage">;
      };
      await retainUpload({
        storageId,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        byteSize: file.size,
        sourceType,
        vendor,
      });
      uploadAttempt.current = null;
    });
  }

  async function connectGithub() {
    if (!clerkUser?.externalAccounts.some(account => account.provider === "github")) {
      setMessage("Add GitHub under Connected accounts, then return here and connect it to import activity.");
      openUserProfile();
      return;
    }
    await run("GitHub evidence retained privately. Review any new discovery or supporting update in your collection.", async () => {
      const token = await getToken();
      if (!token) throw new Error("Sign in again before connecting GitHub.");
      const response = await fetch("/api/connect/github", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "GitHub connection failed.");
      }
    });
  }

  async function submitDevin(form: FormData) {
    await run("Devin activity imported as an organization-scoped draft.", async () => {
      await connectDevin({
        organizationId: String(form.get("organizationId")),
        token: String(form.get("devinToken")),
      });
    });
  }

  function updateReview(
    propId: string,
    fallback: ReviewEdit,
    patch: Partial<ReviewEdit>,
  ) {
    setReviewEdits((current) => ({
      ...current,
      [propId]: { ...(current[propId]?.basis === fallback.basis ? current[propId] : fallback), ...patch },
    }));
  }

  function publicationSelections() {
    if (!state) return [];
    return explicitPublicationCards(
        state.cards.flatMap(card => card.product ? [{ ...card, product: card.product }] : []),
        reviewEdits, Boolean(state.privateInventoryAvailable),
      ).map(({ card, edit }) => {
        return {
          propId: card.prop._id,
          ...(state.privateInventoryAvailable ? { expectedRelationshipVersion: card.prop.relationshipVersion ?? 0 } : {}),
          publish: edit.publish,
          status: edit.status,
          headline: edit.headline,
          note: edit.note,
          startedAt: edit.startedAt || undefined,
          startedAtSource: edit.startedAt
            ? ("USER_CONFIRMED" as const)
            : undefined,
          primaryLink: edit.linkUrl.trim() ? {
            type: edit.linkType,
            url: edit.linkUrl,
            label: edit.linkLabel,
          } : undefined,
          cost: edit.costAmount.trim() === "" ? undefined : costSchema.parse({
            amount: Number(edit.costAmount),
            currency: edit.costCurrency,
            cadence: edit.costCadence,
            basis: edit.costBasis,
            asOf: edit.costAsOf,
            period: edit.costPeriodStart || edit.costPeriodEnd
              ? { start: edit.costPeriodStart, end: edit.costPeriodEnd }
              : undefined,
          }),
          costVisibility: edit.costVisibility,
          activity:
            edit.publish && edit.approveActivity
              ? card.prop.activity
              : undefined,
          usageLinkUrl: edit.publish && edit.includeUsageLink && reviewUsageLink(card) ? card.prop.supportingUrl : undefined,
          usageLinkLabel: edit.publish && edit.includeUsageLink && reviewUsageLink(card) ? edit.usageLinkLabel : undefined,
          autoRefresh: false,
        };
      });
  }

  async function previewSharing() {
    if (!state) return;
    await run("Sharing preview is ready. Review it before deciding to publish.", async () => {
      const selections = publicationSelections();
      const result = await convex.query(api.onboarding.previewPublication, { selections });
      setPreview({ ...result, selections, basis: previewBasis });
    });
  }

  async function publish() {
    if (!preview || preview.basis !== previewBasis) {
      setMessage("Preview your current saved collection and sharing choices before publishing.");
      return;
    }
    await run("Your approved preview is now shared. Other private information remains private.", async () => {
      await publishSelected({ selections: preview.selections, expectedPublicationRevision: preview.revision, expectedPreviewHash: preview.previewHash });
      setPreview(null);
      setReviewEdits({});
    });
  }

  function setSelectedCostVisibility(visibility: CostVisibility) {
    if (!state) return;
    setReviewEdits(current => setReviewCostVisibility(
      state.cards.flatMap(card => card.product ? [{ ...card, product: card.product }] : []),
      current, visibility,
    ));
  }

  function connectorStatus(provider: "GITHUB" | "DEVIN") {
    return state?.connectors.filter(connector => connector.provider === provider).map(connector => <div className="connector-state" key={connector._id}>
      <p><strong>{connector.accountLabel}</strong> · {connector.status === "REVOKED" ? "Disconnected" : connector.status === "ERROR" ? "Needs attention" : "Connected"}</p>
      <p>{connector.lastSyncedAt ? `Last successful capture: ${new Date(connector.lastSyncedAt).toLocaleString()}.` : "No successful capture is recorded."} Earlier evidence and relationships remain retained.</p>
      {connector.lastError && <p role="status">The last refresh failed. Reconnect or retry; the previous capture is still available.</p>}
      {connector.status !== "REVOKED" && <button type="button" className="secondary-action" disabled={busy} onClick={() => void run("Disconnected. Retained evidence, private relationships, and previously approved public cards are unchanged.", () => revokeConnector({ connectorId: connector._id }))}>Disconnect {provider === "GITHUB" ? "GitHub" : "Devin"}</button>}
    </div>);
  }

  if (!state) return <main className="onboarding-shell">
    {setupFailed ? <>
      <p role="alert">We could not prepare your private collection. Retry account setup to continue. Nothing has been published.</p>
      <button type="button" className="primary-action" disabled={setupPending} onClick={() => {
        setSetupPending(true);
        setSetupAttempt(attempt => attempt + 1);
      }}>Retry account setup</button>
      {setupPending && <p role="status">Preparing your private collection…</p>}
    </> : <p role="status">Loading your profile…</p>}
  </main>;

  const publicIdentityClaimed = typeof state.hasClaimedPublicIdentity === "boolean"
    ? state.hasClaimedPublicIdentity : null;

  return (
    <main className="onboarding-shell">
      <div className="onboarding-intro">
        <div>
          <p className="onboarding-kicker">PROPER—RESPECT / YOUR COLLECTION</p>
          <h1>Your tools. Your track record.</h1>
        </div>
        <div>
          <UserButton appearance={{ elements: { avatarBox: { width: "3rem", height: "3rem" } } }} />
        </div>
        <p>
          Technology moves fast. Keep a record of the tools you’ve tested and used,
          how you’ve used them, and why your stack changed. Share the history and supporting evidence you choose.
        </p>
      </div>

      <nav className="collection-navigation" aria-label="Your collection workspace">
        <a href="#private-collection-title">Collection</a>
        <a href="#add-product">Add a product</a>
        <a href="#collection-sources">Sources</a>
        <a href="#collection-profile" onClick={() => document.getElementById("collection-profile")?.setAttribute("open", "")}>Profile and links</a>
        <a href="#collection-sharing">Sharing</a>
      </nav>
      {message && <p className="message" role="status">{message}</p>}
      {state.cards.length === 0 && state.privateInventoryAvailable && <section className="onboarding-panel" aria-labelledby="first-tool-title">
        <p className="onboarding-kicker">YOUR FIRST CARD</p>
        <h2 id="first-tool-title">Start with one tool</h2>
        <p>Add a tool you use or are trying. Then choose your relationship and write what it helps you do. Your card stays private; you can connect a source or share it later.</p>
        <a className="primary-action" href="#add-product">Add your first tool</a>
      </section>}
      {state.brandEnrichmentAvailable && <CollectionBrandPreparation key={state.user._id} propIds={[...new Map(state.cards.filter(card => card.product).map(card => [card.prop.productId, card.prop._id])).values()]} />}
      {state.privateInventoryAvailable ? <PrivateInventory brandEnrichmentAvailable={Boolean(state.brandEnrichmentAvailable)} /> : <p role="status">Your collection is temporarily unavailable. Existing evidence remains unchanged.</p>}
      <AddProductForm onAdd={addManualProduct} />

      <section className="onboarding-panel" id="collection-sources" aria-labelledby="collection-sources-title">
        <p className="onboarding-kicker">SOURCES / PRIVATE DISCOVERY</p>
        <h2 id="collection-sources-title">Bring in supporting context</h2>
        <p>We ask what the evidence cannot answer. Signup, payment, and observed use are different claims—not proof of continuous use.</p>
        <p>Gmail discovery uses separately authorized read-only access when this environment is configured. Signing in with Google does not grant mailbox access. Microsoft mailbox connection is not available yet.</p>
        <p>Sources bring discoveries and supporting context into your private collection. Your relationship and go-to choices remain yours.</p>
        <div className="connector-grid">
          <MailboxManagement />
          <div className="connector-card">
            <strong>GitHub</strong>
            <p>Authorized account contributions. Account creation is separate from first use. A capture is a snapshot; no continuous coverage is implied.</p>
            {connectorStatus("GITHUB")}
            <button
              className="secondary-action"
              type="button"
              onClick={connectGithub}
              disabled={busy}
            >
              {state.connectors.some(connector => connector.provider === "GITHUB" && connector.status !== "REVOKED") ? "Refresh GitHub evidence" : "Connect GitHub"}
            </button>
          </div>
          <form className="connector-card" action={submitDevin}>
            <strong>Devin</strong>
            <p>Optional organization-scoped sessions, searches, and PRs.</p>
            {connectorStatus("DEVIN")}
            <label className="review-field">
              Organization ID
              <input name="organizationId" required />
            </label>
            <label className="review-field">
              Service token
              <input name="devinToken" type="password" required />
            </label>
            <button className="secondary-action" disabled={busy}>
              Connect Devin
            </button>
          </form>
          <form className="connector-card" action={uploadEvidence}>
            <strong>Upload an export or screenshot</strong>
            <p>Retain an original privately, up to 19 MiB. Supports PNG/JPEG/WebP/HEIC/HEIF, CSV/TSV, JSON/JSONL/NDJSON, PDF, XLS/XLSX/ODS, TXT/XML/HTML, and ZIP. Files are not parsed or unpacked automatically. Add selected observations with their period and scope from the product’s supporting details.</p>
            <label className="review-field">
              Product
              <select name="vendor" required defaultValue="Wispr Flow">
                <option>Wispr Flow</option>
                <option>NotebookLM</option>
                <option value="Devin">Devin (cloud)</option>
                <option>Devin Desktop</option>
                <option>Windsurf</option>
                <option>Greptile</option>
              </select>
            </label>
            <label className="review-field">
              Evidence file
              <input
                name="evidence"
                type="file"
                accept={EVIDENCE_UPLOAD_ACCEPT}
                required
              />
            </label>
            <button className="secondary-action" disabled={busy}>
              Upload privately
            </button>
          </form>
        </div>

      </section>

      <section className="onboarding-panel" id="collection-sharing" aria-labelledby="collection-sharing-title">
        <p className="onboarding-kicker">SHARING / YOUR CHOICE</p>
        <h2 id="collection-sharing-title">Choose what to share</h2>
        <p>Private saving never publishes. Select saved cards, preview the information a visitor will see, and approve that version. Existing public cards stay unchanged unless you include or remove them here.</p>
        <details id="collection-profile" className="collection-identity">
          <summary>Public identity</summary>
          <p>A handle is needed only when you choose to share. It is not required to build your private collection.</p>
          <form onSubmit={event => { event.preventDefault(); void submitProfile(new FormData(event.currentTarget)); }} className="form-grid">
            <label>Handle<input name="handle" defaultValue={publicIdentityClaimed === false ? "" : state.user.handle} placeholder="your-handle" required /></label>
            <label>Display name<input name="displayName" defaultValue={state.user.displayName ?? clerkUser?.fullName ?? ""} required /></label>
            <label className="full">Short footer bio (optional)<textarea name="bio" defaultValue={state.user.bio} rows={2} /></label>
            <ProfileLinksFields links={state.user.profileLinks} preferredLinkUrl={state.user.preferredLinkUrl} />
            <div className="action-row full"><button className="secondary-action" disabled={busy}>Save public identity</button></div>
          </form>
        </details>
        <fieldset>
          <legend>Cost visibility</legend>
          <p>Apply cost choices to selected cards, then review before publishing. Unmatched older public cards stay unchanged unless you explicitly select their saved relationships.</p>
          <div className="action-row">
            <button type="button" className="secondary-action" disabled={busy} onClick={() => setSelectedCostVisibility("PUBLIC")}>Show costs on selected cards</button>
            <button type="button" className="secondary-action" disabled={busy} onClick={() => setSelectedCostVisibility("PRIVATE")}>Keep selected costs private</button>
          </div>
        </fieldset>
        <div className="review-grid">
          {state?.cards.map((card, index) => {
            if (!card.product) return null;
            const savedCard = { ...card, product: card.product };
            const priorEdit = reviewEdits[card.prop._id];
            const edit = priorEdit && isCurrentReview(savedCard, priorEdit) ? priorEdit : defaultReview(savedCard);
            const confirmed = isRelationshipConfirmed(card.prop);
            return <AccountEvidence key={card.prop._id} propId={card.prop._id} productSlug={savedCard.product.slug}>{(evidence, progress) => {
              const destinationInput = {
                product: savedCard.product,
                links: card.links,
                associatedEvidence: evidence,
              };
              const privateDestination = privateCardPrimaryLink(destinationInput);
              const publicationOffer = offeredPrivatePublicationLink(destinationInput);
              return (
                <fieldset className="review-card" key={card.prop._id} disabled={busy} aria-label={`${savedCard.product.name} review`}>
                  <h3>{savedCard.product.name}</h3>
                  {progress}
                  <details>
                    <summary>Preview private card</summary>
                    <ProductCard audience="owner" index={index} relationshipConfirmed={confirmed} goTo={card.prop.goTo} card={{
                      product: savedCard.product,
                      status: card.prop.status,
                      headline: card.prop.headline,
                      note: card.prop.note,
                      startedAt: card.prop.startedAt,
                      activity: card.prop.activity,
                      cost: card.prop.cost,
                      primaryLink: privateDestination,
                    }} />
                  </details>
                  <details><summary>Product and evidence records</summary>
                    {state.brandEnrichmentAvailable && <ProductBrandControls propId={card.prop._id} />}
                    <ProductKnowledgePanel propId={card.prop._id} />
                    <PrivateEvidencePanel propId={card.prop._id} productName={savedCard.product.name} productSlug={savedCard.product.slug} disabled={busy}
                      onUseStartDate={state.privateInventoryAvailable ? undefined : date => updateReview(card.prop._id, edit, { startedAt: date })} />
                  </details>
                  {state.privateInventoryAvailable && <p>{confirmed
                    ? "These are your saved relationship details. Change them in your private collection above before publishing a new version."
                    : "Confirm and save this discovery in your private collection above before publishing it."}</p>}
                  <label className="review-toggle">
                    <input
                      type="checkbox"
                      checked={edit.publish}
                      disabled={state.privateInventoryAvailable && !confirmed}
                      onChange={(event) =>
                        updateReview(card.prop._id, edit, {
                          publish: event.target.checked,
                        })
                      }
                    />
                      Share this saved card
                  </label>
                  {card.isPublishedAtCurrentHandle === true && <>
                    <p>Already public at /{state.user.handle}. Its approved version stays unchanged until you include saved edits or change these publication choices.</p>
                    <button type="button" className="secondary-action" onClick={() => updateReview(card.prop._id, edit, { publish: true })}>Include saved version</button>
                  </>}
                  <details><summary>Information to include</summary>
                  <label className="review-field">
                    Relationship
                    <select
                      value={edit.status}
                      disabled={state.privateInventoryAvailable}
                      onChange={(event) =>
                        updateReview(card.prop._id, edit, {
                          status: event.target.value as ReviewEdit["status"],
                        })
                      }
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="TESTING">Testing</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                  </label>
                  <label className="review-field">
                    When you started using it (optional)
                    <input
                      type="date"
                      value={edit.startedAt}
                      readOnly={state.privateInventoryAvailable}
                      onChange={(event) =>
                        updateReview(card.prop._id, edit, {
                          startedAt: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="review-field">
                    Headline
                    <input
                      value={edit.headline}
                      readOnly={state.privateInventoryAvailable}
                      onChange={(event) =>
                        updateReview(card.prop._id, edit, {
                          headline: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="review-field">
                    Public note
                    <textarea
                      value={edit.note}
                      readOnly={state.privateInventoryAvailable}
                      rows={3}
                      onChange={(event) =>
                        updateReview(card.prop._id, edit, {
                          note: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="review-field">
                    Primary link
                    <input
                      type="url"
                      value={edit.linkUrl}
                      onChange={(event) =>
                        updateReview(card.prop._id, edit, {
                          linkUrl: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="review-field">
                    Link purpose
                    <select value={edit.linkType} onChange={event => updateReview(card.prop._id, edit, { linkType: event.target.value as ReviewEdit["linkType"] })}>
                      <option value="CANONICAL">Product or account page</option>
                      <option value="AFFILIATE">My affiliate link</option>
                      <option value="REFERRAL">My referral link</option>
                      <option value="INVITE">My invite link</option>
                    </select>
                  </label>
                  <p>Use your own affiliate or referral URL. It appears publicly only after you approve the sharing preview.</p>
                  {publicationOffer && publicationOffer.url !== edit.linkUrl && <>
                    <p>Your private card opens {publicationOffer.url}. Visitors will use the primary link above until you choose otherwise and approve a preview.</p>
                    <button type="button" className="secondary-action" onClick={() => updateReview(card.prop._id, edit, {
                      linkUrl: publicationOffer.url,
                      linkType: publicationOffer.type,
                      linkLabel: publicationOffer.label,
                    })}>Use the private account page in this preview</button>
                  </>}
                  <fieldset>
                    <legend>Cost (optional)</legend>
                    <label className="review-field">
                      Amount
                      <input type="number" min="0" step="0.01" value={edit.costAmount}
                        onChange={event => updateReview(card.prop._id, edit, { costAmount: event.target.value })} />
                    </label>
                    <label className="review-field">
                      Currency
                      <input maxLength={3} value={edit.costCurrency}
                        onChange={event => updateReview(card.prop._id, edit, { costCurrency: event.target.value.toUpperCase() })} />
                    </label>
                    <label className="review-field">
                      Billing interval
                      <select value={edit.costCadence} onChange={event => updateReview(card.prop._id, edit, { costCadence: event.target.value as ReviewEdit["costCadence"] })}>
                        <option value="MONTHLY">Monthly</option><option value="ANNUAL">Annual</option><option value="ONE_TIME">One-time</option><option value="UNKNOWN">Unknown</option>
                      </select>
                    </label>
                    <label className="review-field">
                      Basis
                      <select value={edit.costBasis} onChange={event => updateReview(card.prop._id, edit, { costBasis: event.target.value as ReviewEdit["costBasis"] })}>
                        <option value="OWNER_REPORTED">Entered by me</option><option value="RECEIPT">From a receipt</option><option value="ESTIMATE">Estimate</option>
                      </select>
                    </label>
                    <label className="review-field">
                      Price as of
                      <input type="date" value={edit.costAsOf}
                        onChange={event => updateReview(card.prop._id, edit, { costAsOf: event.target.value })} />
                    </label>
                    <label className="review-field">
                      Billing period start (optional)
                      <input type="date" value={edit.costPeriodStart}
                        onChange={event => updateReview(card.prop._id, edit, { costPeriodStart: event.target.value })} />
                    </label>
                    <label className="review-field">
                      Billing period end (optional)
                      <input type="date" value={edit.costPeriodEnd}
                        onChange={event => updateReview(card.prop._id, edit, { costPeriodEnd: event.target.value })} />
                    </label>
                    <label className="review-toggle">
                      <input type="checkbox" checked={edit.costVisibility === "PUBLIC"}
                        onChange={event => updateReview(card.prop._id, edit, { costVisibility: event.target.checked ? "PUBLIC" : "PRIVATE" })} />
                      Show this cost publicly
                    </label>
                  </fieldset>
                  {card.prop.activity && (
                    <label className="review-toggle">
                      <input
                        type="checkbox"
                        checked={edit.approveActivity}
                        onChange={(event) =>
                          updateReview(card.prop._id, edit, {
                            approveActivity: event.target.checked,
                          })
                        }
                      />
                      Publish{" "}
                      {card.prop.activity.attributionScope.toLowerCase()} activity
                    </label>
                  )}
                  {reviewUsageLink(savedCard) && <>
                    <label className="review-toggle">
                      <input
                        type="checkbox"
                        checked={edit.includeUsageLink}
                        onChange={(event) => updateReview(card.prop._id, edit, { includeUsageLink: event.target.checked })}
                      />
                      Show my work-sample link on the back of this card
                    </label>
                    <label className="review-field">
                      Link label
                      <select
                        value={edit.usageLinkLabel}
                        onChange={(event) => updateReview(card.prop._id, edit, { usageLinkLabel: event.target.value as ReviewEdit["usageLinkLabel"] })}
                      >
                        {USAGE_LINK_LABELS.map(label => <option key={label} value={label}>{usageLinkLabelText(label)}</option>)}
                      </select>
                    </label>
                    <p>Visitors open it on its own site, if its sharing settings let them. A screen recording can show other people’s data, like enriched contact rows in Clay, so check it first.</p>
                  </>}
                  </details>
                </fieldset>
              );
            }}</AccountEvidence>;
          })}
        </div>
        <div className="action-row">
          <button
            className="primary-action"
            type="button"
            onClick={previewSharing}
            disabled={busy || publicIdentityClaimed !== true}
          >
            Preview sharing
          </button>
          <span className="sharing-selection-count">{Object.keys(reviewEdits).length} card choice{Object.keys(reviewEdits).length === 1 ? "" : "s"} to review</span>
          {state.hasPublicationAtCurrentHandle === true && <a href={`/${state.user.handle}`} target="_blank" rel="noreferrer">Open current public page ↗</a>}
        </div>
        {publicIdentityClaimed === false && <p>Ready to preview a public page? <a href="#collection-profile" onClick={() => document.getElementById("collection-profile")?.setAttribute("open", "")}>Set up your public identity</a> with a handle and display name. Social links are optional.</p>}
        {publicIdentityClaimed === null && <p>Public identity status is unavailable. Reload before previewing sharing.</p>}
        {state.hasPublicationAtCurrentHandle === false && <p>{publicIdentityClaimed === true ? `Nothing is published at /${state.user.handle} yet.` : "Nothing is published yet."}</p>}
        {preview && <SharingPreview key={preview.basis} profile={preview.profile} current={preview.basis === previewBasis} busy={busy} onPublish={() => void publish()} />}
      </section>
    </main>
  );
}

export function OnboardingClient() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  return (
    <Show
      when="signed-in"
      fallback={
        <main className="system-message">
          <p className="eyebrow">PROPER—RESPECT / YOUR COLLECTION</p>
          <h1>Your tools. Your track record.</h1>
          <p>
            Sign in to keep your products, testing, go-to choices, and their history
            in one private collection. Share only what you choose.
          </p>
          <SignInButton mode="modal">
            <button className="primary-action">Sign in or create account</button>
          </SignInButton>
        </main>
      }
    >
      {isAuthenticated ? <Builder /> : (
        <main className="system-message">
          <p role="status">{isLoading
            ? "Verifying your session…"
            : "Could not verify your session. Reload this page to retry."}</p>
        </main>
      )}
    </Show>
  );
}
