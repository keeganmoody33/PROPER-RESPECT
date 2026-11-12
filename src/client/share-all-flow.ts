export type SkipReason = "LINK_NEEDS_REVIEW" | "LINK_TOO_LONG";

export type ShareAllPreview<Profile> = Readonly<{
  profile: Profile;
  revision: number;
  previewHash: string;
  sharedCount: number;
  remainingCount: number;
  skipped: readonly { propId: string; productName: string; reason: SkipReason }[];
  refreshAccounts?: readonly { accountLabel: string }[];
}>;

export type ShareState<Profile> =
  | Readonly<{ step: "needsHandle" }>
  | Readonly<{ step: "ready" }>
  | Readonly<{ step: "previewing" }>
  | Readonly<{ step: "previewed"; preview: ShareAllPreview<Profile>; basis: string }>
  | Readonly<{ step: "publishing"; preview: ShareAllPreview<Profile>; basis: string }>
  | Readonly<{ step: "published"; sharedCount: number; remainingCount: number }>
  | Readonly<{ step: "error"; message: string }>;

export type ShareEvent<Profile> =
  | { type: "identity"; claimed: boolean }
  | { type: "preview" }
  | { type: "previewLoaded"; preview: ShareAllPreview<Profile>; basis: string }
  | { type: "publish" }
  | { type: "published" }
  | { type: "failed"; message: string };

export function initialShareState<Profile>(claimed: boolean): ShareState<Profile> {
  return claimed ? { step: "ready" } : { step: "needsHandle" };
}

type Transitions<Profile> = {
  [Step in ShareState<Profile>["step"]]: (state: Extract<ShareState<Profile>, { step: Step }>, event: ShareEvent<Profile>) => ShareState<Profile>;
};

function transitions<Profile>(): Transitions<Profile> {
  const unclaimed = (state: ShareState<Profile>, event: ShareEvent<Profile>) =>
    event.type === "identity" && !event.claimed ? { step: "needsHandle" as const } : state;
  return {
    needsHandle: (state, event) => event.type === "identity" && event.claimed ? { step: "ready" } : state,
    ready: (state, event) => event.type === "preview" ? { step: "previewing" } : unclaimed(state, event),
    previewing: (state, event) => {
      if (event.type === "previewLoaded") return { step: "previewed", preview: event.preview, basis: event.basis };
      if (event.type === "failed") return { step: "error", message: event.message };
      return state;
    },
    previewed: (state, event) => {
      if (event.type === "publish") return { step: "publishing", preview: state.preview, basis: state.basis };
      if (event.type === "preview") return { step: "previewing" };
      return unclaimed(state, event);
    },
    publishing: (state, event) => {
      if (event.type === "published") return { step: "published", sharedCount: state.preview.sharedCount, remainingCount: state.preview.remainingCount };
      if (event.type === "failed") return { step: "error", message: event.message };
      return state;
    },
    published: (state, event) => event.type === "preview" ? { step: "previewing" } : unclaimed(state, event),
    error: (state, event) => event.type === "preview" ? { step: "previewing" } : unclaimed(state, event),
  };
}

/** Events a step does not accept leave the state unchanged. */
export function shareFlow<Profile>(state: ShareState<Profile>, event: ShareEvent<Profile>): ShareState<Profile> {
  const step = transitions<Profile>()[state.step] as (state: ShareState<Profile>, event: ShareEvent<Profile>) => ShareState<Profile>;
  return step(state, event);
}

const SKIP_REASONS: Record<SkipReason, string> = {
  LINK_NEEDS_REVIEW: "its saved link is not a public web address. Fix the link in your collection.",
  LINK_TOO_LONG: "its saved link or link label is too long to publish. Shorten it in your collection.",
};

export function skipReasonText(reason: SkipReason) {
  return SKIP_REASONS[reason];
}

export function previewSummary(preview: Pick<ShareAllPreview<unknown>, "sharedCount" | "remainingCount" | "skipped">) {
  const parts = [`${preview.sharedCount} card${preview.sharedCount === 1 ? "" : "s"} will be shared.`];
  if (preview.remainingCount) parts.push(`${preview.remainingCount} more remain. Share them in another run after this one.`);
  if (preview.skipped.length) parts.push(`${preview.skipped.length} will stay private until you fix ${preview.skipped.length === 1 ? "it" : "them"}.`);
  return parts.join(" ");
}
