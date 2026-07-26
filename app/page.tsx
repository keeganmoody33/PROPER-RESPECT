import Link from "next/link";

export default function HomePage() {
  return (
    <main className="system-message">
      <p className="eyebrow">PROPER—RESPECT / PUBLIC RECORD</p>
      <h1>Product usage deserves attribution.</h1>
      <p>
        Connect your tools, approve the activity that belongs in public, and
        publish one tight account of what you actually use.
      </p>
      <Link className="text-link" href="/keegan">
        Open Keegan’s stack →
      </Link>
      <Link className="text-link" href="/onboarding">
        Build your profile →
      </Link>
    </main>
  );
}
