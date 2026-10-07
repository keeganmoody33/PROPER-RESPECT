import Link from "next/link";
import { UsageConnectionsClient } from "@/components/usage-connections-client";
export const metadata = { robots: { index: false, follow: false } };
export default function ConnectionsPage() {
  if (process.env.NEXT_PUBLIC_CONVEX_URL !== "https://utmost-mongoose-374.convex.cloud") return <main className="system-message"><h1>Development connection unavailable</h1><p>This connection requires the approved Convex development destination and its matching Clerk app.</p></main>;
  return <main className="system-message"><Link href="/app/collection">Back to collection</Link><UsageConnectionsClient /></main>;
}
