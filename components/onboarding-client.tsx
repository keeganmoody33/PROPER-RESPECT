"use client";

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
import { defaultReview, explicitPublicationCards, isCurrentReview, type ReviewEdit } from "@/src/domain/review";
import { isRelationshipConfirmed } from "@/src/domain/inventory";
import { privateCardPrimaryLink } from "@/src/domain/product-destination";
import { costSchema, type CostVisibility } from "@/src/domain/cost";
import { ProductKnowledgePanel } from "./product-knowledge-panel";
import { PrivateEvidencePanel } from "./private-evidence-panel";
import { ProductCard } from "./product-card";
import { ProductBrandControls } from "./product-brand-controls";
import { PrivateInventory } from "./private-inventory";
import { MailboxManagement } from "./mailbox-management";

type ManualProductInput = { name: string; website?: string; description?: string; operationId: string };

export function AddProductForm({ onAdd }: { onAdd: (input: ManualProductInput) => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
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
    setNotice("");
    try {
      await onAdd({ ...values, operationId: retry.current.id });
      setNotice("The product is in your private collection. New products appear in Discoveries; an existing product keeps its saved choices and notes.");
      retry.current = null;
      form.reset();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The product was not added. Your collection is unchanged; you can retry.");
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
    <p role="status">{notice}</p>
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
    <div className="card-grid">{profile.cards.map((card, index) => <ProductCard key={`${card.product.slug}-${index}`} card={card} index={index} goTo={card.goTo} />)}</div>
    {!profile.cards.length && <p>No products will be public.</p>}
    <footer className="profile-footer"><div><strong>{profile.displayName}</strong><span>@{profile.handle}</span></div><p>{profile.bio}</p></footer>
    <label className="sharing-preview-confirmation"><input type="checkbox" checked={approved} disabled={!current || busy} onChange={event => setApproved(event.target.checked)} />I approve making exactly this preview visible to anyone with the public link.</label>
    <button type="button" className="primary-action" disabled={!current || busy || !approved} onClick={onPublish}>{busy ? "Publishing…" : "Publish this preview"}</button>
  </section>;
}

function Builder() {
  const convex = useConvex();
  const { user: clerkUser } = useUser();
  const { getToken } = useAuth();
  const { openUserProfile } = useClerk();
  const ensureAccount = useMutation(api.onboarding.ensureAccount);
  const claimHandle = useMutation(api.onboarding.claimHandle);
  const generateUploadUrl = useMutation(api.onboarding.generateUploadUrl);
  const retainUpload = useMutation(api.onboarding.retainUpload);
  const addManualProduct = useMutation(api.onboarding.addManualProduct);
  const publishSelected = useMutation(api.onboarding.publishSelected);
  const revokeConnector = useMutation(api.connectors.revokeConnector);
  const connectDevin = useAction(api.connectors.connectDevin);
  const state = useQuery(api.onboarding.getState, { includeClaims: false });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewEdits, setReviewEdits] = useState<
    Record<string, ReviewEdit>
  >({});
  const [preview, setPreview] = useState<{
    profile: PublicProfile; revision: number; previewHash: string; selections: FunctionArgs<typeof api.onboarding.publishSelected>["selections"]; basis: string;
  } | null>(null);
  const previewBasis = useMemo(() => JSON.stringify({ edits: reviewEdits, cards: state?.cards, user: state?.user }), [reviewEdits, state?.cards, state?.user]);

  useEffect(() => {
    if (!clerkUser) return;
    void ensureAccount({
      displayName: clerkUser.fullName ?? undefined,
      avatarUrl: clerkUser.imageUrl,
    });
  }, [clerkUser, ensureAccount]);

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
      await claimHandle({
        handle: String(form.get("handle")),
        displayName: String(form.get("displayName")),
        bio: String(form.get("bio")),
      });
    });
  }

  async function uploadEvidence(form: FormData) {
    const file = form.get("evidence");
    if (!(file instanceof File) || file.size === 0) {
      setMessage("Choose a screenshot or CSV first.");
      return;
    }
    await run("Original file retained privately. Review the product in your collection; add selected observations only if the original supports them.", async () => {
      const vendor = String(form.get("vendor"));
      const uploadUrl = await generateUploadUrl({});
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!response.ok) throw new Error("Evidence upload failed.");
      const { storageId } = (await response.json()) as {
        storageId: Id<"_storage">;
      };
      await retainUpload({
        storageId,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        byteSize: file.size,
        sourceType: file.name.toLowerCase().endsWith(".csv")
          ? "CSV"
          : "SCREENSHOT",
        vendor,
      });
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

  function setAllCostVisibility(visibility: CostVisibility) {
    if (!state) return;
    setReviewEdits(current => {
      const next = { ...current };
      for (const card of state.cards) {
        if (!card.product) continue;
        const prior = current[card.prop._id];
        const edit = prior && isCurrentReview({ ...card, product: card.product }, prior) ? prior : defaultReview({ ...card, product: card.product });
        next[card.prop._id] = { ...edit, costVisibility: visibility };
      }
      return next;
    });
  }

  function connectorStatus(provider: "GITHUB" | "DEVIN") {
    return state?.connectors.filter(connector => connector.provider === provider).map(connector => <div className="connector-state" key={connector._id}>
      <p><strong>{connector.accountLabel}</strong> · {connector.status === "REVOKED" ? "Disconnected" : connector.status === "ERROR" ? "Needs attention" : "Connected"}</p>
      <p>{connector.lastSyncedAt ? `Last successful capture: ${new Date(connector.lastSyncedAt).toLocaleString()}.` : "No successful capture is recorded."} Earlier evidence and relationships remain retained.</p>
      {connector.lastError && <p role="status">The last refresh failed. Reconnect or retry; the previous capture is still available.</p>}
      {connector.status !== "REVOKED" && <button type="button" className="secondary-action" disabled={busy} onClick={() => void run("Disconnected. Retained evidence, private relationships, and previously approved public cards are unchanged.", () => revokeConnector({ connectorId: connector._id }))}>Disconnect {provider === "GITHUB" ? "GitHub" : "Devin"}</button>}
    </div>);
  }

  if (!state) return <main className="onboarding-shell"><p role="status">Loading your profile…</p></main>;

  return (
    <main className="onboarding-shell">
      <div className="onboarding-intro">
        <div>
          <p className="onboarding-kicker">PROPER—RESPECT / YOUR COLLECTION</p>
          <h1>Your tools. Your track record.</h1>
        </div>
        <div>
          <UserButton />
        </div>
        <p>
          The tools you’ve tested and used, what’s in your stack now, and why you
          moved on. A record of your changing stack, shared on your terms.
        </p>
      </div>

      <nav className="collection-navigation" aria-label="Your collection workspace">
        <a href="#private-collection-title">Collection</a>
        <a href="#add-product">Add a product</a>
        <a href="#collection-sources">Sources</a>
        <a href="#collection-sharing">Sharing</a>
      </nav>
      {message && <p className="message" role="status">{message}</p>}
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
            <strong>Screenshot or CSV</strong>
            <p>The original is retained privately. This upload does not read the image or CSV automatically. You can add selected observations with their period and scope from the product’s supporting details.</p>
            <label className="review-field">
              Product
              <select name="vendor" required defaultValue="Wispr Flow">
                <option>Wispr Flow</option>
                <option>NotebookLM</option>
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
                accept="image/*,.csv,text/csv"
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
        <details className="collection-identity" open={state.user.handle.startsWith("pending-")}>
          <summary>Public identity</summary>
          <p>A handle is needed only when you choose to share. It is not required to build your private collection.</p>
          <form onSubmit={event => { event.preventDefault(); void submitProfile(new FormData(event.currentTarget)); }} className="form-grid">
            <label>Handle<input name="handle" defaultValue={state.user.handle.startsWith("pending-") ? "" : state.user.handle} placeholder="your-handle" required /></label>
            <label>Display name<input name="displayName" defaultValue={state.user.displayName ?? clerkUser?.fullName ?? ""} required /></label>
            <label className="full">Short footer bio (optional)<textarea name="bio" defaultValue={state.user.bio} rows={2} /></label>
            <div className="action-row full"><button className="secondary-action" disabled={busy}>Save public identity</button></div>
          </form>
        </details>
        <fieldset>
          <legend>Cost visibility</legend>
          <p>Keep every cost private, show all costs, or choose on each card. Changes apply when you publish selected cards.</p>
          <div className="action-row">
            <button type="button" className="secondary-action" disabled={busy} onClick={() => setAllCostVisibility("PUBLIC")}>Show all costs</button>
            <button type="button" className="secondary-action" disabled={busy} onClick={() => setAllCostVisibility("PRIVATE")}>Keep all costs private</button>
          </div>
        </fieldset>
        <div className="review-grid">
          {state?.cards.map((card, index) => {
            if (!card.product) return null;
            const savedCard = { ...card, product: card.product };
            const priorEdit = reviewEdits[card.prop._id];
            const edit = priorEdit && isCurrentReview(savedCard, priorEdit) ? priorEdit : defaultReview(savedCard);
            const confirmed = isRelationshipConfirmed(card.prop);
            return (
              <fieldset className="review-card" key={card.prop._id} disabled={busy} aria-label={`${card.product.name} review`}>
                <h3>{card.product.name}</h3>
                <details>
                  <summary>Preview private card</summary>
                  <ProductCard index={index} relationshipConfirmed={confirmed} goTo={card.prop.goTo} card={{
                    product: card.product,
                    status: card.prop.status,
                    headline: card.prop.headline,
                    note: card.prop.note,
                    startedAt: card.prop.startedAt,
                    activity: card.prop.activity,
                    cost: card.prop.cost,
                    primaryLink: privateCardPrimaryLink({
                      product: card.product,
                      links: card.links,
                      associatedEvidence: card.associatedAccountEvidence ?? [],
                    }),
                  }} />
                </details>
                <details><summary>Product and evidence records</summary>
                  {state.brandEnrichmentAvailable && <ProductBrandControls propId={card.prop._id} />}
                  <ProductKnowledgePanel propId={card.prop._id} />
                  <PrivateEvidencePanel propId={card.prop._id} productName={card.product.name} productSlug={card.product.slug} disabled={busy}
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
                {card.prop.visibility === "PUBLIC" && <>
                  <p>Already public. Its approved version stays unchanged until you include saved edits or change these publication choices.</p>
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
                </details>
              </fieldset>
            );
          })}
        </div>
        <div className="action-row">
          <button
            className="primary-action"
            type="button"
            onClick={previewSharing}
            disabled={busy || state.user.handle.startsWith("pending-")}
          >
            Preview sharing
          </button>
          <span className="sharing-selection-count">{Object.keys(reviewEdits).length} card choice{Object.keys(reviewEdits).length === 1 ? "" : "s"} to review</span>
          {!state.user.handle.startsWith("pending-") && <a href={`/${state.user.handle}`} target="_blank" rel="noreferrer">Open current public page ↗</a>}
        </div>
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
