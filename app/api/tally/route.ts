import { NextResponse } from "next/server";
import { readTally } from "@/src/server/tally-store";

export const dynamic = "force-dynamic";

/** Public running totals for the footer tally. Cached at the edge for a minute. */
export async function GET() {
  try {
    const snapshot = await readTally();
    if (!snapshot) return NextResponse.json({ error: "tally unavailable" }, { status: 503 });
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ error: "tally unavailable" }, { status: 503 });
  }
}
