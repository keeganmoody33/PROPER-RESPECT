"use client";

export default function ProfileError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="system-message">
      <p className="eyebrow">PUBLIC RECORD / UNAVAILABLE</p>
      <h1>This profile couldn’t be loaded.</h1>
      <p>No source records were exposed.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
