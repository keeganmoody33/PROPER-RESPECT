"use client";

import {
  SignInButton,
  Show,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ActivityModule } from "@/src/domain/public-profile";

type ReviewEdit = {
  publish: boolean;
  status: "ACTIVE" | "TESTING" | "ARCHIVED";
  headline: string;
  note: string;
  startedAt: string;
  linkUrl: string;
  approveActivity: boolean;
  autoRefresh: boolean;
};

const METRIC_BY_PRODUCT: Record<string, string> = {
  github: "github.contributions",
  devin: "devin.sessions",
};

function snapshotActivity(
  vendor: string,
  primaryValue: number,
  secondaryValue: number,
): ActivityModule | undefined {
  if (!Number.isFinite(primaryValue)) return undefined;
  const capturedAt = new Date().toISOString();
  const common = {
    capturedAt,
    freshness: "FRESH" as const,
    provenanceLabel: `${vendor} uploaded evidence`,
  };
  if (vendor === "NotebookLM") {
    return {
      kind: "artifactCollection",
      attributionScope: "PERSONAL",
      ...common,
      total: primaryValue,
      artifacts: [],
    };
  }
  if (vendor === "Greptile") {
    return {
      kind: "reviewActivity",
      attributionScope: "ORGANIZATION",
      ...common,
      reviews: primaryValue,
      bugsCaught: Number.isFinite(secondaryValue) ? secondaryValue : 0,
      severity: [],
      points: [],
    };
  }
  if (vendor === "Windsurf" || vendor === "Devin Desktop") {
    return {
      kind: "codingActivity",
      attributionScope: "PERSONAL",
      ...common,
      primary: {
        label: vendor === "Windsurf" ? "Lines written" : "Desktop sessions",
        value: primaryValue,
      },
      supporting: Number.isFinite(secondaryValue)
        ? [
            {
              label:
                vendor === "Windsurf" ? "Conversations" : "Active days",
              value: secondaryValue,
            },
          ]
        : [],
    };
  }
  return {
    kind: "headlineMetrics",
    attributionScope: "PERSONAL",
    ...common,
    primary: {
      label: "Total words dictated",
      value: primaryValue,
      unit: "words",
    },
    supporting: Number.isFinite(secondaryValue)
      ? [{ label: "Average speed", value: secondaryValue, unit: "WPM" }]
      : [],
  };
}

function defaultReview(card: {
  prop: {
    status: "ACTIVE" | "TESTING" | "ARCHIVED";
    headline: string;
    note: string;
    startedAt?: string;
    activity?: unknown;
  };
  product: { domain: string };
  links: Array<{ isPrimary: boolean; url: string }>;
}): ReviewEdit {
  const primary = card.links.find((link) => link.isPrimary);
  return {
    publish: true,
    status: card.prop.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE",
    headline: card.prop.headline,
    note: card.prop.note,
    startedAt: card.prop.startedAt ?? "",
    linkUrl: primary?.url ?? `https://${card.product.domain}`,
    approveActivity: Boolean(card.prop.activity),
    autoRefresh: false,
  };
}

