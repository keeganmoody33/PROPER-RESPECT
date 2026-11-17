import { v, type Infer } from "convex/values";
import { z } from "zod";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { consumeWriteLimit, requireUser } from "./authHelpers";
import {
  intakeRelationship,
  normalizeProductName,
  resolveTypedProduct,
  STACK_BATCH_RECEIPT_PREFIX,
  type IntakeOutcome,
  type ResolvedProduct,
} from "./manualProducts";
import { relationshipLevelValidator, statusValidator } from "./validators";
import { levelLabel, levelMatchesStatus } from "../src/domain/relationship-level";
import { isRelationshipConfirmed, RELATIONSHIP_EDIT_FALLBACK, relationshipEditSchema } from "../src/domain/inventory";
import { directoryEntry } from "../src/domain/product-directory";
import { sha256 } from "../src/domain/product-knowledge";
import { normalizeWebsite } from "../src/domain/typed-product";
import { parseOrUserError, userError } from "../src/domain/user-error";

export const MAX_STACK_PICKS = 100;

/**
 * A directory pick names a slug and nothing else: name, domain and website come from the directory.
 * A pick may carry the owner's level; its status must be the one the level implies.
 */
export const stackPickValidator = v.union(
  v.object({ kind: v.literal("directory"), slug: v.string(), status: statusValidator, level: v.optional(relationshipLevelValidator) }),
  v.object({ kind: v.literal("typed"), name: v.string(), website: v.optional(v.string()), status: statusValidator, level: v.optional(relationshipLevelValidator) }),
);
export type StackPick = Infer<typeof stackPickValidator>;

export type SaveSelectionItem = { propId: Id<"props">; productName: string; outcome: IntakeOutcome };
export type SaveSelectionResult = { items: SaveSelectionItem[]; created: number; confirmed: number; unchanged: number };

// Each pick leaves a manualProductIntakes row keyed `stack-batch:${operationId}:${productSlug}`.
// Its requestJson holds this receipt, so a retry can return the first result unchanged.
const receiptSchema = z.object({
  kind: z.literal("saveSelection"),
  requestHash: z.string(),
  index: z.number().int(),
  productName: z.string(),
  outcome: z.enum(["CREATED", "CONFIRMED_DRAFT", "UNCHANGED"]),
});
type Receipt = z.infer<typeof receiptSchema>;

function normalizePick(pick: StackPick): StackPick {
  // A status-only pick hashes as it always did, so earlier receipts still replay.
  const level = pick.level ? { level: pick.level } : {};
  if (pick.kind === "directory") return { kind: "directory", slug: pick.slug, status: pick.status, ...level };
  const website = normalizeWebsite(pick.website);
  return { kind: "typed", name: normalizeProductName(pick.name), ...(website ? { website } : {}), status: pick.status, ...level };
}

async function resolvePick(userId: Id<"users">, pick: StackPick): Promise<ResolvedProduct> {
  if (pick.kind === "typed") return resolveTypedProduct(userId, pick.name, pick.website);
  const entry = directoryEntry(pick.slug);
  if (!entry) throw userError(`${pick.slug} is not in the directory. Search for it again.`);
  const { slug, name, domain, description, website } = entry;
  return { identity: { slug, name, domain, description }, primaryUrl: website, evidence: entry.evidence !== undefined };
}

function summarize(items: SaveSelectionItem[]): SaveSelectionResult {
  const count = (outcome: IntakeOutcome) => items.filter(item => item.outcome === outcome).length;
  return { items, created: count("CREATED"), confirmed: count("CONFIRMED_DRAFT"), unchanged: count("UNCHANGED") };
}

const itemReceiptPrefix = (operationId: string) => `${STACK_BATCH_RECEIPT_PREFIX}${operationId}:`;

async function replay(ctx: MutationCtx, user: Doc<"users">, operationId: string, requestHash: string, pickCount: number) {
  // The operationId has no colon, so this range holds exactly this operation's receipts.
  const rows = await ctx.db.query("manualProductIntakes")
    .withIndex("by_user_operation", q => q.eq("userId", user._id)
      .gte("operationId", itemReceiptPrefix(operationId)).lt("operationId", `${STACK_BATCH_RECEIPT_PREFIX}${operationId};`))
    .take(MAX_STACK_PICKS + 1);
  if (rows.length === 0) return null;
  const receipts = rows.map(row => ({ row, receipt: receiptSchema.safeParse(JSON.parse(row.requestJson)).data }));
  const matching = receipts.filter((entry): entry is { row: Doc<"manualProductIntakes">; receipt: Receipt } => entry.receipt?.requestHash === requestHash);
  if (matching.length !== rows.length || rows.length !== pickCount) throw userError("This save was already used with different picks.");
  const items: SaveSelectionItem[] = [];
  for (const { row, receipt } of matching.sort((a, b) => a.receipt.index - b.receipt.index)) {
    const prop = await ctx.db.get(row.propId);
    if (!prop || prop.userId !== user._id) throw userError("A previously saved relationship is unavailable.");
    items.push({ propId: prop._id, productName: receipt.productName, outcome: receipt.outcome });
  }
  return summarize(items);
}

