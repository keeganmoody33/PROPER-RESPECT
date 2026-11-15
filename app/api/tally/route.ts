import { NextResponse } from "next/server";
import { readTally, tallyStoreConfigured } from "@/src/server/tally-store";

export const dynamic = "force-dynamic";

/** Public running totals for the footer tally. Cached at the edge for a minute. */
export async function GET() {
  // No store here is not a failure: there is simply no tally to show, so the footer hides it without an error in the console.
  if (!tallyStoreConfigured()) return new NextResponse(null, { status: 204 });
  try {
    const snapshot = await readTally();
    if (!snapshot) return NextResponse.json({ error: "tally unavailable" }, { status: 503 });
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ error: "tally unavailable" }, { status: 503 });
  }
}
