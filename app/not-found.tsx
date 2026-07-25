import Link from "next/link";

export default function NotFound() {
  return (
    <main className="system-message">
      <p className="eyebrow">404 / NO PUBLIC RECORD</p>
      <h1>Nothing is published here.</h1>
      <p>The handle may not exist, or its records may still be private.</p>
      <Link className="text-link" href="/">
        Return home →
      </Link>
    </main>
  );
}
