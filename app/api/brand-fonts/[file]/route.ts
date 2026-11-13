import { serveBrandFont } from "@/src/server/brand-font-route";

/** A product's own typeface for its card, served from this site because the provider's host allows no other origin. */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  return serveBrandFont((await params).file);
}
