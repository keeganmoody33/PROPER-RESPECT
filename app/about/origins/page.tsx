import type { Metadata } from "next";
import Link from "next/link";
import { publicSiteOrigin } from "@/src/server/public-site";

export function generateMetadata(): Metadata {
  return {
    title: "Origins",
    description: "The story behind Proper Respect. Coming soon.",
    alternates: { canonical: new URL("/about/origins", publicSiteOrigin()).href },
    robots: { index: false, follow: true },
  };
}

export default function OriginsPage() {
  return <main className="origins-shell">
    <p className="eyebrow">Origins / Lineage</p>
    <h1>Where it<br />comes from.</h1>
    <p>The story behind Proper Respect belongs here. Coming soon.</p>
    <Link href="/">Back to Proper Respect →</Link>
  </main>;
}
