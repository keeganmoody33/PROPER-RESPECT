import { serveBrandImage } from "@/src/server/brand-image-route";

/** A product's logo for its card, served from this site so a visitor's browser never asks the provider for it. */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  return serveBrandImage((await params).file);
}
