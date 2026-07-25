import Link from "next/link";

export default function HomePage() {
  return (
    <main className="system-message">
      <p className="eyebrow">PROPER—RESPECT / PUBLIC RECORD</p>
      <h1>Product usage deserves attribution.</h1>
      <p>Start with the first published profile.</p>
      <Link className="text-link" href="/keegan">
        Open Keegan’s stack →
      </Link>
    </main>
  );
}