// A draft the owner didn't add (a discovery, a connection or an upload) carries words the system wrote, such as
// "GitHub may be in your stack." Confirming keeps a draft's headline and note, so they're cleared first: the owner
// writes the card's line, and share-all skips a card until they do. intakeRelationship confirms the same first row.
async function clearSystemWords(ctx: MutationCtx, userId: Id<"users">, slug: string) {
  const product = await ctx.db.query("products").withIndex("by_slug", q => q.eq("slug", slug)).unique();
  if (!product) return;
  const draft = await ctx.db.query("props").withIndex("by_user_product", q => q.eq("userId", userId).eq("productId", product._id)).first();
  if (!draft || isRelationshipConfirmed(draft) || draft.ownerEntered || (!draft.headline && !draft.note)) return;
  await ctx.db.patch(draft._id, { headline: "", note: "" });
}

/**
 * Saves every pick privately in one transaction, or none of them. Never publishes.
 * Only relationships it creates spend the hourly saveStack allowance.
 */
export const saveSelection = mutation({
  args: { operationId: v.string(), picks: v.array(stackPickValidator) },
  returns: v.object({
    items: v.array(v.object({
      propId: v.id("props"),
      productName: v.string(),
      outcome: v.union(v.literal("CREATED"), v.literal("CONFIRMED_DRAFT"), v.literal("UNCHANGED")),
    })),
    created: v.number(),
    confirmed: v.number(),
    unchanged: v.number(),
  }),
  handler: async (ctx, args): Promise<SaveSelectionResult> => {
    const user = await requireUser(ctx);
    const operationId = args.operationId.trim();
    if (!operationId || operationId.length > 128 || operationId.includes(":")) throw new Error("Invalid save operation.");
    if (args.picks.length === 0) throw userError("Pick at least one product to save.");
    if (args.picks.length > MAX_STACK_PICKS) throw userError(`Save at most ${MAX_STACK_PICKS} products at a time.`);
    const picks = args.picks.map(normalizePick);
    const mismatched = picks.find(pick => !levelMatchesStatus(pick.level, pick.status));
    if (mismatched?.level) throw userError(`The level ${levelLabel(mismatched.level)} does not match its status. Choose the level again.`);
    const requestHash = await sha256(JSON.stringify(picks));
    const replayed = await replay(ctx, user, operationId, requestHash, picks.length);
    if (replayed) return replayed;

    const resolved: ResolvedProduct[] = [];
    const pickedNames = new Map<string, string>();
    for (const pick of picks) {
      const product = await resolvePick(user._id, pick);
      const earlier = pickedNames.get(product.identity.slug);
      if (earlier) throw userError(`${earlier} is picked twice. Keep one.`);
      pickedNames.set(product.identity.slug, product.identity.name);
      resolved.push(product);
    }

    const now = new Date().toISOString();
    const items: SaveSelectionItem[] = [];
    for (const [index, pick] of picks.entries()) {
      const product = resolved[index]!;
      await clearSystemWords(ctx, user._id, product.identity.slug);
      const itemOperationId = `${itemReceiptPrefix(operationId)}${product.identity.slug}`;
      const edit = parseOrUserError(relationshipEditSchema, { status: pick.status, ...(pick.level ? { level: pick.level } : {}), goTo: false, headline: "", note: "" }, RELATIONSHIP_EDIT_FALLBACK);
      const { propId, product: saved, outcome } = await intakeRelationship(ctx, user, {
        resolved: product, edit, note: "", confirmDraft: true,
        operationId: itemOperationId, requestJson: JSON.stringify(pick), now,
      });
      const receipt: Receipt = { kind: "saveSelection", requestHash, index, productName: saved.name, outcome };
      await ctx.db.insert("manualProductIntakes", {
        userId: user._id, operationId: itemOperationId, requestJson: JSON.stringify(receipt), propId, createdAt: now,
      });
      items.push({ propId, productName: saved.name, outcome });
    }
    const result = summarize(items);
    // Charged after the writes: a refusal throws, and the whole transaction rolls back.
    if (result.created > 0) await consumeWriteLimit(ctx, user._id, "saveStack", result.created);
    return result;
  },
});
