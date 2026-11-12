import { v, type ObjectType } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { consumeWriteLimit, requireUser } from "./authHelpers";
import { registerProductSources } from "./productKnowledge";
import { ensureProductBrand } from "./productBrands";
import { extractDomain, type ProductIdentity } from "../src/domain/discovery";
import { sha256 } from "../src/domain/product-knowledge";
import { isHttpUrl } from "../src/domain/http-url";
import { normalizeWebsite, resolveTypedCatalogProduct } from "../src/domain/typed-product";
import { isRelationshipConfirmed, relationshipEditSchema, type RelationshipEdit } from "../src/domain/inventory";
import { approvePendingDraftImports, relationshipState } from "./inventory";
import { statusValidator } from "./validators";

export const addManualProductArgs = {
  name: v.string(),
  website: v.optional(v.string()),
  description: v.optional(v.string()),
  operationId: v.optional(v.string()),
  status: v.optional(statusValidator),
  // Older callers may still send these fields. Identity is resolved here, never
  // selected by a caller's global slug or unverified logo.
  slug: v.optional(v.string()),
  domain: v.optional(v.string()),
  url: v.optional(v.string()),
  logoUrl: v.optional(v.string()),
};
type ManualProductArgs = ObjectType<typeof addManualProductArgs>;

/** Batch stack saves key their per-item receipts under this prefix; a single add may not use it. */
export const STACK_BATCH_RECEIPT_PREFIX = "stack-batch:";

export function normalizeProductName(input: string): string {
  const name = input.trim().replace(/\s+/g, " ");
  if (!name || name.length > 160) throw new Error("Enter a product name of 160 characters or fewer.");
  return name;
}

export type ResolvedProduct = Readonly<{
  identity: ProductIdentity;
  primaryUrl?: string;
  /** Evidence-tier identities register official sources and request brand artwork when first added. */
  evidence: boolean;
}>;

/** Today's free-text rules: a catalog name or website, otherwise the owner's own manual- identity. */
export async function resolveTypedProduct(userId: Id<"users">, name: string, website: string | undefined): Promise<ResolvedProduct> {
  const catalog = resolveTypedCatalogProduct(name, website);
  if (catalog) return { identity: catalog.product, primaryUrl: catalog.canonicalUrl, evidence: true };
  const domain = website ? extractDomain(website)! : "";
  const identityHash = await sha256(JSON.stringify([userId, name.toLowerCase(), domain]));
  const namePrefix = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 8).replace(/-$/g, "") || "product";
  return {
    identity: {
      name,
      slug: `manual-${namePrefix}-${identityHash.slice(0, 22)}`,
      domain,
      // Personal explanations never enter shared presentation metadata.
      description: "",
    },
    primaryUrl: website,
    evidence: false,
  };
}

export type IntakeOutcome = "CREATED" | "CONFIRMED_DRAFT" | "UNCHANGED";

/**
 * The one writer that turns a resolved product into the owner's relationship. It never publishes.
 * An existing confirmed relationship is never changed. An existing unconfirmed draft is confirmed
 * with the edit's status only when confirmDraft is set, the way inventory.save confirms.
 */
