"use client";

// retry() fetches the page again; reset() would only re-render what failed.
export default function ProfileError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="system-message">
      <p className="eyebrow">PUBLIC RECORD / UNAVAILABLE</p>
      <h1>This page couldn’t be loaded.</h1>
      <p>No source records were exposed.</p>
      <button className="button" onClick={retry}>
        Try again
      </button>
    </main>
  );
}
