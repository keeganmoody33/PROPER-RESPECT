import { v, type Infer } from "convex/values";
import { z } from "zod";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { consumeWriteLimit, requireUser } from "./authHelpers";
import {
  intakeRelationship,
  normalizeProductName,
  normalizeWebsite,
  resolveTypedProduct,
  type IntakeOutcome,
  type ResolvedProduct,
} from "./manualProducts";
import { statusValidator } from "./validators";
import { relationshipEditSchema } from "../src/domain/inventory";
import { directoryEntry } from "../src/domain/product-directory";
import { sha256 } from "../src/domain/product-knowledge";

export const MAX_STACK_PICKS = 100;

/** A directory pick names a slug and nothing else: name, domain and website come from the directory. */
export const stackPickValidator = v.union(
  v.object({ kind: v.literal("directory"), slug: v.string(), status: statusValidator }),
  v.object({ kind: v.literal("typed"), name: v.string(), website: v.optional(v.string()), status: statusValidator }),
);
export type StackPick = Infer<typeof stackPickValidator>;

export type SaveSelectionItem = { propId: Id<"props">; productName: string; outcome: IntakeOutcome };
export type SaveSelectionResult = { items: SaveSelectionItem[]; created: number; confirmed: number; unchanged: number };

// Each pick leaves a manualProductIntakes row keyed `${operationId}:${productSlug}`. Its
// requestJson holds this receipt, so a retry can return the first result unchanged.
const receiptSchema = z.object({
  kind: z.literal("saveSelection"),
  requestHash: z.string(),
  index: z.number().int(),
  productName: z.string(),
  outcome: z.enum(["CREATED", "CONFIRMED_DRAFT", "UNCHANGED"]),
});
type Receipt = z.infer<typeof receiptSchema>;

function normalizePick(pick: StackPick): StackPick {
  if (pick.kind === "directory") return { kind: "directory", slug: pick.slug, status: pick.status };
  const website = normalizeWebsite(pick.website);
  return { kind: "typed", name: normalizeProductName(pick.name), ...(website ? { website } : {}), status: pick.status };
}

async function resolvePick(userId: Id<"users">, pick: StackPick): Promise<ResolvedProduct> {
  if (pick.kind === "typed") return resolveTypedProduct(userId, pick.name, pick.website);
  const entry = directoryEntry(pick.slug);
  if (!entry) throw new Error(`${pick.slug} is not in the directory. Search for it again.`);
  const { slug, name, domain, description, website } = entry;
  return { identity: { slug, name, domain, description }, primaryUrl: website, evidence: entry.evidence !== undefined };
}

function summarize(items: SaveSelectionItem[]): SaveSelectionResult {
  const count = (outcome: IntakeOutcome) => items.filter(item => item.outcome === outcome).length;
  return { items, created: count("CREATED"), confirmed: count("CONFIRMED_DRAFT"), unchanged: count("UNCHANGED") };
}

async function replay(ctx: MutationCtx, user: Doc<"users">, operationId: string, requestHash: string, pickCount: number) {
  // The operationId has no colon, so this range holds exactly this operation's receipts.
  const rows = await ctx.db.query("manualProductIntakes")
    .withIndex("by_user_operation", q => q.eq("userId", user._id).gte("operationId", `${operationId}:`).lt("operationId", `${operationId};`))
    .take(MAX_STACK_PICKS + 1);
  if (rows.length === 0) return null;
  const receipts = rows.map(row => ({ row, receipt: receiptSchema.safeParse(JSON.parse(row.requestJson)).data }));
  const matching = receipts.filter((entry): entry is { row: Doc<"manualProductIntakes">; receipt: Receipt } => entry.receipt?.requestHash === requestHash);
  if (matching.length !== rows.length || rows.length !== pickCount) throw new Error("This save was already used with different picks.");
  const items: SaveSelectionItem[] = [];
  for (const { row, receipt } of matching.sort((a, b) => a.receipt.index - b.receipt.index)) {
    const prop = await ctx.db.get(row.propId);
    if (!prop || prop.userId !== user._id) throw new Error("A previously saved relationship is unavailable.");
    items.push({ propId: prop._id, productName: receipt.productName, outcome: receipt.outcome });
  }
  return summarize(items);
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
    if (args.picks.length === 0) throw new Error("Pick at least one product to save.");
    if (args.picks.length > MAX_STACK_PICKS) throw new Error(`Save at most ${MAX_STACK_PICKS} products at a time.`);
    const picks = args.picks.map(normalizePick);
    const requestHash = await sha256(JSON.stringify(picks));
    const replayed = await replay(ctx, user, operationId, requestHash, picks.length);
    if (replayed) return replayed;

    const resolved: ResolvedProduct[] = [];
    const pickedNames = new Map<string, string>();
    for (const pick of picks) {
      const product = await resolvePick(user._id, pick);
      const earlier = pickedNames.get(product.identity.slug);
      if (earlier) throw new Error(`${earlier} is picked twice. Keep one.`);
      pickedNames.set(product.identity.slug, product.identity.name);
      resolved.push(product);
    }

    const now = new Date().toISOString();
    const items: SaveSelectionItem[] = [];
    for (const [index, pick] of picks.entries()) {
      const product = resolved[index]!;
      const itemOperationId = `${operationId}:${product.identity.slug}`;
      const edit = relationshipEditSchema.parse({ status: pick.status, goTo: false, headline: "", note: "" });
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