export async function intakeRelationship(ctx: MutationCtx, user: Doc<"users">, input: {
  resolved: ResolvedProduct;
  edit: RelationshipEdit | undefined;
  note: string;
  confirmDraft: boolean;
  operationId: string;
  requestJson: string;
  now: string;
}): Promise<{ propId: Id<"props">; product: Doc<"products">; outcome: IntakeOutcome }> {
  const { resolved: { identity, primaryUrl, evidence }, edit, note, confirmDraft, operationId, requestJson, now } = input;
  let product = await ctx.db.query("products").withIndex("by_slug", q => q.eq("slug", identity.slug)).unique();
  if (product && (product.domain !== identity.domain || product.name.toLowerCase() !== identity.name.toLowerCase())) {
    throw new Error("The stored product identity conflicts with this product. It needs review before adding.");
  }
  if (!product) {
    const productId = await ctx.db.insert("products", identity);
    product = (await ctx.db.get(productId)) as Doc<"products">;
  }
  const existing = await ctx.db.query("props").withIndex("by_user_product", q => q.eq("userId", user._id).eq("productId", product._id)).first();
  if (existing) {
    if (!confirmDraft || !edit || isRelationshipConfirmed(existing)) return { propId: existing._id, product, outcome: "UNCHANGED" };
    const before = relationshipState(existing);
    const version = (existing.relationshipVersion ?? 0) + 1;
    await ctx.db.insert("relationshipEvents", {
      userId: user._id, propId: existing._id, operationId, requestJson, version,
      recordedAt: now, basis: "OWNER_ASSERTED", before, after: { ...before, status: edit.status, confirmed: true },
    });
    await ctx.db.patch(existing._id, { status: edit.status, relationshipVersion: version, confirmedAt: now, visibility: "PRIVATE" });
    await approvePendingDraftImports(ctx, existing, product);
    return { propId: existing._id, product, outcome: "CONFIRMED_DRAFT" };
  }

  const propId = await ctx.db.insert("props", {
    userId: user._id, productId: product._id, status: edit?.status ?? "TESTING", visibility: edit ? "PRIVATE" : "DRAFT",
    headline: "", note, ownerEntered: true,
    ...(edit ? { goTo: false, confirmedAt: now, relationshipVersion: 1 } : {}),
  });
  if (edit) await ctx.db.insert("relationshipEvents", {
    userId: user._id, propId, operationId, requestJson, version: 1,
    recordedAt: now, basis: "OWNER_ASSERTED",
    before: { status: "TESTING", goTo: false, confirmed: false, headline: "", note },
    after: { ...edit, confirmed: true },
  });
  if (primaryUrl) {
    if (!isHttpUrl(primaryUrl)) throw new Error("Use a public HTTP or HTTPS product website, or leave it blank.");
    await ctx.db.insert("links", {
      propId, type: "CANONICAL", url: primaryUrl, label: `Open ${product.name}`, isPrimary: true,
    });
  }
  await ctx.db.insert("draftImports", {
    userId: user._id, status: edit ? "APPROVED" : "PENDING", suggestedProductSlug: product.slug,
    suggestedProductName: product.name, suggestedDomain: product.domain,
    suggestedDescription: product.description, suggestedUrl: primaryUrl ?? "",
    rawEvidenceIds: [], resultPropId: propId,
  });
  // Adding a private draft must not reset an already published account's state.
  if (user.onboardingStatus !== "PUBLISHED") await ctx.db.patch(user._id, { onboardingStatus: "REVIEW", updatedAt: now });
  if (evidence) {
    await registerProductSources(ctx, product);
    await ensureProductBrand(ctx, product);
  }
  return { propId, product, outcome: "CREATED" };
}

export async function addManualProductHandler(ctx: MutationCtx, args: ManualProductArgs) {
  const user = await requireUser(ctx);
  const name = normalizeProductName(args.name);
  const note = (args.description ?? "").trim();
  if (note.length > 4000) throw new Error("Keep your explanation to 4,000 characters or fewer.");
  const website = normalizeWebsite(args.website ?? args.url ?? args.domain);
  const edit = args.status === undefined ? undefined : relationshipEditSchema.parse({ status: args.status, goTo: false, headline: "", note });
  const requestJson = edit
    ? JSON.stringify({ version: 2, name, website: website ?? null, note, status: edit.status })
    : JSON.stringify({ version: 1, name, website: website ?? null, note });
  const operationId = args.operationId === undefined ? `legacy:${await sha256(requestJson)}` : args.operationId.trim();
  if (!operationId || operationId.length > 128 || operationId.startsWith(STACK_BATCH_RECEIPT_PREFIX)) throw new Error("Invalid add-product operation.");
  const previous = await ctx.db.query("manualProductIntakes")
    .withIndex("by_user_operation", q => q.eq("userId", user._id).eq("operationId", operationId)).unique();
  if (previous) {
    if (previous.requestJson !== requestJson) throw new Error("This add-product operation was already used with different details.");
    const prop = await ctx.db.get(previous.propId);
    if (!prop || prop.userId !== user._id) throw new Error("The previously added relationship is unavailable.");
    return prop._id;
  }

  // A committed receipt is a read-only replay, even when the allowance is used.
  await consumeWriteLimit(ctx, user._id, "addManualProduct");
  const resolved = await resolveTypedProduct(user._id, name, website);
  const now = new Date().toISOString();
  const { propId } = await intakeRelationship(ctx, user, { resolved, edit, note, confirmDraft: false, operationId, requestJson, now });
  await ctx.db.insert("manualProductIntakes", { userId: user._id, operationId, requestJson, propId, createdAt: now });
  return propId;
}