function Builder() {
  const { user: clerkUser } = useUser();
  const ensureAccount = useMutation(api.onboarding.ensureAccount);
  const claimHandle = useMutation(api.onboarding.claimHandle);
  const generateUploadUrl = useMutation(api.onboarding.generateUploadUrl);
  const retainUpload = useMutation(api.onboarding.retainUpload);
  const addManualProduct = useMutation(api.onboarding.addManualProduct);
  const publishSelected = useMutation(api.onboarding.publishSelected);
  const connectDevin = useAction(api.connectors.connectDevin);
  const state = useQuery(api.onboarding.getState);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewEdits, setReviewEdits] = useState<
    Record<string, ReviewEdit>
  >({});

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
    await run("Handle saved. Bring in your stack.", async () => {
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
    await run("Evidence retained privately and a draft was proposed.", async () => {
      const vendor = String(form.get("vendor"));
      const primaryMetric = String(form.get("primaryMetric")).trim();
      const secondaryMetric = String(form.get("secondaryMetric")).trim();
      const activity = snapshotActivity(
        vendor,
        primaryMetric ? Number(primaryMetric) : Number.NaN,
        secondaryMetric ? Number(secondaryMetric) : Number.NaN,
      );
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
        activity,
      });
    });
  }

  async function submitManualProduct(form: FormData) {
    await run("Manual product added as a private draft.", async () => {
      await addManualProduct({
        name: String(form.get("name")),
        slug: String(form.get("slug")),
        domain: String(form.get("domain")),
        description: String(form.get("description")),
        url: String(form.get("url")),
      });
    });
  }

  async function connectGithub() {
    await run("GitHub activity imported as a private draft.", async () => {
      const response = await fetch("/api/connect/github", { method: "POST" });
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
      [propId]: { ...fallback, ...current[propId], ...patch },
    }));
  }

  async function publish() {
    if (!state) return;
    await run("Profile published.", async () => {
      const selections = state.cards.flatMap((card) => {
        if (!card.product) return [];
        const edit =
          reviewEdits[card.prop._id] ?? defaultReview({
            ...card,
            product: card.product,
          });
        const provider =
          card.product.slug === "github"
            ? "GITHUB"
            : card.product.slug === "devin"
              ? "DEVIN"
              : null;
        const connector = state.connectors.find(
          (item) => item.provider === provider && item.status === "CONNECTED",
        );
        return [
          {
            propId: card.prop._id,
            publish: edit.publish,
            status: edit.status,
            headline: edit.headline,
            note: edit.note,
            startedAt: edit.startedAt || undefined,
            startedAtSource: edit.startedAt
              ? ("USER_CONFIRMED" as const)
              : undefined,
            primaryLink: {
              type: "CANONICAL" as const,
              url: edit.linkUrl,
              label: `Open ${card.product.name}`,
            },
            activity:
              edit.publish && edit.approveActivity
                ? card.prop.activity
                : undefined,
            autoRefresh: Boolean(
              edit.autoRefresh && connector && card.prop.activity,
            ),
            connectorId:
              edit.autoRefresh && connector ? connector._id : undefined,
            metricKey:
              edit.autoRefresh && connector
                ? METRIC_BY_PRODUCT[card.product.slug]
                : undefined,
          },
        ];
      });
      const result = await publishSelected({ selections });
      window.location.assign(`/${result.handle}`);
    });
  }

  return (
    <main className="onboarding-shell">
      <div className="onboarding-intro">
        <div>
          <p className="onboarding-kicker">PROPER—RESPECT / ACCOUNT BUILDER</p>
          <h1>Bring your whole stack.</h1>
        </div>
        <div>
          <UserButton />
        </div>
        <p>
          Connect what can refresh, upload what cannot, then approve one tight
          activity module per product.
        </p>
      </div>

      <section className="onboarding-panel">
        <p className="onboarding-kicker">01 / IDENTITY</p>
        <h2>Claim your public handle</h2>
        <p>Your name stays in metadata and the profile footer—not above the cards.</p>
        <form action={submitProfile} className="form-grid">
          <label>
            Handle
            <input
              name="handle"
              defaultValue={
                state?.user.handle.startsWith("pending-")
                  ? ""
                  : state?.user.handle
              }
              placeholder="your-handle"
              required
            />
          </label>
          <label>
            Display name
            <input
              name="displayName"
              defaultValue={state?.user.displayName ?? clerkUser?.fullName ?? ""}
              required
            />
          </label>
          <label className="full">
            Short footer bio
            <textarea name="bio" defaultValue={state?.user.bio} rows={3} />
          </label>
          <div className="action-row full">
            <button className="primary-action" disabled={busy}>
              Save identity
            </button>
          </div>
        </form>
      </section>

      <section className="onboarding-panel">
        <p className="onboarding-kicker">02 / BRING YOUR STACK</p>
        <h2>Connect, upload, or add</h2>
        <p>Every result remains private until the bulk review below.</p>
        <div className="connector-grid">
          <div className="connector-card">
            <strong>GitHub</strong>
            <p>Contribution calendar and authoritative account tenure.</p>
            <button
              className="secondary-action"
              type="button"
              onClick={connectGithub}
              disabled={busy}
            >
              Connect GitHub
            </button>
          </div>
          <form className="connector-card" action={submitDevin}>
            <strong>Devin</strong>
            <p>Optional organization-scoped sessions, searches, and PRs.</p>
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
            <p>The original is retained privately as provenance.</p>
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
            <label className="review-field">
              Primary metric
              <input
                name="primaryMetric"
                type="number"
                min="0"
                placeholder="Words, notebooks, sessions, lines, or reviews"
              />
            </label>
            <label className="review-field">
              Supporting metric
              <input
                name="secondaryMetric"
                type="number"
                min="0"
                placeholder="WPM, active days, conversations, or bugs"
              />
            </label>
            <button className="secondary-action" disabled={busy}>
              Upload privately
            </button>
          </form>
        </div>

        <form action={submitManualProduct} className="form-grid">
          <label>
            Product name
            <input name="name" required />
          </label>
          <label>
            Slug
            <input name="slug" placeholder="product-name" required />
          </label>
          <label>
            Domain
            <input name="domain" placeholder="product.com" required />
          </label>
          <label>
            Primary URL
            <input name="url" type="url" required />
          </label>
          <label className="full">
            Description
            <textarea name="description" rows={2} required />
          </label>
          <div className="action-row full">
            <button className="secondary-action" disabled={busy}>
              Add manual draft
            </button>
          </div>
        </form>
      </section>

      <section className="onboarding-panel">
        <p className="onboarding-kicker">03 / REVIEW ONCE</p>
        <h2>Approve the public cards</h2>
        <p>
          A new metric or broader attribution scope will always require another
          approval.
        </p>
        <div className="review-grid">
          {state?.cards.map((card) => {
            if (!card.product) return null;
            const edit =
              reviewEdits[card.prop._id] ?? defaultReview({
                ...card,
                product: card.product,
              });
            const canRefresh = card.product.slug in METRIC_BY_PRODUCT;
            return (
              <article className="review-card" key={card.prop._id}>
                <h3>{card.product.name}</h3>
                <label className="review-toggle">
                  <input
                    type="checkbox"
                    checked={edit.publish}
                    onChange={(event) =>
                      updateReview(card.prop._id, edit, {
                        publish: event.target.checked,
                      })
                    }
                  />
                  Publish this card
                </label>
                <label className="review-field">
                  Relationship
                  <select
                    value={edit.status}
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
                  Using since
                  <input
                    type="date"
                    value={edit.startedAt}
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
                {canRefresh && card.prop.activity && (
                  <label className="review-toggle">
                    <input
                      type="checkbox"
                      checked={edit.autoRefresh}
                      onChange={(event) =>
                        updateReview(card.prop._id, edit, {
                          autoRefresh: event.target.checked,
                        })
                      }
                    />
                    Refresh this exact metric daily
                  </label>
                )}
              </article>
            );
          })}
        </div>
        <div className="action-row">
          <button
            className="primary-action"
            type="button"
            onClick={publish}
            disabled={busy || !state || state.cards.length === 0}
          >
            Publish selected cards
          </button>
          <span>
            {state?.cards.length ?? 0} private draft
            {(state?.cards.length ?? 0) === 1 ? "" : "s"} ready
          </span>
        </div>
      </section>

      {message && <p className="message">{message}</p>}
    </main>
  );
}

export function OnboardingClient() {
  return (
    <Show
      when="signed-in"
      fallback={
        <main className="system-message">
          <p className="eyebrow">PROPER—RESPECT / SIGN UP</p>
          <h1>Your stack deserves receipts.</h1>
          <p>
            Sign in, connect what you use, and approve a public activity profile
            in one pass.
          </p>
          <SignInButton mode="modal">
            <button className="primary-action">Sign in or create account</button>
          </SignInButton>
        </main>
      }
    >
      <Builder />
    </Show>
  );
}
