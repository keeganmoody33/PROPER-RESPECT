import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export async function relationshipLinks(ctx: Pick<QueryCtx, "db">, propId: Id<"props">) {
  const [recent, primary] = await Promise.all([
    ctx.db.query("links").withIndex("by_prop", q => q.eq("propId", propId)).order("desc").take(25),
    ctx.db.query("links").withIndex("by_prop_primary", q => q.eq("propId", propId).eq("isPrimary", true)).order("desc").first(),
  ]);
  return primary ? [primary, ...recent.filter(link => link._id !== primary._id)].slice(0, 25) : recent;
}
