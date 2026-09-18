import Link from "next/link";

export default function HomePage() {
  return (
    <main className="system-message">
      <p className="eyebrow">PROPER—RESPECT / YOUR COLLECTION</p>
      <h1>Your tools. Your track record.</h1>
      <p>
        What you use, what you are testing, and the tools you come back to.
        Keep the history and context privately, then choose what to share.
      </p>
      <Link className="text-link" href="/onboarding">
        Open your collection →
      </Link>
      <Link className="text-link" href="/keegan">
        View Keegan’s shared collection →
      </Link>
    </main>
  );
}
