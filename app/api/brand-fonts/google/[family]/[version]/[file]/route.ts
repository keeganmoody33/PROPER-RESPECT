import { serveGoogleFont } from "@/src/server/brand-font-route";

/** A product's Google-hosted typeface for its card, served from this site so a visitor's browser never asks Google for it. */
export async function GET(_request: Request, { params }: { params: Promise<{ family: string; version: string; file: string }> }) {
  const { family, version, file } = await params;
  return serveGoogleFont(family, version, file);
}
